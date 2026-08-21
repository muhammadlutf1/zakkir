import { config } from "../config";
import { createLogger } from "../core/logger";
import type { Locale } from "../i18n/locale";
import { resolveSurah, SURAH_LIST, type Surah } from "./suwar";

const logger = createLogger("catalog");

/** The canonical language for reciter/rewayah names when no locale is given. */
const DEFAULT_LANGUAGE: Locale = "ar";

export interface Radio {
	id: number;
	name: string;
	url: string;
}

export interface Rewayah {
	id: number;
	name: string;
	server: string;
	surahList: Set<number>; // {1, 2, ... , 114}
	surahCount: number;
}

export interface Reciter {
	id: number;
	name: string;
	rewayat: Rewayah[];
}

export interface CatalogOptions {
	language?: Locale;
}

// Raw types mirror the MP3Quran API response, so the "moshaf" naming is kept
// as-is (the API calls rewayat "moshaf").
interface RawMoshaf {
	id: number;
	name: string;
	server: string;
	surah_total: number;
	surah_list: string;
}

interface RawReciter {
	id: number;
	name: string;
	moshaf: RawMoshaf[];
}

interface CacheEntry {
	data: unknown;
	expiresAt: number;
}

// Module-level cache shared by every Catalog instance and locale-bound view,
// keyed by `${endpoint}:${locale}` — each endpoint entry is fully
// independent, so traffic on one never forces a refetch of the other.
const endpointCache = new Map<string, CacheEntry>();

// In-flight refetches, keyed the same way, so concurrent resolves on a cold
// or expired entry share one fetch instead of racing a herd of them.
const inflightFetches = new Map<string, Promise<unknown>>();

export class Catalog {
	private readonly language: Locale;

	constructor(options: CatalogOptions = {}) {
		this.language = options.language ?? DEFAULT_LANGUAGE;
	}

	async fetchRadios(locale?: Locale) {
		const data = await this.get<{ radios: Radio[] }>(
			"radios",
			locale ?? this.language,
		);

		return data.radios;
	}

	async fetchReciters(locale?: Locale) {
		const data = await this.get<{ reciters: RawReciter[] }>(
			"reciters",
			locale ?? this.language,
		);

		return data.reciters.map(normalizeReciter);
	}

	/**
	 * The fixed list of 114 suwar, used for `/play` autocomplete.
	 */
	get surahList(): Surah[] {
		return SURAH_LIST;
	}

	/**
	 * Resolves a surah given by number (1-114), numeric string, or name in any
	 * known locale.
	 */
	resolveSurah(input: string | number): Surah | undefined {
		return resolveSurah(input);
	}

	async resolveReciterByName(name: string, locale?: Locale) {
		const reciters = await this.fetchReciters(locale);

		return reciters.find((r) => r.name === name.trim());
	}

	async resolveReciterById(reciterId: number, locale?: Locale) {
		const reciters = await this.fetchReciters(locale);

		return reciters.find((r) => r.id === reciterId);
	}

	/**
	 * Resolves a rewayah by its id across every reciter, returning the first
	 * match — used by `/preferences` to confirm a saved default rewayah name.
	 */
	async resolveRewayahById(rewayahId: number, locale?: Locale) {
		const reciters = await this.fetchReciters(locale);

		for (const reciter of reciters) {
			const rewayah = reciter.rewayat.find((r) => r.id === rewayahId);
			if (rewayah) return rewayah;
		}

		return undefined;
	}

	/**
	 * get the different rewayat of a reciter that list a specific surah
	 */
	async resolveRewayat(
		reciterId: number,
		surahNumber: number,
		locale?: Locale,
	) {
		const reciters = await this.fetchReciters(locale);
		const reciter = reciters.find((r) => r.id === reciterId);

		if (!reciter) return [];

		return rewayatForSurah(reciter, surahNumber);
	}

	async resolveStreamUrl(
		reciterId: number,
		rewayahId: number,
		surahNumber: number,
		locale?: Locale,
	) {
		const reciters = await this.fetchReciters(locale);
		const reciter = reciters.find((r) => r.id === reciterId);
		const rewayah = reciter?.rewayat.find(
			(r) => r.id === rewayahId && r.surahList.has(surahNumber),
		);

		if (!rewayah) return undefined;

		return buildSurahStreamUrl(rewayah.server, surahNumber);
	}

	async resolveRadioUrl(radioId: number, locale?: Locale) {
		const radios = await this.fetchRadios(locale);

		return radios.find((radio) => radio.id === radioId)?.url;
	}

	/**
	 * Serves an endpoint payload from the shared cache while it is fresh;
	 * on a miss or expiry, refetches (retrying up to `fetchAttempts`), and
	 * falls back to the stale copy when the refetch keeps failing. A cold
	 * cache with no stale copy propagates the error.
	 */
	private async get<T>(endpoint: string, locale: Locale) {
		const key = `${endpoint}:${locale}`;
		const cached = endpointCache.get(key);

		if (cached && cached.expiresAt > Date.now()) return cached.data as T;

		let pending = inflightFetches.get(key);

		if (!pending) {
			pending = this.refresh(endpoint, key, locale, cached).finally(() => {
				inflightFetches.delete(key);
			});
			inflightFetches.set(key, pending);
		}

		return pending as Promise<T>;
	}

	private async refresh<T>(
		endpoint: string,
		key: string,
		locale: Locale,
		cached: CacheEntry | undefined,
	) {
		try {
			const data = await this.fetchEndpoint<T>(endpoint, locale);
			endpointCache.set(key, {
				data,
				expiresAt: Date.now() + config.catalog.ttlMs,
			});
			return data;
		} catch (error) {
			if (!cached) throw error;

			logger.warn(
				error,
				"MP3Quran refresh failed for %s; serving stale cache",
				key,
			);
			return cached.data;
		}
	}

	private async fetchEndpoint<T>(endpoint: string, locale: Locale) {
		let lastError: unknown;

		for (let attempt = 0; attempt < config.catalog.fetchAttempts; attempt++) {
			try {
				const url = `${config.mp3Quran.baseUrl}/${endpoint}?language=${locale}`;
				const response = await fetch(url);

				if (!response.ok) {
					logger.error(
						{ status: response.status, url },
						"MP3Quran request failed",
					);
					throw new Error(
						`MP3Quran request failed with status ${response.status}`,
					);
				}

				return (await response.json()) as T;
			} catch (error) {
				lastError = error;
			}
		}

		throw lastError;
	}
}

function parseSurahList(surahList: string) {
	return new Set(surahList.split(",").filter(Boolean).map(Number));
}

function normalizeReciter(raw: RawReciter): Reciter {
	return {
		id: raw.id,
		name: raw.name,
		rewayat: raw.moshaf.map((moshaf) => ({
			id: moshaf.id,
			name: moshaf.name,
			server: moshaf.server,
			surahList: parseSurahList(moshaf.surah_list),
			surahCount: moshaf.surah_total,
		})),
	};
}

function buildSurahStreamUrl(server: string, surahNumber: number) {
	return `${server}${String(surahNumber).padStart(3, "0")}.mp3`; // ex: https://server6.mp3quran.net/akdr/001.mp3
}

function rewayatForSurah(reciter: Reciter, surahNumber: number) {
	return reciter.rewayat.filter((r) => r.surahList.has(surahNumber));
}
