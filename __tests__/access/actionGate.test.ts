import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PermissionFlagsBits } from "discord.js";
import { handleActionWithGate } from "../../src/access/actionGate";
import { handleSkipWithGate } from "../../src/access/skipAccess";
import type { SendableTextChannel } from "../../src/access/types";
import type {
	VoteManager,
	VoteProposeInput,
} from "../../src/access/VoteManager";
import { localizable } from "../../src/i18n/locale";
import type { Player } from "../../src/voice/Player";
import type { Recitation } from "../../src/voice/Recitation";

function makePlayer(
	overrides: { humanIds?: string[]; current?: Recitation } = {},
) {
	const calls: string[] = [];
	const humanIds = overrides.humanIds ?? ["user-a", "user-b", "user-c"];
	const player = {
		guildId: "g-1",
		get humanMemberCount() {
			return humanIds.length;
		},
		humanMemberIds: humanIds,
		queueView: {
			current: overrides.current,
			upcoming: [],
			repeatMode: "off",
		},
		async skip() {
			calls.push("skip");
			return { started: true, queued: false };
		},
	} as unknown as Player & { calls: string[] };

	return { player, calls };
}

function makeChannel() {
	return {
		id: "text-1",
		send: async () => ({}),
	} as never as SendableTextChannel;
}

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

const unqualified = { id: "user-a", displayName: "A" };

const mover = {
	id: "user-a",
	displayName: "A",
	permissions: {
		has: (flag: bigint) => flag === PermissionFlagsBits.MoveMembers,
	},
};

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

describe("handleActionWithGate", () => {
	it("lets a member with MoveMembers act directly without proposing a vote", async () => {
		const { player } = makePlayer();
		const { votes, proposals } = makeVotes();

		const result = await handleActionWithGate({
			player,
			member: mover,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			votes,
			channel: makeChannel(),
			action: "clear the queue",
			onPass: async () => {},
		});

		assert.deepEqual(result, { kind: "qualified" });
		assert.equal(proposals.length, 0);
	});

	it("lets a member alone with the Player act directly", async () => {
		const { player } = makePlayer({ humanIds: ["user-a"] });
		const { votes, proposals } = makeVotes();

		const result = await handleActionWithGate({
			player,
			member: unqualified,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			votes,
			channel: makeChannel(),
			action: "clear the queue",
			onPass: async () => {},
		});

		assert.deepEqual(result, { kind: "qualified" });
		assert.equal(proposals.length, 0);
	});

	it("lets the Requester of the affected Recitation act directly", async () => {
		const { player } = makePlayer({
			current: makeRecitation({ requestedBy: "user-a" }),
		});
		const { votes, proposals } = makeVotes();

		const result = await handleActionWithGate({
			player,
			member: unqualified,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			votes,
			channel: makeChannel(),
			recitation: player.queueView.current,
			action: "remove **X**",
			onPass: async () => {},
		});

		assert.deepEqual(result, { kind: "qualified" });
		assert.equal(proposals.length, 0);
	});

	it("honors an extra direct-allow rule before the standard checks", async () => {
		const { player } = makePlayer({ humanIds: ["user-b"] });
		const { votes, proposals } = makeVotes();

		const result = await handleActionWithGate({
			player,
			member: unqualified,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			votes,
			channel: makeChannel(),
			directAllowed: true,
			action: "remove **X**",
			onPass: async () => {},
		});

		assert.deepEqual(result, { kind: "qualified" });
		assert.equal(proposals.length, 0);
	});

	it("proposes a vote naming the action for an unqualified member", async () => {
		let actionRan = false;
		const { player } = makePlayer();
		const { votes, proposals } = makeVotes();

		const result = await handleActionWithGate({
			player,
			member: unqualified,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			votes,
			channel: makeChannel(),
			action: "clear the queue",
			onPass: async () => {
				actionRan = true;
			},
		});

		assert.deepEqual(result, { kind: "voted" });
		assert.equal(proposals.length, 1);
		assert.equal(proposals[0]!.action, "clear the queue");
		assert.equal(proposals[0]!.initiatorId, "user-a");

		await proposals[0]!.onPass();
		assert.ok(actionRan);
	});

	it("falls back to acting directly when there is no channel to post the vote in", async () => {
		const { player } = makePlayer();
		const { votes, proposals } = makeVotes();

		const result = await handleActionWithGate({
			player,
			member: unqualified,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			votes,
			channel: null,
			action: "clear the queue",
			onPass: async () => {},
		});

		assert.deepEqual(result, { kind: "noVoters" });
		assert.equal(proposals.length, 0);
	});

	it("falls back to acting directly when no humans can vote", async () => {
		const { player } = makePlayer({ humanIds: [] });
		const { votes, proposals } = makeVotes();

		const result = await handleActionWithGate({
			player,
			member: unqualified,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			votes,
			channel: makeChannel(),
			action: "clear the queue",
			onPass: async () => {},
		});

		assert.deepEqual(result, { kind: "noVoters" });
		assert.equal(proposals.length, 0);
	});

	it("treats a missing votes manager as qualified", async () => {
		const { player } = makePlayer();

		const result = await handleActionWithGate({
			player,
			member: unqualified,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			channel: makeChannel(),
			action: "clear the queue",
			onPass: async () => {},
		});

		assert.deepEqual(result, { kind: "qualified" });
	});
});

describe("handleSkipWithGate", () => {
	it("reports noVoters when nothing current plays so callers fall back to skip()", async () => {
		const { player } = makePlayer();

		const result = await handleSkipWithGate({
			player,
			member: unqualified,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			channel: makeChannel(),
		});

		assert.deepEqual(result, { kind: "noVoters" });
	});

	it("labels the vote as a skip of the target recitation", async () => {
		const recitation = makeRecitation();
		const { player, calls } = makePlayer({ current: recitation });
		const { votes, proposals } = makeVotes();

		const result = await handleSkipWithGate({
			player,
			member: unqualified,
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			votes,
			channel: makeChannel(),
		});

		assert.deepEqual(result, { kind: "voted" });
		assert.match(proposals[0]!.action, /^skip \*\*.+\*\*$/);

		await proposals[0]!.onPass();
		assert.deepEqual(calls, ["skip"]);
	});
});
