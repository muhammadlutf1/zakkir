import { gateOrVoteStarted } from "../../access/actionGate";
import type { Component } from "../../core/Component";
import { PANEL_STOP_CUSTOM_ID, setPanelStatus } from "../../play/playerPanel";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	match: (customId) => customId === PANEL_STOP_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		const userId = interaction.user.id;
		const displayName =
			interaction.member.user.username ??
			interaction.user.username ??
			"someone";
		const mention = userId ? `<@${userId}> (${displayName})` : displayName;

		const act = async () => {
			setPanelStatus(player.guildId, {
				kind: "stoppedBy",
				user: mention,
			});
			player.endSession();
		};

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
					action: context.translator.t("vote.action.stop"),
					onPass: act,
				},
				interaction,
				context.translator,
			))
		) {
			return;
		}

		await interaction.deferUpdate();

		await act();
	},
};

export default component;
