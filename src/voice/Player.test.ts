import assert from "node:assert/strict";
import { test } from "node:test";
import { VoiceConnectionStatus } from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";
import { Player } from "./Player";
import type {
	VoicePort,
	VoicePortEventName,
	VoicePortEventPayload,
	VoicePortEvents,
} from "./VoicePort";

class FakeVoicePort implements VoicePort {
	readonly calls: string[] = [];

	private listeners: {
		[K in VoicePortEventName]: Set<VoicePortEvents[K]>;
	} = {
		stateChange: new Set(),
		playerStateChange: new Set(),
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

test("Player is bound to its guild id", () => {
	const player = new Player("guild-1", new FakeVoicePort());

	assert.equal(player.guildId, "guild-1");
	assert.equal(player.isConnected, false);
});

test("join delegates to the VoicePort and reflects the ready state", async () => {
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

test("leave delegates to the VoicePort", () => {
	const port = new FakeVoicePort();
	const player = new Player("guild-1", port);

	player.leave();

	assert.deepEqual(port.calls, ["leave"]);
});

test("dispose leaves and destroys the VoicePort", () => {
	const port = new FakeVoicePort();
	const player = new Player("guild-1", port);

	player.dispose();

	assert.deepEqual(port.calls, ["leave", "destroy"]);
});

test("play delegates to the VoicePort", () => {
	const port = new FakeVoicePort();
	const player = new Player("guild-1", port);

	player.play("https://example.com/audio.mp3");

	assert.deepEqual(port.calls, ["play:https://example.com/audio.mp3"]);
});

test("stop delegates to the VoicePort", () => {
	const port = new FakeVoicePort();
	const player = new Player("guild-1", port);

	player.stop();

	assert.deepEqual(port.calls, ["stop"]);
});

test("voice errors emitted by the port are caught and do not escape", async () => {
	const port = new FakeVoicePort();
	const player = new Player("guild-1", port);

	await player.join(channel);

	assert.doesNotThrow(() => port.emit("error", new Error("boom")));
});
