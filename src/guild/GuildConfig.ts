import { config } from "../config";
import { isLocale, type Locale } from "../i18n/locale";
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

	get(guildId: string): GuildConfigData | undefined {
		if (this.cache.has(guildId)) return this.cache.get(guildId);

		const saved = this.store.get(guildId);

		if (saved) this.cache.set(guildId, saved);

		return saved;
	}

	set(guildId: string, patch: Partial<GuildConfigData>): GuildConfigData {
		const current = this.get(guildId) ?? {
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

		this.store.set(data);
		this.cache.set(guildId, data);

		return data;
	}

	/**
	 * The guild's effective UI locale — its saved language when that names a
	 * known locale, otherwise the bot-wide default (English).
	 */
	language(guildId: string): Locale {
		const saved = this.get(guildId)?.language;

		return isLocale(saved) ? saved : this.defaults.language;
	}

	/**
	 * Resolves the playback defaults for a play request: which reciter and
	 * rewayah to use. Precedence is the command option, then the guild config,
	 * then the bot-wide defaults; the rewayah is kept only if it covers the surah.
	 * Async because the coverage probe queries the Catalog.
	 */
	async resolve(
		guildId: string,
		request: ResolveRequest,
		rewayahCovers: RewayahCoverage,
	) {
		const guildConfig = this.get(guildId);
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