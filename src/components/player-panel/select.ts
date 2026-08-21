import type { Component } from "../../core/Component";
import { updatePanel } from "../../play/playerPanel";
import { resolvePanelPlayer } from "./shared";

const TRACK_VALUE_PREFIX = "track-";

const component: Component = {
	id: "player-panel-select",
	match: (customId) => customId === "player-panel:select",

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		if (!interaction.isStringSelectMenu()) return;

		await interaction.deferUpdate();

		const value = interaction.values[0];

		if (!value?.startsWith(TRACK_VALUE_PREFIX)) return;

		const index = Number.parseInt(value.slice(TRACK_VALUE_PREFIX.length), 10);

		if (Number.isNaN(index)) return;

		await player.jumpTo(index);

		updatePanel(player.guildId);
	},
};

export default component;
