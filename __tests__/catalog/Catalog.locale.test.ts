import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { Catalog } from "../../src/catalog/Catalog";
import { config } from "../../src/config";

/**
 * Stubs the global fetch so the Catalog's API lookups run offline, and
 * records the request URLs so we can assert the `language` query param.
 */
function stubApi(reciters: unknown) {
	const urls: string[] = [];

	const fetchMock = mock.method(globalThis, "fetch", async (url: string) => {
		urls.push(url);
		return new Response(JSON.stringify({ reciters }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	});

	return { urls, fetchMock };
}

// The endpoint cache is module-level and shared across tests in this file,
// and mock.timers restarts at epoch 0 for every test. Each test therefore
// jumps the mocked clock well past everything earlier tests could have
// written, so every test's stub is actually fetched.
let clock = 0;

beforeEach(() => {
	mock.timers.enable({ apis: ["Date"] });
	clock += config.catalog.ttlMs * 10;
	mock.timers.tick(clock);
});

afterEach(() => {
	mock.timers.reset();
	mock.restoreAll();
});

const arReciter = { id: 1, name: "إبراهيم الأخضر", moshaf: [] };
const enReciter = { id: 1, name: "Ibrahim Al-Akhdar", moshaf: [] };

describe("Catalog locale threading", () => {
	it("requests Arabic names with language=ar", async () => {
		const { urls } = stubApi([arReciter]);
		const catalog = new Catalog();

		const reciters = await catalog.fetchReciters("ar");

		assert.equal(reciters[0]!.name, "إبراهيم الأخضر");
		assert.match(urls[0]!, /language=ar$/);
	});

	it("requests English names with language=en", async () => {
		const { urls } = stubApi([enReciter]);
		const catalog = new Catalog();

		const reciters = await catalog.fetchReciters("en");

		assert.equal(reciters[0]!.name, "Ibrahim Al-Akhdar");
		assert.match(urls[0]!, /language=en$/);
	});

	it("threads the locale through a by-name reciter resolution", async () => {
		const { urls } = stubApi([enReciter]);
		const catalog = new Catalog();

		const reciter = await catalog.resolveReciterByName(
			"Ibrahim Al-Akhdar",
			"en",
		);

		assert.equal(reciter?.id, 1);
		assert.match(urls[0]!, /language=en$/);
	});

	it("resolves a rewayah by id across reciters, in the locale", async () => {
		const reciter = {
			id: 1,
			name: "إبراهيم الأخضر",
			moshaf: [
				{
					id: 7,
					name: "حفص عن عاصم - مرتل",
					server: "s",
					surah_total: 1,
					surah_list: "1",
				},
			],
		};
		const { urls } = stubApi([reciter]);
		const catalog = new Catalog();

		const rewayah = await catalog.resolveRewayahById(7, "ar");

		assert.equal(rewayah?.id, 7);
		assert.equal(rewayah?.name, "حفص عن عاصم - مرتل");
		assert.match(urls[0]!, /language=ar$/);
	});
});
