import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const clearCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("clear")
		.setDescription("Clear the queue"),

	async execute(context, interaction) {
		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: context.translator.t("command.nothingPlaying"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		player.clearQueue();

		await interaction.reply(context.translator.t("command.queueCleared"));
	},
};

export default clearCommand;
