import { ChannelType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const playCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("play")
		.setDescription("Play a Surah recitation in your voice channel")
		.addStringOption((option) =>
			option
				.setName("surah")
				.setDescription("Surah name or number (1-114)")
				.setAutocomplete(true)
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName("reciter")
				.setDescription("Reciter name (defaults to the server default)")
				.setAutocomplete(true),
		),

	async autocomplete(context, interaction) {
		const focused = interaction.options.getFocused(true);
		const query = focused.value.trim().toLowerCase();

		// Reciters come from the localized Catalog; the value carries the
		// localized name so `/play`'s name-based resolution picks it up.
		if (focused.name === "reciter") {
			const reciters = await context.catalog.fetchReciters();
			const matches = reciters
				.filter((reciter) => reciter.name.toLowerCase().includes(query))
				.slice(0, 25);

			await interaction.respond(
				matches.map((reciter) => ({
					name: reciter.name,
					value: reciter.name,
				})),
			);
			return;
		}

		const matches = context.catalog.surahList
			.filter(
				(surah) =>
					surah.name.toLowerCase().includes(query) ||
					String(surah.number).includes(query),
			)
			.slice(0, 25);

		await interaction.respond(
			matches.map((surah) => ({
				name: `${surah.number}. ${surah.name}`,
				value: String(surah.number),
			})),
		);
	},

	async execute(context, interaction) {
		const channel = interaction.member.voice.channel;

		if (!channel || channel.type === ChannelType.GuildStageVoice) {
			await interaction.reply({
				content: context.translator.t("command.needVoice"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply({ ephemeral: true });

		const surahInput = interaction.options.getString("surah", true);
		const reciterOption = interaction.options.getString("reciter") ?? undefined;

		const surah = context.catalog.resolveSurah(surahInput);

		if (!surah) {
			await interaction.editReply({
				content: context.translator.t("command.playNotFound", {
					input: surahInput,
				}),
			});
			return;
		}

		const locale = context.locale;

		// One seam call: PlaybackRequest resolves, plays or shows the picker,
		// handles the radio-confirm branch, and replies through the sinks.
		await context.playback.request({
			guildId: interaction.guildId,
			catalog: context.catalog,
			surah,
			reciter: reciterOption,
			locale,
			translator: context.translator,
			voiceChannel: channel,
			noticeChannel: interaction.channel ?? undefined,
			requestedBy: interaction.user.id,
			editReply: (reply) => interaction.editReply(reply),
			followUp: (content) =>
				interaction.followUp({ content, flags: MessageFlags.Ephemeral }),
		});
	},
};

export default playCommand;
