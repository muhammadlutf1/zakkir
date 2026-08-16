import { Events, MessageFlags } from "discord.js";
import type { BotEvent } from "../core/Event";
import { createLogger } from "../core/logger";

const logger = createLogger("interactionCreate");

const interactionDispatcher: BotEvent<Events.InteractionCreate> = {
	name: Events.InteractionCreate,
	async execute(bot, interaction) {
		if (interaction.isAutocomplete()) {
			const command = bot.commands.get(interaction.commandName);

			if (!command?.autocomplete) return;

			try {
				await command.autocomplete(bot, interaction);
			} catch (error) {
				logger.error(
					error,
					"Error handling autocomplete for %s",
					interaction.commandName,
				);
			}

			return;
		}

		// Message components (e.g. rewayah picker Play buttons)
		if (interaction.isMessageComponent()) {
			const component = Array.from(bot.components.values()).find((c) =>
				c.match(interaction.customId),
			);

			if (!component) return;

			try {
				await component.execute(bot, interaction);
			} catch (error) {
				logger.error(error, "Error executing component %s", interaction.customId);

				const content = "There was an error while handling that component!";

				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
				} else {
					await interaction.reply({ content, flags: MessageFlags.Ephemeral });
				}
			}

			return;
		}

		// Slash commands
		if (interaction.isChatInputCommand()) {
			const command = bot.commands.get(interaction.commandName);

			if (!command) return;

			try {
				await command.execute(bot, interaction);
			} catch (error) {
				logger.error(
					error,
					"Error executing command %s",
					interaction.commandName,
				);

				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({
						content: "There was an error while executing this command!",
						flags: MessageFlags.Ephemeral,
					});
				} else {
					await interaction.reply({
						content: "There was an error while executing this command!",
						flags: MessageFlags.Ephemeral,
					});
				}
			}
		}
	},
} as const;

export default interactionDispatcher;
