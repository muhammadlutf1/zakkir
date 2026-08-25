import {
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import type { Reciter, Rewayah } from "../catalog/Catalog";
import { DEFAULT_LOCALE } from "../config";
import type { Command } from "../core/Command";
import { LOCALES, type Locale, type Localizable } from "../i18n/locale";
import type { MessageKey } from "../i18n/messages";

const LANGUAGE_NAME_KEYS: Record<Locale, MessageKey> = {
	en: "language.name.en",
	ar: "language.name.ar",
};

/** The localized noun a `notFound` notice refers to ("reciter" / "rewayah"). */
const PREFERENCE_NOUN_KEYS: Record<"reciter" | "rewayah", MessageKey> = {
	reciter: "preferences.reciter",
	rewayah: "preferences.rewayah",
};

/**
 * Renders the display name of a language option in that language's own name.
 * Lives here so the `/preferences` command stays free of locale-switching
 * logic in the reply-writing step.
 */
function languageName(translator: Localizable, locale: Locale) {
	return translator.t(LANGUAGE_NAME_KEYS[locale]);
}

/**
 * The `/preferences` command — persists the guild's UI language and playback
 * defaults through the guild-config layer. Every reply is public and
 * localized; `reciter` and `rewayah` autocomplete from the
 * localized Catalog.
 */
const preferencesCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("preferences")
		.setDescription("View or change this server's playback preferences")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("list")
				.setDescription("Show the server's current preferences"),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("language")
				.setDescription("Set the server's UI language")
				.addStringOption((option) =>
					option
						.setName("locale")
						.setDescription("The language bot replies render in")
						.setRequired(true)
						.addChoices(
							...LOCALES.map((locale) => ({
								name: locale,
								value: locale,
							})),
						),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("reciter")
				.setDescription("Set the server's default reciter")
				.addStringOption((option) =>
					option
						.setName("reciter")
						.setDescription("The reciter used when /play omits one")
						.setRequired(true)
						.setAutocomplete(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("rewayah")
				.setDescription("Set the server's default rewayah")
				.addStringOption((option) =>
					option
						.setName("rewayah")
						.setDescription("The rewayah used when /play omits one")
						.setRequired(true)
						.setAutocomplete(true),
				),
		),

	async autocomplete(context, interaction) {
		const focused = interaction.options.getFocused(true);
		const query = focused.value.trim().toLowerCase();

		const reciters = await context.catalog.fetchReciters();

		// Reciter and rewayah names arrive in the guild's locale; match against
		// the localized name while the value carries the stable numeric id.
		const matches =
			focused.name === "reciter"
				? reciters
						.filter((reciter) => reciter.name.toLowerCase().includes(query))
						.slice(0, 25)
				: reciters
						.flatMap((reciter) => reciter.rewayat)
						.filter((rewayah) => rewayah.name.toLowerCase().includes(query))
						.slice(0, 25);

		await interaction.respond(
			matches.map((match) => ({ name: match.name, value: String(match.id) })),
		);
	},

	async execute(context, interaction) {
		const rawMember = interaction.member as unknown as
			| { permissions?: { has: (flag: bigint) => boolean } }
			| undefined;
		const hasFromMember =
			rawMember?.permissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
		const memberPermissions = (
			interaction as unknown as {
				memberPermissions?: { has: (flag: bigint) => boolean };
			}
		).memberPermissions;
		const hasFromPermissions =
			memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
		const hasNeitherSource = !rawMember?.permissions && !memberPermissions;
		const hasManageGuild =
			hasFromMember || hasFromPermissions || hasNeitherSource;

		if (!hasManageGuild) {
			await interaction.reply({
				content: context.translator.t("command.manageGuildRequired"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const subcommand = interaction.options.getSubcommand();
		const { translator, guildConfigs } = context;

		if (subcommand === "list") {
			const data = guildConfigs.get(interaction.guildId);
			const language = data?.language ?? DEFAULT_LOCALE;
			const reciter = (data?.defaultReciter &&
				(await context.catalog.resolveReciterById(data.defaultReciter))) as
				| Reciter
				| undefined;
			const rewayah = (data?.defaultRewayah &&
				(await context.catalog.resolveRewayahById(data.defaultRewayah))) as
				| Rewayah
				| undefined;

			await interaction.reply(
				[
					translator.t("preferences.current"),
					translator.t("preferences.showLanguage", {
						lang: languageName(translator, language),
					}),
					translator.t("preferences.showReciter", {
						reciter: reciter?.name ?? translator.t("preferences.unset"),
					}),
					translator.t("preferences.showRewayah", {
						rewayah: rewayah?.name ?? translator.t("preferences.unset"),
					}),
				].join("\n"),
			);
			return;
		}

		if (subcommand === "language") {
			const locale = interaction.options.getString("locale", true) as Locale;

			guildConfigs.set(interaction.guildId, { language: locale });

			await interaction.reply(
				translator.t("preferences.languageSet", {
					lang: languageName(translator, locale),
				}),
			);
			return;
		}

		if (subcommand === "reciter") {
			const id = Number(interaction.options.getString("reciter", true));
			const reciter = await context.catalog.resolveReciterById(id);

			if (!reciter) {
				await interaction.reply(
					translator.t("preferences.notFound", {
						what: translator.t(PREFERENCE_NOUN_KEYS.reciter),
					}),
				);
				return;
			}

			guildConfigs.set(interaction.guildId, { defaultReciter: id });

			await interaction.reply(
				translator.t("preferences.reciterSet", { reciter: reciter.name }),
			);
			return;
		}

		// rewayah
		const id = Number(interaction.options.getString("rewayah", true));
		const rewayah = await context.catalog.resolveRewayahById(id);

		if (!rewayah) {
			await interaction.reply(
				translator.t("preferences.notFound", {
					what: translator.t(PREFERENCE_NOUN_KEYS.rewayah),
				}),
			);
			return;
		}

		guildConfigs.set(interaction.guildId, { defaultRewayah: id });

		await interaction.reply(
			translator.t("preferences.rewayahSet", { rewayah: rewayah.name }),
		);
	},
};

export default preferencesCommand;
