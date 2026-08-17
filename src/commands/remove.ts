import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const removeCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("remove")
		.setDescription("Remove a queued recitation")
		.addIntegerOption((option) =>
			option
				.setName("position")
				.setDescription("1-based position of the queued recitation to remove")
				.setRequired(true)
				.setMinValue(1),
		),

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

		const position = interaction.options.getInteger("position", true);
		const upcoming = player.queueView.upcoming;

		if (position > upcoming.length) {
			await interaction.reply({
				content: `There are only ${upcoming.length} queued recitation${upcoming.length === 1 ? "" : "s"}.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		// Queue positions are 1-based over the whole queue (current at 1), so an
		// upcoming position N maps to queue position N + 1.
		player.remove(position + 1);

		await interaction.reply(
			`Removed queued recitation at position ${position}.`,
		);
	},
};

export default removeCommand;
