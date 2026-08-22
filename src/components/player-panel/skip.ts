import { MessageFlags } from "discord.js";
import type { Component } from "../../core/Component";
import { recitationLabel } from "../../i18n/recitationLabel";
import { updatePanel } from "../../play/playerPanel";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	id: "player-panel-skip",
	match: (customId) => customId === "player-panel:skip",

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		await interaction.deferUpdate();

		const result = await player.skip();

		updatePanel(player.guildId);

		const current = (player as unknown as { queueView?: { current?: unknown } })
			.queueView?.current as
			| import("../../voice/Recitation").Recitation
			| undefined;
		let content: string;
		if (result.started && current) {
			content = context.translator.t("command.nowPlaying", {
				label: recitationLabel(current, context.locale),
			});
		} else if (!result.started && !current) {
			content = context.translator.t("command.playbackEnded");
		} else {
			content = context.translator.t("command.skipped");
		}
		await interaction.followUp({
			content,
			flags: MessageFlags.Ephemeral,
		});
	},
};

export default component;
