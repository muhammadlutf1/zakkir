import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GuildConfig } from "../../src/guild/GuildConfig";
import { SqliteGuildConfigStore } from "../../src/guild/SqliteGuildConfigStore";

function memoryStore() {
	return new SqliteGuildConfigStore(":memory:");
}

const savedConfig = {
	language: "en",
	defaultReciter: 12,
	defaultRewayah: 22,
} as const;

describe("GuildConfig.get", () => {
	it("loads a saved config from the store synchronously", () => {
		const store = memoryStore();
		store.set({ guildId: "guild-1", ...savedConfig });
		const configs = new GuildConfig(store);

		const config = configs.get("guild-1");

		assert.deepEqual(config, { guildId: "guild-1", ...savedConfig });
	});

	it("returns undefined for a guild with no saved config", () => {
		const configs = new GuildConfig(memoryStore());

		assert.equal(configs.get("guild-1"), undefined);
	});

	it("caches the store value on first access", () => {
		const store = memoryStore();
		store.set({
			guildId: "guild-1",
			language: "en",
			defaultReciter: undefined,
			defaultRewayah: undefined,
		});
		const configs = new GuildConfig(store);

		const first = configs.get("guild-1");
		store.set({
			guildId: "guild-1",
			language: "ar",
			defaultReciter: undefined,
			defaultRewayah: undefined,
		});
		const second = configs.get("guild-1");

		assert.equal(first, second);
		assert.equal(second!.language, "en");
	});
});

describe("GuildConfig.set", () => {
	it("persists a merged config to the store and returns it synchronously", () => {
		const store = memoryStore();
		const configs = new GuildConfig(store);

		const config = configs.set("guild-1", { defaultReciter: 12 });

		assert.deepEqual(config, {
			guildId: "guild-1",
			language: undefined,
			defaultReciter: 12,
			defaultRewayah: undefined,
		});
		assert.deepEqual(store.get("guild-1"), config);
	});

	it("a fresh GuildConfig over the same store sees saved values (survives restart)", () => {
		const store = memoryStore();

		new GuildConfig(store).set("guild-1", savedConfig);

		const config = new GuildConfig(store).get("guild-1");

		assert.deepEqual(config, { guildId: "guild-1", ...savedConfig });
	});
});

describe("GuildConfig.resolve", () => {
	it("applies the guild config defaults", async () => {
		const store = memoryStore();
		store.set({ guildId: "guild-1", ...savedConfig });
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
		store.set({ guildId: "guild-1", ...savedConfig });
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
		store.set({ guildId: "guild-1", ...savedConfig });
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
		store.set({ guildId: "guild-1", ...savedConfig });
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
		store.set({
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

describe("GuildConfig.language", () => {
	it("returns the guild's saved locale", () => {
		const store = memoryStore();
		store.set({ guildId: "guild-1", language: "ar", defaultReciter: 12, defaultRewayah: 22 });
		const configs = new GuildConfig(store);

		assert.equal(configs.language("guild-1"), "ar");
	});

	it("falls back to the global default (English) for a guild with no saved locale", () => {
		const configs = new GuildConfig(memoryStore());

		assert.equal(configs.language("guild-1"), "en");
	});

	it("falls back to the default when the saved language is not a known locale", () => {
		const store = memoryStore();
		store.set({ guildId: "guild-1", language: undefined, defaultReciter: undefined, defaultRewayah: undefined });
		const configs = new GuildConfig(store);

		assert.equal(configs.language("guild-1"), "en");
	});
});