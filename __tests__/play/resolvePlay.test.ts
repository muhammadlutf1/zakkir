import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Catalog, Reciter, Rewayah } from "../../src/catalog/Catalog";
import { resolveSurah } from "../../src/catalog/suwar";
import { GuildConfig } from "../../src/guild/GuildConfig";
import { SqliteGuildConfigStore } from "../../src/guild/SqliteGuildConfigStore";
import type { GlobalDefaults } from "../../src/guild/types";
import {
	buildRecitationFromChoice,
	resolvePlay,
	type RewayahChoice,
} from "../../src/play/resolvePlay";

const rewayah = (id: number, name: string, surahs: number[]): Rewayah => ({
	id,
	name,
	server: `https://fixture/mc${id}`,
	surahList: new Set(surahs),
	surahCount: surahs.length,
});

const FIXTURES: Reciter[] = [
	{
		id: 1,
		name: "إبراهيم الأخضر",
		rewayat: [rewayah(1, "حفص عن عاصم - مرتل", [18]), rewayah(2, "ورش عن نافع - مرتل", [18])],
	},
	{
		id: 10,
		name: "أكرم العلاقمي",
		rewayat: [rewayah(10, "حفص عن عاصم - مرتل", [18])],
	},
	{
		id: 20,
		name: "محمد صديق المنشاوي",
		rewayat: [rewayah(20, "قالون عن نافع - مرتل", [1])],
	},
];

class FakeCatalog {
	constructor(private readonly reciters: Reciter[]) {}

	async resolveReciterByName(name: string) {
		return this.reciters.find((r) => r.name === name);
	}

	async resolveReciterById(id: number) {
		return this.reciters.find((r) => r.id === id);
	}

	async resolveRewayat(reciterId: number, surahNumber: number) {
		const reciter = this.reciters.find((r) => r.id === reciterId);

		return reciter?.rewayat.filter((r) => r.surahList.has(surahNumber)) ?? [];
	}

	async resolveStreamUrl(reciterId: number, rewayahId: number, surahNumber: number) {
		const reciter = this.reciters.find((r) => r.id === reciterId);
		const rewayah = reciter?.rewayat.find(
			(r) => r.id === rewayahId && r.surahList.has(surahNumber),
		);

		return rewayah ? `${rewayah.server}/${String(surahNumber).padStart(3, "0")}.mp3` : undefined;
	}

	resolveSurah(input: string | number) {
		return resolveSurah(input);
	}
}

const catalog = new FakeCatalog(FIXTURES) as unknown as Catalog;
const alKahf = { number: 18, name: "الكهف" };
const NO_DEFAULTS: GlobalDefaults = {
	language: "ar",
	defaultReciter: undefined,
	defaultRewayah: undefined,
};

function memoryStore() {
	return new SqliteGuildConfigStore(":memory:");
}

function guildConfig(defaults: GlobalDefaults = NO_DEFAULTS) {
	return new GuildConfig(memoryStore(), defaults);
}

describe("resolvePlay", () => {
	it("plays directly when a single Rewayah covers and the reciter comes from the option", async () => {
		const outcome = await resolvePlay(catalog, guildConfig(), NO_DEFAULTS, "g-1", alKahf, "أكرم العلاقمي");

		assert.equal(outcome.kind, "play");

		if (outcome.kind !== "play") return;

		assert.deepEqual(outcome.recitation, {
			surah: alKahf,
			reciterId: 10,
			reciterName: "أكرم العلاقمي",
			rewayahId: 10,
			rewayahName: "حفص عن عاصم - مرتل",
			url: "https://fixture/mc10/018.mp3",
		});
	});

	it("resolves the reciter through the guild config", async () => {
		const store = memoryStore();
		store.set({ guildId: "g-1", language: "ar", defaultReciter: 10, defaultRewayah: 10 });
		const config = new GuildConfig(store);

		const outcome = await resolvePlay(catalog, config, NO_DEFAULTS, "g-1", alKahf);

		assert.equal(outcome.kind, "play");
		assert.equal(outcome.kind === "play" && outcome.recitation.reciterId, 10);
	});

	it("resolves the reciter through the global defaults", async () => {
		const defaults: GlobalDefaults = {
		language: "ar",
		defaultReciter: 10,
		defaultRewayah: 10,
	};

		const outcome = await resolvePlay(catalog, guildConfig(defaults), defaults, "g-1", alKahf);

		assert.equal(outcome.kind, "play");
		assert.equal(outcome.kind === "play" && outcome.recitation.reciterId, 10);
	});

	it("plays the resolved default Rewayah directly when it covers and is the only one", async () => {
		const store = memoryStore();
		store.set({ guildId: "g-1", language: "ar", defaultReciter: 10, defaultRewayah: 10 });
		const config = new GuildConfig(store);

		const outcome = await resolvePlay(catalog, config, NO_DEFAULTS, "g-1", alKahf);

		assert.equal(outcome.kind, "play");
		assert.equal(outcome.kind === "play" && outcome.recitation.rewayahId, 10);
	});

	it("shows the picker when more than one Rewayah covers, defaulting to the resolved default", async () => {
		const store = memoryStore();
		store.set({ guildId: "g-1", language: "ar", defaultReciter: 1, defaultRewayah: 1 });
		const config = new GuildConfig(store);

		const outcome = await resolvePlay(catalog, config, NO_DEFAULTS, "g-1", alKahf);

		assert.equal(outcome.kind, "picker");

		if (outcome.kind !== "picker") return;

		assert.equal(outcome.choices.length, 2);
		assert.deepEqual(outcome.choices[0], {
			surahNumber: 18,
			reciterId: 1,
			reciterName: "إبراهيم الأخضر",
			rewayahId: 1,
			rewayahName: "حفص عن عاصم - مرتل",
		});
		assert.equal(outcome.defaultChoice?.rewayahId, 1);
	});

	it("shows the picker when the default Rewayah does not cover, as unresolved not an error", async () => {
		const store = memoryStore();
		store.set({ guildId: "g-1", language: "ar", defaultReciter: 10, defaultRewayah: 99 });
		const config = new GuildConfig(store);

		const outcome = await resolvePlay(catalog, config, NO_DEFAULTS, "g-1", alKahf);

		assert.equal(outcome.kind, "picker");

		if (outcome.kind !== "picker") return;

		assert.equal(outcome.choices.length, 1);
		assert.equal(outcome.choices[0]!.rewayahId, 10);
		assert.equal(outcome.defaultChoice, undefined);
	});

	it("prefers the command reciter option over the guild default", async () => {
		const store = memoryStore();
		store.set({ guildId: "g-1", language: "ar", defaultReciter: 10, defaultRewayah: 10 });
		const config = new GuildConfig(store);

		const outcome = await resolvePlay(catalog, config, NO_DEFAULTS, "g-1", alKahf, "إبراهيم الأخضر");

		assert.equal(outcome.kind, "picker");
		assert.equal(outcome.kind === "picker" && outcome.reciterName, "إبراهيم الأخضر");
	});

	it("returns an error when no reciter resolves anywhere", async () => {
		const outcome = await resolvePlay(catalog, guildConfig(), NO_DEFAULTS, "g-1", alKahf);

		assert.equal(outcome.kind, "error");
		assert.match(outcome.kind === "error" ? outcome.message : "", /default reciter/);
	});

	it("returns an error when the reciter option is unknown", async () => {
		const outcome = await resolvePlay(catalog, guildConfig(), NO_DEFAULTS, "g-1", alKahf, "أبو العيون");

		assert.equal(outcome.kind, "error");
		assert.match(outcome.kind === "error" ? outcome.message : "", /Abu.*not found|أبو العيون/);
	});

	it("returns an error when no Rewayah covers the Surah for the Reciter", async () => {
		const outcome = await resolvePlay(catalog, guildConfig(), NO_DEFAULTS, "g-1", alKahf, "محمد صديق المنشاوي");

		assert.equal(outcome.kind, "error");
		assert.match(outcome.kind === "error" ? outcome.message : "", /no recitation/);
	});
});

describe("buildRecitationFromChoice", () => {
	it("resolves a full Recitation from a picker choice", async () => {
		const choice: RewayahChoice = {
			surahNumber: 18,
			reciterId: 10,
			reciterName: "أكرم العلاقمي",
			rewayahId: 10,
			rewayahName: "حفص عن عاصم - مرتل",
		};

		const recitation = await buildRecitationFromChoice(catalog, choice);

		assert.deepEqual(recitation, {
			surah: { number: 18, name: "الكهف", names: { en: "Al-Kahf" } },
			reciterId: 10,
			reciterName: "أكرم العلاقمي",
			rewayahId: 10,
			rewayahName: "حفص عن عاصم - مرتل",
			url: "https://fixture/mc10/018.mp3",
		});
	});
});