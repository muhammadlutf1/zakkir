import type {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	CommandInteraction,
	MessageComponentInteraction,
} from "discord.js";
import { Events, MessageFlags } from "discord.js";
import { Catalog } from "../catalog/Catalog";
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
			playback: bot.playback,
			votes: bot.votes,
			locale,
			translator,
		};

		const componentContext: ComponentContext = {
			players: bot.players,
			catalog,
			guildConfigs: bot.guildConfigs,
			playback: bot.playback,
			votes: bot.votes,
			locale,
			translator,
		};

		if (interaction.isAutocomplete()) {
			// The guild gate above guarantees a cached-guild interaction; the
			// cast only restates that for the handler's static type.
			const autocomplete = interaction as AutocompleteInteraction<"cached">;
			const command = bot.commands.get(autocomplete.commandName);

			if (!command?.autocomplete) return;

			await dispatchWithErrorPolicy(
				"autocomplete",
				`autocomplete for ${autocomplete.commandName}`,
				autocomplete,
				() => command.autocomplete?.(commandContext, autocomplete),
				translator,
			);

			return;
		}

		// Message components (e.g. rewayah picker Play buttons)
		if (interaction.isMessageComponent()) {
			const component = interaction as MessageComponentInteraction<"cached">;
			const handler = Array.from(bot.components.values()).find((c) =>
				c.match(component.customId),
			);

			if (!handler) return;

			await dispatchWithErrorPolicy(
				"messageComponent",
				`component ${component.customId}`,
				component,
				() => handler.execute(componentContext, component),
				translator,
			);

			return;
		}

		// Slash commands
		if (interaction.isChatInputCommand()) {
			const chatInput = interaction as ChatInputCommandInteraction<"cached">;
			const command = bot.commands.get(chatInput.commandName);

			if (!command) return;

			await dispatchWithErrorPolicy(
				"chatInput",
				`command ${chatInput.commandName}`,
				chatInput,
				() => command.execute(commandContext, chatInput),
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
		// 10062 Unknown interaction and 40060 Already acknowledged are
		// expected when Discord times out the 3s window or the interaction
		// was already handled — don't spam error logs or try to reply.
		const code =
			error instanceof Error && "code" in error
				? (error as { code: number }).code
				: undefined;
		if (code === 10062 || code === 40060) {
			logger.warn(
				error,
				"Interaction expired for %s — skipping error reply",
				logLabel,
			);
			return;
		}
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

		try {
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
		} catch (replyError) {
			const replyCode =
				replyError instanceof Error && "code" in replyError
					? (replyError as { code: number }).code
					: undefined;
			if (replyCode === 10062 || replyCode === 40060) {
				logger.warn(replyError, "Error reply expired for %s", logLabel);
				return;
			}
			throw replyError;
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
