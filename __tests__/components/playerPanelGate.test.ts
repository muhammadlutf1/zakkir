import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import type {
	VoteManager,
	VoteProposeInput,
} from "../../src/access/VoteManager";
import repeatModeComponent from "../../src/components/player-panel/repeatMode";
import selectComponent from "../../src/components/player-panel/select";
import stopComponent from "../../src/components/player-panel/stop";
import type { ComponentContext } from "../../src/core/interactionContext";
import { localizable, t as renderTemplate } from "../../src/i18n/locale";
import { en } from "../../src/i18n/messages";
import { recitationLabel } from "../../src/i18n/recitationLabel";
import type { Player } from "../../src/voice/Player";
import { RepeatMode } from "../../src/voice/Queue";
import type { Recitation } from "../../src/voice/Recitation";

function makeVotes() {
	const proposals: VoteProposeInput[] = [];
	const votes = {
		propose: async (input: VoteProposeInput) => {
			proposals.push(input);
			return { guildId: input.guildId };
		},
	} as unknown as VoteManager;
	return { votes, proposals };
}

function makeRecitation(overrides: Partial<Recitation> = {}): Recitation {
	return {
		surah: { number: 18, name: "الكهف" },
		reciterId: 1,
		reciterName: "Minshawi",
		rewayahId: 1,
		rewayahName: "Hafs",
		url: "https://example.com/stream",
		...overrides,
	};
}

function makePlayer(
	overrides: {
		current?: Recitation;
		upcoming?: Recitation[];
		humanIds?: string[];
	} = {},
) {
	const calls: string[] = [];
	let repeatMode = RepeatMode.OFF;
	const humanIds = overrides.humanIds ?? ["user-a", "user-b"];
	const player = {
		guildId: "g-1",
		get voiceChannelId() {
			return "voice-1";
		},
		get isPlaying() {
			return true;
		},
		get humanMemberCount() {
			return humanIds.length;
		},
		humanMemberIds: humanIds,
		get repeatMode() {
			return repeatMode;
		},
		queueView: {
			current: overrides.current,
			upcoming: overrides.upcoming ?? [],
			get repeatMode() {
				return repeatMode;
			},
		},
		endSession() {
			calls.push("endSession");
		},
		async jumpTo(index: number) {
			calls.push(`jumpTo:${index}`);
			return { started: true, queued: false };
		},
		setRepeatMode(mode: RepeatMode) {
			repeatMode = mode;
			calls.push(`repeat:${mode}`);
		},
		onChange(_listener: () => void) {
			return () => {};
		},
	} as unknown as Player & { calls: string[] };

	return { player: player as Player, calls };
}

function makeMember(options: { id?: string; mover?: boolean } = {}) {
	return {
		id: options.id ?? "user-a",
		user: { username: "tester" },
		displayName: "tester",
		permissions: {
			has: (flag: bigint) =>
				options.mover === true && flag === PermissionFlagsBits.MoveMembers,
		},
		voice: { channelId: "voice-1" },
	};
}

function makeInteraction(options: {
	customId: string;
	member?: ReturnType<typeof makeMember>;
	values?: string[];
	channel?: unknown;
}) {
	let defers = 0;
	const replies: Array<Record<string, unknown>> = [];

	const interaction = {
		customId: options.customId,
		guildId: "g-1",
		user: { id: "user-a", username: "tester" },
		member: options.member ?? makeMember(),
		channel: options.channel ?? { id: "text-1", send: async () => ({}) },
		message: { async edit(_payload: unknown) {} },
		values: options.values,
		isStringSelectMenu: () => options.values !== undefined,
		deferred: false,
		replied: false,
		async deferUpdate() {
			defers += 1;
		},
		async reply(payload: Record<string, unknown>) {
			replies.push(payload);
		},
		async update(_payload: Record<string, unknown>) {},
		async followUp(payload: Record<string, unknown>) {
			replies.push(payload);
		},
	};

	return {
		interaction: interaction as never as Parameters<
			typeof stopComponent.execute
		>[1],
		state: {
			get defers() {
				return defers;
			},
		},
		replies,
	};
}

function makeContext(player: Player, votes?: VoteManager): ComponentContext {
	return {
		players: { get: () => player },
		catalog: {} as ComponentContext["catalog"],
		guildConfigs: {} as ComponentContext["guildConfigs"],
		playback: {} as ComponentContext["playback"],
		votes,
		locale: "en",
		translator: localizable("en"),
	};
}

describe("gated panel buttons", () => {
	it("Stop by an unqualified member starts a Vote instead of ending the session", async () => {
		const { player, calls } = makePlayer();
		const { votes, proposals } = makeVotes();
		const { interaction, state, replies } = makeInteraction({
			customId: "player-panel:stop",
		});

		await stopComponent.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, []);
		assert.equal(state.defers, 0);
		assert.equal(proposals[0]!.action, en["vote.action.stop"]);
		assert.equal(replies[0]!.content, en["vote.started"]);
		assert.equal(replies[0]!.flags, MessageFlags.Ephemeral);

		await proposals[0]!.onPass();
		assert.deepEqual(calls, ["endSession"]);
	});

	it("needVoice wins over gating: no Vote is proposed when out of voice", async () => {
		const { player, calls } = makePlayer();
		const { votes, proposals } = makeVotes();
		const member = makeMember({ mover: false });
		(member.voice as { channelId: string }).channelId = "elsewhere";
		const { interaction, replies } = makeInteraction({
			customId: "player-panel:stop",
			member,
		});

		await stopComponent.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, []);
		assert.equal(proposals.length, 0);
		assert.equal(replies[0]!.content, en["command.needVoice"]);
	});

	it("Repeat-mode press by an unqualified member starts a Vote instead of setting the mode", async () => {
		const { player, calls } = makePlayer();
		const { votes, proposals } = makeVotes();
		const { interaction, replies } = makeInteraction({
			customId: "player-panel:repeat:all",
		});

		await repeatModeComponent.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, []);
		assert.equal(proposals[0]!.action, en["vote.action.repeat"]);
		assert.equal(replies[0]!.content, en["vote.started"]);

		await proposals[0]!.onPass();
		assert.deepEqual(calls, [`repeat:${RepeatMode.ALL}`]);
	});

	it("Select by an unqualified member proposes a vote naming the target track", async () => {
		const current = makeRecitation({ requestedBy: "user-a" });
		const target = makeRecitation({ reciterName: "Al Husary" });
		const { player, calls } = makePlayer({ current, upcoming: [target] });
		const { votes, proposals } = makeVotes();

		// user-b is not Qualified and did not request either recitation
		const { interaction, state } = makeInteraction({
			customId: "player-panel:select",
			member: makeMember({ id: "user-b" }),
			values: ["track-1"],
		});

		await selectComponent.execute(makeContext(player, votes), interaction);

		assert.equal(state.defers, 0);
		assert.deepEqual(calls, []);
		assert.equal(
			proposals[0]!.action,
			renderTemplate(en["vote.action.select"], {
				label: recitationLabel(target, "en"),
			}),
		);
	});
});
