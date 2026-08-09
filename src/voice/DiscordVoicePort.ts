import {
	type AudioPlayer,
	createAudioPlayer,
	createAudioResource,
	joinVoiceChannel,
	type VoiceConnection,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";
import { createLogger } from "../core/logger";
import type {
	VoicePort,
	VoicePortEventName,
	VoicePortEventPayload,
	VoicePortEvents,
} from "./VoicePort";

const logger = createLogger("discordVoicePort");

/**
 * @discordjs/voice adapter. Every 'error' source is attached to a listener
 * before use so nothing crashes the process with an unhandled rejection.
 */
export class DiscordVoicePort implements VoicePort {
	private connection: VoiceConnection | null = null;
	private audioPlayer: AudioPlayer | null = null;

	private readonly listeners: {
		[K in VoicePortEventName]: Set<VoicePortEvents[K]>;
	} = {
		stateChange: new Set(),
		playerStateChange: new Set(),
		error: new Set(),
	};

	async join(channel: VoiceChannel): Promise<void> {
		if (this.connection) {
			this.connection.rejoin({
				channelId: channel.id,
				selfDeaf: true,
				selfMute: false,
			});
			return;
		}

		const connection = joinVoiceChannel({
			channelId: channel.id,
			guildId: channel.guild.id,
			adapterCreator: channel.guild.voiceAdapterCreator,
			selfDeaf: true,
		});

		this.connection = connection;

		connection.on("stateChange", (_oldState, newState) => {
			const state = newState.status;

			this.emit("stateChange", state);

			if (state === VoiceConnectionStatus.Disconnected) {
				logger.warn({ guildId: channel.guild.id }, "Voice connection dropped");
			}
		});

		connection.on("error", (error) => {
			this.emit("error", error);
		});

		const audioPlayer = createAudioPlayer();

		this.audioPlayer = audioPlayer;

		audioPlayer.on("error", (error) => {
			this.emit("error", error);
		});

		audioPlayer.on("stateChange", (_oldState, newState) => {
			this.emit("playerStateChange", newState.status);
		});

		connection.subscribe(audioPlayer);
	}

	leave(): void {
		this.stop();

		this.connection?.destroy();
		this.connection = null;
		this.audioPlayer = null;
	}

	play(url: string): void {
		if (!this.audioPlayer) return;

		try {
			const resource = createAudioResource(url);

			this.audioPlayer.play(resource);
		} catch (error) {
			this.emit("error", error);
		}
	}

	stop(): void {
		this.audioPlayer?.stop();
	}

	on<K extends VoicePortEventName>(event: K, listener: VoicePortEvents[K]) {
		this.listeners[event].add(listener);
	}

	off<K extends VoicePortEventName>(event: K, listener: VoicePortEvents[K]) {
		this.listeners[event].delete(listener);
	}

	destroy(): void {
		for (const listeners of Object.values(this.listeners)) listeners.clear();
	}

	private emit<K extends VoicePortEventName>(
		event: K,
		payload: VoicePortEventPayload<K>,
	) {
		for (const listener of this.listeners[event]) {
			(listener as (payload: VoicePortEventPayload<K>) => void)(payload);
		}
	}
}
