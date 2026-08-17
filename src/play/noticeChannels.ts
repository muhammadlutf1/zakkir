import { createLogger } from "../core/logger";
import type { Player } from "../voice/Player";

const logger = createLogger("notices");

/**
 * Wires a Player's user-facing notices (e.g. a failed Recitation) to the text
 * channel the playback session set on that Player. Notice routing is local to
 * the Player's session rather than a hidden module-global map.
 */
export function attachPlayerNotices(player: Player) {
	player.onNotice((message) => {
		const channel = player.noticeChannel;

		if (!channel || !("send" in channel)) return;

		void channel.send(message).catch((error: unknown) => {
			logger.error(error, "Failed to post notice in guild %s", player.guildId);
		});
	});
}
