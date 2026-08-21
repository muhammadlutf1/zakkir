import type { Component } from "../../core/Component";
import { updatePanel } from "../../play/playerPanel";
import { RepeatMode } from "../../voice/Queue";
import { buildRepeatRow, resolvePanelPlayer } from "./shared";

const MODES: Record<string, RepeatMode> = {
	off: RepeatMode.OFF,
	track: RepeatMode.TRACK,
	all: RepeatMode.ALL,
};

const component: Component = {
	id: "player-panel-repeat-mode",
	match: (customId) => /^player-panel:repeat:(off|track|all)$/.test(customId),

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		const mode = MODES[interaction.customId.split(":")[2] ?? ""];

		if (!mode) {
			await interaction.deferUpdate();
			return;
		}

		player.setRepeatMode(mode);

		updatePanel(player.guildId);

		await interaction.update({ components: [buildRepeatRow(mode, true)] });
	},
};

export default component;
