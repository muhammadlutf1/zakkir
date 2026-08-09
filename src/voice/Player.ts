import { VoiceConnectionStatus } from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";
import { createLogger } from "../core/logger";
import type { VoicePort } from "./VoicePort";

const logger = createLogger("player");

export class Player {
	private connectionState: VoiceConnectionStatus =
		VoiceConnectionStatus.Destroyed;

	constructor(
		public readonly guildId: string,
		private readonly port: VoicePort,
	) {
		port.on("error", (error) => {
			logger.error(error, "Voice error in guild %s", this.guildId);
		});

		port.on("stateChange", (state) => {
			this.connectionState = state;
		});
	}

	get isConnected() {
		return this.connectionState === VoiceConnectionStatus.Ready;
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
		this.port.leave();
	}

	play(url: string): void {
		this.port.play(url);
	}

	pause(): void {
		this.port.pause();
	}

	unpause(): void {
		this.port.unpause();
	}

	stop(): void {
		this.port.stop();
	}

	dispose(): void {
		this.port.leave();
		this.port.destroy();
	}
}
