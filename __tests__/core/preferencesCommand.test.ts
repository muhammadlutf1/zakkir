import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Catalog, Reciter, Rewayah } from "../../src/catalog/Catalog";
import preferencesCommand from "../../src/commands/preferences";
import type { CommandContext } from "../../src/core/interactionContext";
import { GuildConfig } from "../../src/guild/GuildConfig";
import { SqliteGuildConfigStore } from "../../src/guild/SqliteGuildConfigStore";
import { ar, en } from "../../src/i18n/messages";
import { localizable, t } from "../../src/i18n/locale";

const rewayah = (id: number, name: string): Rewayah => ({
	id,
	name,
	server: `https://fixture/mc${id}`,
	surahList: new Set([18]),
	surahCount: 1,
});

const FIXTURES: Reciter[] = [
	{
		id: 10,
		name: "أكرم العلاقمي",
		rewayat: [rewayah(100, "حفص عن عاصم - مرتل")],
	},
	{ id: 11, name: "مشاري العفاسي", rewayat: [] },
];

class FakeCatalog {
	fetchReciters() {
		return FIXTURES;
	}

	resolveReciterById(id: number) {
		return FIXTURES.find((reciter) => reciter.id === id);
	}

	async resolveRewayahById(id: number) {
		for (const reciter of FIXTURES) {
			const match = reciter.rewayat.find((r) => r.id === id);
			if (match) return match;
		}
		return undefined;
	}
}

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
	return {
		players: {} as CommandContext["players"],
		catalog: new FakeCatalog() as unknown as Catalog,
		guildConfigs: new GuildConfig(new SqliteGuildConfigStore(":memory:")),
		play: {} as CommandContext["play"],
		locale: "en",
		translator: localizable("en"),
		...overrides,
	};
}

interface MockInteraction {
	inCachedGuild: () => boolean;
	guildId: string;
	options: {
		getSubcommand: () => string | null;
		getString: (key: string) => string | undefined;
	};
	reply: (payload: string) => Promise<void>;
}

function run(context: CommandContext, interaction: MockInteraction) {
	return preferencesCommand.execute(context, interaction as never);
}

async function capture(): Promise<{
	replies: string[];
	interaction: MockInteraction;
}> {
	const replies: string[] = [];
	const interaction: MockInteraction = {
		inCachedGuild: () => true,
		guildId: "g-1",
		options: {
			getSubcommand: () => "",
			getString: () => undefined,
		},
		reply: async (payload: string) => {
			replies.push(payload);
		},
	};
	return { replies, interaction };
}

describe("preferences command", () => {
	it("shows the current preferences when invoked with no subcommand", async () => {
		const context = makeContext();
		const { replies, interaction } = await capture();
		interaction.options.getSubcommand = () => null;

		await run(context, interaction);

		assert.equal(
			replies[0],
			[
				en["preferences.current"],
				t(en["preferences.showLanguage"], { lang: en["language.name.en"] }),
				t(en["preferences.showReciter"], { reciter: en["preferences.unset"] }),
				t(en["preferences.showRewayah"], { rewayah: en["preferences.unset"] }),
			].join("\n"),
		);
	});

	it("shows the saved defaults in the summary when set", async () => {
		const context = makeContext();
		context.guildConfigs.set("g-1", {
			language: "ar",
			defaultReciter: 10,
			defaultRewayah: 100,
		});
		// The summary resolves names in the guild's (now Arabic) locale.
		context.locale = "ar";
		context.translator = localizable("ar");

		const { replies, interaction } = await capture();
		interaction.options.getSubcommand = () => null;

		await run(context, interaction);

		assert.equal(
			replies[0],
			[
				ar["preferences.current"],
				t(ar["preferences.showLanguage"], { lang: ar["language.name.ar"] }),
				t(ar["preferences.showReciter"], { reciter: "أكرم العلاقمي" }),
				t(ar["preferences.showRewayah"], { rewayah: "حفص عن عاصم - مرتل" }),
			].join("\n"),
		);
	});

	it("persists the UI language and confirms publicly in the guild's locale", async () => {
		const context = makeContext();
		const { replies, interaction } = await capture();
		interaction.options.getSubcommand = () => "language";
		interaction.options.getString = (key) => (key === "locale" ? "ar" : undefined);

		await run(context, interaction);

		assert.equal(context.guildConfigs.language("g-1"), "ar");
		assert.equal(
			replies[0],
			t(en["preferences.languageSet"], { lang: en["language.name.ar"] }),
		);
	});

	it("persists the default reciter and confirms with its localized name", async () => {
		const context = makeContext();
		const { replies, interaction } = await capture();
		interaction.options.getSubcommand = () => "reciter";
		interaction.options.getString = (key) =>
			key === "reciter" ? "10" : undefined;

		await run(context, interaction);

		assert.equal(context.guildConfigs.get("g-1")?.defaultReciter, 10);
		assert.equal(
			replies[0],
			t(en["preferences.reciterSet"], { reciter: "أكرم العلاقمي" }),
		);
	});

	it("persists the default rewayah and confirms with its localized name", async () => {
		const context = makeContext();
		const { replies, interaction } = await capture();
		interaction.options.getSubcommand = () => "rewayah";
		interaction.options.getString = (key) =>
			key === "rewayah" ? "100" : undefined;

		await run(context, interaction);

		assert.equal(context.guildConfigs.get("g-1")?.defaultRewayah, 100);
		assert.equal(
			replies[0],
			t(en["preferences.rewayahSet"], { rewayah: "حفص عن عاصم - مرتل" }),
		);
	});

	it("rejects an unknown reciter with a localized notice", async () => {
		const context = makeContext();
		const { replies, interaction } = await capture();
		interaction.options.getSubcommand = () => "reciter";
		interaction.options.getString = (key) =>
			key === "reciter" ? "999" : undefined;

		await run(context, interaction);

		assert.equal(
			replies[0],
			t(en["preferences.notFound"], { what: en["preferences.reciter"] }),
		);
		assert.equal(context.guildConfigs.get("g-1")?.defaultReciter, undefined);
	});
});

describe("preferences command autocomplete", () => {
	it("offers reciters with their localized names and stable ids", async () => {
		const context = makeContext();
		const responses: Array<{ name: string; value: string }> = [];

		await preferencesCommand.autocomplete?.(
			context,
			{
				options: {
					getFocused: () => ({ name: "reciter", value: "ش" }),
				},
				respond: async (payload: Array<{ name: string; value: string }>) => {
					responses.push(...payload);
				},
			} as never,
		);

		assert.deepEqual(
			responses.map((r) => r.value),
			["11"],
		);
		assert.equal(responses[0]?.name, "مشاري العفاسي");
	});

	it("offers rewayat with their localized names and stable ids", async () => {
		const context = makeContext();
		const responses: Array<{ name: string; value: string }> = [];

		await preferencesCommand.autocomplete?.(
			context,
			{
				options: {
					getFocused: () => ({ name: "rewayah", value: "حفص" }),
				},
				respond: async (payload: Array<{ name: string; value: string }>) => {
					responses.push(...payload);
				},
			} as never,
		);

		assert.deepEqual(
			responses.map((r) => r.value),
			["100"],
		);
		assert.equal(responses[0]?.name, "حفص عن عاصم - مرتل");
	});
});