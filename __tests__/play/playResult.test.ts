import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPlayResult } from "../../src/play/playResult";
import type { Recitation } from "../../src/voice/Recitation";

const recitation: Recitation = {
	surah: { number: 18, name: "الكهف" },
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
			"Added to the queue: الكهف by إبراهيم الأخضر (حفص عن عاصم - مرتل).",
		);
	});

	it("announces a starting Recitation", () => {
		assert.equal(
			formatPlayResult(recitation, { started: true, queued: false }),
			"Playing الكهف by إبراهيم الأخضر (حفص عن عاصم - مرتل).",
		);
	});

	it("reports a failed play with the notice-channel wording", () => {
		assert.equal(
			formatPlayResult(recitation, { started: false, queued: false }),
			"Couldn't play الكهف. A notice was posted to the channel.",
		);
	});
});
