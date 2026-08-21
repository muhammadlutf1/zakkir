// import { clientId, guildId, token } from "./config.json";
import { REST, Routes } from "discord.js";
import { config } from "../config";
import commandLoader from "../core/loaders/commandLoader";
import { createLogger } from "../core/logger";

const logger = createLogger("deployCommands");

const commands = Array.from((await commandLoader()).values()).map((cmd) =>
	cmd.data.toJSON(),
);

const rest = new REST().setToken(process.env.BOT_TOKEN as string);

try {
	logger.info(
		"Started refreshing %d application (/) commands.",
		commands.length,
	);

	// global commands register
	const data = await rest.put(Routes.applicationCommands(config.clientId), {
		body: commands,
	});

	if (typeof data === "object" && data !== null && "length" in data) {
		logger.info(
			"Successfully reloaded %d application (/) commands.",
			Number(data.length),
		);
	}
} catch (error) {
	logger.error(error, "Failed to refresh application (/) commands.");
}
