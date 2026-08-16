import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Player } from "../../src/voice/Player";
import { PlayerRegistry } from "../../src/voice/PlayerRegistry";
import type { VoicePort } from "../../src/voice/VoicePort";

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

describe("PlayerRegistry", () => {
	it("creates a Player lazily on first access", () => {
		const registry = new PlayerRegistry((guildId) => new Player(guildId, new NoopVoicePort()));

		const player = registry.getOrCreate("guild-1");

		assert.equal(player.guildId, "guild-1");
	});

	it("returns undefined from get before a Player exists", () => {
		const registry = new PlayerRegistry(() => new Player("n/a", new NoopVoicePort()));

		assert.equal(registry.get("guild-1"), undefined);
	});

	it("reuses the same Player for later calls in the same guild", () => {
		const registry = new PlayerRegistry((guildId) => new Player(guildId, new NoopVoicePort()));

		const first = registry.getOrCreate("guild-1");
		const second = registry.getOrCreate("guild-1");

		assert.equal(first, second);
	});

	it("creates separate Players for separate guilds", () => {
		const registry = new PlayerRegistry((guildId) => new Player(guildId, new NoopVoicePort()));

		const first = registry.getOrCreate("guild-1");
		const second = registry.getOrCreate("guild-2");

		assert.notEqual(first, second);
		assert.equal(first.guildId, "guild-1");
		assert.equal(second.guildId, "guild-2");
	});

	it("drops the Player on remove and subsequent get returns undefined", () => {
		const registry = new PlayerRegistry((guildId) => new Player(guildId, new NoopVoicePort()));

		const player = registry.getOrCreate("guild-1");

		assert.equal(registry.remove("guild-1"), player);
		assert.equal(registry.get("guild-1"), undefined);
	});
});
