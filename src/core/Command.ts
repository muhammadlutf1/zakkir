import type {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { CommandContext } from "./interactionContext";

export interface Command {
	readonly data:
		| SlashCommandBuilder
		| SlashCommandOptionsOnlyBuilder
		| SlashCommandSubcommandsOnlyBuilder;
	execute(
		context: CommandContext,
		interaction: ChatInputCommandInteraction,
	): Promise<void> | void;
	autocomplete?(
		context: CommandContext,
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
