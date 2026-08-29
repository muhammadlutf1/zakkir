import type { Component } from "../../core/Component";
import { PANEL_REPEAT_CUSTOM_ID } from "../../play/playerPanel";
import { replyWithAutoDelete } from "./autoDelete";
import { buildRepeatRow, resolvePanelPlayer } from "./shared";

const component: Component = {
	match: (customId) => customId === PANEL_REPEAT_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		await replyWithAutoDelete(interaction, {
			components: [buildRepeatRow(player.repeatMode, context.locale)],
		});
	},
};

export default component;
