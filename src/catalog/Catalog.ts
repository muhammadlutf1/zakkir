import { config } from "../config";
import { createLogger } from "../core/logger";
import { resolveSurah, SURAHS, type Surah } from "./surahs";

const logger = createLogger("catalog");

const DEFAULT_LANGUAGE = "ar";

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
	language?: string;
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

export class Catalog {
	private readonly language: string;

	constructor(options: CatalogOptions = {}) {
		this.language = options.language ?? DEFAULT_LANGUAGE;
	}

	async fetchRadios() {
		const data = await this.get<{ radios: Radio[] }>("radios");

		return data.radios;
	}

	async fetchReciters() {
		const data = await this.get<{ reciters: RawReciter[] }>("reciters");

		return data.reciters.map(normalizeReciter);
	}

	/**
	 * The fixed list of 114 surahs, used for `/play` autocomplete.
	 */
	surahs(): Surah[] {
		return SURAHS;
	}

	/**
	 * Resolves a surah given by number (1-114), numeric string, or name.
	 */
	resolveSurah(input: string | number): Surah | undefined {
		return resolveSurah(input);
	}

	async resolveReciterByName(name: string) {
		const reciters = await this.fetchReciters();

		return reciters.find((r) => r.name === name.trim());
	}

	async resolveReciterById(reciterId: number) {
		const reciters = await this.fetchReciters();

		return reciters.find((r) => r.id === reciterId);
	}

	/**
	 * get the different rewayat of a reciter that list a specific surah
	 */
	async resolveRewayat(reciterId: number, surahNumber: number) {
		const reciters = await this.fetchReciters();
		const reciter = reciters.find((r) => r.id === reciterId);

		if (!reciter) return [];

		return rewayatForSurah(reciter, surahNumber);
	}

	async resolveStreamUrl(
		reciterId: number,
		rewayahId: number,
		surahNumber: number,
	) {
		const reciters = await this.fetchReciters();
		const reciter = reciters.find((r) => r.id === reciterId);
		const rewayah = reciter?.rewayat.find(
			(r) => r.id === rewayahId && r.surahList.has(surahNumber),
		);

		if (!rewayah) return undefined;

		return buildSurahStreamUrl(rewayah.server, surahNumber);
	}

	async resolveRadioUrl(radioId: number) {
		const radios = await this.fetchRadios();

		return radios.find((radio) => radio.id === radioId)?.url;
	}

	private async get<T>(endpoint: string) {
		const url = `${config.mp3Quran.baseUrl}/${endpoint}?language=${this.language}`;
		const response = await fetch(url);

		if (!response.ok) {
			logger.error(
				{ status: response.status, url },
				"MP3Quran request failed",
			);
			throw new Error(`MP3Quran request failed with status ${response.status}`);
		}

		return (await response.json()) as T;
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
