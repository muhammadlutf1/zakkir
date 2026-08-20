import { surahName } from "../catalog/suwar";
import type { Recitation } from "../voice/Recitation";
import { DEFAULT_LOCALE, localizable, type Locale } from "./locale";

/**
 * Renders a recitation's label in the target locale: the Surah name localized
 * for that locale (Arabic canonical fallback) alongside the already-resolved
 * Reciter/Rewayah names. Lives in the i18n layer (not the voice layer) so the
 * voice layer carries no localization logic.
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