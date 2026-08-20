import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	resolveSurah,
	surahName,
	SURAH_LIST,
} from "../../src/catalog/suwar";

describe("SURAH_LIST", () => {
	it("lists all 114 surahs numbered 1..114", () => {
		assert.equal(SURAH_LIST.length, 114);

		const numbers = SURAH_LIST.map((s) => s.number);

		assert.deepEqual(numbers, Array.from({ length: 114 }, (_, i) => i + 1));

		for (const surah of SURAH_LIST) {
			assert.ok(surah.name.length > 0);
			assert.equal(typeof surah.names?.en, "string");
		}
	});
});

describe("surahName", () => {
	it("returns the Arabic canonical name in Arabic", () => {
		const surah = SURAH_LIST.find((s) => s.number === 18)!;

		assert.equal(surahName(surah, "ar"), "الكهف");
	});

	it("returns the English variant in English", () => {
		const surah = SURAH_LIST.find((s) => s.number === 18)!;

		assert.equal(surahName(surah, "en"), "Al-Kahf");
	});

	it("falls back to the Arabic canonical name when a surah has no variant", () => {
		assert.equal(surahName({ number: 18, name: "الكهف" }, "en"), "الكهف");
	});
});

describe("resolveSurah", () => {
	it("matches a number", () => {
		assert.deepEqual(resolveSurah(18), {
			number: 18,
			name: "الكهف",
			names: { en: "Al-Kahf" },
		});
		assert.deepEqual(resolveSurah(114), {
			number: 114,
			name: "الناس",
			names: { en: "An-Nas" },
		});
	});

	it("matches a numeric string", () => {
		assert.deepEqual(resolveSurah("18")?.number, 18);
		assert.deepEqual(resolveSurah("1")?.number, 1);
	});

	it("matches the Arabic name", () => {
		assert.deepEqual(resolveSurah("الكهف")?.number, 18);
		assert.deepEqual(resolveSurah("الفاتحة")?.number, 1);
	});

	it("matches an English name regardless of the requesting locale", () => {
		assert.deepEqual(resolveSurah("Al-Kahf")?.number, 18);
		assert.deepEqual(resolveSurah("An-Nas")?.number, 114);
	});

	it("matches an English name case-insensitively", () => {
		assert.deepEqual(resolveSurah("al-kahf")?.number, 18);
		assert.deepEqual(resolveSurah("AL-BAQARAH")?.number, 2);
	});

	it("trims surrounding whitespace", () => {
		assert.deepEqual(resolveSurah("  18  ")?.number, 18);
		assert.deepEqual(resolveSurah("  Al-Kahf  ")?.number, 18);
	});

	it("returns undefined for unknown input", () => {
		assert.equal(resolveSurah(115), undefined);
		assert.equal(resolveSurah("0"), undefined);
		assert.equal(resolveSurah("الكهفاء"), undefined);
		assert.equal(resolveSurah("Not-A-Surah"), undefined);
		assert.equal(resolveSurah(""), undefined);
	});
});