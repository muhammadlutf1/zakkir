import { VoteManager } from "./access/VoteManager.ts";
import { config } from "./config/index.ts";
import Bot from "./core/Bot.ts";
import commandLoader from "./core/loaders/commandLoader.ts";
import componentLoader from "./core/loaders/componentLoader.ts";
import eventLoader from "./core/loaders/eventLoader.ts";
import { createLogger } from "./core/logger.ts";
import { GuildConfig } from "./guild/GuildConfig.ts";
import { SqliteGuildConfigStore } from "./guild/SqliteGuildConfigStore.ts";
import { playbackNotices } from "./play/playbackNotices.ts";
import { PlaybackRequest } from "./play/playbackRequest.ts";
import { DiscordVoicePort } from "./voice/DiscordVoicePort.ts";
import { Player } from "./voice/Player.ts";
import { PlayerRegistry } from "./voice/PlayerRegistry.ts";

const logger = createLogger("index");

const store = new SqliteGuildConfigStore(config.database.path);
const guildConfig = new GuildConfig(store);

// Both bindings below reference each other; every access goes through a
// deferred closure, so the declaration order is structurally safe.
const playbackRequest = new PlaybackRequest({
	players: {
		get: (guildId) => playerRegistry.get(guildId),
		getOrCreate: (guildId) => playerRegistry.getOrCreate(guildId),
	},
	guildConfig,
	defaults: config.defaults,
	pickerTimeoutMs: config.rewayahPicker.timeoutMs,
});

const voteManager = new VoteManager();

const playerRegistry = new PlayerRegistry((guildId) => {
	const locale = guildConfig.language(guildId);
	const player = new Player(guildId, new DiscordVoicePort(), {
		gracePeriodMs: config.voice.gracePeriodMs,
		notices: playbackNotices(locale),
		onSessionEnd: () => {
			playerRegistry.remove(guildId);
		},
	});

	playbackRequest.attach(player, locale);

	return player;
});

const bot = new Bot(
	commandLoader,
	eventLoader,
	componentLoader,
	playerRegistry,
	guildConfig,
	playbackRequest,
	voteManager,
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
