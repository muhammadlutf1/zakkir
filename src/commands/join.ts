import { ChannelType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const joinCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("join")
		.setDescription("Join your voice channel"),

	async execute(context, interaction) {
		if (!interaction.inCachedGuild()) return;

		const channel = interaction.member.voice.channel;

		if (!channel || channel.type === ChannelType.GuildStageVoice) {
			await interaction.reply({
				content: context.t.t("command.needVoice"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const player = context.players.getOrCreate(interaction.guildId);

		await player.join(channel);

		await interaction.reply(
			context.t.t("command.joined", { channel: channel.name }),
		);
	},
};

export default joinCommand;
