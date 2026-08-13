import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SqliteGuildConfigStore } from "../../src/guildConfig/SqliteGuildConfigStore";

function memoryStore() {
	return new SqliteGuildConfigStore(":memory:");
}

test("set then get round-trips a full config", async () => {
	const store = memoryStore();

	await store.set({
		guildId: "guild-1",
		language: "en",
		defaultReciter: 12,
		defaultRewayah: 22,
	});

	const config = await store.get("guild-1");

	assert.deepEqual(config, {
		guildId: "guild-1",
		language: "en",
		defaultReciter: 12,
		defaultRewayah: 22,
	});
});

test("get returns undefined for a guild with no saved config", async () => {
	const store = memoryStore();

	assert.equal(await store.get("guild-1"), undefined);
});

test("unset fields round-trip as undefined, not null", async () => {
	const store = memoryStore();

	await store.set({
		guildId: "guild-1",
		language: undefined,
		defaultReciter: undefined,
		defaultRewayah: undefined,
	});

	assert.deepEqual(await store.get("guild-1"), {
		guildId: "guild-1",
		language: undefined,
		defaultReciter: undefined,
		defaultRewayah: undefined,
	});
});

test("set upserts rather than duplicates a guild row", async () => {
	const store = memoryStore();

	await store.set({ guildId: "guild-1", language: "en", defaultReciter: 12, defaultRewayah: 22 });
	await store.set({ guildId: "guild-1", language: "fr", defaultReciter: 13, defaultRewayah: 23 });

	const config = await store.get("guild-1");

	assert.deepEqual(config, {
		guildId: "guild-1",
		language: "fr",
		defaultReciter: 13,
		defaultRewayah: 23,
	});
});

test("a persisted config survives a fresh store over the same file (restart)", async () => {
	const dir = mkdtempSync(join(tmpdir(), "guildconfig-"));
	const path = join(dir, "guilds.db");

	try {
		const first = new SqliteGuildConfigStore(path);
		await first.set({
			guildId: "guild-1",
			language: "en",
			defaultReciter: 12,
			defaultRewayah: 22,
		});
		first.close();

		const second = new SqliteGuildConfigStore(path);
		const config = await second.get("guild-1");
		second.close();

		assert.deepEqual(config, {
			guildId: "guild-1",
			language: "en",
			defaultReciter: 12,
			defaultRewayah: 22,
		});
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
