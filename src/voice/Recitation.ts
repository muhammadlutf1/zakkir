import type { Surah } from "../catalog/suwar";
import { surahName } from "../catalog/suwar";
import { DEFAULT_LOCALE, type Locale, localizable } from "../i18n/locale";

/**
 * The Queue's unit of playback — a Surah read by a Reciter in a specific
 * Rewayah, already resolved to a stream URL. The Reciter/Rewayah names are
 * stored in the locale they were resolved in; the Surah keeps per-locale
 * name variants.
 */
export interface Recitation {
	surah: Surah;
	reciterId: number;
	reciterName: string;
	rewayahId: number;
	rewayahName: string;
	url: string;
}

/**
 * Renders a recitation's label in the target locale: the Surah name localized
 * for that locale (Arabic canonical fallback) alongside the already-resolved
 * Reciter/Rewayah names.
 */
export function recitationLabel(
	recitation: Recitation,
	locale: Locale = DEFAULT_LOCALE,
): string {
	const { t } = localizable(locale);

	return t("recitation.label", {
		surah: surahName(recitation.surah, locale),
		reciter: recitation.reciterName,
		rewayah: recitation.rewayahName,
	});
}
