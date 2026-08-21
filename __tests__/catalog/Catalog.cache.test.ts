import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { Catalog } from "../../src/catalog/Catalog";
import { config } from "../../src/config";
import { isolateEndpointCache } from "./isolateEndpointCache";

/**
 * Stubs the global fetch so both Catalog endpoints run offline, counting
 * how many times each endpoint actually hit the network.
 */
function stubApi() {
	const calls = { reciters: 0, radios: 0 };
	let failing = false;

	mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
		const url = String(input);
		const endpoint = url.includes("/reciters") ? "reciters" : "radios";
		calls[endpoint]++;

		if (failing) return new Response("boom", { status: 500 });

		const body =
			endpoint === "reciters" ? { reciters: [reciter] } : { radios: [radio] };

		return new Response(JSON.stringify(body), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	});

	return {
		calls,
		failAlways: () => {
			failing = true;
		},
	};
}

beforeEach(() => {
	isolateEndpointCache();
});

afterEach(() => {
	mock.timers.reset();
	mock.restoreAll();
});

const reciter = {
	id: 1,
	name: "Ibrahim Al-Akhdar",
	moshaf: [
		{
			id: 7,
			name: "Hafs",
			server: "https://server6.mp3quran.net/akdr/",
			surah_total: 114,
			surah_list: "1",
		},
	],
};

const radio = { id: 100, name: "Quran Radio", url: "https://stream/radio-a" };

describe("Catalog endpoint cache", () => {
	it("serves N resolves from a single fetch per endpoint", async () => {
		const api = stubApi();
		const catalog = new Catalog();

		const byName = await catalog.resolveReciterByName("Ibrahim Al-Akhdar");
		const byId = await catalog.resolveReciterById(1);
		const rewayah = await catalog.resolveRewayahById(7);
		const rewayat = await catalog.resolveRewayat(1, 1);
		const url = await catalog.resolveStreamUrl(1, 7, 1);
		await catalog.fetchRadios();
		const radioUrl = await catalog.resolveRadioUrl(100);

		assert.equal(byName?.id, 1);
		assert.equal(byId?.id, 1);
		assert.equal(rewayah?.id, 7);
		assert.equal(rewayat.length, 1);
		assert.match(url!, /001\.mp3$/);
		assert.equal(radioUrl, radio.url);
		assert.equal(api.calls.reciters, 1);
		assert.equal(api.calls.radios, 1);
	});

	it("caches each locale separately", async () => {
		const api = stubApi();
		const catalog = new Catalog();

		await catalog.fetchReciters("ar");
		await catalog.fetchReciters("en");

		assert.equal(api.calls.reciters, 2);
	});

	it("shares one cache across locale-bound views of the same Catalog", async () => {
		const api = stubApi();
		const catalog = new Catalog();

		await catalog.forLocale("en").fetchReciters();
		await catalog.forLocale("en").fetchReciters();

		assert.equal(api.calls.reciters, 1);
	});

	it("pays one fetch when resolves race on a cold cache", async () => {
		const api = stubApi();
		const catalog = new Catalog();

		await Promise.all([
			catalog.fetchReciters(),
			catalog.fetchReciters(),
			catalog.fetchRadios(),
			catalog.fetchRadios(),
		]);

		assert.equal(api.calls.reciters, 1);
		assert.equal(api.calls.radios, 1);
	});

	it("refetches exactly once once the TTL has lapsed", async () => {
		const api = stubApi();
		const catalog = new Catalog();

		await catalog.fetchReciters();
		mock.timers.tick(config.catalog.ttlMs + 1);
		await catalog.fetchReciters();
		await catalog.fetchReciters();

		assert.equal(api.calls.reciters, 2);
	});

	it("serves the stale copy when a refresh keeps failing", async () => {
		const api = stubApi();
		const catalog = new Catalog();

		const fresh = await catalog.fetchReciters();
		mock.timers.tick(config.catalog.ttlMs + 1);
		api.failAlways();
		const stale = await catalog.fetchReciters();

		assert.deepEqual(stale, fresh);
		assert.equal(api.calls.reciters, 1 + config.catalog.fetchAttempts);
	});

	it("propagates the error when a cold cache fails", async () => {
		const api = stubApi();
		api.failAlways();
		const catalog = new Catalog();

		await assert.rejects(catalog.fetchRadios("en"));
		assert.equal(api.calls.radios, config.catalog.fetchAttempts);
	});
});
