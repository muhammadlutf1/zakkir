import type { TextBasedChannel } from "discord.js";
import type { Locale, Localizable } from "../i18n/locale";
import { recitationLabel } from "../i18n/recitationLabel";
import { getPanel } from "../play/playerPanel";
import type { Player } from "../voice/Player";
import type { Recitation } from "../voice/Recitation";
import { isQualified } from "./Gate";
import type { VoteManager } from "./VoteManager";

export interface SkipGateInput {
	player: Player;
	member: { id?: string; permissions?: { has: (flag: bigint) => boolean } };
	guildId: string;
	locale: Locale;
	translator: Localizable;
	votes?: VoteManager;
	channel?: TextBasedChannel;
	recitation?: Recitation;
}

function voterIdsFromPlayer(player: Player): string[] {
	if (
		typeof (player as unknown as { humanMemberIds?: string[] })
			.humanMemberIds !== "undefined"
	) {
		const ids = (player as unknown as { humanMemberIds: string[] })
			.humanMemberIds;
		if (ids.length > 0) return ids;
	}
	return [];
}

function resolveChannel(input: SkipGateInput): TextBasedChannel | undefined {
	if (input.channel) return input.channel;
	const p = input.player as unknown as { noticeChannel?: TextBasedChannel };
	if (p.noticeChannel) return p.noticeChannel;
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

	const voterIds = voterIdsFromPlayer(input.player);
	// If player has channel members collection via discord.js, use that directly for ids
	let ids = voterIds;
	if (ids.length === 0) {
		// Try via player humanMemberCount fallback — we still need ids for mentions;
		// if we cannot enumerate, use initiator alone as voter to avoid zero
		if (input.player.humanMemberCount > 0) {
			ids = [input.member.id ?? "unknown"];
		}
	}

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
