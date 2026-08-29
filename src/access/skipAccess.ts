import type { Locale, Localizable } from "../i18n/locale";
import { recitationLabel } from "../i18n/recitationLabel";
import type { HasPermissions } from "../types";
import type { Player } from "../voice/Player";
import type { Recitation } from "../voice/Recitation";
import { handleActionWithGate } from "./actionGate";
import type { SendableTextChannel } from "./types";
import type { VoteManager } from "./VoteManager";

export interface SkipGateInput {
	player: Player;
	member: {
		id?: string;
		displayName?: string;
		permissions?: HasPermissions;
	};
	guildId: string;
	locale: Locale;
	translator: Localizable;
	votes?: VoteManager;
	channel?: SendableTextChannel | null;
	recitation?: Recitation;
}

export async function handleSkipWithGate(input: SkipGateInput) {
	const recitation = input.recitation ?? input.player.queueView.current;

	if (!recitation) return { kind: "noVoters" };

	return handleActionWithGate({
		...input,
		recitation,
		action: input.translator.t("vote.action.skip", {
			label: recitationLabel(recitation, input.locale),
		}),
		onPass: async () => {
			await input.player.skip();
			// panel update is handled by Player onChange -> updatePanel, but ensure
		},
	});
}
