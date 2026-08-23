import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MessageComponentInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import type { Catalog } from "../../src/catalog/Catalog";
import pauseComponent from "../../src/components/player-panel/pause";
import repeatComponent from "../../src/components/player-panel/repeat";
import repeatModeComponent from "../../src/components/player-panel/repeatMode";
import selectComponent from "../../src/components/player-panel/select";
import skipComponent from "../../src/components/player-panel/skip";
import stopComponent from "../../src/components/player-panel/stop";
import type { ComponentContext } from "../../src/core/interactionContext";
import type { GuildConfig } from "../../src/guild/GuildConfig";
import { localizable } from "../../src/i18n/locale";
import type { Player } from "../../src/voice/Player";
import { RepeatMode } from "../../src/voice/Queue";

interface RowJson {
	type: number;
	components: Array<{
		type: number;
		custom_id: string;
		label: string;
		style: number;
		disabled: boolean;
	}>;
}

function makeFakePlayer(
	overrides: {
		paused?: boolean;
		repeatMode?: RepeatMode;
		voiceChannelId?: string | null;
	} = {},
) {
	const calls: string[] = [];
	let paused = overrides.paused ?? false;
	let repeatMode = overrides.repeatMode ?? RepeatMode.OFF;

	const player = {
		guildId: "g-1",
		get voiceChannelId() {
			return overrides.voiceChannelId === undefined
				? "voice-1"
				: overrides.voiceChannelId;
		},
		get isPaused() {
			return paused;
		},
		get repeatMode() {
			return repeatMode;
		},
		pause() {
			paused = true;
			calls.push("pause");
		},
		unpause() {
			paused = false;
			calls.push("unpause");
		},
		endSession() {
			calls.push("endSession");
		},
		async skip() {
			calls.push("skip");
			return { started: true, queued: false };
		},
		async jumpTo(index: number) {
			calls.push(`jumpTo:${index}`);
			return { started: true, queued: false };
		},
		setRepeatMode(mode: RepeatMode) {
			repeatMode = mode;
			calls.push(`repeat:${mode}`);
		},
		get queueView() {
			return {
				current: undefined,
				upcoming: [],
				repeatMode,
			};
		},
		onChange(_listener: () => void) {
			return () => {};
		},
		onEnd(_listener: () => void) {
			return () => {};
		},
	} as unknown as Player & { calls: string[] };

	return { player, calls };
}

function makeInteraction(options: {
	customId: string;
	voiceChannelId?: string | null;
	values?: string[];
}) {
	let defers = 0;
	const replies: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	const state = {
		get defers() {
			return defers;
		},
	};

	const interaction = {
		customId: options.customId,
		guildId: "g-1",
		member: { voice: { channelId: options.voiceChannelId ?? "voice-1" } },
		values: options.values,
		replied: false,
		deferred: false,
		isStringSelectMenu: () => options.values !== undefined,
		async deferUpdate() {
			defers += 1;
		},
		async reply(payload: Record<string, unknown>) {
			replies.push(payload);
		},
		async update(payload: Record<string, unknown>) {
			updates.push(payload);
		},
		async followUp(payload: Record<string, unknown>) {
			replies.push(payload);
		},
	};

	return {
		interaction: interaction as unknown as MessageComponentInteraction,
		state,
		replies,
		updates,
	};
}

function makeContext(player?: Player): ComponentContext {
	return {
		players: { get: () => player },
		catalog: {} as Catalog,
		guildConfigs: {} as GuildConfig,
		locale: "en",
		translator: localizable("en"),
	};
}

function rowOf(payload: Record<string, unknown>): RowJson {
	return (payload.components as Array<{ toJSON(): RowJson }>)[0]!.toJSON();
}

describe("player panel components — shared gates", () => {
	it("replies notInVoice when the guild has no player", async () => {
		const { interaction, replies, state } = makeInteraction({
			customId: "player-panel:pause",
		});

		await stopComponent.execute(makeContext(), interaction);

		assert.equal(state.defers, 0);
		assert.equal(replies.length, 1);
		assert.equal(
			replies[0]!.content,
			"You need to join a voice channel first!",
		);
		assert.equal(replies[0]!.flags, MessageFlags.Ephemeral);
	});

	it("replies needVoice when the interactor is in another channel", async () => {
		const { player, calls } = makeFakePlayer();
		const { interaction, replies, state } = makeInteraction({
			customId: "player-panel:skip",
			voiceChannelId: "voice-elsewhere",
		});

		await skipComponent.execute(makeContext(player), interaction);

		assert.equal(state.defers, 0);
		assert.deepEqual(calls, []);
		assert.equal(
			replies[0]!.content,
			"Hey! Join the same voice channel as me first 😄",
		);
	});
});

describe("player panel components — controls", () => {
	it("pause pauses an unpaused player", async () => {
		const { player, calls } = makeFakePlayer({ paused: false });
		const { interaction, state } = makeInteraction({
			customId: "player-panel:pause",
		});

		await pauseComponent.execute(makeContext(player), interaction);

		assert.equal(state.defers, 1);
		assert.deepEqual(calls, ["pause"]);
	});

	it("pause resumes a paused player", async () => {
		const { player, calls } = makeFakePlayer({ paused: true });
		const { interaction } = makeInteraction({
			customId: "player-panel:pause",
		});

		await pauseComponent.execute(makeContext(player), interaction);

		assert.deepEqual(calls, ["unpause"]);
	});

	it("stop acknowledges then ends the session", async () => {
		const { player, calls } = makeFakePlayer();
		const { interaction, state } = makeInteraction({
			customId: "player-panel:stop",
		});

		await stopComponent.execute(makeContext(player), interaction);

		assert.equal(state.defers, 1);
		assert.deepEqual(calls, ["endSession"]);
	});

	it("skip calls skip and refreshes", async () => {
		const { player, calls } = makeFakePlayer();
		const { interaction, state } = makeInteraction({
			customId: "player-panel:skip",
		});

		await skipComponent.execute(makeContext(player), interaction);

		assert.equal(state.defers, 1);
		assert.deepEqual(calls, ["skip"]);
	});

	it("repeat opens an ephemeral menu with the current mode disabled", async () => {
		const { player } = makeFakePlayer({ repeatMode: RepeatMode.CURRENT });
		const { interaction, replies } = makeInteraction({
			customId: "player-panel:repeat",
		});

		await repeatComponent.execute(makeContext(player), interaction);

		assert.equal(replies.length, 1);
		assert.equal(replies[0]!.flags, MessageFlags.Ephemeral);

		const buttons = rowOf(replies[0]!).components;

		assert.deepEqual(
			buttons.map((b) => b.custom_id),
			[
				"player-panel:repeat:off",
				"player-panel:repeat:current",
				"player-panel:repeat:all",
			],
		);
		assert.deepEqual(
			buttons.map((b) => b.label),
			["Off", "Current", "All"],
		);
		for (const button of buttons) {
			assert.equal(button.style, 2);
			assert.equal(
				button.disabled,
				button.custom_id === "player-panel:repeat:current",
			);
		}
	});

	it("a mode press sets RepeatMode and disables every menu button", async () => {
		const { player, calls } = makeFakePlayer();
		const { interaction, updates } = makeInteraction({
			customId: "player-panel:repeat:all",
		});

		await repeatModeComponent.execute(makeContext(player), interaction);

		assert.ok(calls.includes("repeat:all"));
		assert.equal(updates.length, 1);

		const buttons = rowOf(updates[0]!).components;

		assert.equal(buttons.length, 3);
		for (const button of buttons) assert.equal(button.disabled, true);
	});

	it("select jumps to the encoded queue index", async () => {
		const { player, calls } = makeFakePlayer();
		const { interaction, state } = makeInteraction({
			customId: "player-panel:select",
			values: ["track-2"],
		});

		await selectComponent.execute(makeContext(player), interaction);

		assert.equal(state.defers, 1);
		assert.deepEqual(calls, ["jumpTo:2"]);
	});

	it("select ignores a malformed option value", async () => {
		const { player, calls } = makeFakePlayer();
		const { interaction } = makeInteraction({
			customId: "player-panel:select",
			values: ["garbage"],
		});

		await selectComponent.execute(makeContext(player), interaction);

		assert.deepEqual(calls, []);
	});
});
