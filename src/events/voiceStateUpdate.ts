import { Events } from "discord.js";
import type { BotEvent } from "../core/Event";

/**
 * Reflects a guild voice-state change back into that guild's Player so it can
 * start or cancel its grace-period leave timer as humans come and go.
 */
const voiceStateUpdateEvent: BotEvent<Events.VoiceStateUpdate> = {
	name: Events.VoiceStateUpdate,
	execute(bot, _oldState, newState) {
		bot.players.get(newState.guild.id)?.refreshVoiceMembership();
	},
} as const;

export default voiceStateUpdateEvent;