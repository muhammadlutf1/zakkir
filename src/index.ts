import Bot from "./core/Bot";
import commandLoader from "./core/loaders/commandLoader";
import eventLoader from "./core/loaders/eventLoader";
import { DiscordVoicePort } from "./voice/DiscordVoicePort";
import { Player } from "./voice/Player";
import { PlayerRegistry } from "./voice/PlayerRegistry";

const playerRegistry = new PlayerRegistry(
	(guildId) => new Player(guildId, new DiscordVoicePort()),
);

const bot = new Bot(commandLoader, eventLoader, playerRegistry);

bot.login();
