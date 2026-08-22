import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Queue, type QueueView, RepeatMode } from "../../src/voice/Queue";

const alFatiha = { surah: "Al-Fatiha", reciter: "Mishary" } as const;
const yaseen = { surah: "Yaseen", reciter: "Mishary" } as const;
const arRahman = { surah: "Ar-Rahman", reciter: "Alafasy" } as const;

function emptyView(): QueueView<typeof alFatiha> {
	return { current: undefined, upcoming: [], repeatMode: RepeatMode.OFF };
}

describe("a new Queue", () => {
	it("starts empty", () => {
		const queue = new Queue();

		assert.deepEqual(queue.view(), emptyView());
		assert.equal(queue.size, 0);
	});
});

describe("adding to a Queue", () => {
	it("appends a Recitation to the end", () => {
		const queue = new Queue();

		queue.add(alFatiha);
		queue.add(yaseen);

		assert.deepEqual(queue.view(), {
			current: alFatiha,
			upcoming: [yaseen],
			repeatMode: RepeatMode.OFF,
		});
		assert.equal(queue.size, 2);
	});

	it("makes the first added Recitation the current one", () => {
		const queue = new Queue();

		queue.add(alFatiha);

		assert.deepEqual(queue.view(), {
			current: alFatiha,
			upcoming: [],
			repeatMode: RepeatMode.OFF,
		});
	});
});

describe("skipping in a Queue", () => {
	it("advances to the next Recitation", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);

		queue.skip();

		assert.deepEqual(queue.view(), {
			current: yaseen,
			upcoming: [arRahman],
			repeatMode: RepeatMode.OFF,
		});
	});

	it("leaves no current item past the last Recitation", () => {
		const queue = new Queue();
		queue.add(alFatiha);

		queue.skip();
		queue.skip();

		assert.deepEqual(queue.view(), emptyView());
		assert.equal(queue.size, 0);
	});

	it("is a safe no-op on an empty Queue", () => {
		const queue = new Queue();

		queue.skip();

		assert.deepEqual(queue.view(), emptyView());
	});

	it("removes the played Recitation from the Queue", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);

		queue.skip();

		assert.equal(queue.size, 1);
	});
});

describe("removing from a Queue", () => {
	it("deletes the current Recitation and the next becomes current", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);

		assert.equal(queue.remove(1), true);
		assert.deepEqual(queue.view(), {
			current: yaseen,
			upcoming: [],
			repeatMode: RepeatMode.OFF,
		});
	});

	it("deletes an upcoming Recitation by position and preserves order", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);

		assert.equal(queue.remove(2), true);
		assert.deepEqual(queue.view(), {
			current: alFatiha,
			upcoming: [arRahman],
			repeatMode: RepeatMode.OFF,
		});
	});

	it("reports failure for an invalid position", () => {
		const queue = new Queue();
		queue.add(alFatiha);

		assert.equal(queue.remove(0), false);
		assert.equal(queue.remove(-1), false);
		assert.equal(queue.remove(2), false);
		assert.deepEqual(queue.view(), {
			current: alFatiha,
			upcoming: [],
			repeatMode: RepeatMode.OFF,
		});
	});

	it("reports failure on an empty Queue", () => {
		const queue = new Queue();

		assert.equal(queue.remove(1), false);
		assert.deepEqual(queue.view(), emptyView());
	});

	it("reports failure for an empty position argument", () => {
		const queue = new Queue();

		assert.equal(queue.remove(Number.NaN), false);
	});
});

describe("clearing a Queue", () => {
	it("empties the Queue", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);

		queue.clear();

		assert.deepEqual(queue.view(), emptyView());
		assert.equal(queue.size, 0);
	});

	it("is a safe no-op on an empty Queue", () => {
		const queue = new Queue();

		queue.clear();

		assert.deepEqual(queue.view(), emptyView());
	});
});

describe("view", () => {
	it("exposes current and upcoming in order after mixed operations", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);
		queue.skip();
		queue.remove(2);
		queue.add(alFatiha);

		assert.deepEqual(queue.view(), {
			current: yaseen,
			upcoming: [alFatiha],
			repeatMode: RepeatMode.OFF,
		});
	});
});

describe("RepeatMode", () => {
	it("defaults to OFF and is exposed in the view", () => {
		const queue = new Queue();

		assert.equal(queue.repeatMode, RepeatMode.OFF);
		assert.equal(queue.view().repeatMode, RepeatMode.OFF);
	});

	it("setRepeatMode takes a mode and exposes it", () => {
		const queue = new Queue();
		queue.add(alFatiha);

		queue.setRepeatMode(RepeatMode.TRACK);

		assert.equal(queue.repeatMode, RepeatMode.TRACK);
		assert.equal(queue.view().repeatMode, RepeatMode.TRACK);
	});
});

describe("advance honors RepeatMode", () => {
	it("OFF advances to the next Recitation and ends when empty", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);

		queue.advance();
		assert.deepEqual(queue.view(), {
			current: yaseen,
			upcoming: [],
			repeatMode: RepeatMode.OFF,
		});

		queue.advance();
		assert.deepEqual(queue.view(), emptyView());
		assert.equal(queue.size, 0);
	});

	it("TRACK leaves the current Recitation in place for replay", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.setRepeatMode(RepeatMode.TRACK);

		queue.advance();

		assert.deepEqual(queue.view(), {
			current: alFatiha,
			upcoming: [yaseen],
			repeatMode: RepeatMode.TRACK,
		});
		assert.equal(queue.size, 2);
	});

	it("ALL rotates the played Recitation to the back", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);
		queue.setRepeatMode(RepeatMode.ALL);

		queue.advance();

		assert.deepEqual(queue.view(), {
			current: yaseen,
			upcoming: [arRahman, alFatiha],
			repeatMode: RepeatMode.ALL,
		});
	});

	it("ALL wraps back to the first Recitation when the queue ends", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);
		queue.setRepeatMode(RepeatMode.ALL);

		queue.advance();
		queue.advance();
		queue.advance();

		assert.deepEqual(queue.view(), {
			current: alFatiha,
			upcoming: [yaseen, arRahman],
			repeatMode: RepeatMode.ALL,
		});
	});

	it("ALL keeps a single Recitation as the current one", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.setRepeatMode(RepeatMode.ALL);

		queue.advance();

		assert.deepEqual(queue.view(), {
			current: alFatiha,
			upcoming: [],
			repeatMode: RepeatMode.ALL,
		});
	});

	it("is a safe no-op on an empty Queue in every mode", () => {
		for (const mode of [RepeatMode.OFF, RepeatMode.TRACK, RepeatMode.ALL]) {
			const queue = new Queue();
			queue.setRepeatMode(mode);

			queue.advance();

			assert.equal(queue.size, 0);
			assert.equal(queue.view().current, undefined);
			assert.deepEqual(queue.view().upcoming, []);
		}
	});

	it("skip always removes the current Recitation regardless of RepeatMode", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.setRepeatMode(RepeatMode.ALL);

		queue.skip();

		assert.deepEqual(queue.view(), {
			current: yaseen,
			upcoming: [],
			repeatMode: RepeatMode.ALL,
		});
	});
});

describe("clearPending", () => {
	it("drops every upcoming Recitation and keeps the current one", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);

		queue.clearPending();

		assert.deepEqual(queue.view(), {
			current: alFatiha,
			upcoming: [],
			repeatMode: RepeatMode.OFF,
		});
	});

	it("is a safe no-op with nothing queued", () => {
		const queue = new Queue();

		queue.clearPending();

		assert.deepEqual(queue.view(), emptyView());
	});
});

describe("jumpTo", () => {
	it("makes the item at the 0-based index current and drops everything before it", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);

		assert.equal(queue.jumpTo(1), true);
		assert.deepEqual(queue.view(), {
			current: yaseen,
			upcoming: [arRahman],
			repeatMode: RepeatMode.OFF,
		});
		assert.equal(queue.size, 2);
	});

	it("keeps the items after the index as upcoming", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);

		queue.jumpTo(0);

		assert.deepEqual(queue.view().upcoming, [yaseen, arRahman]);
		assert.equal(queue.size, 3);
	});

	it("reports failure for an out-of-range index and leaves the Queue untouched", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);

		assert.equal(queue.jumpTo(2), false);
		assert.equal(queue.jumpTo(-1), false);
		assert.deepEqual(queue.view(), {
			current: alFatiha,
			upcoming: [yaseen],
			repeatMode: RepeatMode.OFF,
		});
	});

	it("reports failure on an empty Queue", () => {
		const queue = new Queue();

		assert.equal(queue.jumpTo(0), false);
		assert.deepEqual(queue.view(), emptyView());
	});

	it("is unaffected by RepeatMode", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);
		queue.setRepeatMode(RepeatMode.ALL);

		queue.jumpTo(2);

		assert.deepEqual(queue.view(), {
			current: arRahman,
			upcoming: [],
			repeatMode: RepeatMode.ALL,
		});
	});
});
