import { VoiceConnectionStatus } from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";
import { createLogger } from "../core/logger";
import type { VoicePort } from "./VoicePort";

const logger = createLogger("sessionLifecycle");

export interface SessionLifecycleOptions {
	gracePeriodMs?: number;
	onGraceExpired?: () => void;
}

export class SessionLifecycle {
	private channel: VoiceChannel | undefined;
	private connectionState: VoiceConnectionStatus =
		VoiceConnectionStatus.Destroyed;
	private graceTimer: NodeJS.Timeout | undefined;
	private readonly gracePeriodMs: number;
	private readonly onGraceExpired?: () => void;

	constructor(
		private readonly guildId: string,
		options: SessionLifecycleOptions = {},
	) {
		this.gracePeriodMs = options.gracePeriodMs ?? 60_000;
		this.onGraceExpired = options.onGraceExpired;
	}

	get isConnected() {
		return this.connectionState === VoiceConnectionStatus.Ready;
	}

	get voiceChannelId(): string | null {
		return this.channel?.id ?? null;
	}

	get channelRef(): VoiceChannel | undefined {
		return this.channel;
	}

	get humanMemberCount() {
		if (!this.channel) return 0;
		return this.channel.members.filter((member) => !member.user.bot).size;
	}

	get humanMemberIds(): string[] {
		if (!this.channel) return [];
		const ids: string[] = [];
		for (const [id, member] of this.channel.members) {
			if (!member.user.bot) ids.push(id);
		}
		return ids;
	}

	get isOccupied() {
		return this.isConnected && this.humanMemberCount > 0;
	}

	setConnectionState(state: VoiceConnectionStatus) {
		this.connectionState = state;
	}

	async join(channel: VoiceChannel, port: VoicePort): Promise<void> {
		this.channel = channel;
		logger.info(
			"Player joining voice channel %s in guild %s",
			channel.id,
			this.guildId,
		);
		await port.join(channel);
	}

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

	leave(port: VoicePort): void {
		logger.info("Player leaving voice channel in guild %s", this.guildId);
		this.cancelGraceTimer();
		this.channel = undefined;
		this.connectionState = VoiceConnectionStatus.Destroyed;
		port.leave();
	}

	updateVoiceMembership(humanCount: number) {
		if (humanCount > 0) {
			this.cancelGraceTimer();
			return;
		}
		if (this.isConnected) this.startGraceTimer();
	}

	refreshVoiceMembership() {
		if (!this.channel) return;
		const humans = this.channel.members.filter(
			(member) => !member.user.bot,
		).size;
		this.updateVoiceMembership(humans);
	}

	cancelGraceTimer() {
		if (!this.graceTimer) return;
		clearTimeout(this.graceTimer);
		this.graceTimer = undefined;
	}

	dispose() {
		this.cancelGraceTimer();
	}

	private startGraceTimer() {
		if (this.graceTimer) return;
		this.graceTimer = setTimeout(() => {
			this.graceTimer = undefined;
			logger.info(
				"Grace period elapsed in guild %s — ending session",
				this.guildId,
			);
			this.onGraceExpired?.();
		}, this.gracePeriodMs);
		this.graceTimer.unref();
	}
}
