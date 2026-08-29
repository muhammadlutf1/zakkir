import {
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../core/Command";
import {
	createPanel,
	hasPanel,
	repostPanel,
	updatePanel,
} from "../play/playerPanel";

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

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const hasManageGuild =
			interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) ||
			(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
				false);

		const channel = interaction.channel ?? player.noticeChannel;

		if (hasManageGuild) {
			if (channel && "send" in channel) {
				await repostPanel(player, channel, context.locale);
			}
		} else if (hasPanel(interaction.guildId)) {
			updatePanel(interaction.guildId);
		} else if (channel && "send" in channel) {
			await createPanel(player, channel, context.locale);
		}

		await interaction.editReply({
			content: context.translator.t("panel.showing"),
		});
	},
};

export default panelCommand;
