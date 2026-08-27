import type { TextBasedChannel, VoiceChannel } from "discord.js";
import type { Radio } from "../catalog/Catalog";
import { createLogger } from "../core/logger";
import {
	PlaybackEngine,
	type PlayerNoticeFormatter,
	type PlayResult,
} from "./PlaybackEngine";
import { Queue, type RepeatMode } from "./Queue";
import type { Recitation } from "./Recitation";
import { SessionLifecycle } from "./SessionLifecycle";
import type { VoicePort } from "./VoicePort";

const logger = createLogger("player");

export type {
	PlayerNoticeFormatter,
	PlayerNoticeKind,
	PlayResult,
} from "./PlaybackEngine";

export interface PlayerOptions {
	probeStream?: (url: string) => Promise<boolean>;
	gracePeriodMs?: number;
	onSessionEnd?: (guildId: string) => void;
	notices?: PlayerNoticeFormatter;
}

export class Player {
	private readonly queue = new Queue<Recitation>();
	private readonly session: SessionLifecycle;
	private readonly playback: PlaybackEngine;
	private readonly onSessionEnd?: (guildId: string) => void;
	private notices?: PlayerNoticeFormatter;
	private readonly noticeListeners = new Set<(message: string) => void>();
	private readonly changeListeners = new Set<() => void>();
	private readonly endListeners = new Set<() => void>();
	private readonly radioListeners = new Set<() => void>();
	private noticeChannelRef: TextBasedChannel | undefined;

	constructor(
		public readonly guildId: string,
		private readonly port: VoicePort,
		options: PlayerOptions = {},
	) {
		this.onSessionEnd = options.onSessionEnd;
		this.notices = options.notices;
		this.session = new SessionLifecycle(guildId, {
			gracePeriodMs: options.gracePeriodMs,
			onGraceExpired: () => this.endSession(),
		});
		this.playback = new PlaybackEngine({
			guildId,
			port,
			queue: this.queue,
			probeStream: options.probeStream,
			getNotices: () => this.notices,
			emitNotice: (message) => this.emitNotice(message),
			emitChange: () => this.emitChange(),
			emitRadioChange: () => this.emitRadioChange(),
		});
		port.on("error", (error) => {
			logger.error(error, "Voice error in guild %s", this.guildId);
		});
		port.on("streamError", (error) => {
			logger.error(error, "Stream error in guild %s", this.guildId);
			this.playback.handleStreamError(error);
		});
		port.on("playerStateChange", (state) => {
			this.playback.handlePlayerStateChange(state);
		});
		port.on("stateChange", (state) => {
			this.session.setConnectionState(state);
		});
	}

	get isConnected() {
		return this.session.isConnected;
	}

	get isPlaying() {
		return this.playback.isPlaying;
	}

	get isPaused() {
		return this.playback.isPaused;
	}

	get voiceChannelId() {
		return this.session.voiceChannelId ?? this.port.joinedChannelId ?? null;
	}

	get humanMemberCount() {
		return this.session.humanMemberCount;
	}

	get humanMemberIds(): string[] {
		return this.session.humanMemberIds;
	}

	get isOccupied() {
		return this.session.isOccupied;
	}

	get isRadioPlaying() {
		return this.playback.isRadioPlaying;
	}

	get radioInfo(): Radio | null {
		return this.playback.radioInfo;
	}

	get queueView() {
		return this.queue.view();
	}

	get repeatMode() {
		return this.queue.repeatMode;
	}

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

	async jumpTo(index: number) {
		return this.playback.jumpTo(index);
	}

	setNotices(notices: PlayerNoticeFormatter) {
		this.notices = notices;
	}

	async play(recitation: Recitation): Promise<PlayResult> {
		return this.playback.play(recitation);
	}

	async playRadio(radio: Radio): Promise<void> {
		return this.playback.playRadio(radio);
	}

	stopRadio(): void {
		this.playback.stopRadio();
	}

	onNotice(listener: (message: string) => void): () => void {
		this.noticeListeners.add(listener);
		return () => this.noticeListeners.delete(listener);
	}

	onChange(listener: () => void): () => void {
		this.changeListeners.add(listener);
		return () => this.changeListeners.delete(listener);
	}

	onEnd(listener: () => void): () => void {
		this.endListeners.add(listener);
		return () => this.endListeners.delete(listener);
	}

	onRadioChange(listener: () => void): () => void {
		this.radioListeners.add(listener);
		return () => this.radioListeners.delete(listener);
	}

	async join(channel: VoiceChannel): Promise<void> {
		await this.session.join(channel, this.port);
	}

	handleExternalMove(channel: VoiceChannel): void {
		this.session.handleExternalMove(channel);
	}

	leave(): void {
		this.playback.handleLeave();
		this.session.leave(this.port);
	}

	updateVoiceMembership(humanCount: number) {
		this.session.updateVoiceMembership(humanCount);
	}

	refreshVoiceMembership() {
		this.session.refreshVoiceMembership();
	}

	stop(): void {
		this.playback.stop();
	}

	async skip() {
		return this.playback.skip();
	}

	remove(position: number) {
		return this.playback.remove(position);
	}

	clearQueue() {
		this.playback.clearPending();
	}

	pause(): void {
		this.playback.pause();
	}

	unpause(): void {
		this.playback.unpause();
	}

	endSession() {
		this.playback.handleEndSession();
		this.session.leave(this.port);
		this.queue.clear();
		this.port.destroy();
		for (const listener of this.endListeners) listener();
		this.onSessionEnd?.(this.guildId);
	}

	private emitNotice(message: string) {
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
