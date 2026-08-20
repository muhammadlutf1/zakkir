import { DEFAULT_LOCALE, localizable, type Locale } from "../i18n/locale";
import type { MessageKey } from "../i18n/messages";
import { recitationLabel } from "../i18n/recitationLabel";
import type { PlayerNoticeFormatter, PlayerNoticeKind } from "../voice/Player";
import type { Recitation } from "../voice/Recitation";

/** Each playback-failure notice kind maps to its catalog key. */
const NOTICE_KEYS: Record<PlayerNoticeKind, MessageKey> = {
	unreachable: "notice.unreachable",
	playbackFailed: "notice.playbackFailed",
};

/**
 * Builds the locale-aware renderer for a {@link Player}'s playback-failure
 * notices. Lives in the play layer (not the voice layer) so the Player depends
 * only on the injected {@link PlayerNoticeFormatter} contract and stays free of
 * localization logic. The composition root builds one per guild from the
 * guild's effective locale.
 */
export function playbackNotices(
	locale: Locale = DEFAULT_LOCALE,
): PlayerNoticeFormatter {
	const { t } = localizable(locale);

	return {
		render(kind: PlayerNoticeKind, recitation: Recitation): string {
			return t(NOTICE_KEYS[kind], {
				label: recitationLabel(recitation, locale),
			});
		},
	};
}