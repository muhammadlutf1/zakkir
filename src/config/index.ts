import type { GlobalDefaults } from "../guildConfig/types";

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
};
