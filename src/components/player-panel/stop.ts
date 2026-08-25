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
		setPanelStatus(player.guildId, {
			kind: "stoppedBy",
			user: mention,
		});

		await interaction.deferUpdate();

		player.endSession();
	},
};

export default component;
