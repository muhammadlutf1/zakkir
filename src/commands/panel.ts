import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";
import { createPanel, hasPanel, updatePanel } from "../play/playerPanel";

const panelCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("panel")
		.setDescription("Show the player panel"),

	async execute(context, interaction) {
		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: context.translator.t("command.notInVoice"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (hasPanel(interaction.guildId)) {
			updatePanel(interaction.guildId);
		} else {
			const channel = interaction.channel ?? player.noticeChannel;

			if (channel && "send" in channel) {
				await createPanel(player, channel, context.locale);
			}
		}

		await interaction.reply({
			content: context.translator.t("panel.showing"),
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default panelCommand;
