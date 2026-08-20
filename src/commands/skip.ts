import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";
import { recitationLabel } from "../voice/Recitation";

const skipCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("skip")
		.setDescription("Skip the current recitation"),

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

		const wasPlaying = player.isPlaying;
		const result = await player.skip();

		if (!wasPlaying) {
			await interaction.reply({
				content: "Nothing is playing to skip.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!result.started) {
			await interaction.reply("Playback ended — nothing is queued.");
			return;
		}

		const current = player.queueView.current;

		await interaction.reply(
			current
				? `Now playing ${recitationLabel(
						current,
						context.guildConfigs.language(interaction.guildId),
					)}.`
				: "Skipped.",
		);
	},
};

export default skipCommand;
