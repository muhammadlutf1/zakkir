import { join } from "node:path";
import type { Command } from "../Command.ts";
import loader from "./loader.ts";

/**
 * reads and builds commands collection dynamically from commands folder
 */
export default async function commandLoader() {
	return await loader<Command>(
		join(import.meta.dirname, "..", "..", "commands"),
	);
}
