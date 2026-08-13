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

const store = new SqliteGuildConfigStore(config.database.path);
const guildConfig = new GuildConfig(store);

const bot = new Bot(commandLoader, eventLoader, playerRegistry, guildConfig);

bot.login();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		bot.destroy().finally(() => {
			store.close();
			process.exit(0);
		});
	});
}
