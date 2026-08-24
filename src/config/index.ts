import type { GlobalDefaults } from "../guild/types";
import type { Locale } from "../i18n/locale";

export interface BotConfig {
	clientId: string;
	mp3Quran: {
		baseUrl: string;
	};
	catalog: {
		/** How long a fetched endpoint payload stays fresh before a refetch. */
		ttlMs: number;
		/** How many times a failing refetch is attempted before giving up. */
		fetchAttempts: number;
		/**
		 * After a failed refresh of a stale entry, how long to keep serving
		 * that stale copy without attempting another refresh.
		 */
		failureCooldownMs: number;
	};
	database: {
		path: string;
	};
	defaults: GlobalDefaults;
	rewayahPicker: {
		timeoutMs: number;
	};
	voice: {
		/**
		 * How long to wait for a human to return before ending the session
		 * once the last human leaves the voice channel.
		 */
		gracePeriodMs: number;
	};
}

export const config: BotConfig = {
	clientId: process.env.CLIENT_ID ?? "",
	mp3Quran: {
		baseUrl: "https://www.mp3quran.net/api/v3",
	},
	catalog: {
		ttlMs: 24 * 60 * 60 * 1000,
		fetchAttempts: 3,
		failureCooldownMs: 60 * 60 * 1000,
	},
	database: {
		path: process.env.DATABASE_PATH ?? "data/zakkir.db",
	},
	defaults: {
		language: "en",
		defaultReciter: undefined,
		defaultRewayah: undefined,
	},
	rewayahPicker: {
		timeoutMs: 30_000,
	},
	voice: {
		gracePeriodMs: Number(process.env.GRACE_PERIOD_MS ?? 60_000),
	},
};

/** The bot-wide default UI locale, sourced from the config's `defaults.language`. */
export const DEFAULT_LOCALE: Locale = config.defaults.language;
