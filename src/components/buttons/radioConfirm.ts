import { MessageFlags } from "discord.js";
import { gateOrVoteStarted } from "../../access/actionGate";
import type { Component } from "../../core/Component";
import { recitationLabel } from "../../i18n/recitationLabel";

const component: Component = {
	match: (customId) =>
		customId === "radio:confirm" || customId === "radio:cancel",

	async execute(context, interaction) {
		// One seam call per path: the module owns the pending-Radio state
		// and the play/cancel behaviour; we only supply reply sinks.
		const input = {
			guildId: interaction.guildId,
			locale: context.locale,
			translator: context.translator,
			noticeChannel: interaction.channel ?? undefined,
			replyEphemeral: (content: string) =>
				interaction.reply({ content, flags: MessageFlags.Ephemeral }),
			update: (reply: { content: string }) =>
				interaction.update({ content: reply.content, components: [] }),
		};

		if (interaction.customId === "radio:cancel") {
			await context.playback.cancelRadio(input);
			return;
		}

		// Empty states (no player / no pending recitation) resolve through the
		// seam's own error replies BEFORE any gate/vote decision.
		const player = context.players.get(interaction.guildId);
		const pending = context.playback.peekPendingRecitation(interaction.guildId);

		if (!player || !pending) {
			await context.playback.confirmRadio(input);
			return;
		}

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
					recitation: pending,
					action: context.translator.t("vote.action.radio", {
						label: recitationLabel(pending, context.locale),
					}),
					onPass: async () => {
						await context.playback.confirmRadio({
							...input,
							// SAFETY: by vote-pass time the interaction is already acked, so the
							// prompt is edited via its message and stray ephemeral replies are dropped.
							replyEphemeral: async () => {},
							update: (reply) => interaction.message.edit(reply),
						});
					},
				},
				interaction,
				context.translator,
			))
		) {
			return;
		}

		await context.playback.confirmRadio(input);
	},
};

export default component;
