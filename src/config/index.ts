import type { GlobalDefaults } from "../guild/types";
import type { Locale } from "../i18n/locale";

export interface BotConfig {
	clientId: string;
	mp3Quran: {
		baseUrl: string;
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
	clientId: "881841846312116234",
	mp3Quran: {
		baseUrl: "https://www.mp3quran.net/api/v3",
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
