import { Events } from "discord.js";
import type { BotEvent } from "../core/Event";

/**
 * Reflects every guild voice-state change back into each connected Player so
 * it can start or cancel its grace-period leave timer as humans come and go.
 */
const voiceStateUpdateEvent: BotEvent<Events.VoiceStateUpdate> = {
	name: Events.VoiceStateUpdate,
	execute(bot) {
		bot.players.forEach((player) => {
			player.refreshVoiceMembership();
		});
	},
} as const;

export default voiceStateUpdateEvent;