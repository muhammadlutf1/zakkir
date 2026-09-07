import { Events } from "discord.js";
import type { BotEvent } from "../core/Event.ts";
import { createLogger } from "../core/logger.ts";

const logger = createLogger("client");

const errorEvent: BotEvent<Events.Error> = {
	name: Events.Error,
	execute(_bot, error) {
		logger.error(error, "Client error");
	},
} as const;

export default errorEvent;
