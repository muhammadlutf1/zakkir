import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { isLocale } from "../i18n/locale";
import type { GuildConfigData } from "./types";

interface Row {
	language: string | null;
	default_reciter: number | null;
	default_rewayah: number | null;
}

export class SqliteGuildConfigStore {
	private readonly db: DatabaseSync;

	constructor(path: string) {
		if (path !== ":memory:") {
			mkdirSync(dirname(path), { recursive: true });
		}
		this.db = new DatabaseSync(path);
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS guild_configs (
				guild_id TEXT PRIMARY KEY,
				language TEXT,
				default_reciter INTEGER,
				default_rewayah INTEGER
			)
		`);
	}

	/**
	 * The stored GuildConfigData for a guild, or undefined when none is saved.
	 * SQLite is synchronous, so this never yields.
	 */
	get(guildId: string): GuildConfigData | undefined {
		const row = this.db
			.prepare(
				"SELECT language, default_reciter, default_rewayah FROM guild_configs WHERE guild_id = ?",
			)
			.get(guildId) as Row | undefined;

		if (!row) return undefined;

		return {
			guildId,
			language: isLocale(row.language) ? row.language : undefined,
			defaultReciter: row.default_reciter ?? undefined,
			defaultRewayah: row.default_rewayah ?? undefined,
		};
	}

	set(config: GuildConfigData): void {
		this.db
			.prepare(
				`INSERT INTO guild_configs (guild_id, language, default_reciter, default_rewayah)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(guild_id) DO UPDATE SET
					language = excluded.language,
					default_reciter = excluded.default_reciter,
					default_rewayah = excluded.default_rewayah`,
			)
			.run(
				config.guildId,
				config.language ?? null,
				config.defaultReciter ?? null,
				config.defaultRewayah ?? null,
			);
	}

	close() {
		this.db.close();
	}
}