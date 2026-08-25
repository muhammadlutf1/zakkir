import assert from "node:assert/strict";
import { describe, it } from "node:test";
import clearCommand from "../../src/commands/clear";
import type { CommandContext } from "../../src/core/interactionContext";
import { localizable } from "../../src/i18n/locale";
import { ar, en } from "../../src/i18n/messages";

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
	return {
		players: {} as CommandContext["players"],
		catalog: {} as CommandContext["catalog"],
		guildConfigs: {} as CommandContext["guildConfigs"],
		playback: {} as CommandContext["playback"],
		locale: "en",
		translator: localizable("en"),
		...overrides,
	};
}

/** Captures the plain-text `reply` payload the command sends, if any. */
async function runClear(context: CommandContext): Promise<string | undefined> {
	const captured: string[] = [];

	await clearCommand.execute(context, {
		inCachedGuild: () => true,
		guildId: "g-1",
		member: { id: "user-1", user: { username: "tester" } },
		channel: null,
		reply: async (payload: string) => {
			captured.push(payload);
		},
	} as never);

	return captured[0];
}

describe("command replies are localized through context.translator", () => {
	it("clear reports the cleared state in the guild's locale", async () => {
		const shared = {
			players: {
				get: () => ({ clearQueue: () => undefined }),
			} as unknown as CommandContext["players"],
		};

		const enReply = await runClear(makeContext(shared));
		const arReply = await runClear(
			makeContext({ ...shared, locale: "ar", translator: localizable("ar") }),
		);

		assert.equal(enReply, en["command.queueCleared"]);
		assert.equal(arReply, ar["command.queueCleared"]);
		assert.notEqual(enReply, arReply);
	});
});
