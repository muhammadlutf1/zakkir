import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "./Player";
import { PlayerRegistry } from "./PlayerRegistry";
import type { VoicePort } from "./VoicePort";

class NoopVoicePort implements VoicePort {
	async join() {}

	leave() {}

	play() {}

	pause() {}

	unpause() {}

	stop() {}

	destroy() {}

	on() {}

	off() {}
}

test("getOrCreate creates a Player lazily on first access", () => {
	const registry = new PlayerRegistry((guildId) => new Player(guildId, new NoopVoicePort()));

	const player = registry.getOrCreate("guild-1");

	assert.equal(player.guildId, "guild-1");
});

test("get returns undefined before a Player exists", () => {
	const registry = new PlayerRegistry(() => new Player("n/a", new NoopVoicePort()));

	assert.equal(registry.get("guild-1"), undefined);
});

test("getOrCreate reuses the same Player for later calls in the same guild", () => {
	const registry = new PlayerRegistry((guildId) => new Player(guildId, new NoopVoicePort()));

	const first = registry.getOrCreate("guild-1");
	const second = registry.getOrCreate("guild-1");

	assert.equal(first, second);
});

test("getOrCreate creates separate Players for separate guilds", () => {
	const registry = new PlayerRegistry((guildId) => new Player(guildId, new NoopVoicePort()));

	const first = registry.getOrCreate("guild-1");
	const second = registry.getOrCreate("guild-2");

	assert.notEqual(first, second);
	assert.equal(first.guildId, "guild-1");
	assert.equal(second.guildId, "guild-2");
});

test("remove drops the Player and subsequent get returns undefined", () => {
	const registry = new PlayerRegistry((guildId) => new Player(guildId, new NoopVoicePort()));

	const player = registry.getOrCreate("guild-1");

	assert.equal(registry.remove("guild-1"), player);
	assert.equal(registry.get("guild-1"), undefined);
});
