import { join } from "node:path";
import type { Component } from "../Component.ts";
import loader from "./loader.ts";

/**
 * reads and builds components collection dynamically from components folder
 */
export default async function componentLoader() {
	return await loader<Component>(
		join(import.meta.dirname, "..", "..", "components"),
	);
}
