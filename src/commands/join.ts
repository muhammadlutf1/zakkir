import { ChannelType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const joinCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("join")
		.setDescription("Join your voice channel"),

	async execute(bot, interaction) {
		if (!interaction.inCachedGuild()) return;

		const channel = interaction.member.voice.channel;

		if (!channel || channel.type === ChannelType.GuildStageVoice) {
			await interaction.reply({
				content: "You need to be in a voice channel to use this command!",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const player = bot.players.getOrCreate(interaction.guildId);

		await player.join(channel);

		await interaction.reply(`Joined ${channel.name}!`);
	},
};

export default joinCommand;
