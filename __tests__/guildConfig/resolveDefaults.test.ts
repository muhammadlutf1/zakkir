import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDefaults } from "../../src/guildConfig/resolveDefaults";
import type {
	GlobalDefaults,
	GuildConfigData,
	ResolveRequest,
	RewayahCoverage,
} from "../../src/guildConfig/types";

const global: GlobalDefaults = {
	language: "ar",
	defaultReciter: 11,
	defaultRewayah: 21,
};

const guild: GuildConfigData = {
	guildId: "guild-1",
	language: "en",
	defaultReciter: 12,
	defaultRewayah: 22,
};

const covering: RewayahCoverage = async (reciterId, surahNumber, rewayahId) =>
	rewayahId === 21 ? true : surahNumber === 1;

function resolve(
	request: ResolveRequest,
	guildConfig?: GuildConfigData,
	globalDefaults: GlobalDefaults = global,
) {
	return resolveDefaults({ guildConfig, global: globalDefaults, request, rewayahCovers: covering });
}

test("resolves against global defaults when a guild has no saved config", async () => {
	const resolved = await resolve({ surahNumber: 1 });

	assert.deepEqual(resolved, { language: "ar", reciter: 11, rewayah: 21 });
});

test("GuildConfig values beat global defaults", async () => {
	const resolved = await resolve({ surahNumber: 1 }, guild);

	assert.deepEqual(resolved, { language: "en", reciter: 12, rewayah: 22 });
});

test("command option beats GuildConfig beats global default", async () => {
	const resolved = await resolve(
		{
			surahNumber: 1,
			option: { language: "fr", reciter: 13, rewayah: 21 },
		},
		guild,
	);

	assert.deepEqual(resolved, { language: "fr", reciter: 13, rewayah: 21 });
});

test("omitted option fields fall through to GuildConfig", async () => {
	const resolved = await resolve({ surahNumber: 1, option: { reciter: 13 } }, guild);

	assert.deepEqual(resolved, { language: "en", reciter: 13, rewayah: 22 });
});

test("omitted GuildConfig fields fall through to global defaults", async () => {
	const resolved = await resolve(
		{ surahNumber: 1 },
		{ guildId: "guild-2", language: "en", defaultReciter: undefined, defaultRewayah: undefined },
	);

	assert.deepEqual(resolved, { language: "en", reciter: 11, rewayah: 21 });
});

test("a default rewayah that does not cover the surah is unresolved, not an error", async () => {
	const resolved = await resolve({ surahNumber: 2 }, guild);

	assert.deepEqual(resolved, { language: "en", reciter: 12, rewayah: undefined });
});

test("rewayah is unresolved when no reciter resolves", async () => {
	const noReciterGlobal: GlobalDefaults = { ...global, defaultReciter: undefined };
	const resolved = await resolve({ surahNumber: 1 }, undefined, noReciterGlobal);

	assert.deepEqual(resolved, { language: "ar", reciter: undefined, rewayah: undefined });
});
