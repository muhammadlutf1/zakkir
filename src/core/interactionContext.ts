import type { Catalog } from "../catalog/Catalog";
import type { GuildConfig } from "../guildConfig/GuildConfig";
import type { GlobalDefaults } from "../guildConfig/types";
import type { Player } from "../voice/Player";

/**
 * The slice of the Player registry that handlers touch — never the whole
 * command-collection / event-emitter surface of the Bot.
 */
export interface PlayerRegistryView {
	get(guildId: string): Player | undefined;
	getOrCreate(guildId: string): Player;
	remove(guildId: string): Player | undefined;
}

export interface PlayConfig {
	defaults: GlobalDefaults;
	pickerTimeoutMs: number;
}

/** Collaborators a slash-command handler may touch. */
export interface CommandContext {
	players: PlayerRegistryView;
	catalog: Catalog;
	guildConfigs: GuildConfig;
	play: PlayConfig;
}

/** Collaborators a message-component handler may touch. */
export interface ComponentContext {
	players: Pick<PlayerRegistryView, "get">;
	catalog: Catalog;
}
