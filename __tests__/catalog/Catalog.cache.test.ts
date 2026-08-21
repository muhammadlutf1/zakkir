import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { Catalog } from "../../src/catalog/Catalog";
import { config } from "../../src/config";

/**
 * Stubs the global fetch so the Catalog's API lookups run offline, and
 * counts how many times the network was actually hit.
 */
function stubApi(reciters: unknown) {
	let calls = 0;

	mock.method(globalThis, "fetch", async () => {
		calls++;
		return new Response(JSON.stringify({ reciters }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	});

	return {
		getCalls: () => calls,
	};
}

afterEach(() => {
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

describe("Catalog reciters cache", () => {
	it("serves N resolves from a single fetch", async () => {
		const api = stubApi([reciter]);
		const catalog = new Catalog();

		const byName = await catalog.resolveReciterByName("Ibrahim Al-Akhdar");
		const byId = await catalog.resolveReciterById(1);
		const rewayah = await catalog.resolveRewayahById(7);
		const rewayat = await catalog.resolveRewayat(1, 1);
		const url = await catalog.resolveStreamUrl(1, 7, 1);

		assert.equal(byName?.id, 1);
		assert.equal(byId?.id, 1);
		assert.equal(rewayah?.id, 7);
		assert.equal(rewayat.length, 1);
		assert.match(url!, /001\.mp3$/);
		assert.equal(api.getCalls(), 1);
	});

	it("caches each locale separately", async () => {
		const api = stubApi([reciter]);
		const catalog = new Catalog();

		await catalog.fetchReciters("ar");
		await catalog.fetchReciters("en");

		assert.equal(api.getCalls(), 2);
	});

	it("refetches once the TTL has lapsed", async () => {
		const api = stubApi([reciter]);
		const catalog = new Catalog();
		mock.timers.enable({ apis: ["Date"] });

		try {
			await catalog.fetchReciters();
			mock.timers.tick(config.catalog.recitersTtlMs + 1);
			await catalog.fetchReciters();
		} finally {
			mock.timers.reset();
		}

		assert.equal(api.getCalls(), 2);
	});
});
