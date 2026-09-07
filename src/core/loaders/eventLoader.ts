import { join } from "node:path";
import type { BotEvent } from "../Event.ts";
import loader from "./loader.ts";

/**
 * reads and builds events collection dynamically from events folder
 */
export default async function commandLoader() {
	return await loader<BotEvent>(
		join(import.meta.dirname, "..", "..", "events"),
	);
}
