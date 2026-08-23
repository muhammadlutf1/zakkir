import assert from "node:assert/strict";
import { describe, it } from "node:test";
import repeatCommand from "../../src/commands/repeat";
import type { CommandContext } from "../../src/core/interactionContext";
import { localizable, t } from "../../src/i18n/locale";
import { ar, en } from "../../src/i18n/messages";
import { RepeatMode } from "../../src/voice/Queue";

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
	return {
		players: {} as CommandContext["players"],
		catalog: {} as CommandContext["catalog"],
		guildConfigs: {} as CommandContext["guildConfigs"],
		play: {} as CommandContext["play"],
		locale: "en",
		translator: localizable("en"),
		...overrides,
	};
}

async function runRepeat(
	context: CommandContext,
	mode: RepeatMode,
): Promise<string | undefined> {
	const captured: string[] = [];

	await repeatCommand.execute(context, {
		inCachedGuild: () => true,
		guildId: "g-1",
		options: {
			getString: (key: string) => (key === "mode" ? mode : undefined),
		},
		reply: async (payload: string) => {
			captured.push(payload);
		},
	} as never);

	return captured[0];
}

describe("repeat mode names are localized", () => {
	it("renders the mode label in the guild's locale, not the raw enum value", async () => {
		const players = {
			get: () => ({ setRepeatMode: () => undefined }),
		} as unknown as CommandContext["players"];

		const enReply = await runRepeat(
			makeContext({ players }),
			RepeatMode.CURRENT,
		);
		const arReply = await runRepeat(
			makeContext({ players, locale: "ar", translator: localizable("ar") }),
			RepeatMode.CURRENT,
		);

		assert.equal(
			enReply,
			t(en["command.repeatSet"], { mode: en["repeat.mode.current"] }),
		);
		assert.equal(
			arReply,
			t(ar["command.repeatSet"], { mode: ar["repeat.mode.current"] }),
		);
		assert.notEqual(enReply, arReply);
	});
});
