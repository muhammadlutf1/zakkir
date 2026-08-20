import type { Locale } from "../i18n/locale";

export interface GuildConfigData {
	guildId: string;
	language: Locale | undefined;
	defaultReciter: number | undefined;
	defaultRewayah: number | undefined;
}

export interface GlobalDefaults {
	language: Locale;
	defaultReciter: number | undefined;
	defaultRewayah: number | undefined;
}

export interface DefaultsOption {
	reciter?: number;
	rewayah?: number;
}

export interface ResolvedDefaults {
	reciter: number | undefined;
	rewayah: number | undefined;
}

export interface ResolveRequest {
	surahNumber: number;
	option?: DefaultsOption;
}

/**
 * Whether a rewayah is available for a given reciter and surah.
 */
export type RewayahCoverage = (
	reciterId: number,
	surahNumber: number,
	rewayahId: number,
) => Promise<boolean>;