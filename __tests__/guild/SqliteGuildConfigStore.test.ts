import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { SqliteGuildConfigStore } from "../../src/guild/SqliteGuildConfigStore";

function memoryStore() {
	return new SqliteGuildConfigStore(":memory:");
}

describe("SqliteGuildConfigStore", () => {
	it("round-trips a full config through set then get synchronously", () => {
		const store = memoryStore();

		store.set({
			guildId: "guild-1",
			language: "en",
			defaultReciter: 12,
			defaultRewayah: 22,
		});

		const config = store.get("guild-1");

		assert.deepEqual(config, {
			guildId: "guild-1",
			language: "en",
			defaultReciter: 12,
			defaultRewayah: 22,
		});
	});

	it("returns undefined from get for a guild with no saved config", () => {
		const store = memoryStore();

		assert.equal(store.get("guild-1"), undefined);
	});

	it("round-trips unset fields as undefined, not null", () => {
		const store = memoryStore();

		store.set({
			guildId: "guild-1",
			language: undefined,
			defaultReciter: undefined,
			defaultRewayah: undefined,
		});

		assert.deepEqual(store.get("guild-1"), {
			guildId: "guild-1",
			language: undefined,
			defaultReciter: undefined,
			defaultRewayah: undefined,
		});
	});

	it("set upserts rather than duplicates a guild row", () => {
		const store = memoryStore();

		store.set({
			guildId: "guild-1",
			language: "en",
			defaultReciter: 12,
			defaultRewayah: 22,
		});
		store.set({
			guildId: "guild-1",
			language: "ar",
			defaultReciter: 13,
			defaultRewayah: 23,
		});

		const config = store.get("guild-1");

		assert.deepEqual(config, {
			guildId: "guild-1",
			language: "ar",
			defaultReciter: 13,
			defaultRewayah: 23,
		});
	});

	it("a persisted config survives a fresh store over the same file (restart)", () => {
		const dir = mkdtempSync(join(tmpdir(), "guildconfig-"));
		const path = join(dir, "guilds.db");

		try {
			const first = new SqliteGuildConfigStore(path);
			first.set({
				guildId: "guild-1",
				language: "en",
				defaultReciter: 12,
				defaultRewayah: 22,
			});
			first.close();

			const second = new SqliteGuildConfigStore(path);
			const config = second.get("guild-1");
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
});
