import { MessageFlags } from "discord.js";
import { handleSkipWithGate } from "../../access/skipAccess";
import type { Component } from "../../core/Component";
import { recitationLabel } from "../../i18n/recitationLabel";
import { PANEL_SKIP_CUSTOM_ID, updatePanel } from "../../play/playerPanel";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	match: (customId) => customId === PANEL_SKIP_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		if (player.isPlaying === false) {
			await interaction.reply({
				content: context.translator.t("command.nothingToSkip"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const current = player.queueView.current;
		const resolvedChannel = interaction.channel ?? undefined;

		const gate = await handleSkipWithGate({
			player,
			member: interaction.member,
			guildId: interaction.guildId,
			locale: context.locale,
			translator: context.translator,
			votes: context.votes,
			channel: resolvedChannel,
			recitation: current ?? undefined,
		});

		if (gate.kind === "voted") {
			await interaction.reply({
				content: context.translator.t("vote.started"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferUpdate();

		const result = await player.skip();

		updatePanel(player.guildId);

		const next = player.queueView.current;
		let content: string;
		if (result.started && next) {
			content = context.translator.t("command.nowPlaying", {
				label: recitationLabel(next, context.locale),
			});
		} else if (!result.started && !next) {
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
