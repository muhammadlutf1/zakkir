import type { Surah } from "../catalog/surahs";

/**
 * The Queue's unit of playback — a Surah read by a Reciter in a specific
 * Rewayah, already resolved to a stream URL.
 */
export interface Recitation {
	surah: Surah;
	reciterId: number;
	reciterName: string;
	rewayahId: number;
	rewayahName: string;
	url: string;
}

export function recitationLabel(recitation: Recitation): string {
	return `${recitation.surah.name} by ${recitation.reciterName} (${recitation.rewayahName})`;
}
