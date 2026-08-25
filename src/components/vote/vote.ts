import { MessageFlags } from "discord.js";
import {
	VOTE_NO_CUSTOM_ID,
	VOTE_YES_CUSTOM_ID,
} from "../../access/VoteManager";
import type { Component } from "../../core/Component";

const component: Component = {
	match: (customId) =>
		customId === VOTE_YES_CUSTOM_ID || customId === VOTE_NO_CUSTOM_ID,

	async execute(context, interaction) {
		await interaction.deferUpdate();
		const choice = interaction.customId === VOTE_YES_CUSTOM_ID ? "yes" : "no";
		const result = await context.votes?.handleVote(
			interaction.guildId,
			interaction.user.id,
			choice,
		);

		if (result === "alreadyVoted") {
			await interaction.followUp({
				content: context.translator.t("vote.alreadyVoted"),
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};

export default component;
