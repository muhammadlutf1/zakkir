import type { PlayResult } from "../voice/Player";
import { type Recitation, recitationLabel } from "../voice/Recitation";

/**
 * The single user-facing wording for the outcome of playing a Recitation,
 * shared by the direct `/play` path, the picker button, and the picker
 * timeout, so the feedback is identical however playback starts.
 */
export function formatPlayResult(
	recitation: Recitation,
	result: PlayResult,
): string {
	if (result.queued)
		return `Added to the queue: ${recitationLabel(recitation)}.`;
	if (result.started) return `Playing ${recitationLabel(recitation)}.`;

	return `Couldn't play ${recitation.surah.name}. A notice was posted to the channel.`;
}
