import { AudioPlayerStatus } from "@discordjs/voice";
import type { Radio } from "../catalog/Catalog";
import { createLogger } from "../core/logger";
import type { Queue } from "./Queue";
import type { Recitation } from "./Recitation";
import type { VoicePort } from "./VoicePort";

const logger = createLogger("playbackEngine");

const MAX_STREAM_RETRIES = 1;
const MAX_RADIO_RETRIES = 3;
const RADIO_RETRY_BASE_MS = 1000;

export type PlayerNoticeKind = "unreachable" | "playbackFailed";

export interface PlayerNoticeFormatter {
	render(kind: PlayerNoticeKind, recitation: Recitation): string;
}

export interface PlayResult {
	started: boolean;
	queued: boolean;
}

export interface PlaybackEngineOptions {
	guildId: string;
	port: VoicePort;
	queue: Queue<Recitation>;
	probeStream?: (url: string) => Promise<boolean>;
	getNotices?: () => PlayerNoticeFormatter | undefined;
	emitNotice?: (message: string) => void;
	emitChange?: () => void;
	emitRadioChange?: () => void;
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

export class PlaybackEngine {
	private active: { item: Recitation; retries: number } | null = null;
	private radio: (Radio & { retries: number }) | null = null;
	private radioRetryTimer: NodeJS.Timeout | undefined;
	private readonly probeStream: (url: string) => Promise<boolean>;
	private readonly port: VoicePort;
	private readonly queue: Queue<Recitation>;
	private readonly guildId: string;
	private readonly getNotices?: () => PlayerNoticeFormatter | undefined;
	private readonly emitNoticeRaw?: (message: string) => void;
	private readonly emitChangeRaw?: () => void;
	private readonly emitRadioChangeRaw?: () => void;
	private paused = false;

	constructor(options: PlaybackEngineOptions) {
		this.guildId = options.guildId;
		this.port = options.port;
		this.queue = options.queue;
		this.probeStream = options.probeStream ?? defaultProbeStream;
		this.getNotices = options.getNotices;
		this.emitNoticeRaw = options.emitNotice;
		this.emitChangeRaw = options.emitChange;
		this.emitRadioChangeRaw = options.emitRadioChange;
	}

	get isPlaying() {
		return this.active !== null;
	}

	get isPaused() {
		return this.paused;
	}

	get isRadioPlaying() {
		return this.radio !== null;
	}

	get radioInfo(): Radio | null {
		return this.radio
			? { id: this.radio.id, name: this.radio.name, url: this.radio.url }
			: null;
	}

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

	stop(): void {
		this.cancelRadioRetry();
		if (this.radio) {
			this.radio = null;
			this.emitRadioChange();
		}
		this.active = null;
		this.queue.clear();
		this.port.stop();
	}

	async skip(): Promise<PlayResult> {
		if (this.isRadioPlaying) return { started: false, queued: false };
		if (!this.active) return { started: false, queued: false };
		return this.advance();
	}

	async jumpTo(index: number): Promise<PlayResult> {
		if (this.isRadioPlaying) return { started: false, queued: false };
		if (!this.queue.jumpTo(index)) return { started: false, queued: false };
		this.active = null;
		this.port.stop();
		const result = await this.startCurrent();
		this.emitChange();
		return result;
	}

	remove(position: number): boolean {
		return this.queue.remove(position);
	}

	clearPending(): void {
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

	handlePlayerStateChange(state: AudioPlayerStatus): void {
		this.paused = state === AudioPlayerStatus.Paused;
		if (state === AudioPlayerStatus.Idle) this.onTrackEnd();
	}

	handleStreamError(_error: unknown): void {
		this.onStreamError();
	}

	handleLeave(): void {
		this.cancelRadioRetry();
		if (this.radio) {
			this.radio = null;
			this.emitRadioChange();
		}
		this.active = null;
	}

	handleEndSession(): void {
		this.cancelRadioRetry();
		if (this.radio) {
			this.radio = null;
			this.emitRadioChange();
		}
		this.active = null;
	}

	dispose(): void {
		this.cancelRadioRetry();
	}

	private cancelRadioRetry(): void {
		if (!this.radioRetryTimer) return;
		clearTimeout(this.radioRetryTimer);
		this.radioRetryTimer = undefined;
	}

	private handleRadioStreamError(): void {
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
			this.radioRetryTimer.unref();
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
			this.emitNoticeKind("unreachable", current);
			this.queue.skip();
			return this.startCurrent();
		}
		this.active = { item: current, retries: 0 };
		this.port.play(current.url);
		return { started: true, queued: false };
	}

	private onStreamError(): void {
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
		this.emitNoticeKind("playbackFailed", active.item);
		void this.advance();
	}

	private async advance(): Promise<PlayResult> {
		this.active = null;
		this.queue.advance();
		const result = await this.startCurrent();
		this.emitChange();
		return result;
	}

	private onTrackEnd(): void {
		if (this.radio) return;
		if (!this.active) return;
		void this.advance();
	}

	private emitNoticeKind(kind: PlayerNoticeKind, recitation: Recitation): void {
		const formatter = this.getNotices?.();
		const message = formatter?.render(kind, recitation);
		if (!message) {
			logger.warn(
				"No notice formatter injected — playback failure in guild %s produced no user-facing notice",
				this.guildId,
			);
			return;
		}
		if (this.emitNoticeRaw) this.emitNoticeRaw(message);
	}

	private emitChange(): void {
		if (this.emitChangeRaw) this.emitChangeRaw();
	}

	private emitRadioChange(): void {
		if (this.emitRadioChangeRaw) this.emitRadioChangeRaw();
	}
}
