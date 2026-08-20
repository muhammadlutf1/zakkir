import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPlayResult } from "../../src/play/playResult";
import type { Recitation } from "../../src/voice/Recitation";

const recitation: Recitation = {
	surah: { number: 18, name: "الكهف", names: { en: "Al-Kahf" } },
	reciterId: 1,
	reciterName: "إبراهيم الأخضر",
	rewayahId: 1,
	rewayahName: "حفص عن عاصم - مرتل",
	url: "https://example.com/018.mp3",
};

describe("formatPlayResult", () => {
	it("announces an appended (queued) Recitation", () => {
		assert.equal(
			formatPlayResult(recitation, { started: false, queued: true }),
			"✅ Added **Al-Kahf by إبراهيم الأخضر (حفص عن عاصم - مرتل)** to the queue.",
		);
	});

	it("announces a starting Recitation", () => {
		assert.equal(
			formatPlayResult(recitation, { started: true, queued: false }),
			"**<:play:1384273884622229514> Playing** Al-Kahf by إبراهيم الأخضر (حفص عن عاصم - مرتل).",
		);
	});

	it("reports a failed play with the notice-channel wording", () => {
		assert.equal(
			formatPlayResult(recitation, { started: false, queued: false }),
			"<:error:1385171040098979961> Couldn't play Al-Kahf. A notice was posted to the channel.",
		);
	});

	it("renders the label with the Arabic surah name in Arabic", () => {
		assert.equal(
			formatPlayResult(recitation, { started: true, queued: false }, "ar"),
			"**<:play:1384273884622229514> جارٍ تشغيل** الكهف بصوت إبراهيم الأخضر (حفص عن عاصم - مرتل).",
		);
	});

	it("renders the label with the English surah name in English", () => {
		assert.equal(
			formatPlayResult(recitation, { started: true, queued: false }, "en"),
			"**<:play:1384273884622229514> Playing** Al-Kahf by إبراهيم الأخضر (حفص عن عاصم - مرتل).",
		);
	});
});
