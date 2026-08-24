import { MessageFlags } from "discord.js";
import type { Component } from "../../core/Component";
import { PANEL_REPEAT_CUSTOM_ID, updatePanel } from "../../play/playerPanel";
import { RepeatMode } from "../../voice/Queue";
import { buildRepeatRow, resolvePanelPlayer } from "./shared";

const MODES: Record<string, RepeatMode> = {
	off: RepeatMode.OFF,
	current: RepeatMode.CURRENT,
	all: RepeatMode.ALL,
};

const component: Component = {
	match: (customId) =>
		customId.startsWith(`${PANEL_REPEAT_CUSTOM_ID}:`) &&
		(customId.slice(PANEL_REPEAT_CUSTOM_ID.length + 1) as RepeatMode) in MODES,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		const suffix = interaction.customId.slice(
			PANEL_REPEAT_CUSTOM_ID.length + 1,
		);
		const mode = MODES[suffix];

		if (!mode) {
			await interaction.deferUpdate();
			return;
		}

		player.setRepeatMode(mode);

		updatePanel(player.guildId);

		await interaction.update({
			components: [buildRepeatRow(mode, context.locale, true)],
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
