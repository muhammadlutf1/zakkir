import type { Component } from "../../core/Component";
import { updatePanel } from "../../play/playerPanel";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	id: "player-panel-pause",
	match: (customId) => customId === "player-panel:pause",

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		await interaction.deferUpdate();

		if (player.isPaused) player.unpause();
		else player.pause();

		updatePanel(player.guildId);
	},
};

export default component;
