import { Events, type VoiceChannel } from "discord.js";
import type { BotEvent } from "../core/Event";

/**
 * Reflects a guild voice-state change back into that guild's Player so it can
 * start or cancel its grace-period leave timer as humans come and go.
 * Also handles the bot's own external disconnect (voice kick) and admin moves
 * between voice channels — the former ends the session, the latter keeps
 * playback alive on the same VoiceConnection.
 */
const voiceStateUpdateEvent: BotEvent<Events.VoiceStateUpdate> = {
	name: Events.VoiceStateUpdate,
	execute(bot, oldState, newState) {
		const player = bot.players.get(newState.guild.id);
		if (!player) return;

		if (newState.id === bot.user?.id) {
			if (newState.channelId === null) {
				player.endSession();
				return;
			}
			if (oldState.channelId !== newState.channelId) {
				const channel = newState.channel;
				if (channel?.isVoiceBased()) {
					player.handleExternalMove(channel as VoiceChannel);
					return;
				}
				const cached = newState.guild.channels.cache.get(
					newState.channelId ?? "",
				);
				if (cached?.isVoiceBased()) {
					player.handleExternalMove(cached as VoiceChannel);
				}
				return;
			}
			return;
		}

		player.refreshVoiceMembership();
	},
} as const;

export default voiceStateUpdateEvent;
