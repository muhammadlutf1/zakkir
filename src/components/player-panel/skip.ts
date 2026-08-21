import type { Component } from "../../core/Component";
import { updatePanel } from "../../play/playerPanel";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	id: "player-panel-skip",
	match: (customId) => customId === "player-panel:skip",

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		await interaction.deferUpdate();

		await player.skip();

		updatePanel(player.guildId);
	},
};

export default component;
