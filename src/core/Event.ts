import type { ClientEvents } from "discord.js";
import type Bot from "./Bot";

export interface BotEvent<T extends keyof ClientEvents = keyof ClientEvents> {
	readonly name: T;
	readonly once?: boolean;
	execute(bot: Bot, ...args: ClientEvents[T]): Promise<void> | void;
}

export function isBotEvent(event: unknown): event is BotEvent {
	return (
		typeof event === "object" &&
		event !== null &&
		"name" in event &&
		"execute" in event
	);
}
