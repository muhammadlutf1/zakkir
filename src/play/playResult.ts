import { surahName } from "../catalog/suwar";
import { DEFAULT_LOCALE, localizable, type Locale } from "../i18n/locale";
import { recitationLabel } from "../i18n/recitationLabel";
import type { PlayResult } from "../voice/Player";
import type { Recitation } from "../voice/Recitation";

/**
 * The single user-facing wording for the outcome of playing a Recitation,
 * shared by the direct `/play` path, the picker button, and the picker
 * timeout, so the feedback is identical however playback starts. Rendered in
 * the requesting locale from the message catalog.
 */
export function formatPlayResult(
	recitation: Recitation,
	result: PlayResult,
	locale: Locale = DEFAULT_LOCALE,
): string {
	const { t } = localizable(locale);
	const label = recitationLabel(recitation, locale);

	if (result.queued) return t("play.addedToQueue", { label });
	if (result.started) return t("play.started", { label });

	return t("play.failed", { surah: surahName(recitation.surah, locale) });
}