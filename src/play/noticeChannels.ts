import type { TextBasedChannel } from "discord.js";
import { createLogger } from "../core/logger";
import type { Player } from "../voice/Player";

const logger = createLogger("notices");

const noticeChannels = new Map<string, TextBasedChannel>();

export function setGuildNoticeChannel(guildId: string, channel: TextBasedChannel) {
	noticeChannels.set(guildId, channel);
}

/**
 * Wires a Player's user-facing notices (e.g. a failed Recitation) to the text
 * channel where the guild's last `/play` was issued.
 */
export function attachPlayerNotices(player: Player): void {
	player.onNotice((message) => {
		const channel = noticeChannels.get(player.guildId);

		if (!channel || !("send" in channel)) return;

		void channel.send(message).catch((error: unknown) => {
			logger.error(error, "Failed to post notice in guild %s", player.guildId);
		});
	});
}