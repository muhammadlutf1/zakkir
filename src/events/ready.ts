import { ActivityType, Events } from "discord.js";
import type { BotEvent } from "../core/Event";
import { createLogger } from "../core/logger";

const logger = createLogger("ready");

const readyEvent: BotEvent<Events.ClientReady> = {
	name: Events.ClientReady,
	once: true,
	execute(_, client) {
		logger.info("Logged in as %s", client.user.tag);

		client.user.setPresence({
			activities: [
				{
					name: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
					type: ActivityType.Playing,
				},
			],
			status: "online",
		});
	},
} as const;

export default readyEvent;
