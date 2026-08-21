import type { Component } from "../../core/Component";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	id: "player-panel-stop",
	match: (customId) => customId === "player-panel:stop",

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		await interaction.deferUpdate();

		player.endSession();
	},
};

export default component;
