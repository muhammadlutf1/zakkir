import type { Catalog } from "../catalog/Catalog";
import type { GuildConfig } from "../guildConfig/GuildConfig";
import type { GlobalDefaults } from "../guildConfig/types";
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
}

/** Collaborators a message-component handler may touch. */
export interface ComponentContext {
	players: Pick<PlayerRegistryView, "get">;
	catalog: Catalog;
}
