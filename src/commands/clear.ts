import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const clearCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("clear")
		.setDescription("Clear the queue"),

	async execute(context, interaction) {
		if (!interaction.inCachedGuild()) return;

		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply(context.t.t("command.notInVoice"));
			return;
		}

		player.clearQueue();

		await interaction.reply(context.t.t("command.queueCleared"));
	},
};

export default clearCommand;
