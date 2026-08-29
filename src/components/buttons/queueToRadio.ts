import { MessageFlags } from "discord.js";
import { gateOrVoteStarted } from "../../access/actionGate";
import type { Component } from "../../core/Component";
import {
	CANCEL_QUEUE_TO_RADIO_CUSTOM_ID,
	CONFIRM_QUEUE_TO_RADIO_CUSTOM_ID,
	type PlayReply,
} from "../../play/playbackRequest";

const component: Component = {
	match: (customId) =>
		customId === CONFIRM_QUEUE_TO_RADIO_CUSTOM_ID ||
		customId === CANCEL_QUEUE_TO_RADIO_CUSTOM_ID,

	async execute(context, interaction) {
		const input = {
			guildId: interaction.guildId,
			locale: context.locale,
			translator: context.translator,
			noticeChannel: interaction.channel ?? undefined,
			replyEphemeral: (content: string) =>
				interaction.reply({ content, flags: MessageFlags.Ephemeral }),
			update: (reply: PlayReply) => interaction.update(reply),
		};

		if (interaction.customId === CANCEL_QUEUE_TO_RADIO_CUSTOM_ID) {
			await context.playback.cancelQueueToRadio(input);
			return;
		}

		const player = context.players.get(interaction.guildId);
		const pending = context.playback.peekPendingQueueToRadio(
			interaction.guildId,
		);

		if (!player || !pending) {
			await context.playback.confirmQueueToRadio(input);
			return;
		}

		const recitation = player.queueView.current;

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
					...(recitation ? { recitation } : {}),
					action: context.translator.t("vote.action.queueToRadio", {
						station: pending.name,
					}),
					onPass: async () => {
						await context.playback.confirmQueueToRadio({
							...input,
							// SAFETY: by vote-pass time the interaction is already acked, so the
							// prompt is edited via its message and stray ephemeral replies are dropped.
							replyEphemeral: async (_content: string) => {},
							update: (reply: PlayReply) => interaction.message.edit(reply),
						});
					},
				},
				interaction,
				context.translator,
			))
		) {
			return;
		}

		await context.playback.confirmQueueToRadio(input);
	},
};

export default component;
