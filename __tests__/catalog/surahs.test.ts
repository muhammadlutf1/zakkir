import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSurah, SURAH_LIST } from "../../src/catalog/surahs";

describe("SURAH_LIST", () => {
	it("lists all 114 surahs numbered 1..114", () => {
		assert.equal(SURAH_LIST.length, 114);

		const numbers = SURAH_LIST.map((s) => s.number);

		assert.deepEqual(numbers, Array.from({ length: 114 }, (_, i) => i + 1));

		for (const surah of SURAH_LIST) {
			assert.ok(surah.name.length > 0);
		}
	});
});

describe("resolveSurah", () => {
	it("matches a number", () => {
		assert.deepEqual(resolveSurah(18), { number: 18, name: "الكهف" });
		assert.deepEqual(resolveSurah(114), { number: 114, name: "الناس" });
	});

	it("matches a numeric string", () => {
		assert.deepEqual(resolveSurah("18"), { number: 18, name: "الكهف" });
		assert.deepEqual(resolveSurah("1"), { number: 1, name: "الفاتحة" });
	});

	it("matches a name", () => {
		assert.deepEqual(resolveSurah("الكهف"), { number: 18, name: "الكهف" });
		assert.deepEqual(resolveSurah("الفاتحة"), { number: 1, name: "الفاتحة" });
	});

	it("trims surrounding whitespace", () => {
		assert.deepEqual(resolveSurah("  18  "), { number: 18, name: "الكهف" });
	});

	it("returns undefined for unknown input", () => {
		assert.equal(resolveSurah(115), undefined);
		assert.equal(resolveSurah("0"), undefined);
		assert.equal(resolveSurah("الكهفاء"), undefined);
		assert.equal(resolveSurah(""), undefined);
	});
});
