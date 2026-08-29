import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { gateOrVoteStarted } from "../access/actionGate";
import type { Command } from "../core/Command";

const clearCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("clear")
		.setDescription("Clear all upcoming recitations — current keeps playing"),

	async execute(context, interaction) {
		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: context.translator.t("command.nothingPlaying"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (
			!(await gateOrVoteStarted(
				{
					player,
					member: interaction.member,
					guildId: interaction.guildId,
					locale: context.locale,
					translator: context.translator,
					votes: context.votes,
					channel: interaction.channel ?? undefined,
					action: context.translator.t("vote.action.clear"),
					onPass: async () => {
						player.clearQueue();
					},
				},
				interaction,
				context.translator,
			))
		) {
			return;
		}

		player.clearQueue();

		await interaction.reply(context.translator.t("command.queueCleared"));
	},
};

export default clearCommand;
