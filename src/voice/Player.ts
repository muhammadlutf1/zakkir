import { AudioPlayerStatus, VoiceConnectionStatus } from "@discordjs/voice";
import type { TextBasedChannel, VoiceChannel } from "discord.js";
import type { Radio } from "../catalog/Catalog";
import { createLogger } from "../core/logger";
import { Queue, type RepeatMode } from "./Queue";
import type { Recitation } from "./Recitation";
import type { VoicePort } from "./VoicePort";

const logger = createLogger("player");

const MAX_STREAM_RETRIES = 1;
const MAX_RADIO_RETRIES = 3;
const RADIO_RETRY_BASE_MS = 1000;

/** The playback-failure notices a Player can emit. */
export type PlayerNoticeKind = "unreachable" | "playbackFailed";

/**
 * Renders a Player's playback-failure notice in the guild's locale. Injected
 * into the Player so the voice layer stays free of localization logic; the
 * composition root builds it from the guild's effective locale.
 */
export interface PlayerNoticeFormatter {
	render(kind: PlayerNoticeKind, recitation: Recitation): string;
}

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
	/**
	 * How long to wait for a human to return before ending the session once
	 * the last human leaves the voice channel. Defaults to 60s.
	 */
	gracePeriodMs?: number;
	/**
	 * Invoked once the session ends (the grace timer fired). Lets the owner
	 * dispose this Player from the registry.
	 */
	onSessionEnd?: (guildId: string) => void;
	/**
	 * Renders this guild's playback-failure notices in the guild's locale.
	 * Defaults to none (no user-facing notice); the composition root injects
	 * it per guild so the voice layer holds no localization logic.
	 */
	notices?: PlayerNoticeFormatter;
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
	private radio: (Radio & { retries: number }) | null = null;
	private radioRetryTimer: NodeJS.Timeout | undefined;
	private readonly probeStream: (url: string) => Promise<boolean>;
	private readonly gracePeriodMs: number;
	private readonly onSessionEnd?: (guildId: string) => void;
	private notices?: PlayerNoticeFormatter;
	private readonly noticeListeners = new Set<(message: string) => void>();
	private readonly changeListeners = new Set<() => void>();
	private readonly endListeners = new Set<() => void>();
	private readonly radioListeners = new Set<() => void>();
	private noticeChannelRef: TextBasedChannel | undefined;
	private channel: VoiceChannel | undefined;
	private graceTimer: NodeJS.Timeout | undefined;
	private paused = false;

	constructor(
		public readonly guildId: string,
		private readonly port: VoicePort,
		options: PlayerOptions = {},
	) {
		this.probeStream = options.probeStream ?? defaultProbeStream;
		this.gracePeriodMs = options.gracePeriodMs ?? 60_000;
		this.onSessionEnd = options.onSessionEnd;
		this.notices = options.notices;

		port.on("error", (error) => {
			logger.error(error, "Voice error in guild %s", this.guildId);
		});

		port.on("streamError", (error) => {
			logger.error(error, "Stream error in guild %s", this.guildId);
			this.onStreamError();
		});

		port.on("playerStateChange", (state) => {
			this.paused = state === AudioPlayerStatus.Paused;
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

	get isPaused() {
		return this.paused;
	}

	get voiceChannelId() {
		return this.channel?.id ?? this.port.joinedChannelId ?? null;
	}

	get humanMemberCount() {
		if (!this.channel) return 0;
		return this.channel.members.filter((member) => !member.user.bot).size;
	}

	get isOccupied() {
		return this.isConnected && this.humanMemberCount > 0;
	}

	get isRadioPlaying() {
		return this.radio !== null;
	}

	get radioInfo(): Radio | null {
		return this.radio
			? { id: this.radio.id, name: this.radio.name, url: this.radio.url }
			: null;
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
		this.emitChange();
	}

	/**
	 * Makes the queued Recitation at the given 0-based index current, dropping
	 * everything before it, and restarts playback of the now-current track.
	 * A no-op when nothing sits at that index.
	 */
	async jumpTo(index: number) {
		if (this.isRadioPlaying) return { started: false, queued: false };
		if (!this.queue.jumpTo(index)) return { started: false, queued: false };

		this.active = null;
		this.port.stop();
		const result = await this.startCurrent();
		this.emitChange();
		return result;
	}

	/**
	 * Swaps the Player's notice renderer — called when the guild changes its
	 * UI language. Localization ownership stays with the injected formatter,
	 * so a locale change is expressed as exchanging it rather than teaching
	 * the Player about locales.
	 */
	setNotices(notices: PlayerNoticeFormatter) {
		this.notices = notices;
	}

	/**
	 * Adds the Recitation to the guild's Queue. If nothing is currently
	 * playing and no Radio is active, it starts immediately. While Radio
	 * plays the Queue is paused — the Recitation is appended but never
	 * auto-started.
	 */
	async play(recitation: Recitation): Promise<PlayResult> {
		this.queue.add(recitation);

		if (this.isRadioPlaying) {
			this.emitChange();
			return { started: false, queued: true };
		}

		if (this.isPlaying) {
			this.emitChange();
			return { started: false, queued: true };
		}

		const result = await this.startCurrent();

		if (result.started) this.emitChange();

		return result;
	}

	async playRadio(radio: Radio): Promise<void> {
		this.cancelRadioRetry();
		if (this.active) {
			this.active = null;
			this.port.stop();
		}
		this.radio = { id: radio.id, name: radio.name, url: radio.url, retries: 0 };
		this.port.play(radio.url);
		this.emitRadioChange();
	}

	stopRadio(): void {
		if (!this.radio) return;
		this.cancelRadioRetry();
		this.radio = null;
		this.port.stop();
		this.emitRadioChange();
	}

	onNotice(listener: (message: string) => void): () => void {
		this.noticeListeners.add(listener);

		return () => this.noticeListeners.delete(listener);
	}

	/**
	 * Subscribes to playback-state changes (something started, advanced,
	 * skipped, paused, unpaused, repeat mode changed, jumped). Returns an
	 * unsubscribe function.
	 */
	onChange(listener: () => void): () => void {
		this.changeListeners.add(listener);

		return () => this.changeListeners.delete(listener);
	}

	/** Subscribes to session end. Returns an unsubscribe function. */
	onEnd(listener: () => void): () => void {
		this.endListeners.add(listener);

		return () => this.endListeners.delete(listener);
	}

	/**
	 * Subscribes to Radio state transitions (a Radio started, stopped, gave
	 * up after retries, or the session ended). Returns an unsubscribe
	 * function. Lets the play layer drop per-guild state tied to the current
	 * Radio — e.g. pending play confirmations — without reaching into
	 * playback internals.
	 */
	onRadioChange(listener: () => void): () => void {
		this.radioListeners.add(listener);

		return () => this.radioListeners.delete(listener);
	}

	async join(channel: VoiceChannel): Promise<void> {
		this.channel = channel;
		logger.info(
			"Player joining voice channel %s in guild %s",
			channel.id,
			this.guildId,
		);
		await this.port.join(channel);
	}

	/**
	 * Syncs the Player to an external voice move (e.g. an admin dragged the
	 * bot to another channel). The audio pipeline is untouched — the
	 * AudioPlayer stays subscribed to the same VoiceConnection, so the current
	 * Recitation/Radio keeps playing. Only the channel pointer and grace timer
	 * are updated so membership tracking follows the new channel.
	 */
	handleExternalMove(channel: VoiceChannel): void {
		if (this.channel?.id === channel.id) {
			this.refreshVoiceMembership();
			return;
		}
		logger.info(
			"Player moved to voice channel %s in guild %s via external move",
			channel.id,
			this.guildId,
		);
		this.channel = channel;
		this.refreshVoiceMembership();
	}

	leave(): void {
		logger.info("Player leaving voice channel in guild %s", this.guildId);
		this.cancelGraceTimer();
		this.cancelRadioRetry();
		this.radio = null;
		this.emitRadioChange();
		this.channel = undefined;
		this.connectionState = VoiceConnectionStatus.Destroyed;
		this.active = null;
		this.port.leave();
	}

	/**
	 * Reports the current number of human (non-bot) members in the Player's
	 * voice channel. The last human leaving (while connected) starts the grace
	 * timer; a human returning before it fires is the only thing that cancels
	 * it.
	 */
	updateVoiceMembership(humanCount: number) {
		if (humanCount > 0) {
			this.cancelGraceTimer();
			return;
		}

		if (this.isConnected) this.startGraceTimer();
	}

	/**
	 * Re-reads the current channel's membership and feeds the human count
	 * into the grace timer. Called by the bot on every voice-state change.
	 */
	refreshVoiceMembership() {
		if (!this.channel) return;

		const humans = this.channel.members.filter(
			(member) => !member.user.bot,
		).size;

		this.updateVoiceMembership(humans);
	}

	stop(): void {
		this.cancelRadioRetry();
		this.radio = null;
		this.emitRadioChange();
		this.active = null;
		this.queue.clear();
		this.port.stop();
	}

	/**
	 * Stops the current Recitation and starts the next per RepeatMode. In OFF
	 * mode playback ends cleanly when nothing is queued; CURRENT replays the
	 * current; ALL wraps back to the first when the queue ends.
	 * While Radio plays, skip is a no-op — the station is never skipped forward.
	 */
	async skip() {
		if (this.isRadioPlaying) return { started: false, queued: false };
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
		this.paused = true;
		this.emitChange();
	}

	unpause(): void {
		this.port.unpause();
		this.paused = false;
		this.emitChange();
	}

	/**
	 * Ends the playback session: disconnects, clears the Queue, and disposes
	 * this Player from the registry. Session-end paths (the grace timer today;
	 * the panel's Stop button in the future) converge on this single action.
	 */
	endSession() {
		this.cancelRadioRetry();
		this.radio = null;
		this.emitRadioChange();
		this.leave();
		this.queue.clear();
		this.port.destroy();
		for (const listener of this.endListeners) listener();
		this.onSessionEnd?.(this.guildId);
	}

	private startGraceTimer() {
		if (this.graceTimer) return;

		this.graceTimer = setTimeout(() => {
			this.graceTimer = undefined;
			logger.info(
				"Grace period elapsed in guild %s — ending session",
				this.guildId,
			);
			this.endSession();
		}, this.gracePeriodMs);

		this.graceTimer.unref?.();
	}

	private cancelGraceTimer() {
		if (!this.graceTimer) return;

		clearTimeout(this.graceTimer);
		this.graceTimer = undefined;
	}

	private cancelRadioRetry() {
		if (!this.radioRetryTimer) return;
		clearTimeout(this.radioRetryTimer);
		this.radioRetryTimer = undefined;
	}

	private handleRadioStreamError() {
		const radio = this.radio;
		if (!radio) return;
		if (radio.retries < MAX_RADIO_RETRIES) {
			const delay = RADIO_RETRY_BASE_MS * 2 ** radio.retries;
			radio.retries += 1;
			logger.info(
				"Retrying radio %s in guild %s (%d/%d) in %dms",
				radio.name,
				this.guildId,
				radio.retries,
				MAX_RADIO_RETRIES,
				delay,
			);
			this.cancelRadioRetry();
			this.radioRetryTimer = setTimeout(() => {
				this.radioRetryTimer = undefined;
				if (!this.radio) return;
				this.port.play(this.radio.url);
			}, delay);
			this.radioRetryTimer.unref?.();
			return;
		}
		logger.warn(
			"Radio %s in guild %s failed after %d retries — going idle",
			radio.name,
			this.guildId,
			MAX_RADIO_RETRIES,
		);
		this.cancelRadioRetry();
		this.radio = null;
		this.emitRadioChange();
		this.port.stop();
	}

	private async startCurrent(): Promise<PlayResult> {
		const current = this.queue.view().current;

		if (!current) return { started: false, queued: false };

		const reachable = await this.probeStream(current.url);

		if (!reachable) {
			this.emitNotice(this.notices?.render("unreachable", current));
			this.queue.skip();
			return this.startCurrent();
		}

		this.active = { item: current, retries: 0 };
		this.port.play(current.url);

		return { started: true, queued: false };
	}

	private onStreamError() {
		if (this.radio) {
			this.handleRadioStreamError();
			return;
		}
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

		this.emitNotice(this.notices?.render("playbackFailed", active.item));

		void this.advance();
	}

	private async advance() {
		this.active = null;
		this.queue.advance();
		const result = await this.startCurrent();
		this.emitChange();
		return result;
	}

	private onTrackEnd() {
		if (this.radio) return;
		if (!this.active) return;

		void this.advance();
	}

	private emitNotice(message?: string) {
		if (!message) {
			logger.warn(
				"No notice formatter injected — playback failure in guild %s produced no user-facing notice",
				this.guildId,
			);
			return;
		}

		logger.info("Notice in guild %s: %s", this.guildId, message);

		for (const listener of this.noticeListeners) listener(message);
	}

	private emitChange() {
		for (const listener of this.changeListeners) listener();
	}

	private emitRadioChange() {
		for (const listener of this.radioListeners) listener();
	}
}
