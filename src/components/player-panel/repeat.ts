import { MessageFlags } from "discord.js";
import type { Component } from "../../core/Component";
import { PANEL_REPEAT_CUSTOM_ID } from "../../play/playerPanel";
import { buildRepeatRow, resolvePanelPlayer } from "./shared";

const component: Component = {
	id: "player-panel-repeat",
	match: (customId) => customId === PANEL_REPEAT_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		await interaction.reply({
			components: [buildRepeatRow(player.repeatMode)],
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default component;
