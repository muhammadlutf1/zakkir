import { AudioPlayerStatus, VoiceConnectionStatus } from "@discordjs/voice";
import type { TextBasedChannel, VoiceChannel } from "discord.js";
import { createLogger } from "../core/logger";
import { Queue, type RepeatMode } from "./Queue";
import { type Recitation, recitationLabel } from "./Recitation";
import type { VoicePort } from "./VoicePort";

const logger = createLogger("player");

const MAX_STREAM_RETRIES = 1;

export interface PlayResult {
	started: boolean;
	/** True when the Recitation was appended behind an already-playing one. */
	queued: boolean;
}

export interface PlayerOptions {
	/**
	 * Pre-flight reachability probe run before a Recitation is fed to the
	 * port. Returning false stops the Recitation (404/5xx policy), posts a
	 * notice, and advances the Queue. Defaults to a HEAD request.
	 */
	probeStream?: (url: string) => Promise<boolean>;
}

async function defaultProbeStream(url: string): Promise<boolean> {
	try {
		const response = await fetch(url, {
			method: "HEAD",
			signal: AbortSignal.timeout(10_000),
		});

		return response.ok;
	} catch {
		return false;
	}
}

export class Player {
	private connectionState: VoiceConnectionStatus =
		VoiceConnectionStatus.Destroyed;
	private readonly queue = new Queue<Recitation>();
	private active: { item: Recitation; retries: number } | null = null;
	private readonly probeStream: (url: string) => Promise<boolean>;
	private readonly noticeListeners = new Set<(message: string) => void>();
	private noticeChannelRef: TextBasedChannel | undefined;

	constructor(
		public readonly guildId: string,
		private readonly port: VoicePort,
		options: PlayerOptions = {},
	) {
		this.probeStream = options.probeStream ?? defaultProbeStream;

		port.on("error", (error) => {
			logger.error(error, "Voice error in guild %s", this.guildId);
		});

		port.on("streamError", (error) => {
			logger.error(error, "Stream error in guild %s", this.guildId);
			this.onStreamError();
		});

		port.on("playerStateChange", (state) => {
			if (state === AudioPlayerStatus.Idle) this.onTrackEnd();
		});

		port.on("stateChange", (state) => {
			this.connectionState = state;
		});
	}

	get isConnected() {
		return this.connectionState === VoiceConnectionStatus.Ready;
	}

	get isPlaying() {
		return this.active !== null;
	}

	get queueView() {
		return this.queue.view();
	}

	get repeatMode() {
		return this.queue.repeatMode;
	}

	/**
	 * The text channel where this Player's user-facing notices (e.g. a failed
	 * Recitation) are posted. Notice routing is local to the Player's session
	 * rather than a module-global map.
	 */
	get noticeChannel() {
		return this.noticeChannelRef;
	}

	setNoticeChannel(channel: TextBasedChannel) {
		this.noticeChannelRef = channel;
	}

	setRepeatMode(mode: RepeatMode) {
		this.queue.setRepeatMode(mode);
	}

	/**
	 * Adds the Recitation to the guild's Queue. If nothing is currently
	 * playing, it starts immediately.
	 */
	async play(recitation: Recitation): Promise<PlayResult> {
		this.queue.add(recitation);

		if (this.isPlaying) return { started: false, queued: true };

		return this.startCurrent();
	}

	onNotice(listener: (message: string) => void): () => void {
		this.noticeListeners.add(listener);

		return () => this.noticeListeners.delete(listener);
	}

	async join(channel: VoiceChannel): Promise<void> {
		logger.info(
			"Player joining voice channel %s in guild %s",
			channel.id,
			this.guildId,
		);
		await this.port.join(channel);
	}

	leave(): void {
		logger.info("Player leaving voice channel in guild %s", this.guildId);
		this.active = null;
		this.port.leave();
	}

	stop(): void {
		this.active = null;
		this.queue.clear();
		this.port.stop();
	}

	/**
	 * Stops the current Recitation and starts the next per RepeatMode. In OFF
	 * mode playback ends cleanly when nothing is queued; TRACK replays the
	 * current; ALL wraps back to the first when the queue ends.
	 */
	async skip() {
		if (!this.active) return { started: false, queued: false };

		return this.advance();
	}

	/**
	 * Removes the Recitation at the given 1-based queue position. The current
	 * playing Recitation keeps playing.
	 */
	remove(position: number) {
		return this.queue.remove(position);
	}

	/** Empties the Queue while the current Recitation continues playing. */
	clearQueue() {
		this.queue.clearPending();
	}

	pause(): void {
		this.port.pause();
	}

	unpause(): void {
		this.port.unpause();
	}

	dispose(): void {
		this.active = null;
		this.port.leave();
		this.port.destroy();
	}

	private async startCurrent(): Promise<PlayResult> {
		const current = this.queue.view().current;

		if (!current) return { started: false, queued: false };

		const reachable = await this.probeStream(current.url);

		if (!reachable) {
			this.emitNotice(
				`Couldn't play ${recitationLabel(current)} — the stream is unreachable.`,
			);
			this.queue.skip();
			return this.startCurrent();
		}

		this.active = { item: current, retries: 0 };
		this.port.play(current.url);

		return { started: true, queued: false };
	}

	private onStreamError() {
		const active = this.active;

		if (!active) return;

		if (active.retries < MAX_STREAM_RETRIES) {
			active.retries += 1;
			logger.info(
				"Retrying stream in guild %s (%d/%d)",
				this.guildId,
				active.retries,
				MAX_STREAM_RETRIES,
			);
			this.port.play(active.item.url);
			return;
		}

		this.emitNotice(`Playback of ${recitationLabel(active.item)} failed.`);
		void this.advance();
	}

	private async advance() {
		this.active = null;
		this.queue.advance();
		return this.startCurrent();
	}

	private onTrackEnd() {
		if (!this.active) return;

		void this.advance();
	}

	private emitNotice(message: string) {
		logger.info("Notice in guild %s: %s", this.guildId, message);

		for (const listener of this.noticeListeners) listener(message);
	}
}
