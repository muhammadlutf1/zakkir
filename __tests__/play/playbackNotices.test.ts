import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playbackNotices } from "../../src/play/playbackNotices";
import type { Recitation } from "../../src/voice/Recitation";

const recitationFixture: Recitation = {
	surah: { number: 18, name: "الكهف", names: { en: "Al-Kahf" } },
	reciterId: 1,
	reciterName: "إبراهيم الأخضر",
	rewayahId: 1,
	rewayahName: "حفص عن عاصم",
	url: "https://example.com/018.mp3",
};

describe("playbackNotices", () => {
	it("renders the unreachable notice in English", () => {
		assert.equal(
			playbackNotices("en").render("unreachable", recitationFixture),
			"<:error:1385171040098979961> Couldn't play Al-Kahf by إبراهيم الأخضر (حفص عن عاصم) — the stream is unreachable.",
		);
	});

	it("renders the playback-failed notice in English", () => {
		assert.equal(
			playbackNotices("en").render("playbackFailed", recitationFixture),
			"<:error:1385171040098979961> Playback of Al-Kahf by إبراهيم الأخضر (حفص عن عاصم) failed.",
		);
	});

	it("renders the unreachable notice in Arabic with the literal Surah name", () => {
		assert.equal(
			playbackNotices("ar").render("unreachable", recitationFixture),
			"<:error:1385171040098979961> تعذّر تشغيل الكهف بصوت إبراهيم الأخضر (حفص عن عاصم) — البث غير متاح.",
		);
	});

	it("renders the playback-failed notice in Arabic", () => {
		assert.equal(
			playbackNotices("ar").render("playbackFailed", recitationFixture),
			"<:error:1385171040098979961> فشل تشغيل الكهف بصوت إبراهيم الأخضر (حفص عن عاصم).",
		);
	});
});