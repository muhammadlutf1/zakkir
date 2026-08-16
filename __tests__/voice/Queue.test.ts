import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Queue, type QueueView } from "../../src/voice/Queue";

const alFatiha = { surah: "Al-Fatiha", reciter: "Mishary" } as const;
const yaseen = { surah: "Yaseen", reciter: "Mishary" } as const;
const arRahman = { surah: "Ar-Rahman", reciter: "Alafasy" } as const;

function emptyView(): QueueView<typeof alFatiha> {
	return { current: undefined, upcoming: [] };
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

		assert.deepEqual(queue.view(), { current: alFatiha, upcoming: [yaseen] });
		assert.equal(queue.size, 2);
	});

	it("makes the first added Recitation the current one", () => {
		const queue = new Queue();

		queue.add(alFatiha);

		assert.deepEqual(queue.view(), { current: alFatiha, upcoming: [] });
	});
});

describe("skipping in a Queue", () => {
	it("advances to the next Recitation", () => {
		const queue = new Queue();
		queue.add(alFatiha);
		queue.add(yaseen);
		queue.add(arRahman);

		queue.skip();

		assert.deepEqual(queue.view(), { current: yaseen, upcoming: [arRahman] });
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
		assert.deepEqual(queue.view(), { current: yaseen, upcoming: [] });
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
		});
	});

	it("reports failure for an invalid position", () => {
		const queue = new Queue();
		queue.add(alFatiha);

		assert.equal(queue.remove(0), false);
		assert.equal(queue.remove(-1), false);
		assert.equal(queue.remove(2), false);
		assert.deepEqual(queue.view(), { current: alFatiha, upcoming: [] });
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

		assert.deepEqual(queue.view(), { current: yaseen, upcoming: [alFatiha] });
	});
});
