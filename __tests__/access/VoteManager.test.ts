import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SendableTextChannel } from "../../src/access/types";
import { VoteManager } from "../../src/access/VoteManager";
import { localizable } from "../../src/i18n/locale";

function makeChannel() {
	const sends: Array<Record<string, unknown>> = [];
	const edits: Array<Record<string, unknown>> = [];

	const message = {
		id: "vote-message-1",
		async edit(payload: Record<string, unknown>) {
			edits.push(payload);
		},
	};

	const channel = {
		id: "text-1",
		async send(payload: Record<string, unknown>) {
			sends.push(payload);
			return message;
		},
	} as never as SendableTextChannel;

	return { channel, sends, edits };
}

type ProposeOverrides = Partial<Parameters<VoteManager["propose"]>[0]>;

function makeInput(
	channel: SendableTextChannel,
	overrides: ProposeOverrides = {},
): Parameters<VoteManager["propose"]>[0] {
	return {
		guildId: "guild-1",
		initiatorId: "user-a",
		voterIds: ["user-a", "user-b", "user-c"],
		channel,
		locale: "en" as const,
		translator: localizable("en"),
		action: "skip **Al-Kahf by Minshawi**",
		onPass: async () => {},
		...overrides,
	};
}

function buttonPayload(payload: Record<string, unknown>) {
	const rows = payload.components as Array<{
		toJSON: () => { components: Array<Record<string, unknown>> };
	}>;
	return rows[0].toJSON().components;
}

describe("VoteManager", () => {
	it("rejects a re-vote and keeps the original choice", async () => {
		const manager = new VoteManager();
		const { channel, edits } = makeChannel();
		await manager.propose(
			makeInput(channel, {
				voterIds: ["user-a", "user-b", "user-c", "user-d"],
			}),
		);

		const first = await manager.handleVote("guild-1", "user-b", "yes");
		assert.equal(first, "accepted");

		const second = await manager.handleVote("guild-1", "user-b", "no");
		assert.equal(second, "alreadyVoted");

		const buttons = buttonPayload(edits.at(-1)!);
		const yes = buttons.find((b) => b.custom_id === "vote:yes");
		assert.equal(yes?.label, "Yes (2/4)");
	});

	it("builds both vote buttons as Secondary style", async () => {
		const manager = new VoteManager();
		const { channel, sends } = makeChannel();
		await manager.propose(makeInput(channel));

		const buttons = buttonPayload(sends[0]);
		assert.deepEqual(
			buttons.map((b) => b.style),
			[2, 2],
		);
	});

	it("mentions the initiator by display name in the prompt", async () => {
		const manager = new VoteManager();
		const { channel, sends } = makeChannel();
		await manager.propose(makeInput(channel, { initiatorName: "Amr Diab" }));

		const content = sends[0].content as string;
		assert.match(
			content,
			/\*\*Amr Diab\*\* wants to skip \*\*Al-Kahf by Minshawi\*\*/,
		);
	});
});
