import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { Catalog } from "../../src/catalog/Catalog";
import { resolveSurah } from "../../src/catalog/surahs";
import {
	parsePickerCustomId,
	pickerCustomId,
	RewayahPickerSession,
	renderPicker,
} from "../../src/play/rewayahPicker";
import type { Player } from "../../src/voice/Player";

const surah = { number: 18, name: "الكهف" };
const reciterName = "إبراهيم الأخضر";

const choices = [
	{
		surahNumber: 18,
		reciterId: 1,
		reciterName,
		rewayahId: 1,
		rewayahName: "حفص عن عاصم - مرتل",
	},
	{
		surahNumber: 18,
		reciterId: 1,
		reciterName,
		rewayahId: 2,
		rewayahName: "ورش عن نافع - مرتل",
	},
];

describe("renderPicker", () => {
	it("lists every choice with one Play button each", () => {
		const { content, components } = renderPicker({
			surah,
			reciterName,
			choices,
		});

		assert.match(content, /Surah الكهف \(18\) by إبراهيم الأخضر/);
		assert.match(content, /1\. حفص عن عاصم/);
		assert.match(content, /2\. ورش عن نافع/);

		const buttons = components.flatMap((row) => row.components);
		assert.equal(buttons.length, 2);
		assert.equal(
			(buttons[0]!.toJSON() as { custom_id?: string }).custom_id,
			"rewayah-play:18:1:1",
		);
		assert.equal(
			(buttons[1]!.toJSON() as { custom_id?: string }).custom_id,
			"rewayah-play:18:1:2",
		);
	});

	it("splits buttons into rows of at most five", () => {
		const many = Array.from({ length: 12 }, (_, i) => ({
			...choices[0]!,
			rewayahId: i,
			rewayahName: `riwayat-${i}`,
		}));

		const { components } = renderPicker({ surah, reciterName, choices: many });

		assert.equal(components.length, 3);
		assert.equal(components[0]!.components.length, 5);
		assert.equal(components[1]!.components.length, 5);
		assert.equal(components[2]!.components.length, 2);
	});
});

describe("parsePickerCustomId", () => {
	it("round-trips a picker button", () => {
		assert.deepEqual(parsePickerCustomId("rewayah-play:18:1:2"), {
			surahNumber: 18,
			reciterId: 1,
			rewayahId: 2,
		});
		assert.equal(parsePickerCustomId("other:1"), undefined);
		assert.equal(parsePickerCustomId("rewayah-play:18:1:abc"), undefined);
		assert.equal(pickerCustomId(choices[1]!), "rewayah-play:18:1:2");
	});
});

describe("RewayahPickerSession", () => {
	function makeSession(
		overrides: {
			defaultChoice?: (typeof choices)[number] | undefined;
			followUps?: string[];
			player?: ReturnType<typeof makeFakePlayer>;
		} = {},
	) {
		const player = overrides.player ?? makeFakePlayer();
		const followUps = overrides.followUps ?? [];
		const hasDefault =
			"defaultChoice" in overrides ? overrides.defaultChoice : choices[0];

		const session = new RewayahPickerSession("picker-1", {
			timeoutMs: 100,
			defaultChoice: hasDefault,
			catalog: makeFixtureCatalog(),
			player,
			followUp: async (content) => followUps.push(content),
		});

		return { session, player, followUps };
	}

	function flush() {
		return new Promise<void>((resolve) => setImmediate(resolve));
	}

	it("fires its timeout once after the delay and auto-plays the default Rewayah", async () => {
		const timers = mock.timers;
		timers.enable({ apis: ["setTimeout"] });

		try {
			const { session, player, followUps } = makeSession();
			timers.tick(101);
			await flush();
			timers.tick(200);
			await flush();

			assert.equal(player.calls, 1);
			assert.match(
				followUps[0]!,
				/Playing الكهف by إبراهيم الأخضر \(حفص عن عاصم - مرتل\)/,
			);
			assert.equal(session.isPending, false);
		} finally {
			timers.reset();
		}
	});

	it("cancels with a notice on timeout when there is no default", async () => {
		const timers = mock.timers;
		timers.enable({ apis: ["setTimeout"] });

		try {
			const { session, player, followUps } = makeSession({
				defaultChoice: undefined,
			});
			timers.tick(101);
			await flush();

			assert.match(followUps[0]!, /Nothing picked/);
			assert.equal(player.calls, 0);
			assert.equal(session.isPending, false);
		} finally {
			timers.reset();
		}
	});

	it("press resolves the picker and cancels its timer so the timeout never fires", async () => {
		const timers = mock.timers;
		timers.enable({ apis: ["setTimeout"] });

		try {
			const { session, player, followUps } = makeSession();
			RewayahPickerSession.getSession("picker-1")?.press();
			timers.tick(500);
			await flush();

			assert.equal(player.calls, 0);
			assert.equal(followUps.length, 0);
			assert.equal(session.isPending, false);
		} finally {
			timers.reset();
		}
	});

	it("timeout() drives the auto-play action through the session interface", async () => {
		const { session, player, followUps } = makeSession();

		await session.timeout();

		assert.equal(player.calls, 1);
		assert.match(
			followUps[0]!,
			/Playing الكهف by إبراهيم الأخضر \(حفص عن عاصم - مرتل\)/,
		);
		assert.equal(session.isPending, false);
	});

	it("timeout() settles exactly once", async () => {
		const { session, player, followUps } = makeSession();

		await session.timeout();
		await session.timeout();

		assert.equal(player.calls, 1);
		assert.equal(followUps.length, 1);
	});
});

function makeFixtureCatalog() {
	return {
		resolveSurah: (input: string | number) => resolveSurah(input),
		async resolveReciterById(id: number) {
			return {
				id,
				name: reciterName,
				rewayat: [
					{
						id: 1,
						name: "حفص عن عاصم - مرتل",
						server: "https://fixture/a",
						surahList: new Set([18]),
						surahCount: 1,
					},
					{
						id: 2,
						name: "ورش عن نافع - مرتل",
						server: "https://fixture/b",
						surahList: new Set([18]),
						surahCount: 1,
					},
				],
			};
		},
		async resolveStreamUrl(_rid: number, rewayahId: number, _s: number) {
			return `https://fixture/${rewayahId}.mp3`;
		},
	} as unknown as Catalog;
}

function makeFakePlayer() {
	let calls = 0;

	return {
		get calls() {
			return calls;
		},
		async play() {
			calls += 1;
			return { started: true, queued: false };
		},
	} as unknown as Player & { calls: number };
}
