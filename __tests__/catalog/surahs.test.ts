import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSurah, SURAHS } from "../../src/catalog/surahs";

test("the fixture lists all 114 surahs numbered 1..114", () => {
	assert.equal(SURAHS.length, 114);

	const numbers = SURAHS.map((s) => s.number);

	assert.deepEqual(numbers, Array.from({ length: 114 }, (_, i) => i + 1));

	for (const surah of SURAHS) {
		assert.ok(surah.name.length > 0);
	}
});

test("resolveSurah matches a number", () => {
	assert.deepEqual(resolveSurah(18), { number: 18, name: "الكهف" });
	assert.deepEqual(resolveSurah(114), { number: 114, name: "الناس" });
});

test("resolveSurah matches a numeric string", () => {
	assert.deepEqual(resolveSurah("18"), { number: 18, name: "الكهف" });
	assert.deepEqual(resolveSurah("1"), { number: 1, name: "الفاتحة" });
});

test("resolveSurah matches a name", () => {
	assert.deepEqual(resolveSurah("الكهف"), { number: 18, name: "الكهف" });
	assert.deepEqual(resolveSurah("الفاتحة"), { number: 1, name: "الفاتحة" });
});

test("resolveSurah trims surrounding whitespace", () => {
	assert.deepEqual(resolveSurah("  18  "), { number: 18, name: "الكهف" });
});

test("resolveSurah returns undefined for unknown input", () => {
	assert.equal(resolveSurah(115), undefined);
	assert.equal(resolveSurah("0"), undefined);
	assert.equal(resolveSurah("الكهفاء"), undefined);
	assert.equal(resolveSurah(""), undefined);
});
