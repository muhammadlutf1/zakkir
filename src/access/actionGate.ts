import type { MessageComponentInteraction } from "discord.js";
import { replyWithAutoDelete } from "../components/player-panel/autoDelete";
import type { Locale, Localizable } from "../i18n/locale";
import { getPanel } from "../play/playerPanel";
import type { Player } from "../voice/Player";
import type { Recitation } from "../voice/Recitation";
import { isQualified } from "./Gate";
import type { SendableTextChannel } from "./types";
import type { VoteManager } from "./VoteManager";

export interface ActionGateInput {
	player: Player;
	member: {
		id?: string;
		displayName?: string;
		permissions?: { has: (flag: bigint) => boolean };
	};
	guildId: string;
	locale: Locale;
	translator: Localizable;
	votes?: VoteManager;
	channel?: SendableTextChannel | null;
	/** Recitation whose Requester qualification applies (e.g. the item being removed). */
	recitation?: Recitation;
	/** Extra direct-allow rule evaluated before the standard Gate checks. */
	directAllowed?: boolean;
	action: string;
	onPass: () => Promise<void>;
}

function resolveChannel(
	input: ActionGateInput,
): SendableTextChannel | undefined {
	if (input.channel) return input.channel;
	if (input.player.noticeChannel) {
		// SAFETY: noticeChannel is set from a guild text channel via /play, which is sendable
		return input.player.noticeChannel as SendableTextChannel;
	}
	return undefined;
}

/**
 * The Gate applied to a player-affecting action: a Qualified member acts
 * directly; otherwise a Vote is proposed naming the action. Falls back to
 * acting directly when no votes manager exists, and to "noVoters" when there
 * is nowhere to post the vote or nobody to vote on it.
 */
export type ActionGateResult =
	| { kind: "qualified" }
	| { kind: "voted" }
	| { kind: "noVoters" };

export async function handleActionWithGate(
	input: ActionGateInput,
): Promise<ActionGateResult> {
	if (input.directAllowed) return { kind: "qualified" };

	if (
		isQualified({
			member: {
				id: input.member.id ?? "unknown",
				permissions: input.member.permissions,
			},
			player: input.player,
			recitation: input.recitation,
		})
	) {
		return { kind: "qualified" };
	}

	const channel = resolveChannel(input);
	if (!channel) return { kind: "noVoters" };
	if (!input.votes) return { kind: "qualified" };

	const ids = input.player.humanMemberIds;
	if (ids.length === 0) return { kind: "noVoters" };

	const panel = getPanel(input.guildId);

	await input.votes.propose({
		guildId: input.guildId,
		initiatorId: input.member.id ?? "unknown",
		initiatorName: input.member.displayName,
		voterIds: ids,
		channel,
		panel: panel ?? undefined,
		locale: input.locale,
		translator: input.translator,
		action: input.action,
		onPass: input.onPass,
	});

	return { kind: "voted" };
}

/**
 * Runs the action through the Gate; when a Vote starts instead, replies
 * visibly (auto-deleted after 3s) that a vote is underway and reports false
 * so the caller stops.
 */
export async function gateOrVoteStarted(
	input: ActionGateInput,
	replyable: Pick<MessageComponentInteraction<"cached">, "reply">,
	translator: Localizable,
): Promise<boolean> {
	const gate = await handleActionWithGate(input);

	if (gate.kind === "voted") {
		await replyWithAutoDelete(replyable, {
			content: translator.t("vote.started"),
		});
		return false;
	}

	return true;
}
