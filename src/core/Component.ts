import type { MessageComponentInteraction } from "discord.js";
import type { ComponentContext } from "./interactionContext";

export interface Component {
	readonly id: string;
	/**
	 * Whether this Component handles the given message-component customId.
	 */
	match(customId: string): boolean;
	execute(
		context: ComponentContext,
		interaction: MessageComponentInteraction,
	): Promise<void> | void;
}

export function isComponent(value: unknown): value is Component {
	return (
		typeof value === "object" &&
		value !== null &&
		"id" in value &&
		"match" in value &&
		"execute" in value
	);
}
