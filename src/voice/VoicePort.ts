import type {
	AudioPlayerStatus,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";

export interface VoicePortEvents {
	stateChange: (state: VoiceConnectionStatus) => void;
	playerStateChange: (state: AudioPlayerStatus) => void;
	/** Audio-player / stream failures (a mid-play cut, a bad resource). */
	streamError: (error: unknown) => void;
	/** Voice-connection errors. */
	error: (error: unknown) => void;
}

export type VoicePortEventName = keyof VoicePortEvents;

export type VoicePortEventPayload<K extends VoicePortEventName> =
	VoicePortEvents[K] extends (arg: infer A) => void ? A : never;

/**
 * Isolates @discordjs/voice behind a small injected interface so the Player
 * never touches the voice library directly.
 */
export interface VoicePort {
	join(channel: VoiceChannel): Promise<void>;
	leave(): void;
	play(url: string): void;
	pause(): void;
	unpause(): void;
	stop(): void;
	on<K extends VoicePortEventName>(
		event: K,
		listener: VoicePortEvents[K],
	): void;
	off<K extends VoicePortEventName>(
		event: K,
		listener: VoicePortEvents[K],
	): void;
	destroy(): void;
}
