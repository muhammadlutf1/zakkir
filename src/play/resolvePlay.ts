import type { Catalog, Rewayah } from "../catalog/Catalog";
import type { Surah } from "../catalog/surahs";
import type { GuildConfig } from "../guildConfig/GuildConfig";
import type { GlobalDefaults, RewayahCoverage } from "../guildConfig/types";
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
	  }
	| { kind: "error"; message: string };

/**
 * Resolves a `/play` request: which Reciter plays the given Surah (option >
 * GuildConfig > global default), and whether that resolves to a single
 * Recitation (play it directly) or to a real Rewayah choice (show the picker).
 */
export async function resolvePlay(
	catalog: Catalog,
	guildConfig: GuildConfig,
	defaults: GlobalDefaults,
	guildId: string,
	surah: Surah,
	reciterOption?: string,
): Promise<PlayOutcome> {
	let reciterId: number | undefined;

	if (reciterOption) {
		const reciter = await catalog.resolveReciterByName(reciterOption);

		if (!reciter) {
			return {
				kind: "error",
				message: `Reciter "${reciterOption}" not found.`,
			};
		}

		reciterId = reciter.id;
	}

	const rewayahCovers: RewayahCoverage = async (
		rId,
		surahNumber,
		rewayahId,
	) => {
		const rewayat = await catalog.resolveRewayat(rId, surahNumber);

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
			message:
				"No default reciter is set for this server. Pass a <reciter> to play.",
		};
	}

	const reciter = await catalog.resolveReciterById(resolved.reciter);

	if (!reciter) {
		return { kind: "error", message: "Reciter not found." };
	}

	// rewayah
	const rewayat = await catalog.resolveRewayat(reciter.id, surah.number);

	if (rewayat.length === 0) {
		return {
			kind: "error",
			message: `${reciter.name} has no recitation of Surah ${surah.name} (${surah.number}).`,
		};
	}

	const guildData = await guildConfig.get(guildId);
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
		};
	}

	const rewayah = defaultChoice ?? rewayat[0];
	const url = await catalog.resolveStreamUrl(
		reciter.id,
		rewayah.id,
		surah.number,
	);

	if (!url) {
		return {
			kind: "error",
			message: `No stream available for Surah ${surah.name} by ${reciter.name} (${rewayah.name}).`,
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
 * through the Catalog) at the moment playback actually starts.
 */
export async function buildRecitationFromChoice(
	catalog: Catalog,
	choice: RewayahChoice,
): Promise<Recitation> {
	const surah = catalog.resolveSurah(choice.surahNumber);
	const reciter = await catalog.resolveReciterById(choice.reciterId);
	const rewayah = reciter?.rewayat.find((r) => r.id === choice.rewayahId);
	const url = await catalog.resolveStreamUrl(
		choice.reciterId,
		choice.rewayahId,
		choice.surahNumber,
	);

	if (!surah || !reciter || !rewayah || !url) {
		throw new Error(
			`Could not resolve a stream for surah ${choice.surahNumber}.`,
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
