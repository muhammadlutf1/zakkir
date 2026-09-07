import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import {
	type AudioPlayer,
	createAudioPlayer,
	createAudioResource,
	joinVoiceChannel,
	type VoiceConnection,
	VoiceConnectionStatus,
} from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";
import { createLogger } from "../core/logger.ts";
import type {
	VoicePort,
	VoicePortEventName,
	VoicePortEventPayload,
	VoicePortEvents,
} from "./VoicePort.ts";

const logger = createLogger("discordVoicePort");

/** Connect-phase budget — cleared once response headers arrive so long tracks never trip it mid-stream. */
const FETCH_CONNECT_TIMEOUT_MS = 15_000;

/**
 * @discordjs/voice adapter. Every 'error' source is attached to a listener
 * before use so nothing crashes the process with an unhandled rejection.
 */
export class DiscordVoicePort implements VoicePort {
	private connection: VoiceConnection | null = null;
	private audioPlayer: AudioPlayer | null = null;
	private channelId: string | null = null;
	private fetchController: AbortController | null = null;
	private fetchStream: Readable | null = null;
	private playToken = 0;

	get joinedChannelId() {
		return this.channelId;
	}

	private readonly listeners: {
		[K in VoicePortEventName]: Set<VoicePortEvents[K]>;
	} = {
		stateChange: new Set(),
		playerStateChange: new Set(),
		streamError: new Set(),
		error: new Set(),
	};

	async join(channel: VoiceChannel): Promise<void> {
		this.channelId = channel.id;

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
			this.emit("streamError", error);
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
		this.channelId = null;
	}

	play(url: string): void {
		if (!this.audioPlayer) return;

		// Fetch via Node (proper UA, follows Cloudflare) and pipe to ffmpeg,
		// instead of letting ffmpeg fetch the URL directly (Lavf UA is blocked on some nodes).
		// Cancel any in-flight fetch so a superseded response can never overwrite the new track.
		// cancelFetch bumps the token, so the new fetch owns the fresh value.
		this.cancelFetch();
		void this.playViaFetch(url, this.playToken);
	}

	private async playViaFetch(url: string, token: number) {
		const player = this.audioPlayer;
		if (!player) return;

		const controller = new AbortController();
		this.fetchController = controller;
		const timer = setTimeout(
			() => controller.abort(),
			FETCH_CONNECT_TIMEOUT_MS,
		);
		timer.unref();

		try {
			const res = await fetch(url, {
				headers: { "User-Agent": "zakkir/1.0" },
				signal: controller.signal,
			});

			// stop the connect timer so the body can stream
			clearTimeout(timer);

			if (!res.ok || !res.body)
				throw new Error(`fetch ${url} -> ${res.status}`);
			// Superseded or stopped after a newer play()/stop() took over
			if (token !== this.playToken) {
				void res.body.cancel().catch(() => {});
				return;
			}

			const stream = Readable.fromWeb(res.body as ReadableStream);
			this.fetchStream = stream;
			const resource = createAudioResource(stream);
			player.play(resource);
		} catch (error) {
			clearTimeout(timer);
			// Superseded or stopped after a newer play()/stop() took over.
			if (token !== this.playToken) return;
			this.fetchController = null;
			this.emit("streamError", error);
		}
	}

	private cancelFetch() {
		this.fetchController?.abort();
		this.fetchController = null;
		this.fetchStream?.destroy();
		this.fetchStream = null;
		// Single source of truth: every cancel invalidates in-flight fetches,
		// so the token check alone tells stale ones to stay quiet.
		this.playToken += 1;
	}

	pause(): void {
		this.audioPlayer?.pause();
	}

	unpause(): void {
		this.audioPlayer?.unpause();
	}

	stop(): void {
		this.cancelFetch();
		this.audioPlayer?.stop();
	}

	on<K extends VoicePortEventName>(event: K, listener: VoicePortEvents[K]) {
		this.listeners[event].add(listener);
	}

	off<K extends VoicePortEventName>(event: K, listener: VoicePortEvents[K]) {
		this.listeners[event].delete(listener);
	}

	destroy(): void {
		this.cancelFetch();
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
