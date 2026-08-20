import type { Surah } from "../catalog/suwar";

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