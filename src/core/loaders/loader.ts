import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Collection } from "discord.js";
import type { Command } from "../Command";
import { isCommand } from "../Command";
import type { Component } from "../Component";
import { isComponent } from "../Component";
import type { BotEvent } from "../Event";
import { isBotEvent } from "../Event";
import { createLogger } from "../logger";

const logger = createLogger("loader");

/**
 * expected directory structure:
 * - commands
 *   - commandName.ts
 * or
 * - commands
 *   - general
 *     - commandName.ts
 */
export default async function loader<T extends Command | BotEvent | Component>(
	dir: string,
) {
	const collection = new Collection<string, T>();

	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		if (
			entry.isFile() &&
			(entry.name.endsWith(".ts") || entry.name.endsWith(".js"))
		) {
			const filePath = path.join(dir, entry.name);

			await loadFile(collection, filePath);
		} else if (entry.isDirectory()) {
			const subDir = path.join(dir, entry.name);

			const subDirFiles = fs
				.readdirSync(subDir)
				.filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

			for (const f of subDirFiles) {
				const filePath = path.join(subDir, f);

				await loadFile(collection, filePath);
			}
		}
	}

	return collection;
}

async function loadFile(
	collection: Collection<string, Command | BotEvent | Component>,
	filePath: string,
) {
	try {
		const fileUrl = pathToFileURL(filePath).href;
		const module = await import(fileUrl);
		const item = module.default ?? module;

		if (isBotEvent(item)) collection.set(item.name, item);
		else if (isComponent(item)) collection.set(filePath, item);
		else if (isCommand(item)) collection.set(item.data.name, item);
	} catch (error) {
		logger.error(error, "Failed to import %s", filePath);
	}
}
