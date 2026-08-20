import type { Catalog } from "../catalog/Catalog";
import type { GuildConfig } from "../guild/GuildConfig";
import type { GlobalDefaults } from "../guild/types";
import type { Localizable, Locale } from "../i18n/locale";
import type { PlayerRegistry } from "../voice/PlayerRegistry";

/**
 * The slice of the Player registry that handlers touch — never the whole
 * command-collection / event-emitter surface of the Bot.
 */
export type PlayerRegistryView = Omit<PlayerRegistry, "playerFactory">;

export interface PlayConfig {
	defaults: GlobalDefaults;
	pickerTimeoutMs: number;
}

/** Collaborators a slash-command handler may touch. */
export interface CommandContext {
	players: Omit<PlayerRegistry, "playerFactory">;
	catalog: Catalog;
	guildConfigs: GuildConfig;
	play: PlayConfig;
	/** The guild's UI locale for this dispatch. */
	locale: Locale;
	/** The locale-bound message key resolver for every reply in this dispatch. */
	t: Localizable;
}

/** Collaborators a message-component handler may touch. */
export interface ComponentContext {
	players: Pick<PlayerRegistryView, "get">;
	catalog: Catalog;
	guildConfigs: GuildConfig;
	/** The guild's UI locale for this dispatch. */
	locale: Locale;
	/** The locale-bound message key resolver for every reply in this dispatch. */
	t: Localizable;
}
