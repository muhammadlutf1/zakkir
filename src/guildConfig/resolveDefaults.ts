import type {
	GlobalDefaults,
	GuildConfigData,
	ResolveRequest,
	RewayahCoverage,
} from "./types";

export interface ResolveDefaultsInput {
	guildConfig: GuildConfigData | undefined;
	global: GlobalDefaults;
	request: ResolveRequest;
	rewayahCovers: RewayahCoverage;
}

export async function resolveDefaults({
	guildConfig,
	global,
	request,
	rewayahCovers,
}: ResolveDefaultsInput) {
	const option = request.option ?? {};

	const language = option.language ?? guildConfig?.language ?? global.language;

	const reciter = option.reciter ?? guildConfig?.defaultReciter ?? global.defaultReciter;

	let rewayah: number | undefined;
	if (reciter !== undefined) {
		const candidate =
			option.rewayah ?? guildConfig?.defaultRewayah ?? global.defaultRewayah;

		if (
			candidate !== undefined &&
			(await rewayahCovers(reciter, request.surahNumber, candidate))
		) {
			rewayah = candidate;
		}
	}

	return { language, reciter, rewayah };
}
