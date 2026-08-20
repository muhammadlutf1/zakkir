import type { Localizable } from "./locale";
import type { MessageKey } from "./messages";
import { RepeatMode } from "../voice/Queue";

const REPEAT_MODE_KEYS: Record<RepeatMode, MessageKey> = {
	[RepeatMode.OFF]: "repeat.mode.off",
	[RepeatMode.TRACK]: "repeat.mode.track",
	[RepeatMode.ALL]: "repeat.mode.all",
};

/**
 * Renders a RepeatMode's display name in the translator's locale, so `/repeat`
 * confirms with a localized mode label rather than the raw enum value.
 */
export function repeatModeLabel(
	translator: Localizable,
	mode: RepeatMode,
) {
	return translator.t(REPEAT_MODE_KEYS[mode]);
}