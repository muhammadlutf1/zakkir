import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MessageFlags, type VoiceChannel } from "discord.js";
import type { Catalog } from "../../src/catalog/Catalog";
import panelCommand from "../../src/commands/panel";
import type { CommandContext } from "../../src/core/interactionContext";
import { GuildConfig } from "../../src/guild/GuildConfig";
import { SqliteGuildConfigStore } from "../../src/guild/SqliteGuildConfigStore";
import { localizable } from "../../src/i18n/locale";
import { getPanel, hasPanel } from "../../src/play/playerPanel";
import { Player } from "../../src/voice/Player";
import { RepeatMode } from "../../src/voice/Queue";
import type { Recitation } from "../../src/voice/Recitation";
import type {
	VoicePort,
	VoicePortEventName,
	VoicePortEvents,
} from "../../src/voice/VoicePort";

class FakeVoicePort implements VoicePort {
	private _joinedChannelId: string | null = null;

	get joinedChannelId() {
		return this._joinedChannelId;
	}

	async join(channel: VoiceChannel) {
		this._joinedChannelId = channel.id;
	}

	leave() {
		this._joinedChannelId = null;
	}

	play() {}

	stop() {}

	pause() {}

	unpause() {}

	destroy() {}

	on<K extends VoicePortEventName>(_event: K, _listener: VoicePortEvents[K]) {}

	off<K extends VoicePortEventName>(_event: K, _listener: VoicePortEvents[K]) {}
}

function recitation(): Recitation {
	return {
		surah: { number: 18, name: "الكهف", names: { en: "Al-Kahf" } },
		reciterId: 1,
		reciterName: "إبراهيم الأخضر",
		rewayahId: 1,
		rewayahName: "حفص عن عاصم",
		url: "https://example.com/018.mp3",
	};
}

function makePlayer(guildId: string) {
	return new Player(guildId, new FakeVoicePort(), {
		probeStream: async () => true,
	});
}

interface SentMessage {
	id: string;
	deletions: number;
}

function makeChannel() {
	const sends: SentMessage[] = [];

	const channel = {
		id: "text-1",
		async send(_payload: unknown) {
			const sent: SentMessage = {
				id: `sent-${sends.length + 1}`,
				deletions: 0,
			};
			sends.push(sent);
			return {
				id: sent.id,
				async delete() {
					sent.deletions += 1;
					return sent;
				},
			};
		},
	};

	return { channel, sends };
}

function makeContext(player: Player | undefined): CommandContext {
	return {
		players: {
			getOrCreate: () => player!,
			get: () => player,
			remove: () => player,
		},
		catalog: {} as Catalog,
		guildConfigs: new GuildConfig(new SqliteGuildConfigStore(":memory:")),
		playback: {} as CommandContext["playback"],
		locale: "en",
		translator: localizable("en"),
	};
}

function makeInteraction(guildId: string, channel: unknown, isAdmin = false) {
	const replies: Array<Record<string, unknown>> = [];
	const permissions = {
		has: () => isAdmin,
	};

	const interaction = {
		inCachedGuild: () => true,
		guildId,
		channel,
		member: { permissions },
		memberPermissions: permissions,
		replied: false,
		deferred: false,
		async reply(payload: Record<string, unknown>) {
			replies.push(payload);
		},
	};

	return {
		interaction: interaction as never,
		replies,
	};
}

describe("/panel command", () => {
	it("replies notInVoice when the guild has no player", async () => {
		const context = makeContext(undefined);
		const { interaction, replies } = makeInteraction("panel-cmd-none", {});

		await panelCommand.execute(context, interaction);

		assert.equal(replies.length, 1);
		assert.equal(replies[0]!.flags, MessageFlags.Ephemeral);
		assert.equal(
			replies[0]!.content,
			"You need to join a voice channel first!",
		);
	});

	it("posts a panel in the invoking channel and confirms", async () => {
		const guildId = "panel-cmd-create";
		const player = makePlayer(guildId);
		await player.play(recitation());
		const { channel, sends } = makeChannel();
		const context = makeContext(player);
		const { interaction, replies } = makeInteraction(guildId, channel);

		await panelCommand.execute(context, interaction);

		assert.equal(sends.length, 1);
		assert.equal(hasPanel(guildId), true);
		assert.equal(replies[0]!.flags, MessageFlags.Ephemeral);
	});

	it("re-renders instead of double-posting when a panel already exists", async () => {
		const guildId = "panel-cmd-refresh";
		const player = makePlayer(guildId);
		await player.play(recitation());
		player.setRepeatMode(RepeatMode.ALL);
		const { channel, sends } = makeChannel();
		const context = makeContext(player);
		const first = makeInteraction(guildId, channel);

		await panelCommand.execute(context, first.interaction);
		assert.equal(sends.length, 1);

		for (let i = 0; i < 10; i++) {
			await new Promise<void>((resolve) => setImmediate(resolve));
		}

		const second = makeInteraction(guildId, channel);
		await panelCommand.execute(context, second.interaction);

		assert.equal(sends.length, 1);
	});

	it("reposts a fresh panel for an admin, deleting the tracked one", async () => {
		const guildId = "panel-cmd-admin";
		const player = makePlayer(guildId);
		await player.play(recitation());
		const { channel, sends } = makeChannel();
		const context = makeContext(player);
		const first = makeInteraction(guildId, channel);
		await panelCommand.execute(context, first.interaction);

		const admin = makeInteraction(guildId, channel, true);
		await panelCommand.execute(context, admin.interaction);

		assert.equal(sends[0]!.deletions, 1);
		assert.equal(sends.length, 2);
		assert.equal(hasPanel(guildId), true);
		assert.deepEqual(getPanel(guildId), {
			messageId: "sent-2",
			channelId: "text-1",
		});
		assert.equal(admin.replies[0]!.flags, MessageFlags.Ephemeral);
	});

	it("creates the panel when an admin invokes /panel with none posted", async () => {
		const guildId = "panel-cmd-admin-fresh";
		const player = makePlayer(guildId);
		await player.play(recitation());
		const { channel, sends } = makeChannel();
		const context = makeContext(player);
		const admin = makeInteraction(guildId, channel, true);

		await panelCommand.execute(context, admin.interaction);

		assert.equal(sends.length, 1);
		assert.equal(hasPanel(guildId), true);
	});
});
