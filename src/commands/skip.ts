import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";
import { recitationLabel } from "../i18n/recitationLabel";

const skipCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("skip")
		.setDescription("Skip the current recitation"),

	async execute(context, interaction) {
		if (!interaction.inCachedGuild()) return;

		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: context.t.t("command.notInVoice"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const wasPlaying = player.isPlaying;
		const result = await player.skip();

		if (!wasPlaying) {
			await interaction.reply({
				content: context.t.t("command.nothingToSkip"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!result.started) {
			await interaction.reply(context.t.t("command.playbackEnded"));
			return;
		}

		const current = player.queueView.current;

		await interaction.reply(
			current
				? context.t.t("command.nowPlaying", {
						label: recitationLabel(current, context.locale),
					})
				: context.t.t("command.skipped"),
		);
	},
};

export default skipCommand;
