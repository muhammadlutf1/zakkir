import { handleSkipWithGate } from "../../access/skipAccess";
import type { Component } from "../../core/Component";
import { recitationLabel } from "../../i18n/recitationLabel";
import { PANEL_SKIP_CUSTOM_ID, updatePanel } from "../../play/playerPanel";
import { followUpWithAutoDelete, replyWithAutoDelete } from "./autoDelete";
import { resolvePanelPlayer } from "./shared";

const component: Component = {
	match: (customId) => customId === PANEL_SKIP_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		if (player.isPlaying === false) {
			await replyWithAutoDelete(interaction, {
				content: context.translator.t("command.nothingToSkip"),
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
			await replyWithAutoDelete(interaction, {
				content: context.translator.t("vote.started"),
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
		await followUpWithAutoDelete(interaction, {
			content,
		});
	},
};

export default component;
