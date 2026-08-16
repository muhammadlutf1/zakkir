import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { Catalog } from "../../src/catalog/Catalog";

const catalog = new Catalog();

let online = false;

async function probe(): Promise<boolean> {
	try {
		const response = await fetch(
			"https://www.mp3quran.net/api/v3/radios?language=ar",
			{ signal: AbortSignal.timeout(5000) },
		);

		return response.ok;
	} catch {
		return false;
	}
}

before(async () => {
	online = await probe();
});

describe("Catalog (real MP3Quran API)", () => {
	it("fetchRadios returns MP3Quran-shaped radio entries", async (t) => {
		if (!online) return t.skip("MP3Quran API unreachable");

		const radios = await catalog.fetchRadios();

		assert.ok(radios.length > 0);

		for (const radio of radios) {
			assert.equal(typeof radio.id, "number");
			assert.equal(typeof radio.name, "string");
			assert.ok(radio.url.startsWith("http"));
		}
	});

	it("fetchReciters returns MP3Quran-shaped reciter entries with rewayat", async (t) => {
		if (!online) return t.skip("MP3Quran API unreachable");

		const reciters = await catalog.fetchReciters();

		assert.ok(reciters.length > 0);

		const reciter = reciters[0]!;
		assert.equal(typeof reciter.id, "number");
		assert.equal(typeof reciter.name, "string");
		assert.ok(reciter.rewayat.length > 0);

		const rewayah = reciter.rewayat[0]!;
		assert.equal(typeof rewayah.id, "number");
		assert.equal(typeof rewayah.name, "string");
		assert.ok(rewayah.server.startsWith("http"));
		assert.ok(rewayah.surahList instanceof Set);
		assert.equal(typeof rewayah.surahCount, "number");
	});

	it("resolveRewayat returns only the rewayat that list the Surah", async (t) => {
		if (!online) return t.skip("MP3Quran API unreachable");

		const reciters = await catalog.fetchReciters();
		const reciter = reciters.find((r) => r.rewayat.length > 0)!;
		assert.ok(reciter);

		const rewayat = await catalog.resolveRewayat(reciter.id, 1);

		assert.ok(rewayat.length > 0);

		const listing = rewayat.map((r) => r.surahList.has(1));

		assert.ok(listing.every(Boolean));
	});

	it("resolveStreamUrl returns a reachable stream URL", async (t) => {
		if (!online) return t.skip("MP3Quran API unreachable");

		const reciters = await catalog.fetchReciters();
		const reciter = reciters.find((r) =>
			r.rewayat.some((rewayah) => rewayah.surahList.has(1)),
		)!;
		assert.ok(reciter);
		const rewayah = reciter.rewayat.find((r) => r.surahList.has(1))!;

		const url = await catalog.resolveStreamUrl(reciter.id, rewayah.id, 1);

		assert.ok(url);
		assert.ok(url!.endsWith("/001.mp3"));

		const response = await fetch(url!, {
			signal: AbortSignal.timeout(10000),
		});

		assert.equal(response.status, 200);
		response.body?.cancel();
	});

	it("resolveRadioUrl returns the stream URL for a real Radio", async (t) => {
		if (!online) return t.skip("MP3Quran API unreachable");

		const radios = await catalog.fetchRadios();
		const radio = radios[0]!;

		const url = await catalog.resolveRadioUrl(radio.id);

		assert.equal(url, radio.url);
		assert.ok(url!.startsWith("http"));
	});
});