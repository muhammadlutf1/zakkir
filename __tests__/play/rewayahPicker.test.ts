import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { Catalog } from "../../src/catalog/Catalog";
import { resolveSurah } from "../../src/catalog/surahs";
import type { Player } from "../../src/voice/Player";
import {
	clearPickerTimeout,
	handlePickerTimeout,
	parsePickerCustomId,
	pickerCustomId,
	registerPickerTimeout,
	renderPicker,
} from "../../src/play/rewayahPicker";

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

test("renderPicker lists every choice with one Play button each", () => {
	const { content, components } = renderPicker({ surah, reciterName, choices });

	assert.match(content, /Surah الكهف \(18\) by إبراهيم الأخضر/);
	assert.match(content, /1\. حفص عن عاصم/);
	assert.match(content, /2\. ورش عن نافع/);

	const buttons = components.flatMap((row) => row.components);
	assert.equal(buttons.length, 2);
	assert.equal((buttons[0]!.toJSON() as { custom_id?: string }).custom_id, "rewayah-play:18:1:1");
	assert.equal((buttons[1]!.toJSON() as { custom_id?: string }).custom_id, "rewayah-play:18:1:2");
});

test("renderPicker splits buttons into rows of at most five", () => {
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

test("parsePickerCustomId round-trips a picker button", () => {
	assert.deepEqual(parsePickerCustomId("rewayah-play:18:1:2"), {
		surahNumber: 18,
		reciterId: 1,
		rewayahId: 2,
	});
	assert.equal(parsePickerCustomId("other:1"), undefined);
	assert.equal(parsePickerCustomId("rewayah-play:18:1:abc"), undefined);
	assert.equal(pickerCustomId(choices[1]!), "rewayah-play:18:1:2");
});

test("registerPickerTimeout fires onTimeout only once after the delay, then removes the entry", () => {
	const timers = mock.timers;
	timers.enable({ apis: ["setTimeout"] });

	let calls = 0;
	const entry = registerPickerTimeout("picker-1", {
		timeoutMs: 100,
		onTimeout: () => {
			calls += 1;
		},
	});

	timers.tick(101);
	timers.tick(200);

	assert.equal(calls, 1);
	assert.equal(typeof entry.cancel, "function");

	timers.reset();
});

test("cancelling a picker prevents its onTimeout", () => {
	const timers = mock.timers;
	timers.enable({ apis: ["setTimeout"] });

	let calls = 0;
	registerPickerTimeout("picker-2", {
		timeoutMs: 100,
		onTimeout: () => {
			calls += 1;
		},
	});

	clearPickerTimeout("picker-2");
	timers.tick(200);

	assert.equal(calls, 0);

	timers.reset();
});

test("handlePickerTimeout auto-plays the default Rewayah when present", async () => {
	const player = makeFakePlayer();
	const followUps: string[] = [];
	const catalog = makeFixtureCatalog();

	await handlePickerTimeout(
		{ catalog, player, followUp: async (content) => followUps.push(content) },
		choices[0],
	);

	assert.match(followUps[0]!, /Playing الكهف by إبراهيم الأخضر \(حفص عن عاصم - مرتل\)/);
	assert.equal(player.calls, 1);
});

test("handlePickerTimeout cancels with a notice when there is no default", async () => {
	const player = makeFakePlayer();
	const followUps: string[] = [];

	await handlePickerTimeout(
		{
			catalog: makeFixtureCatalog(),
			player,
			followUp: async (content) => followUps.push(content),
		},
		undefined,
	);

	assert.match(followUps[0]!, /Nothing picked/);
	assert.equal(player.calls, 0);
});

function makeFixtureCatalog() {
	return {
		resolveSurah: (input: string | number) => resolveSurah(input),
		async resolveReciterById(id: number) {
			return {
				id,
				name: reciterName,
				rewayat: [
					{ id: 1, name: "حفص عن عاصم - مرتل", server: "https://fixture/a", surahList: new Set([18]), surahCount: 1 },
					{ id: 2, name: "ورش عن نافع - مرتل", server: "https://fixture/b", surahList: new Set([18]), surahCount: 1 },
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