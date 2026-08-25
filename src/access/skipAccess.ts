import type { Locale, Localizable } from "../i18n/locale";
import { recitationLabel } from "../i18n/recitationLabel";
import { getPanel } from "../play/playerPanel";
import type { Player } from "../voice/Player";
import type { Recitation } from "../voice/Recitation";
import { isQualified } from "./Gate";
import type { SendableTextChannel } from "./types";
import type { VoteManager } from "./VoteManager";

export interface SkipGateInput {
	player: Player;
	member: { id?: string; permissions?: { has: (flag: bigint) => boolean } };
	guildId: string;
	locale: Locale;
	translator: Localizable;
	votes?: VoteManager;
	channel?: SendableTextChannel | null;
	recitation?: Recitation;
}

function resolveChannel(input: SkipGateInput): SendableTextChannel | undefined {
	if (input.channel) return input.channel;
	if (input.player.noticeChannel) {
		// SAFETY: noticeChannel is set from a guild text channel via /play, which is sendable
		return input.player.noticeChannel as SendableTextChannel;
	}
	return undefined;
}

export async function handleSkipWithGate(
	input: SkipGateInput,
): Promise<
	| { kind: "qualified" }
	| { kind: "voted"; started: boolean }
	| { kind: "noVoters" }
> {
	const recitation = input.recitation ?? input.player.queueView.current;

	if (!recitation) return { kind: "noVoters" };

	if (
		isQualified({
			member: {
				id: input.member.id ?? "unknown",
				permissions: input.member.permissions,
			},
			player: input.player,
			recitation,
		})
	) {
		return { kind: "qualified" };
	}

	const channel = resolveChannel(input);
	if (!channel) return { kind: "noVoters" };
	if (!input.votes) return { kind: "qualified" };

	const ids = input.player.humanMemberIds;
	if (ids.length === 0) return { kind: "noVoters" };

	const label = recitationLabel(recitation, input.locale);
	const panel = getPanel(input.guildId);

	const onPass = async () => {
		await input.player.skip();
		// panel update is handled by Player onChange -> updatePanel, but ensure
	};

	await input.votes.propose({
		guildId: input.guildId,
		initiatorId: input.member.id ?? "unknown",
		voterIds: ids,
		channel,
		panel: panel ?? undefined,
		locale: input.locale,
		translator: input.translator,
		label,
		onPass,
	});

	return { kind: "voted", started: true };
}
