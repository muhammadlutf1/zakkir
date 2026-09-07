import { RepeatMode } from "../voice/Queue.ts";
import type { Localizable } from "./locale.ts";
import type { MessageKey } from "./messages/index.ts";

const REPEAT_MODE_KEYS: Record<RepeatMode, MessageKey> = {
	[RepeatMode.OFF]: "repeat.mode.off",
	[RepeatMode.CURRENT]: "repeat.mode.current",
	[RepeatMode.ALL]: "repeat.mode.all",
};

/**
 * Renders a RepeatMode's display name in the translator's locale, so `/repeat`
 * confirms with a localized mode label rather than the raw enum value.
 */
export function repeatModeLabel(translator: Localizable, mode: RepeatMode) {
	return translator.t(REPEAT_MODE_KEYS[mode]);
}
