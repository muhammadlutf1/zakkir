import type { GuildConfigStore } from "./GuildConfigStore";
import { resolveDefaults } from "./resolveDefaults";
import type {
	GlobalDefaults,
	GuildConfigData,
	ResolveRequest,
	RewayahCoverage,
} from "./types";

export class GuildConfig {
	private readonly cache = new Map<string, GuildConfigData>();

	constructor(
		private readonly store: GuildConfigStore,
		private readonly global: GlobalDefaults,
	) {}

	async get(guildId: string) {
		if (this.cache.has(guildId)) return this.cache.get(guildId);

		const config = await this.store.get(guildId);

		if (config) this.cache.set(guildId, config);

		return config;
	}

	async set(guildId: string, patch: Partial<GuildConfigData>) {
		const current = (await this.get(guildId)) ?? {
			guildId,
			language: undefined,
			defaultReciter: undefined,
			defaultRewayah: undefined,
		};

		const config: GuildConfigData = {
			guildId,
			language: patch.language ?? current.language,
			defaultReciter: patch.defaultReciter ?? current.defaultReciter,
			defaultRewayah: patch.defaultRewayah ?? current.defaultRewayah,
		};

		await this.store.set(config);
		this.cache.set(guildId, config);

		return config;
	}

	async resolve(
		guildId: string,
		request: ResolveRequest,
		rewayahCovers: RewayahCoverage,
	) {
		return resolveDefaults({
			guildConfig: await this.get(guildId),
			global: this.global,
			request,
			rewayahCovers,
		});
	}
}
