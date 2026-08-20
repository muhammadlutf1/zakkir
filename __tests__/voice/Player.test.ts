import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { AudioPlayerStatus, VoiceConnectionStatus } from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";
import { playbackNotices } from "../../src/play/playbackNotices";
import { Player } from "../../src/voice/Player";
import { RepeatMode } from "../../src/voice/Queue";
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

		it("endSession disconnects, clears the Queue, and notifies the owner", async () => {
			const port = new FakeVoicePort();
			const ended: string[] = [];
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
				onSessionEnd: (guildId) => ended.push(guildId),
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);

			player.endSession();

			assert.equal(player.isPlaying, false);
			assert.equal(player.isConnected, false);
			assert.equal(player.queueView.current, undefined);
			assert.equal(player.queueView.upcoming.length, 0);
			assert.deepEqual(ended, ["guild-1"]);
			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"leave",
				"destroy",
			]);
		});

		it("leaves without an onSessionEnd hook when constructed bare", () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port);

			assert.doesNotThrow(() => player.endSession());
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
			const player = new Player("guild-1", port, {
				probeStream: async () => false,
				notices: playbackNotices("en"),
			});
			const messages = notices(player);

			const result = await player.play(recitation());

			assert.equal(result.started, false);
			assert.equal(player.isPlaying, false);
			assert.deepEqual(port.calls, []);
			assert.deepEqual(messages, [
				"<:error:1385171040098979961> Couldn't play الكهف by إبراهيم الأخضر (حفص عن عاصم) — the stream is unreachable.",
			]);
		});

		it("renders notices in the guild's locale via the injected formatter", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => false,
				notices: playbackNotices("en"),
			});
			const messages = notices(player);

			await player.play(recitation());

			player.setNotices(playbackNotices("ar"));
			await player.play(recitation());

			assert.deepEqual(messages, [
				"<:error:1385171040098979961> Couldn't play الكهف by إبراهيم الأخضر (حفص عن عاصم) — the stream is unreachable.",
				"<:error:1385171040098979961> تعذّر تشغيل الكهف بصوت إبراهيم الأخضر (حفص عن عاصم) — البث غير متاح.",
			]);
		});

		it("advances to the next reachable Recitation when the first is unreachable", async () => {			const port = new FakeVoicePort();
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
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
				notices: playbackNotices("en"),
			});
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
				"<:error:1385171040098979961> Playback of الكهف by إبراهيم الأخضر (حفص عن عاصم) failed.",
			]);
		});

		it("retries then gives up cleanly on a recoverable failure on the only Recitation", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
				notices: playbackNotices("en"),
			});
			const messages = notices(player);

			await player.play(recitation());

			port.emit("streamError", new Error("cut"));
			port.emit("streamError", new Error("cut again"));
			await flush();

			assert.equal(player.isPlaying, false);
			assert.deepEqual(port.calls, ["play:https://example.com/018.mp3", "play:https://example.com/018.mp3"]);
			assert.deepEqual(messages, [
				"<:error:1385171040098979961> Playback of الكهف by إبراهيم الأخضر (حفص عن عاصم) failed.",
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

	describe("RepeatMode", () => {
		it("defaults to OFF and exposes the mode", () => {
			const player = new Player("guild-1", new FakeVoicePort());

			assert.equal(player.repeatMode, "off");
			assert.equal(player.queueView.repeatMode, "off");
		});

		it("setRepeatMode selects the Queue's mode", () => {
			const player = new Player("guild-1", new FakeVoicePort());

			player.setRepeatMode(RepeatMode.TRACK);
			assert.equal(player.repeatMode, "track");
			assert.equal(player.queueView.repeatMode, "track");
		});
	});

	describe("skipping", () => {
		it("advances to the next Recitation in OFF mode", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);

			const result = await player.skip();

			assert.equal(result.started, true);
			assert.equal(player.isPlaying, true);
			assert.equal(player.queueView.current?.url, "https://example.com/019.mp3");
			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"play:https://example.com/019.mp3",
			]);
		});

		it("ends playback cleanly in OFF mode with nothing queued", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));

			const result = await player.skip();

			assert.equal(result.started, false);
			assert.equal(player.isPlaying, false);
			assert.equal(player.queueView.current, undefined);
		});

		it("is a no-op when nothing is playing", async () => {
			const player = new Player("guild-1", new FakeVoicePort());

			const result = await player.skip();

			assert.equal(result.started, false);
			assert.equal(result.queued, false);
		});

		it("replays the current Recitation in TRACK mode", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);
			player.setRepeatMode(RepeatMode.TRACK);

			const result = await player.skip();

			assert.equal(result.started, true);
			assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"play:https://example.com/018.mp3",
			]);
		});

		it("wraps back to the first Recitation in ALL mode when the queue ends", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);
			await player.play(
				recitation({ surah: { number: 20, name: "طه" }, url: "https://example.com/020.mp3" }),
			);
			player.setRepeatMode(RepeatMode.ALL);

			await player.skip();
			await player.skip();
			await player.skip();

			assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"play:https://example.com/019.mp3",
				"play:https://example.com/020.mp3",
				"play:https://example.com/018.mp3",
			]);
		});
	});

	describe("natural-end auto-advance honors RepeatMode", () => {
		it("replays the current Recitation on Idle in TRACK mode", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			player.setRepeatMode(RepeatMode.TRACK);

			port.emit("playerStateChange", AudioPlayerStatus.Idle);
			await flush();

			assert.equal(player.isPlaying, true);
			assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"play:https://example.com/018.mp3",
			]);
		});

		it("wraps back to the first Recitation on Idle in ALL mode", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);
			player.setRepeatMode(RepeatMode.ALL);

			port.emit("playerStateChange", AudioPlayerStatus.Idle);
			await flush();
			port.emit("playerStateChange", AudioPlayerStatus.Idle);
			await flush();

			assert.equal(player.isPlaying, true);
			assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
			assert.deepEqual(port.calls, [
				"play:https://example.com/018.mp3",
				"play:https://example.com/019.mp3",
				"play:https://example.com/018.mp3",
			]);
		});

		it("ends cleanly on Idle in OFF mode when the queue is empty", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));

			port.emit("playerStateChange", AudioPlayerStatus.Idle);
			await flush();

			assert.equal(player.isPlaying, false);
			assert.equal(player.queueView.current, undefined);
		});
	});

	describe("removing and clearing", () => {
		it("remove deletes the Recitation at a 1-based queue position", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);

			assert.equal(player.remove(2), true);
			assert.equal(player.queueView.upcoming.length, 0);
			assert.deepEqual(port.calls, ["play:https://example.com/018.mp3"]);

			assert.equal(player.remove(2), false);
		});

		it("clearQueue keeps the current Recitation playing", async () => {
			const port = new FakeVoicePort();
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
			});

			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);

			player.clearQueue();

			assert.equal(player.isPlaying, true);
			assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
			assert.equal(player.queueView.upcoming.length, 0);
			assert.deepEqual(port.calls, ["play:https://example.com/018.mp3"]);
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
			const player = new Player("guild-1", port, {
				notices: playbackNotices("en"),
			});
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

	describe("grace-period leave", () => {
		it("ends the session when no human returns before the grace period fires", async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout"] });

			const port = new FakeVoicePort();
			const ended: string[] = [];
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
				gracePeriodMs: 60_000,
				onSessionEnd: (guildId) => ended.push(guildId),
			});

			await player.join(channel);
			port.emit("stateChange", VoiceConnectionStatus.Ready);
			await player.play(recitation({ url: "https://example.com/018.mp3" }));
			await player.play(
				recitation({ surah: { number: 19, name: "مريم" }, url: "https://example.com/019.mp3" }),
			);

			// The last human leaves -> the grace timer starts.
			player.updateVoiceMembership(0);

			// Nobody returns before the window elapses -> the session ends.
			t.mock.timers.tick(60_000);
			await flush();

			assert.equal(player.isConnected, false);
			assert.equal(player.isPlaying, false);
			assert.equal(player.queueView.current, undefined);
			assert.equal(player.queueView.upcoming.length, 0);
			assert.deepEqual(ended, ["guild-1"]);
			assert.deepEqual(port.calls, [
				"join:voice-1",
				"play:https://example.com/018.mp3",
				"leave",
				"destroy",
			]);
		});

		it("cancels the grace timer when a human rejoins within the window", async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout"] });

			const port = new FakeVoicePort();
			const ended: string[] = [];
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
				gracePeriodMs: 60_000,
				onSessionEnd: (guildId) => ended.push(guildId),
			});

			await player.join(channel);
			port.emit("stateChange", VoiceConnectionStatus.Ready);
			await player.play(recitation({ url: "https://example.com/018.mp3" }));

			// The last human leaves -> the grace timer starts, then a human returns.
			player.updateVoiceMembership(0);
			player.updateVoiceMembership(2);

			t.mock.timers.tick(60_000);
			await flush();

			assert.equal(player.isPlaying, true);
			assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
			assert.deepEqual(ended, []);
			assert.deepEqual(port.calls, ["join:voice-1", "play:https://example.com/018.mp3"]);
		});

		it("does not arm the grace timer while not connected", async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout"] });

			const port = new FakeVoicePort();
			const ended: string[] = [];
			const player = new Player("guild-1", port, {
				gracePeriodMs: 60_000,
				onSessionEnd: (guildId) => ended.push(guildId),
			});

			player.updateVoiceMembership(0);
			t.mock.timers.tick(60_000);
			await flush();

			assert.deepEqual(ended, []);
			assert.deepEqual(port.calls, []);
		});

		it("keeps the timer armed through a transient connection blip while the channel is empty", async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout"] });

			const port = new FakeVoicePort();
			const ended: string[] = [];
			const player = new Player("guild-1", port, {
				probeStream: async () => true,
				gracePeriodMs: 60_000,
				onSessionEnd: (guildId) => ended.push(guildId),
			});

			await player.join(channel);
			port.emit("stateChange", VoiceConnectionStatus.Ready);
			await player.play(recitation({ url: "https://example.com/018.mp3" }));

			// The last human leaves -> the grace timer arms.
			player.updateVoiceMembership(0);

			// A transient connection blip must NOT cancel the armed timer.
			port.emit("stateChange", VoiceConnectionStatus.Signalling);
			port.emit("stateChange", VoiceConnectionStatus.Ready);

			t.mock.timers.tick(60_000);
			await flush();

			assert.deepEqual(ended, ["guild-1"]);
		});
	});
});
