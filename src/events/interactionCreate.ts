import type {
	AutocompleteInteraction,
	CommandInteraction,
	MessageComponentInteraction,
} from "discord.js";
import { Events, MessageFlags } from "discord.js";
import { Catalog } from "../catalog/Catalog";
import { config } from "../config";
import type { BotEvent } from "../core/Event";
import type {
	CommandContext,
	ComponentContext,
} from "../core/interactionContext";
import { createLogger } from "../core/logger";
import { type Localizable, localizable } from "../i18n/locale";

const logger = createLogger("interactionCreate");

const interactionDispatcher: BotEvent<Events.InteractionCreate> = {
	name: Events.InteractionCreate,
	async execute(bot, interaction) {
		if (!interaction.guild) return;

		// The guild's UI locale for every reactive reply in this dispatch.
		const locale = bot.guildConfigs.language(interaction.guild.id);
		const translator = localizable(locale);
		// A Catalog bound to the guild's locale over the shared endpoint cache,
		// so call sites resolve localized names without passing `locale` around.
		const catalog = new Catalog({ language: locale });

		const commandContext: CommandContext = {
			players: bot.players,
			catalog,
			guildConfigs: bot.guildConfigs,
			play: {
				defaults: config.defaults,
				pickerTimeoutMs: config.rewayahPicker.timeoutMs,
			},
			locale,
			translator,
		};

		const componentContext: ComponentContext = {
			players: bot.players,
			catalog,
			guildConfigs: bot.guildConfigs,
			locale,
			translator,
		};

		if (interaction.isAutocomplete()) {
			const command = bot.commands.get(interaction.commandName);

			if (!command?.autocomplete) return;

			await dispatchWithErrorPolicy(
				"autocomplete",
				`autocomplete for ${interaction.commandName}`,
				interaction,
				() => command.autocomplete?.(commandContext, interaction),
				translator,
			);

			return;
		}

		// Message components (e.g. rewayah picker Play buttons)
		if (interaction.isMessageComponent()) {
			const component = Array.from(bot.components.values()).find((c) =>
				c.match(interaction.customId),
			);

			if (!component) return;

			await dispatchWithErrorPolicy(
				"messageComponent",
				`component ${interaction.customId}`,
				interaction,
				() => component.execute(componentContext, interaction),
				translator,
			);

			return;
		}

		// Slash commands
		if (interaction.isChatInputCommand()) {
			const command = bot.commands.get(interaction.commandName);

			if (!command) return;

			await dispatchWithErrorPolicy(
				"chatInput",
				`command ${interaction.commandName}`,
				interaction,
				() => command.execute(commandContext, interaction),
				translator,
			);
		}
	},
} as const;

/**
 * The single dispatch-and-error path every interaction kind shares: run the
 * handler, and on failure apply the shared error policy (log-only for
 * autocomplete; reply, or follow up when already responded to).
 */
async function dispatchWithErrorPolicy(
	kind: InteractionFailureKind,
	logLabel: string,
	interaction:
		| AutocompleteInteraction
		| MessageComponentInteraction
		| CommandInteraction,
	execute: () => unknown,
	translator: Localizable,
) {
	try {
		await execute();
	} catch (error) {
		logger.error(error, "Error handling %s", logLabel);

		const decision = decideFailureResponse(
			kind,
			"replied" in interaction
				? interaction.replied || interaction.deferred
				: false,
			translator,
		);

		if (decision.action === "log") return;

		const responder = interaction as CommandInteraction;

		if (decision.action === "reply") {
			await responder.reply({
				content: decision.content,
				flags: MessageFlags.Ephemeral,
			});
		} else {
			await responder.followUp({
				content: decision.content,
				flags: MessageFlags.Ephemeral,
			});
		}
	}
}

type InteractionFailureKind = "autocomplete" | "messageComponent" | "chatInput";

export function decideFailureResponse(
	kind: InteractionFailureKind,
	responsive: boolean,
	translator: Localizable,
) {
	if (kind === "autocomplete") return { action: "log" };

	const content =
		kind === "messageComponent"
			? translator.t("error.componentGeneric")
			: translator.t("error.commandGeneric");

	return responsive
		? { action: "followUp", content }
		: { action: "reply", content };
}

export default interactionDispatcher;
