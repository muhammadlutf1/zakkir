import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";
import { repeatModeLabel } from "../i18n/repeatModeLabel";
import { RepeatMode } from "../voice/Queue";

const REPEAT_CHOICES = [
	{ name: "Off", value: RepeatMode.OFF },
	{ name: "Repeat Current", value: RepeatMode.CURRENT },
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
					"Off: play once; Current: replay the current; All: loop the queue",
				)
				.setRequired(true)
				.addChoices(...REPEAT_CHOICES),
		),

	async execute(context, interaction) {
		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: context.translator.t("command.nothingPlaying"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const mode = interaction.options.getString("mode", true) as RepeatMode;

		player.setRepeatMode(mode);

		await interaction.reply(
			context.translator.t("command.repeatSet", {
				mode: repeatModeLabel(context.translator, mode),
			}),
		);
	},
};

export default repeatCommand;
