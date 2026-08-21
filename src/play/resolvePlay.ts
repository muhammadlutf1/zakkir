import type { Catalog, Rewayah } from "../catalog/Catalog";
import type { Surah } from "../catalog/suwar";
import { DEFAULT_LOCALE } from "../config";
import type { GuildConfig } from "../guild/GuildConfig";
import type { GlobalDefaults, RewayahCoverage } from "../guild/types";
import { type Locale, localizable } from "../i18n/locale";
import type { Recitation } from "../voice/Recitation";

/**
 * A playable Rewayah offered by the picker, resolved to a full Recitation
 * only when the user actually picks it.
 */
export interface RewayahChoice {
	surahNumber: number;
	reciterId: number;
	reciterName: string;
	rewayahId: number;
	rewayahName: string;
}

export type PlayOutcome =
	| { kind: "play"; recitation: Recitation }
	| {
			kind: "picker";
			surah: Surah;
			reciterName: string;
			choices: RewayahChoice[];
			/** The resolved default Rewayah to auto-play on picker timeout, if any. */
			defaultChoice: RewayahChoice | undefined;
			/** The locale the picker's labels render in. */
			locale: Locale;
	  }
	| { kind: "error"; message: string };

/**
 * Resolves a `/play` request: which Reciter plays the given Surah (option >
 * GuildConfig > global default), and whether that resolves to a single
 * Recitation (play it directly) or to a real Rewayah choice (show the picker).
 * The locale threads into the Catalog lookups so Reciter/Rewayah names come
 * back in the requesting locale.
 */
export async function resolvePlay(
	catalog: Catalog,
	guildConfig: GuildConfig,
	defaults: GlobalDefaults,
	guildId: string,
	surah: Surah,
	reciterOption?: string,
	locale: Locale = DEFAULT_LOCALE,
): Promise<PlayOutcome> {
	const { t } = localizable(locale);
	let reciterId: number | undefined;

	if (reciterOption) {
		const reciter = await catalog.resolveReciterByName(reciterOption, locale);

		if (!reciter) {
			return {
				kind: "error",
				message: t("command.reciterNotFound", { reciter: reciterOption }),
			};
		}

		reciterId = reciter.id;
	}

	const rewayahCovers: RewayahCoverage = async (
		rId,
		surahNumber,
		rewayahId,
	) => {
		const rewayat = await catalog.resolveRewayat(rId, surahNumber, locale);

		return rewayat.some((r) => r.id === rewayahId);
	};

	const resolved = await guildConfig.resolve(
		guildId,
		{
			surahNumber: surah.number,
			option: reciterId !== undefined ? { reciter: reciterId } : {},
		},
		rewayahCovers,
	);

	// reciter
	if (resolved.reciter === undefined) {
		return {
			kind: "error",
			message: t("command.noDefaultReciter"),
		};
	}

	const reciter = await catalog.resolveReciterById(resolved.reciter, locale);

	if (!reciter) {
		return { kind: "error", message: t("command.reciterMissing") };
	}

	// rewayah
	const rewayat = await catalog.resolveRewayat(
		reciter.id,
		surah.number,
		locale,
	);

	if (rewayat.length === 0) {
		return {
			kind: "error",
			message: t("command.noRecitation", {
				reciter: reciter.name,
				surah: surah.name,
				number: String(surah.number),
			}),
		};
	}

	const guildData = guildConfig.get(guildId);
	const configuredRewayah =
		guildData?.defaultRewayah ?? defaults.defaultRewayah;
	const defaultDoesNotCover =
		configuredRewayah !== undefined && resolved.rewayah === undefined;

	const toChoice = (rewayah: Rewayah): RewayahChoice => ({
		surahNumber: surah.number,
		reciterId: reciter.id,
		reciterName: reciter.name,
		rewayahId: rewayah.id,
		rewayahName: rewayah.name,
	});

	const defaultChoice = resolved.rewayah
		? rewayat.find((r) => r.id === resolved.rewayah)
		: undefined;

	if (rewayat.length > 1 || defaultDoesNotCover) {
		return {
			kind: "picker",
			surah,
			reciterName: reciter.name,
			choices: rewayat.map(toChoice),
			defaultChoice: defaultChoice ? toChoice(defaultChoice) : undefined,
			locale,
		};
	}

	const rewayah = defaultChoice ?? rewayat[0];
	const url = await catalog.resolveStreamUrl(
		reciter.id,
		rewayah.id,
		surah.number,
		locale,
	);

	if (!url) {
		return {
			kind: "error",
			message: t("command.noStream", {
				surah: surah.name,
				reciter: reciter.name,
				rewayah: rewayah.name,
			}),
		};
	}

	return {
		kind: "play",
		recitation: {
			surah,
			reciterId: reciter.id,
			reciterName: reciter.name,
			rewayahId: rewayah.id,
			rewayahName: rewayah.name,
			url,
		},
	};
}

/**
 * Turns a 'picker' choice into a full Recitation (resolving the stream URL
 * through the Catalog) at the moment playback actually starts. The locale is
 * fed through to the Catalog so the resolved names match the picker's locale.
 */
export async function buildRecitationFromChoice(
	catalog: Catalog,
	choice: RewayahChoice,
	locale: Locale = DEFAULT_LOCALE,
): Promise<Recitation> {
	const surah = catalog.resolveSurah(choice.surahNumber);
	const reciter = await catalog.resolveReciterById(choice.reciterId, locale);
	const rewayah = reciter?.rewayat.find((r) => r.id === choice.rewayahId);
	const url = await catalog.resolveStreamUrl(
		choice.reciterId,
		choice.rewayahId,
		choice.surahNumber,
		locale,
	);

	if (!surah || !reciter || !rewayah || !url) {
		const { t } = localizable(locale);
		throw new Error(
			t("command.resolveStreamFailed", {
				number: String(choice.surahNumber),
			}),
		);
	}

	return {
		surah,
		reciterId: reciter.id,
		reciterName: reciter.name,
		rewayahId: rewayah.id,
		rewayahName: rewayah.name,
		url,
	};
}
