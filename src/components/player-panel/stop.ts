import type { Component } from "../../core/Component";
import { PANEL_STOP_CUSTOM_ID, setPanelStatus } from "../../play/playerPanel";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	id: "player-panel-stop",
	match: (customId) => customId === PANEL_STOP_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		const userId = (interaction as { user?: { id?: string } }).user?.id;
		const displayName =
			(interaction.member as { user?: { username?: string } } | null)?.user
				?.username ??
			(interaction as { user?: { username?: string } }).user?.username ??
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
