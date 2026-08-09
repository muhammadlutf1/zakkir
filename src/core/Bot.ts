import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import type { Command } from "./Command";
import type { BotEvent } from "./Event";
import type { PlayerRegistry } from "../voice/PlayerRegistry";

export default class Bot extends Client {
	private initialized = false;
	private _commands = new Collection<string, Command>();
	private events = new Collection<string, BotEvent>();

	constructor(
		private commandLoader: () => Promise<Collection<string, Command>>,
		private eventLoader: () => Promise<Collection<string, BotEvent>>,
		private playerRegistry: PlayerRegistry,
	) {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildVoiceStates,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildPresences,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.MessageContent,
			],

			// listen to older/uncached on
			partials: [
				Partials.Channel,
				Partials.Message,
				Partials.User,
				Partials.GuildMember,
				Partials.Reaction,
			],
		});
	}

	public get commands() {
		return this._commands;
	}

	public get players() {
		return this.playerRegistry;
	}

	async init() {
		this._commands = await this.commandLoader();

		this.events = await this.eventLoader();

		this.events.forEach((event) => {
			if (event.once)
				this.once(event.name, (...args) => event.execute(this, ...args));
			else this.on(event.name, (...args) => event.execute(this, ...args));
		});

		this.initialized = true;
	}

	async login() {
		if (!this.initialized) await this.init();
		return super.login(process.env.BOT_TOKEN);
	}
}
