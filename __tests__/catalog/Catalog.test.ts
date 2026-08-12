import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSurahStreamUrl } from "../../src/catalog/Catalog";

test("buildSurahStreamUrl appends the zero-padded surah number to the server URL", () => {
	assert.equal(
		buildSurahStreamUrl("https://server11.mp3quran.net/hazza/", 1),
		"https://server11.mp3quran.net/hazza/001.mp3",
	);
});

test("buildSurahStreamUrl pads surah numbers below 100 to three digits", () => {
	assert.equal(
		buildSurahStreamUrl("https://server11.mp3quran.net/hazza/", 18),
		"https://server11.mp3quran.net/hazza/018.mp3",
	);
	assert.equal(
		buildSurahStreamUrl("https://server11.mp3quran.net/hazza/", 114),
		"https://server11.mp3quran.net/hazza/114.mp3",
	);
});