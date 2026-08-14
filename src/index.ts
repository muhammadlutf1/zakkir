import Bot from "./core/Bot";
import commandLoader from "./core/loaders/commandLoader";
import componentLoader from "./core/loaders/componentLoader";
import eventLoader from "./core/loaders/eventLoader";
import { config } from "./config";
import { Catalog } from "./catalog/Catalog";
import { GuildConfig } from "./guildConfig/GuildConfig";
import { SqliteGuildConfigStore } from "./guildConfig/SqliteGuildConfigStore";
import { attachPlayerNotices } from "./play/noticeChannels";
import { DiscordVoicePort } from "./voice/DiscordVoicePort";
import { Player } from "./voice/Player";
import { PlayerRegistry } from "./voice/PlayerRegistry";

const playerRegistry = new PlayerRegistry((guildId) => {
	const player = new Player(guildId, new DiscordVoicePort());

	attachPlayerNotices(player);

	return player;
});

const store = new SqliteGuildConfigStore(config.database.path);
const guildConfig = new GuildConfig(store);
const catalog = new Catalog();

const bot = new Bot(
	commandLoader,
	eventLoader,
	componentLoader,
	playerRegistry,
	guildConfig,
	catalog,
);

bot.login();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		bot.destroy().finally(() => {
			store.close();
			process.exit(0);
		});
	});
}
