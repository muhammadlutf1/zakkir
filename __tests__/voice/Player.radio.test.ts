import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AudioPlayerStatus } from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";
import type { Radio } from "../../src/catalog/Catalog";
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
	readonly joinedChannelId = null;
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
		for (const listener of this.listeners[event])
			(listener as (payload: VoicePortEventPayload<K>) => void)(payload);
	}
}

function radio(overrides: Partial<Radio> = {}): Radio {
	return {
		id: 1,
		name: "Quran Radio",
		url: "https://example.com/radio.mp3",
		...overrides,
	};
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

function flush() {
	return new Promise<void>((resolve) => setImmediate(resolve));
}

describe("Player radio", () => {
	it("playRadio starts an endless stream via the port", async () => {
		const port = new FakeVoicePort();
		const player = new Player("guild-1", port);
		await player.playRadio(radio());
		assert.equal(player.isRadioPlaying, true);
		assert.deepEqual(port.calls, ["play:https://example.com/radio.mp3"]);
	});

	it("while radio plays, queued recitations are paused but retained", async () => {
		const port = new FakeVoicePort();
		const player = new Player("guild-1", port, {
			probeStream: async () => true,
		});
		await player.playRadio(radio());
		const result = await player.play(recitation());
		assert.equal(result.started, false);
		assert.equal(result.queued, true);
		assert.equal(player.queueView.current?.surah.number, 18);
		assert.deepEqual(port.calls, ["play:https://example.com/radio.mp3"]);
	});

	it("confirm flow: stopRadio clears radio and pending", async () => {
		const port = new FakeVoicePort();
		const player = new Player("guild-1", port, {
			probeStream: async () => true,
		});
		await player.playRadio(radio());
		player.setPendingRadioConfirm(recitation());
		player.stopRadio();
		assert.equal(player.isRadioPlaying, false);
		assert.equal(player.pendingRecitation, null);
	});

	it("radio stream error retries up to 3 times with backoff then goes idle without touching queue", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const port = new FakeVoicePort();
		const player = new Player("guild-1", port);
		await player.playRadio(radio());
		// add a queued recitation while radio plays — should be retained
		const queued = await player.play(
			recitation({ url: "https://example.com/018.mp3" }),
		);
		assert.equal(queued.queued, true);
		assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
		// 3 retries: initial radio play + 3 retries = 4 plays before idle
		port.emit("streamError", new Error("cut1"));
		assert.equal(player.isRadioPlaying, true);
		t.mock.timers.tick(1000);
		assert.equal(port.calls.filter((c) => c.startsWith("play:")).length, 2);
		port.emit("streamError", new Error("cut2"));
		t.mock.timers.tick(2000);
		assert.equal(port.calls.filter((c) => c.startsWith("play:")).length, 3);
		port.emit("streamError", new Error("cut3"));
		t.mock.timers.tick(4000);
		assert.equal(port.calls.filter((c) => c.startsWith("play:")).length, 4);
		port.emit("streamError", new Error("cut4"));
		await flush();
		assert.equal(player.isRadioPlaying, false);
		assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
		assert.equal(player.queueView.upcoming.length, 0);
	});

	it("pause/resume delegates to port while radio playing", async () => {
		const port = new FakeVoicePort();
		const player = new Player("guild-1", port);
		await player.playRadio(radio());
		player.pause();
		player.unpause();
		assert.deepEqual(port.calls.slice(1), ["pause", "unpause"]);
	});

	it("Idle while radio does not advance queue", async () => {
		const port = new FakeVoicePort();
		const player = new Player("guild-1", port, {
			probeStream: async () => true,
		});
		await player.play(recitation({ url: "https://example.com/018.mp3" }));
		await player.playRadio(radio());
		port.emit("playerStateChange", AudioPlayerStatus.Idle);
		await flush();
		assert.equal(player.isRadioPlaying, true);
		assert.equal(player.queueView.current?.url, "https://example.com/018.mp3");
	});
});
