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
		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: context.translator.t("command.notInVoice"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const position = interaction.options.getInteger("position", true);
		const upcoming = player.queueView.upcoming;

		if (position > upcoming.length) {
			await interaction.reply({
				content: context.translator.t("command.onlyQueued", {
					count: upcoming.length,
					s: upcoming.length === 1 ? "" : "s",
				}),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		// Queue positions are 1-based over the whole queue (current at 1), so an
		// upcoming position N maps to queue position N + 1.
		player.remove(position + 1);

		await interaction.reply(
			context.translator.t("command.removed", { position: String(position) }),
		);
	},
};

export default removeCommand;
