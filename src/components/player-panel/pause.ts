import type { Component } from "../../core/Component";
import { PANEL_PAUSE_CUSTOM_ID, updatePanel } from "../../play/playerPanel";
import { followUpWithAutoDelete } from "./autoDelete";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	match: (customId) => customId === PANEL_PAUSE_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		const wasPaused = player.isPaused;

		await interaction.deferUpdate();

		if (wasPaused) player.unpause();
		else player.pause();

		updatePanel(player.guildId);

		await followUpWithAutoDelete(interaction, {
			content: context.translator.t(
				wasPaused ? "panel.resumed" : "panel.paused",
			),
		});
	},
};

export default component;
