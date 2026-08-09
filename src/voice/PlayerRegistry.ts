import type { Player } from "./Player";

export type PlayerFactory = (guildId: string) => Player;

export class PlayerRegistry {
	private readonly players = new Map<string, Player>();

	constructor(private readonly playerFactory: PlayerFactory) {}

	get(guildId: string): Player | undefined {
		return this.players.get(guildId);
	}

	getOrCreate(guildId: string): Player {
		let player = this.players.get(guildId);

		if (!player) {
			player = this.playerFactory(guildId);
			this.players.set(guildId, player);
		}

		return player;
	}

	remove(guildId: string): Player | undefined {
		const player = this.players.get(guildId);
		this.players.delete(guildId);
		return player;
	}
}
