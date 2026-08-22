import { createLogger } from "../core/logger";
import type { Locale } from "../i18n/locale";
import type { Player } from "../voice/Player";
import { createPanel, hasPanel } from "./playerPanel";

const logger = createLogger("playerPanelAutoPost");

/**
 * Wires a Player so the first playback start after a session opens posts the
 * guild's PlayerPanel in the session's notice channel — the same channel the
 * notices themselves route through. Later starts are no-ops: the panel's own
 * onChange subscription keeps it current once it exists.
 */
export function attachPlayerPanel(player: Player, locale: Locale) {
	let posting = false;

	player.onChange(() => {
		if (posting || !player.isPlaying || hasPanel(player.guildId)) return;

		const channel = player.noticeChannel;

		if (!channel || !("send" in channel)) return;

		posting = true;

		void createPanel(player, channel, locale).catch((error: unknown) => {
			logger.error(error, "Failed to post panel in guild %s", player.guildId);
			posting = false;
		});
	});
}
