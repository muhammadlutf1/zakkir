import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";
import { recitationLabel } from "../i18n/recitationLabel";

const skipCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("skip")
		.setDescription("Skip the current recitation"),

	async execute(context, interaction) {
		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: context.translator.t("command.notInVoice"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const wasPlaying = player.isPlaying;
		const result = await player.skip();

		if (!wasPlaying) {
			await interaction.reply({
				content: context.translator.t("command.nothingToSkip"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!result.started) {
			await interaction.reply(context.translator.t("command.playbackEnded"));
			return;
		}

		const current = player.queueView.current;

		await interaction.reply(
			current
				? context.translator.t("command.nowPlaying", {
						label: recitationLabel(current, context.locale),
					})
				: context.translator.t("command.skipped"),
		);
	},
};

export default skipCommand;
