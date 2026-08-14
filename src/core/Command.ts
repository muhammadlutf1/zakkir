import type {
	AutocompleteInteraction,
	CommandInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type Bot from "./Bot";

export interface Command {
	readonly data:
		| SlashCommandBuilder
		| SlashCommandOptionsOnlyBuilder
		| SlashCommandSubcommandsOnlyBuilder;
	execute(bot: Bot, interaction: CommandInteraction): Promise<void> | void;
	autocomplete?(
		bot: Bot,
		interaction: AutocompleteInteraction,
	): Promise<void> | void;
}

export function isCommand(command: unknown): command is Command {
	return (
		typeof command === "object" &&
		command !== null &&
		"data" in command &&
		"execute" in command
	);
}
