import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const clearCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("clear")
		.setDescription("Clear the queue"),

	async execute(bot, interaction) {
		if (!interaction.inCachedGuild()) return;

		const player = bot.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply("I'm not in a voice channel!");
			return;
		}

		player.clearQueue();

		await interaction.reply("Cleared the queue.");
	},
};

export default clearCommand;
