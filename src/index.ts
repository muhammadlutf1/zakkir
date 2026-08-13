import Bot from "./core/Bot";
import commandLoader from "./core/loaders/commandLoader";
import eventLoader from "./core/loaders/eventLoader";
import { config } from "./config";
import { GuildConfig } from "./guildConfig/GuildConfig";
import { SqliteGuildConfigStore } from "./guildConfig/SqliteGuildConfigStore";
import { DiscordVoicePort } from "./voice/DiscordVoicePort";
import { Player } from "./voice/Player";
import { PlayerRegistry } from "./voice/PlayerRegistry";

const playerRegistry = new PlayerRegistry(
	(guildId) => new Player(guildId, new DiscordVoicePort()),
);

const guildConfig = new GuildConfig(
	new SqliteGuildConfigStore(config.database.path),
	config.defaults,
);

const bot = new Bot(commandLoader, eventLoader, playerRegistry, guildConfig);

bot.login();
