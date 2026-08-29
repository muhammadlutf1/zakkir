import { gateOrVoteStarted } from "../../access/actionGate";
import type { Component } from "../../core/Component";
import { recitationLabel } from "../../i18n/recitationLabel";
import { PANEL_SELECT_CUSTOM_ID, updatePanel } from "../../play/playerPanel";
import { followUpWithAutoDelete } from "./autoDelete";
import { resolvePanelPlayer } from "./shared";

const TRACK_VALUE_PREFIX = "track-";

const component: Component = {
	match: (customId) => customId === PANEL_SELECT_CUSTOM_ID,

	async execute(context, interaction) {
		const player = await resolvePanelPlayer(context, interaction);

		if (!player) return;

		if (!interaction.isStringSelectMenu()) return;

		const value = interaction.values[0];

		if (!value?.startsWith(TRACK_VALUE_PREFIX)) {
			await interaction.deferUpdate();
			return;
		}

		const index = Number.parseInt(value.slice(TRACK_VALUE_PREFIX.length), 10);

		if (Number.isNaN(index)) {
			await interaction.deferUpdate();
			return;
		}

		// Select options are [current, ...upcoming]; the encoded index is the
		// 0-based queue index jumpTo expects.
		const view = player.queueView;
		const target = index === 0 ? view.current : view.upcoming[index - 1];

		if (!target) {
			// Stale panel: the selection no longer resolves to a queued item.
			await interaction.deferUpdate();
			return;
		}

		const act = async () => {
			await player.jumpTo(index);
			updatePanel(player.guildId);
		};

		if (
			!(await gateOrVoteStarted(
				{
					player,
					member: interaction.member,
					guildId: interaction.guildId,
					locale: context.locale,
					translator: context.translator,
					votes: context.votes,
					channel: interaction.channel ?? undefined,
					recitation: target,
					action: context.translator.t("vote.action.select", {
						label: recitationLabel(target, context.locale),
					}),
					onPass: act,
				},
				interaction,
				context.translator,
			))
		) {
			return;
		}

		await interaction.deferUpdate();

		await act();

		const jumped = player.queueView.current;
		if (jumped) {
			await followUpWithAutoDelete(interaction, {
				content: context.translator.t("panel.jumpedTo", {
					label: recitationLabel(jumped, context.locale),
				}),
			});
		}
	},
};

export default component;
