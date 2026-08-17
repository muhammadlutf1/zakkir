import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const leaveCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("leave")
		.setDescription("Leave your voice channel"),

	async execute(context, interaction) {
		if (!interaction.inCachedGuild()) return;

		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: "I'm not in a voice channel!",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		player.dispose();
		context.players.remove(interaction.guildId);

		await interaction.reply("Left your voice channel!");
	},
};

export default leaveCommand;
