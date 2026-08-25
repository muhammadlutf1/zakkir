import { ChannelType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const joinCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("join")
		.setDescription("Join your voice channel"),

	async execute(context, interaction) {
		const channel = interaction.member.voice.channel;

		if (!channel || channel.type === ChannelType.GuildStageVoice) {
			await interaction.reply({
				content: context.translator.t("command.needVoice"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const existing = context.players.get(interaction.guildId);

		if (existing?.isOccupied) {
			const channelMention = existing.voiceChannelId
				? `<#${existing.voiceChannelId}>`
				: "a voice channel";
			await interaction.reply({
				content: context.translator.t("command.joinBlocked", {
					channel: channelMention,
				}),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const player = context.players.getOrCreate(interaction.guildId);

		await player.join(channel);

		await interaction.reply(
			context.translator.t("command.joined", { channel: channel.name }),
		);
	},
};

export default joinCommand;
