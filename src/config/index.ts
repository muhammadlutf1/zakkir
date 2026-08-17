import type { GlobalDefaults } from "../guild/types";

/**
 * Reads a positive millisecond duration from an env var, falling back when
 * the var is absent, empty, or not a positive number.
 */
function envMs(value: string | undefined, fallback: number) {
	if (value === undefined) return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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
		language: "ar",
		defaultReciter: undefined,
		defaultRewayah: undefined,
	},
	rewayahPicker: {
		timeoutMs: 30_000,
	},
	voice: {
		gracePeriodMs: envMs(process.env.GRACE_PERIOD_MS, 60_000),
	},
};
