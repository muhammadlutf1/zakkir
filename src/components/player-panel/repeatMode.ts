import { MessageFlags } from "discord.js";
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

		await interaction.update({
			components: [buildRepeatRow(mode, true)],
		});
		await interaction.followUp({
			content: context.translator.t("command.repeatSet", {
				mode: context.translator.t(`repeat.mode.${mode}` as never),
			}),
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default component;
