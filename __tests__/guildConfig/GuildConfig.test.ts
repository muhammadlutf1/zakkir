import assert from "node:assert/strict";
import { test } from "node:test";
import { GuildConfig } from "../../src/guildConfig/GuildConfig";
import type { GuildConfigStore } from "../../src/guildConfig/GuildConfigStore";
import type { GuildConfigData } from "../../src/guildConfig/types";

const global = { language: "ar", defaultReciter: 11, defaultRewayah: 21 } as const;

class MemoryStore implements GuildConfigStore {
	readonly rows = new Map<string, GuildConfigData>();

	async get(guildId: string) {
		return this.rows.get(guildId);
	}

	async set(config: GuildConfigData) {
		this.rows.set(config.guildId, { ...config });
	}
}

test("get loads a saved config from the store", async () => {
	const store = new MemoryStore();
	store.rows.set("guild-1", {
		guildId: "guild-1",
		language: "en",
		defaultReciter: 12,
		defaultRewayah: 22,
	});
	const configs = new GuildConfig(store, global);

	const config = await configs.get("guild-1");

	assert.deepEqual(config, {
		guildId: "guild-1",
		language: "en",
		defaultReciter: 12,
		defaultRewayah: 22,
	});
});

test("get returns undefined for a guild with no saved config", async () => {
	const configs = new GuildConfig(new MemoryStore(), global);

	assert.equal(await configs.get("guild-1"), undefined);
});

test("get caches the store value on first access", async () => {
	const store = new MemoryStore();
	store.rows.set("guild-1", {
		guildId: "guild-1",
		language: "en",
		defaultReciter: undefined,
		defaultRewayah: undefined,
	});
	const configs = new GuildConfig(store, global);

	const first = await configs.get("guild-1");
	store.rows.set("guild-1", {
		guildId: "guild-1",
		language: "fr",
		defaultReciter: undefined,
		defaultRewayah: undefined,
	});
	const second = await configs.get("guild-1");

	assert.equal(first, second);
	assert.equal(second!.language, "en");
});

test("set persists a merged config to the store and returns it", async () => {
	const store = new MemoryStore();
	const configs = new GuildConfig(store, global);

	const config = await configs.set("guild-1", { defaultReciter: 12 });

	assert.deepEqual(config, {
		guildId: "guild-1",
		language: undefined,
		defaultReciter: 12,
		defaultRewayah: undefined,
	});
	assert.deepEqual(store.rows.get("guild-1"), config);
});

test("a fresh GuildConfig over the same store sees saved values (survives restart)", async () => {
	const store = new MemoryStore();

	await new GuildConfig(store, global).set("guild-1", {
		language: "en",
		defaultReciter: 12,
		defaultRewayah: 22,
	});

	const config = await new GuildConfig(store, global).get("guild-1");

	assert.deepEqual(config, {
		guildId: "guild-1",
		language: "en",
		defaultReciter: 12,
		defaultRewayah: 22,
	});
});

test("resolve resolves guild defaults then falls back to global", async () => {
	const store = new MemoryStore();
	await store.set({ guildId: "guild-1", language: "en", defaultReciter: 12, defaultRewayah: 22 });
	const configs = new GuildConfig(store, global);

	const resolved = await configs.resolve(
		"guild-1",
		{ surahNumber: 1 },
		async (_reciter, _surah, rewayahId) => rewayahId === 22,
	);

	assert.deepEqual(resolved, { language: "en", reciter: 12, rewayah: 22 });
});

test("resolve falls back to global defaults for a guild with no saved config", async () => {
	const configs = new GuildConfig(new MemoryStore(), global);

	const resolved = await configs.resolve(
		"guild-1",
		{ surahNumber: 1 },
		async (_reciter, _surah, rewayahId) => rewayahId === 21,
	);

	assert.deepEqual(resolved, { language: "ar", reciter: 11, rewayah: 21 });
});
