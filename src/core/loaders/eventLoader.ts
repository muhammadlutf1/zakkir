import { join } from "node:path";
import type { BotEvent } from "../Event";
import loader from "./loader";

/**
 * reads and builds events collection dynamically from events folder
 */
export default async function commandLoader() {
	return await loader<BotEvent>(
		join(import.meta.dirname, "..", "..", "events"),
	);
}
