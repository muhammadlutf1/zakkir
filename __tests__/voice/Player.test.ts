import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { AudioPlayerStatus, VoiceConnectionStatus } from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";
import { Player } from "../../src/voice/Player";
import type { Recitation } from "../../src/voice/Recitation";
import type {
	VoicePort,
	VoicePortEventName,
	VoicePortEventPayload,
	VoicePortEvents,
} from "../../src/voice/VoicePort";

class FakeVoicePort implements VoicePort {
	readonly calls: string[] = [];

	private listeners: {
		[K in VoicePortEventName]: Set<VoicePortEvents[K]>;
	} = {
		stateChange: new Set(),
		playerStateChange: new Set(),
		streamError: new Set(),
		error: new Set(),
	};

	async join(channel: VoiceChannel) {
		this.calls.push(`join:${channel.id}`);
	}

	leave() {
		this.calls.push("leave");
	}

	play(url: string) {
		this.calls.push(`play:${url}`);
	}

	stop() {
		this.calls.push("stop");
	}

	pause() {
		this.calls.push("pause");
	}

	unpause() {
		this.calls.push("unpause");
	}

	destroy() {
		this.calls.push("destroy");
	}

	on<K extends VoicePortEventName>(event: K, listener: VoicePortEvents[K]) {
		this.listeners[event].add(listener);
	}

	off<K extends VoicePortEventName>(event: K, listener: VoicePortEvents[K]) {
		this.listeners[event].delete(listener);
	}

	emit<K extends VoicePortEventName>(
		event: K,
		payload: VoicePortEventPayload<K>,
	) {
		for (const listener of this.listeners[event]) {
			(listener as (payload: VoicePortEventPayload<K>) => void)(payload);
		}
	}
}

const channel = { id: "voice-1", guildId: "guild-1" } as VoiceChannel;

function flush() {
	return new Promise<void>((resolve) => setImmediate(resolve));
}

function recitation(overrides: Partial<Recitation> = {}): Recitation {
	return {
		surah: { number: 18, name: "الكهف" },
		reciterId: 1,
		reciterName: "إبراهيم الأخضر",
		rewayahId: 1,
		rewayahName: "حفص عن عاصم",
		url: "https://example.com/018.mp3",
		...overrides,
	};
}

function notices(player: Player) {
	const messages: string[] = [];
	player.onNotice((message) => messages.push(message));
	return messages;
}

describe("Player", () => {
	it("is bound to its guild id", () => {
		const player = new Player("guild-1", new FakeVoicePort());

		assert.equal(player.guildId, "guild-1");
		assert.equal(player.isConnected, false);
	});

	describe("connection", () => {
		it("join delegates to the VoicePort and reflects the ready state", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port);

			await player.join(channel);

			assert.deepEqual(port.calls, ["join:voice-1"]);
			assert.equal(player.isConnected, false);

			port.emit("stateChange", VoiceConnectionStatus.Ready);
			assert.equal(player.isConnected, true);

			port.emit("stateChange", VoiceConnectionStatus.Disconnected);
			assert.equal(player.isConnected, false);
		});

		it("leave delegates to the VoicePort", () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port);

			player.leave();

			assert.deepEqual(port.calls, ["leave"]);
		});

		it("dispose leaves and destroys the VoicePort", () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port);

			player.dispose();

			assert.deepEqual(port.calls, ["leave", "destroy"]);
		});
	});

	describe("playing", () => {
		it("adds the Recitation to the Queue and feeds the URL after a successful probe", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, { probeStream: async () => true });

			const result = await player.play(recitation());

			assert.equal(result.started, true);
			assert.equal(player.isPlaying, true);
			assert.deepEqual(port.calls, ["play:https://example.com/018.mp3"]);
			assert.equal(player.queueView.current?.surah.number, 18);
		});

		it("appends to the Queue without interrupting while playing", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, { probeStream: async () => true });

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			const result = await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);

			assert.equal(result.started, false);
			assert.equal(result.queued, true);
			assert.deepEqual(port.calls, ["play:https://example.com/018.mp3"]);
			assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
			assert.equal(player.queueView.upcoming.length, 1);
		});
	});

	describe("failure handling", () => {
		it("skips an unreachable stream (404/5xx) with a notice and no playback", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, { probeStream: async () => false });
			const messages = notices(player);

			const result = await player.play(recitation());

			assert.equal(result.started, false);
			assert.equal(player.isPlaying, false);
			assert.deepEqual(port.calls, []);
			assert.deepEqual(messages, [
				"Couldn't play الكهف by إبراهيم الأخضر (حفص عن عاصم) — the stream is unreachable.",
			]);
		});

		it("advances to the next reachable Recitation when the first is unreachable", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async (url) => url.includes("019"),
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			const result = await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);

			assert.equal(result.started, true);
			assert.equal(player.isPlaying, true);
			assert.deepEqual(port.calls, ["play:https://example.com/019.mp3"]);
			assert.equal(player.queueView.current?.url, "https://example.com/019.mp3");
		});

		it("retries once on a recoverable mid-play failure, then continues to the next Recitation", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, { probeStream: async () => true });
			const messages = notices(player);

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);

			port.emit("streamError", new Error("cut"));
			port.emit("streamError", new Error("cut again"));
			await flush();

			assert.equal(player.isPlaying, true);
			assert.equal(player.queueView.current?.url, "https://example.com/019.mp3");
			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"play:https://example.com/018.mp3",
				"play:https://example.com/019.mp3",
			]);
			assert.deepEqual(messages, [
				"Playback of الكهف by إبراهيم الأخضر (حفص عن عاصم) failed.",
			]);
		});

		it("retries then gives up cleanly on a recoverable failure on the only Recitation", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, { probeStream: async () => true });
			const messages = notices(player);

			await player.play(recitation());

			port.emit("streamError", new Error("cut"));
			port.emit("streamError", new Error("cut again"));
			await flush();

			assert.equal(player.isPlaying, false);
			assert.deepEqual(port.calls, ["play:https://example.com/018.mp3", "play:https://example.com/018.mp3"]);
			assert.deepEqual(messages, [
				"Playback of الكهف by إبراهيم الأخضر (حفص عن عاصم) failed.",
			]);
		});

		it("does not crash on stream errors with nothing playing", () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, { probeStream: async () => true });

			assert.doesNotThrow(() => port.emit("streamError", new Error("late")));
			assert.doesNotThrow(() => port.emit("error", new Error("connection")));
			assert.equal(player.isPlaying, false);
		});

		it("catches voice errors emitted by the port so they do not escape", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port);

			await player.join(channel);

			assert.doesNotThrow(() => port.emit("error", new Error("boom")));
		});
	});

	describe("stopping and natural end", () => {
		it("stop clears the active Recitation so a later play restarts", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, { probeStream: async () => true });

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			player.stop();
			assert.equal(player.isPlaying, false);

			await player.play(recitation({ url: "https://example.com/019.mp3" }));

			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"stop",
				"play:https://example.com/019.mp3",
			]);
			assert.equal(player.queueView.current?.url, "https://example.com/019.mp3");
		});

		it("a natural end advances to the next queued Recitation", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, { probeStream: async () => true });

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);
			port.emit("playerStateChange", AudioPlayerStatus.Idle);
			await flush();

			assert.equal(player.isPlaying, true);
			assert.equal(player.queueView.current?.url, "https://example.com/019.mp3");
			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"play:https://example.com/019.mp3",
			]);

			port.emit("playerStateChange", AudioPlayerStatus.Idle);
			await flush();

			assert.equal(player.isPlaying, false);
			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"play:https://example.com/019.mp3",
			]);
		});
	});

	describe("the default probe", () => {
		let probeServer: Server;
		let probeBaseUrl: string;

		before(async () => {
			probeServer = createServer((req, res) => {
				const status = Number(req.url?.split("/")[1]);
				res.statusCode = Number.isInteger(status) ? status : 200;
				res.end();
			});

			await new Promise<void>((resolve) => {
				probeServer.listen(0, "127.0.0.1", resolve);
			});

			const address = probeServer.address();
			probeBaseUrl = `http://127.0.0.1:${(address as { port: number }).port}`;
		});

		after(() => {
			probeServer.close();
		});

		it("accepts a 2xx stream", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port);

			await player.play(recitation({ url: `${probeBaseUrl}/200/018.mp3` }));

			assert.equal(player.isPlaying, true);
			assert.deepEqual(port.calls, [`play:${probeBaseUrl}/200/018.mp3`]);
		});

		it("rejects 404 and 5xx streams", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port);
			const messages = notices(player);

			await player.play(recitation({ url: `${probeBaseUrl}/404/018.mp3` }));
			await player.play(recitation({ url: `${probeBaseUrl}/500/018.mp3` }));

			assert.equal(player.isPlaying, false);
			assert.deepEqual(port.calls, []);
			assert.equal(messages.length, 2);
		});

		it("rejects an unreachable stream", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port);

			await player.play(recitation({ url: "http://127.0.0.1:1/018.mp3" }));

			assert.equal(player.isPlaying, false);
			assert.deepEqual(port.calls, []);
		});
	});
});
