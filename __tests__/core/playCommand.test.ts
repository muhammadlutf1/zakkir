import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChannelType } from "discord.js";
import type { Catalog, Reciter, Rewayah } from "../../src/catalog/Catalog";
import { resolveSurah, SURAH_LIST } from "../../src/catalog/surahs";
import playCommand from "../../src/commands/play";
import type { CommandContext } from "../../src/core/interactionContext";
import { GuildConfig } from "../../src/guild/GuildConfig";
import { SqliteGuildConfigStore } from "../../src/guild/SqliteGuildConfigStore";
import type { GlobalDefaults } from "../../src/guild/types";
import type { Player } from "../../src/voice/Player";

const NO_DEFAULTS: GlobalDefaults = {
	language: "ar",
	defaultReciter: undefined,
	defaultRewayah: undefined,
};

const rewayah = (id: number, name: string, surahs: number[]): Rewayah => ({
	id,
	name,
	server: `https://fixture/mc${id}`,
	surahList: new Set(surahs),
	surahCount: surahs.length,
});

const FIXTURES: Reciter[] = [
	{
		id: 10,
		name: "أكرم العلاقمي",
		rewayat: [rewayah(10, "حفص عن عاصم - مرتل", [18])],
	},
];

class FakeCatalog {
	async resolveReciterByName(name: string) {
		return FIXTURES.find((r) => r.name === name);
	}

	async resolveReciterById(id: number) {
		return FIXTURES.find((r) => r.id === id);
	}

	async resolveRewayat(reciterId: number, surahNumber: number) {
		const reciter = FIXTURES.find((r) => r.id === reciterId);
		return reciter?.rewayat.filter((r) => r.surahList.has(surahNumber)) ?? [];
	}

	async resolveStreamUrl(
		reciterId: number,
		rewayahId: number,
		surahNumber: number,
	) {
		const reciter = FIXTURES.find((r) => r.id === reciterId);
		const rewayah = reciter?.rewayat.find(
			(r) => r.id === rewayahId && r.surahList.has(surahNumber),
		);
		return rewayah
			? `${rewayah.server}/${String(surahNumber).padStart(3, "0")}.mp3`
			: undefined;
	}

	resolveSurah(input: string | number) {
		return resolveSurah(input);
	}

	get surahList() {
		return SURAH_LIST;
	}
}

function makeFakePlayer() {
	const calls: string[] = [];

	return {
		get calls() {
			return calls;
		},
		async join(channel: { id: string }) {
			calls.push(`join:${channel.id}`);
		},
		async play() {
			calls.push("play");
			return { started: true, queued: false };
		},
		setNoticeChannel() {
			calls.push("setNoticeChannel");
		},
	} as unknown as Player & { calls: string[] };
}

describe("play command with a fabricated context", () => {
	it("plays a resolved recitation directly and reports the formatted result", async () => {
		const player = makeFakePlayer();
		const edits: Array<{ content: string }> = [];
		const voiceChannel = { id: "voice-1", type: ChannelType.GuildVoice };

		const context: CommandContext = {
			players: {
				getOrCreate: () => player,
				get: () => undefined,
				remove: () => undefined,
			},
			catalog: new FakeCatalog() as unknown as Catalog,
			guildConfigs: new GuildConfig(new SqliteGuildConfigStore(":memory:")),
			play: { defaults: NO_DEFAULTS, pickerTimeoutMs: 100 },
		};

		const interaction = {
			inCachedGuild: () => true,
			member: { voice: { channel: voiceChannel } },
			options: {
				getString: (key: string) => (key === "surah" ? "18" : "أكرم العلاقمي"),
			},
			guildId: "g-1",
			channel: { id: "text-1" },
			deferReply: async () => undefined,
			editReply: async (payload: { content: string }) => {
				edits.push(payload);
				return { id: "msg-1" };
			},
			reply: async () => undefined,
			replied: false,
			deferred: false,
		};

		await playCommand.execute(context, interaction as never);

		assert.equal(edits.length, 1);
		assert.equal(
			edits[0]!.content,
			"Playing الكهف by أكرم العلاقمي (حفص عن عاصم - مرتل).",
		);
		assert.deepEqual(player.calls, [
			"join:voice-1",
			"setNoticeChannel",
			"play",
		]);
	});
});
