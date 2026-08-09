import assert from "node:assert/strict";
import { test } from "node:test";
import { Queue, type QueueView } from "../../src/voice/Queue";

const alFatiha = { surah: "Al-Fatiha", reciter: "Mishary" } as const;
const yaseen = { surah: "Yaseen", reciter: "Mishary" } as const;
const arRahman = { surah: "Ar-Rahman", reciter: "Alafasy" } as const;

function emptyView(): QueueView<typeof alFatiha> {
	return { current: undefined, upcoming: [] };
}

test("a new Queue starts empty", () => {
	const queue = new Queue();

	assert.deepEqual(queue.view(), emptyView());
	assert.equal(queue.size, 0);
});

test("add appends a Recitation to the end of the Queue", () => {
	const queue = new Queue();

	queue.add(alFatiha);
	queue.add(yaseen);

	assert.deepEqual(queue.view(), { current: alFatiha, upcoming: [yaseen] });
	assert.equal(queue.size, 2);
});

test("the first added Recitation becomes the current one", () => {
	const queue = new Queue();

	queue.add(alFatiha);

	assert.deepEqual(queue.view(), { current: alFatiha, upcoming: [] });
});

test("skip advances to the next Recitation", () => {
	const queue = new Queue();
	queue.add(alFatiha);
	queue.add(yaseen);
	queue.add(arRahman);

	queue.skip();

	assert.deepEqual(queue.view(), { current: yaseen, upcoming: [arRahman] });
});

test("skip past the last Recitation leaves no current item", () => {
	const queue = new Queue();
	queue.add(alFatiha);

	queue.skip();
	queue.skip();

	assert.deepEqual(queue.view(), emptyView());
	assert.equal(queue.size, 0);
});

test("skip on an empty Queue is a safe no-op", () => {
	const queue = new Queue();

	queue.skip();

	assert.deepEqual(queue.view(), emptyView());
});

test("skip removes the played Recitation from the Queue", () => {
	const queue = new Queue();
	queue.add(alFatiha);
	queue.add(yaseen);

	queue.skip();

	assert.equal(queue.size, 1);
});

test("remove deletes the current Recitation and the next becomes current", () => {
	const queue = new Queue();
	queue.add(alFatiha);
	queue.add(yaseen);

	assert.equal(queue.remove(1), true);
	assert.deepEqual(queue.view(), { current: yaseen, upcoming: [] });
});

test("remove deletes an upcoming Recitation by position and preserves order", () => {
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

test("remove reports failure for an invalid position", () => {
	const queue = new Queue();
	queue.add(alFatiha);

	assert.equal(queue.remove(0), false);
	assert.equal(queue.remove(-1), false);
	assert.equal(queue.remove(2), false);
	assert.deepEqual(queue.view(), { current: alFatiha, upcoming: [] });
});

test("remove on an empty Queue reports failure", () => {
	const queue = new Queue();

	assert.equal(queue.remove(1), false);
	assert.deepEqual(queue.view(), emptyView());
});

test("remove reports failure for an empty position argument", () => {
	const queue = new Queue();

	assert.equal(queue.remove(Number.NaN), false);
});

test("clear empties the Queue", () => {
	const queue = new Queue();
	queue.add(alFatiha);
	queue.add(yaseen);

	queue.clear();

	assert.deepEqual(queue.view(), emptyView());
	assert.equal(queue.size, 0);
});

test("clear on an empty Queue is a safe no-op", () => {
	const queue = new Queue();

	queue.clear();

	assert.deepEqual(queue.view(), emptyView());
});

test("view exposes current and upcoming in order after mixed operations", () => {
	const queue = new Queue();
	queue.add(alFatiha);
	queue.add(yaseen);
	queue.add(arRahman);
	queue.skip();
	queue.remove(2);
	queue.add(alFatiha);

	assert.deepEqual(queue.view(), { current: yaseen, upcoming: [alFatiha] });
});
