import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PermissionFlagsBits } from "discord.js";
import type {
	VoteManager,
	VoteProposeInput,
} from "../../src/access/VoteManager";
import radioConfirmComponent from "../../src/components/buttons/radioToQueue";
import type { ComponentContext } from "../../src/core/interactionContext";
import { localizable, t as renderTemplate } from "../../src/i18n/locale";
import { en } from "../../src/i18n/messages";
import { recitationLabel } from "../../src/i18n/recitationLabel";
import type { PlaybackRequest } from "../../src/play/playbackRequest";
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

type PlayerStub = {
	humanMemberIds: string[];
	humanMemberCount: number;
};

function makePlayback(pending?: Recitation, player?: PlayerStub) {
	const calls: string[] = [];
	const playback = {
		peekPendingRadioToQueue: (_guildId: string) => pending,
		confirmRadioToQueue: async () => {
			calls.push("confirmRadioToQueue");
		},
		cancelRadioToQueue: async () => {
			calls.push("cancelRadioToQueue");
		},
	};

	return {
		playback: playback as unknown as PlaybackRequest,
		calls,
		playerStub: player,
	};
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
	};
}

function makeInteraction(
	options: { member?: ReturnType<typeof makeMember> } = {},
) {
	const replies: Array<Record<string, unknown>> = [];
	const messageEdits: Array<Record<string, unknown>> = [];

	const interaction = {
		customId: "confirm:radio-to-queue",
		guildId: "g-1",
		user: { id: "user-a", username: "tester" },
		member: options.member ?? makeMember(),
		channel: { id: "text-1", send: async () => ({}) },
		message: {
			async edit(payload: Record<string, unknown>) {
				messageEdits.push(payload);
			},
		},
		deferred: false,
		replied: false,
		async reply(payload: Record<string, unknown>) {
			replies.push(payload);
		},
		async update(_payload: Record<string, unknown>) {},
	};

	return {
		interaction: interaction as never as Parameters<
			typeof radioConfirmComponent.execute
		>[1],
		replies,
		messageEdits,
	};
}

function makeContext(
	playback: PlaybackRequest,
	votes?: VoteManager,
	player?: unknown,
): ComponentContext {
	return {
		players: { get: () => player } as ComponentContext["players"],
		catalog: {} as ComponentContext["catalog"],
		guildConfigs: {} as ComponentContext["guildConfigs"],
		playback,
		votes,
		locale: "en",
		translator: localizable("en"),
	};
}

describe("the Radio Confirm button goes through the Gate", () => {
	it("an unqualified member starts a Vote naming the radio swap instead of confirming", async () => {
		const pending = makeRecitation();
		const { playback, calls } = makePlayback(pending, {
			humanMemberIds: ["user-a", "user-b"],
			humanMemberCount: 2,
		});
		const { votes, proposals } = makeVotes();
		const { interaction, replies } = makeInteraction();

		await radioConfirmComponent.execute(
			makeContext(playback, votes, {
				humanMemberIds: ["user-a", "user-b"],
				humanMemberCount: 2,
			}),
			interaction,
		);

		assert.deepEqual(calls, []);
		assert.equal(proposals.length, 1);
		assert.equal(
			proposals[0]!.action,
			renderTemplate(en["vote.action.radioToQueue"], {
				label: recitationLabel(pending, "en"),
			}),
		);
		assert.equal(replies[0]!.content, en["vote.started"]);

		await proposals[0]!.onPass();
		assert.deepEqual(calls, ["confirmRadioToQueue"]);
	});

	it("a Qualified member confirms directly", async () => {
		const pending = makeRecitation();
		const { playback, calls } = makePlayback(pending);
		const { votes, proposals } = makeVotes();
		const { interaction } = makeInteraction({
			member: makeMember({ mover: true }),
		});

		await radioConfirmComponent.execute(
			makeContext(playback, votes, { humanMemberCount: 2 }),
			interaction,
		);

		assert.deepEqual(calls, ["confirmRadioToQueue"]);
		assert.equal(proposals.length, 0);
	});

	it("empty state wins over gating: no pending recitation confirms straight through the error path", async () => {
		const { playback, calls } = makePlayback(undefined);
		const { votes, proposals } = makeVotes();
		const { interaction } = makeInteraction();

		await radioConfirmComponent.execute(
			makeContext(playback, votes, undefined),
			interaction,
		);

		assert.deepEqual(calls, ["confirmRadioToQueue"]);
		assert.equal(proposals.length, 0);
	});
});
