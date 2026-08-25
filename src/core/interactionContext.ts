import type { VoteManager } from "../access/VoteManager";
import type { Catalog } from "../catalog/Catalog";
import type { GuildConfig } from "../guild/GuildConfig";
import type { Locale, Localizable } from "../i18n/locale";
import type { PlaybackRequest } from "../play/playbackRequest";
import type { PlayerRegistry } from "../voice/PlayerRegistry";

/**
 * The slice of the Player registry that handlers touch — never the whole
 * command-collection / event-emitter surface of the Bot.
 */
export type PlayerRegistryView = Omit<PlayerRegistry, "playerFactory">;

/** Collaborators a slash-command handler may touch. */
export interface CommandContext {
	players: Omit<PlayerRegistry, "playerFactory">;
	catalog: Catalog;
	guildConfigs: GuildConfig;
	/** The guild's PlaybackRequest: the single seam for /play flows. */
	playback: PlaybackRequest;
	votes?: VoteManager;
	/** The guild's UI locale for this dispatch. */
	locale: Locale;
	/** The locale-bound message key resolver for every reply in this dispatch. */
	translator: Localizable;
}

/** Collaborators a message-component handler may touch. */
export interface ComponentContext {
	players: Pick<PlayerRegistryView, "get">;
	catalog: Catalog;
	guildConfigs: GuildConfig;
	/** The guild's PlaybackRequest: the single seam for /play flows. */
	playback: PlaybackRequest;
	votes?: VoteManager;
	/** The guild's UI locale for this dispatch. */
	locale: Locale;
	/** The locale-bound message key resolver for every reply in this dispatch. */
	translator: Localizable;
}
