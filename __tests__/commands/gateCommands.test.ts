import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PermissionFlagsBits } from "discord.js";
import type {
	VoteManager,
	VoteProposeInput,
} from "../../src/access/VoteManager";
import clearCommand from "../../src/commands/clear";
import removeCommand from "../../src/commands/remove";
import repeatCommand from "../../src/commands/repeat";
import type { CommandContext } from "../../src/core/interactionContext";
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
	overrides: { upcoming?: Recitation[]; humanIds?: string[] } = {},
) {
	const calls: string[] = [];
	const humanIds = overrides.humanIds ?? ["user-a", "user-b"];
	const player = {
		guildId: "g-1",
		get humanMemberCount() {
			return humanIds.length;
		},
		humanMemberIds: humanIds,
		queueView: {
			current: undefined,
			upcoming: overrides.upcoming ?? [],
			repeatMode: RepeatMode.OFF,
		},
		clearQueue() {
			calls.push("clearQueue");
		},
		setRepeatMode(mode: RepeatMode) {
			calls.push(`repeat:${mode}`);
		},
		remove(position: number) {
			calls.push(`remove:${position}`);
		},
	} as unknown as Player & { calls: string[] };

	return { player: player as Player, calls };
}

type MemberOverrides = {
	id?: string;
	mover?: boolean;
};

function makeMember(overrides: MemberOverrides = {}) {
	return {
		id: overrides.id ?? "user-a",
		user: { username: "tester" },
		displayName: "tester",
		permissions: {
			has: (flag: bigint) =>
				overrides.mover === true && flag === PermissionFlagsBits.MoveMembers,
		},
	};
}

function makeInteraction(
	options: {
		member?: ReturnType<typeof makeMember>;
		channel?: unknown;
		position?: number;
		mode?: RepeatMode;
	} = {},
) {
	const replies: Array<string | Record<string, unknown>> = [];

	const interaction = {
		inCachedGuild: () => true,
		guildId: "g-1",
		member: options.member ?? makeMember(),
		channel: options.channel ?? { id: "text-1", send: async () => ({}) },
		options: {
			getInteger: (_key: string) => options.position,
			getString: (_key: string) => options.mode,
		},
		reply: async (payload: string | Record<string, unknown>) => {
			replies.push(payload);
		},
	};

	return { interaction: interaction as never, replies };
}

function makeContext(player: Player, votes?: VoteManager): CommandContext {
	return {
		players: {
			get: () => player,
		} as unknown as CommandContext["players"],
		catalog: {} as CommandContext["catalog"],
		guildConfigs: {} as CommandContext["guildConfigs"],
		playback: {} as CommandContext["playback"],
		votes,
		locale: "en",
		translator: localizable("en"),
	};
}

function replyContent(reply: string | Record<string, unknown>): string {
	return typeof reply === "string" ? reply : (reply.content as string);
}

describe("/clear goes through the Gate", () => {
	it("an unqualified member starts a Vote instead of clearing", async () => {
		const { player, calls } = makePlayer();
		const { votes, proposals } = makeVotes();
		const { interaction, replies } = makeInteraction();

		await clearCommand.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, []);
		assert.equal(proposals.length, 1);
		assert.equal(proposals[0]!.action, en["vote.action.clear"]);
		assert.equal(replies.length, 1);
		assert.equal(replyContent(replies[0]!), en["vote.started"]);
	});

	it("a Qualified member clears directly", async () => {
		const { player, calls } = makePlayer();
		const { votes, proposals } = makeVotes();
		const { interaction, replies } = makeInteraction({
			member: makeMember({ mover: true }),
		});

		await clearCommand.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, ["clearQueue"]);
		assert.equal(proposals.length, 0);
		assert.equal(replyContent(replies[0]!), en["command.queueCleared"]);
	});
});

describe("/repeat goes through the Gate", () => {
	it("an unqualified member starts a Vote whose pass sets the mode", async () => {
		const { player, calls } = makePlayer();
		const { votes, proposals } = makeVotes();
		const { interaction, replies } = makeInteraction({
			mode: RepeatMode.ALL,
		});

		await repeatCommand.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, []);
		assert.equal(proposals[0]!.action, en["vote.action.repeat"]);
		assert.equal(replyContent(replies[0]!), en["vote.started"]);

		await proposals[0]!.onPass();
		assert.deepEqual(calls, [`repeat:${RepeatMode.ALL}`]);
	});

	it("a Qualified member sets the mode directly", async () => {
		const { player, calls } = makePlayer();
		const { votes, proposals } = makeVotes();
		const { interaction, replies } = makeInteraction({
			member: makeMember({ mover: true }),
			mode: RepeatMode.CURRENT,
		});

		await repeatCommand.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, [`repeat:${RepeatMode.CURRENT}`]);
		assert.equal(proposals.length, 0);
		assert.match(replyContent(replies[0]!), /Loop mode set to/);
	});
});

describe("/remove goes through the Gate", () => {
	it("the Requester of the target item removes it directly without a Vote", async () => {
		const target = makeRecitation({ requestedBy: "user-a" });
		const { player, calls } = makePlayer({ upcoming: [target] });
		const { votes, proposals } = makeVotes();
		const { interaction, replies } = makeInteraction({
			member: makeMember({ id: "user-a" }),
			position: 1,
		});

		await removeCommand.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, ["remove:2"]);
		assert.equal(proposals.length, 0);
		assert.match(replyContent(replies[0]!), /Removed queued recitation/);
	});

	it("an unqualified non-requester starts a Vote naming the removal", async () => {
		const target = makeRecitation({ requestedBy: "user-b" });
		const { player, calls } = makePlayer({ upcoming: [target] });
		const { votes, proposals } = makeVotes();
		const { interaction, replies } = makeInteraction({ position: 1 });

		await removeCommand.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, []);
		assert.equal(proposals.length, 1);
		assert.equal(
			proposals[0]!.action,
			renderTemplate(en["vote.action.remove"], {
				label: recitationLabel(target, "en"),
			}),
		);
		assert.equal(replyContent(replies[0]!), en["vote.started"]);
	});

	it("empty-state errors win over gating: an out-of-range position errors without a Vote", async () => {
		const { player, calls } = makePlayer({ upcoming: [] });
		const { votes, proposals } = makeVotes();
		const { interaction, replies } = makeInteraction({ position: 3 });

		await removeCommand.execute(makeContext(player, votes), interaction);

		assert.deepEqual(calls, []);
		assert.equal(proposals.length, 0);
		// The command's own empty-state reply fires before any gate decision.
		assert.match(replyContent(replies[0]!), /queued recitations/);
		assert.notEqual(replyContent(replies[0]!), en["vote.started"]);
	});
});
