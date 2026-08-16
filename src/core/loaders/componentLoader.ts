import { join } from "node:path";
import type { Component } from "../Component";
import loader from "./loader";

/**
 * reads and builds components collection dynamically from components folder
 */
export default async function componentLoader() {
	return await loader<Component>(
		join(import.meta.dirname, "..", "..", "components"),
	);
}