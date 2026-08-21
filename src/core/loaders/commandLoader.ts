import { join } from "node:path";
import type { Command } from "../Command";
import loader from "./loader";

/**
 * reads and builds commands collection dynamically from commands folder
 */
export default async function commandLoader() {
	return await loader<Command>(
		join(import.meta.dirname, "..", "..", "commands"),
	);
}
