import { Catalog } from "./catalog/Catalog";
import { config } from "./config";
import Bot from "./core/Bot";
import commandLoader from "./core/loaders/commandLoader";
import componentLoader from "./core/loaders/componentLoader";
import eventLoader from "./core/loaders/eventLoader";
import { createLogger } from "./core/logger";
import { GuildConfig } from "./guild/GuildConfig";
import { SqliteGuildConfigStore } from "./guild/SqliteGuildConfigStore";
import { attachPlayerNotices } from "./play/noticeChannels";
import { DiscordVoicePort } from "./voice/DiscordVoicePort";
import { Player } from "./voice/Player";
import { PlayerRegistry } from "./voice/PlayerRegistry";

const logger = createLogger("index");

const store = new SqliteGuildConfigStore(config.database.path);
const guildConfig = new GuildConfig(store);
const catalog = new Catalog();

const playerRegistry = new PlayerRegistry((guildId) => {
	const player = new Player(guildId, new DiscordVoicePort(), {
		gracePeriodMs: config.voice.gracePeriodMs,
		locale: guildConfig.language(guildId),
		onSessionEnd: () => {
			playerRegistry.remove(guildId);
		},
	});

	attachPlayerNotices(player);

	return player;
});

const bot = new Bot(
	commandLoader,
	eventLoader,
	componentLoader,
	playerRegistry,
	guildConfig,
	catalog,
);

try {
	await bot.login();
} catch (error) {
	logger.error(error, "Failed to log in the bot");
	process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		bot.destroy().finally(() => {
			store.close();
			process.exit(0);
		});
	});
}
