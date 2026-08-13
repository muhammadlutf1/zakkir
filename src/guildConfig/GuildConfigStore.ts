import type { GuildConfigData } from "./types";

export interface GuildConfigStore {
	get(guildId: string): Promise<GuildConfigData | undefined>;
	set(config: GuildConfigData): Promise<void>;
}
