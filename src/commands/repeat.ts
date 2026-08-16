import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";
import { RepeatMode } from "../voice/Queue";

const REPEAT_CHOICES = [
	{ name: "Off", value: RepeatMode.OFF },
	{ name: "Repeat Track", value: RepeatMode.TRACK },
	{ name: "Repeat All", value: RepeatMode.ALL },
];

const repeatCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("repeat")
		.setDescription("Set the repeat mode")
		.addStringOption((option) =>
			option
				.setName("mode")
				.setDescription(
					"Off: play once; Track: replay the current; All: loop the queue",
				)
				.setRequired(true)
				.addChoices(...REPEAT_CHOICES),
		),

	async execute(bot, interaction) {
		if (!interaction.inCachedGuild()) return;
		if (!interaction.isChatInputCommand()) return;

		const player = bot.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: "I'm not in a voice channel!",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const mode = interaction.options.getString("mode", true) as RepeatMode;

		player.setRepeatMode(mode);

		await interaction.reply(`Repeat mode set to ${mode}.`);
	},
};

export default repeatCommand;
