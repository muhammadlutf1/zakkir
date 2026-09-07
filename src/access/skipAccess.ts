import type { Locale, Localizable } from "../i18n/locale.ts";
import { recitationLabel } from "../i18n/recitationLabel.ts";
import type { HasPermissions } from "../types/index.ts";
import type { Player } from "../voice/Player.ts";
import type { Recitation } from "../voice/Recitation.ts";
import { handleActionWithGate } from "./actionGate.ts";
import type { SendableTextChannel } from "./types.ts";
import type { VoteManager } from "./VoteManager.ts";

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
