import { ChannelType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { config } from "../config";
import type { Command } from "../core/Command";
import { setGuildNoticeChannel } from "../play/noticeChannels";
import { resolvePlay } from "../play/resolvePlay";
import {
	handlePickerTimeout,
	registerPickerTimeout,
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

	async autocomplete(bot, interaction) {
		const query = interaction.options
			.getFocused()
			.toString()
			.trim()
			.toLowerCase();
		const matches = bot.catalog.surahList
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

	async execute(bot, interaction) {
		if (!interaction.isChatInputCommand()) return;

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

		const surah = bot.catalog.resolveSurah(surahInput);

		if (!surah) {
			await interaction.editReply({
				content: `Couldn't find surah "${surahInput}". Use the autocomplete or a number 1-114.`,
			});
			return;
		}

		const outcome = await resolvePlay(
			bot.catalog,
			bot.guildConfigs,
			config.defaults,
			interaction.guildId,
			surah,
			reciterOption,
		);

		if (outcome.kind === "error") {
			await interaction.editReply({ content: outcome.message });
			return;
		}

		const player = bot.players.getOrCreate(interaction.guildId);
		await player.join(channel);

		if (interaction.channel) {
			setGuildNoticeChannel(interaction.guildId, interaction.channel);
		}

		if (outcome.kind === "play") {
			const result = await player.play(outcome.recitation);

			await interaction.editReply({
				content: result.queued
					? `Added to the queue: ${outcome.recitation.surah.name} by ${outcome.recitation.reciterName} (${outcome.recitation.rewayahName}).`
					: result.started
						? `Playing ${outcome.recitation.surah.name} by ${outcome.recitation.reciterName} (${outcome.recitation.rewayahName}).`
						: `Couldn't play ${outcome.recitation.surah.name}. A notice was posted to the channel.`,
			});
			return;
		}

		const message = await interaction.editReply(renderPicker(outcome));

		registerPickerTimeout(message.id, {
			timeoutMs: config.rewayahPicker.timeoutMs,
			onTimeout: () =>
				handlePickerTimeout(
					{
						catalog: bot.catalog,
						player,
						followUp: (content) =>
							interaction.followUp({
								content,
								flags: MessageFlags.Ephemeral,
							}),
					},
					outcome.defaultChoice,
				),
		});
	},
};

export default playCommand;
