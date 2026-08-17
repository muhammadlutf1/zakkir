import { config } from "../config";
import type { SqliteGuildConfigStore } from "./SqliteGuildConfigStore";
import type {
	GlobalDefaults,
	GuildConfigData,
	ResolveRequest,
	RewayahCoverage,
} from "./types";

export class GuildConfig {
	private readonly cache = new Map<string, GuildConfigData>();
	private readonly defaults: GlobalDefaults;

	constructor(
		private readonly store: SqliteGuildConfigStore,
		defaults: GlobalDefaults = config.defaults,
	) {
		this.defaults = defaults;
	}

	async get(guildId: string) {
		if (this.cache.has(guildId)) return this.cache.get(guildId);

		const saved = await this.store.get(guildId);

		if (saved) this.cache.set(guildId, saved);

		return saved;
	}

	async set(guildId: string, patch: Partial<GuildConfigData>) {
		const current = (await this.get(guildId)) ?? {
			guildId,
			language: undefined,
			defaultReciter: undefined,
			defaultRewayah: undefined,
		};

		const data: GuildConfigData = {
			guildId,
			language: patch.language ?? current.language,
			defaultReciter: patch.defaultReciter ?? current.defaultReciter,
			defaultRewayah: patch.defaultRewayah ?? current.defaultRewayah,
		};

		await this.store.set(data);
		this.cache.set(guildId, data);

		return data;
	}

	/**
	 * Resolves the playback defaults for a play request: which reciter and
	 * rewayah to use. Precedence is the command option, then the guild config,
	 * then the bot-wide defaults; the rewayah is kept only if it covers the surah.
	 */
	async resolve(
		guildId: string,
		request: ResolveRequest,
		rewayahCovers: RewayahCoverage,
	) {
		const guildConfig = await this.get(guildId);
		const option = request.option ?? {};

		const reciter =
			option.reciter ??
			guildConfig?.defaultReciter ??
			this.defaults.defaultReciter;

		let rewayah: number | undefined;
		if (reciter !== undefined) {
			const candidate =
				option.rewayah ??
				guildConfig?.defaultRewayah ??
				this.defaults.defaultRewayah;

			if (
				candidate !== undefined &&
				(await rewayahCovers(reciter, request.surahNumber, candidate))
			) {
				rewayah = candidate;
			}
		}

		return { reciter, rewayah };
	}
}
