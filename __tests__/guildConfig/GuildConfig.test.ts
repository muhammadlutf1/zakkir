import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GuildConfig } from "../../src/guildConfig/GuildConfig";
import { SqliteGuildConfigStore } from "../../src/guildConfig/SqliteGuildConfigStore";

function memoryStore() {
	return new SqliteGuildConfigStore(":memory:");
}

const savedConfig = {
	language: "en",
	defaultReciter: 12,
	defaultRewayah: 22,
};

describe("GuildConfig.get", () => {
	it("loads a saved config from the store", async () => {
		const store = memoryStore();
		await store.set({ guildId: "guild-1", ...savedConfig });
		const configs = new GuildConfig(store);

		const config = await configs.get("guild-1");

		assert.deepEqual(config, { guildId: "guild-1", ...savedConfig });
	});

	it("returns undefined for a guild with no saved config", async () => {
		const configs = new GuildConfig(memoryStore());

		assert.equal(await configs.get("guild-1"), undefined);
	});

	it("caches the store value on first access", async () => {
		const store = memoryStore();
		await store.set({
			guildId: "guild-1",
			language: "en",
			defaultReciter: undefined,
			defaultRewayah: undefined,
		});
		const configs = new GuildConfig(store);

		const first = await configs.get("guild-1");
		await store.set({
			guildId: "guild-1",
			language: "fr",
			defaultReciter: undefined,
			defaultRewayah: undefined,
		});
		const second = await configs.get("guild-1");

		assert.equal(first, second);
		assert.equal(second!.language, "en");
	});
});

describe("GuildConfig.set", () => {
	it("persists a merged config to the store and returns it", async () => {
		const store = memoryStore();
		const configs = new GuildConfig(store);

		const config = await configs.set("guild-1", { defaultReciter: 12 });

		assert.deepEqual(config, {
			guildId: "guild-1",
			language: undefined,
			defaultReciter: 12,
			defaultRewayah: undefined,
		});
		assert.deepEqual(await store.get("guild-1"), config);
	});

	it("a fresh GuildConfig over the same store sees saved values (survives restart)", async () => {
		const store = memoryStore();

		await new GuildConfig(store).set("guild-1", savedConfig);

		const config = await new GuildConfig(store).get("guild-1");

		assert.deepEqual(config, { guildId: "guild-1", ...savedConfig });
	});
});

describe("GuildConfig.resolve", () => {
	it("applies the guild config defaults", async () => {
		const store = memoryStore();
		await store.set({ guildId: "guild-1", ...savedConfig });
		const configs = new GuildConfig(store);

		const resolved = await configs.resolve(
			"guild-1",
			{ surahNumber: 1 },
			async () => true,
		);

		assert.deepEqual(resolved, { reciter: 12, rewayah: 22 });
	});

	it("prefers command options over the guild config", async () => {
		const store = memoryStore();
		await store.set({ guildId: "guild-1", ...savedConfig });
		const configs = new GuildConfig(store);

		const resolved = await configs.resolve(
			"guild-1",
			{ surahNumber: 1, option: { reciter: 13, rewayah: 21 } },
			async () => true,
		);

		assert.deepEqual(resolved, { reciter: 13, rewayah: 21 });
	});

	it("falls omitted option fields through to the guild config", async () => {
		const store = memoryStore();
		await store.set({ guildId: "guild-1", ...savedConfig });
		const configs = new GuildConfig(store);

		const resolved = await configs.resolve(
			"guild-1",
			{ surahNumber: 1, option: { reciter: 13 } },
			async () => true,
		);

		assert.deepEqual(resolved, { reciter: 13, rewayah: 22 });
	});

	it("leaves defaults unresolved for a guild with no saved config", async () => {
		const configs = new GuildConfig(memoryStore());

		const resolved = await configs.resolve(
			"guild-1",
			{ surahNumber: 1 },
			async () => true,
		);

		assert.deepEqual(resolved, { reciter: undefined, rewayah: undefined });
	});

	it("a default rewayah that does not cover the surah is unresolved, not an error", async () => {
		const store = memoryStore();
		await store.set({ guildId: "guild-1", ...savedConfig });
		const configs = new GuildConfig(store);

		const resolved = await configs.resolve(
			"guild-1",
			{ surahNumber: 2 },
			async (_reciter, _surah, rewayahId) => rewayahId === 21,
		);

		assert.deepEqual(resolved, { reciter: 12, rewayah: undefined });
	});

	it("rewayah is unresolved when no reciter resolves", async () => {
		const store = memoryStore();
		await store.set({
			guildId: "guild-1",
			language: "en",
			defaultReciter: undefined,
			defaultRewayah: 22,
		});
		const configs = new GuildConfig(store);

		const resolved = await configs.resolve(
			"guild-1",
			{ surahNumber: 1 },
			async () => true,
		);

		assert.deepEqual(resolved, { reciter: undefined, rewayah: undefined });
	});
});
