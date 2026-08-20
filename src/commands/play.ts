import { ChannelType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";
import { formatPlayResult } from "../play/playResult";
import { resolvePlay } from "../play/resolvePlay";
import {
	RewayahPickerSession,
	renderPicker,
} from "../play/rewayahPicker";

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
				.setDescription("Reciter name (defaults to the server default)"),
		),

	async autocomplete(context, interaction) {
		const query = interaction.options
			.getFocused()
			.toString()
			.trim()
			.toLowerCase();
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
		if (!interaction.inCachedGuild()) return;

		const channel = interaction.member.voice.channel;

		if (!channel || channel.type === ChannelType.GuildStageVoice) {
			await interaction.reply({
				content: "You need to be in a voice channel to use this command!",
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
				content: `Couldn't find surah "${surahInput}". Use the autocomplete or a number 1-114.`,
			});
			return;
		}

		const locale = context.guildConfigs.language(interaction.guildId);

		const outcome = await resolvePlay(
			context.catalog,
			context.guildConfigs,
			context.play.defaults,
			interaction.guildId,
			surah,
			reciterOption,
			locale,
		);

		if (outcome.kind === "error") {
			await interaction.editReply({ content: outcome.message });
			return;
		}

		const player = context.players.getOrCreate(interaction.guildId);
		await player.join(channel);

		if (interaction.channel) {
			player.setNoticeChannel(interaction.channel);
		}

		if (outcome.kind === "play") {
			const result = await player.play(outcome.recitation);

			await interaction.editReply({
				content: formatPlayResult(outcome.recitation, result, locale),
			});
			return;
		}

		const message = await interaction.editReply(renderPicker(outcome));

		new RewayahPickerSession(message.id, {
			timeoutMs: context.play.pickerTimeoutMs,
			defaultChoice: outcome.defaultChoice,
			catalog: context.catalog,
			player,
			locale: outcome.locale,
			followUp: (content) =>
				interaction.followUp({ content, flags: MessageFlags.Ephemeral }),
		});
	},
};

export default playCommand;
