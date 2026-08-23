import { MessageFlags } from "discord.js";
import type { Component } from "../../core/Component";
import { PANEL_PAUSE_CUSTOM_ID, updatePanel } from "../../play/playerPanel";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	id: "player-panel-pause",
	match: (customId) => customId === PANEL_PAUSE_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		const wasPaused = player.isPaused;

		await interaction.deferUpdate();

		if (wasPaused) player.unpause();
		else player.pause();

		updatePanel(player.guildId);

		await interaction.followUp({
			content: context.translator.t(
				wasPaused ? "panel.resumed" : "panel.paused",
			),
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default component;
