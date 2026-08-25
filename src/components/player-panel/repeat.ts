import { MessageFlags } from "discord.js";
import type { Component } from "../../core/Component";
import { PANEL_REPEAT_CUSTOM_ID } from "../../play/playerPanel";
import { buildRepeatRow, resolvePanelPlayer } from "./shared";

const component: Component = {
	match: (customId) => customId === PANEL_REPEAT_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		// Opening the mode picker changes nothing; the mode-set buttons in
		// repeatMode.ts are what go through the Gate.
		await interaction.reply({
			components: [buildRepeatRow(player.repeatMode, context.locale)],
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default component;
