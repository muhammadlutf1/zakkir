export interface GuildConfigData {
	guildId: string;
	language: string | undefined;
	defaultReciter: number | undefined;
	defaultRewayah: number | undefined;
}

export interface GlobalDefaults {
	language: string;
	defaultReciter: number | undefined;
	defaultRewayah: number | undefined;
}

export interface DefaultsOption {
	language?: string;
	reciter?: number;
	rewayah?: number;
}

export interface ResolvedDefaults {
	language: string;
	reciter: number | undefined;
	rewayah: number | undefined;
}

export interface ResolveRequest {
	surahNumber: number;
	option?: DefaultsOption;
}

export type RewayahCoverage = (
	reciterId: number,
	surahNumber: number,
	rewayahId: number,
) => Promise<boolean>;
