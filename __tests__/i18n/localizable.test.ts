import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { config, DEFAULT_LOCALE } from "../../src/config";
import { isLocale, localizable, t } from "../../src/i18n/locale";
import { ar, en } from "../../src/i18n/messages";

function catalogKeys(catalog: object) {
	return Object.keys(catalog).sort();
}

describe("t", () => {
	it("interpolates {var} placeholders", () => {
		assert.equal(
			t("Playing {label}.", { label: "Al-Kahf by Qari (Hafs)" }),
			"Playing Al-Kahf by Qari (Hafs).",
		);
	});

	it("renders a numeric placeholder as a string", () => {
		assert.equal(t("Surah {number}", { number: 18 }), "Surah 18");
	});

	it("leaves a placeholder without a matching param untouched", () => {
		assert.equal(t("Hello {name}!", {}), "Hello {name}!");
	});

	it("ignores params the template does not use", () => {
		assert.equal(t("{a}", { a: "x", b: "y" }), "x");
	});
});

describe("isLocale", () => {
	it("accepts the known locales", () => {
		assert.equal(isLocale("en"), true);
		assert.equal(isLocale("ar"), true);
	});

	it("rejects unknown or empty values", () => {
		assert.equal(isLocale("fr"), false);
		assert.equal(isLocale(""), false);
		assert.equal(isLocale(undefined), false);
		assert.equal(isLocale(null), false);
	});
});

describe("message catalogs", () => {
	it("ships English as the default locale", () => {
		assert.equal(DEFAULT_LOCALE, config.defaults.language);
		assert.equal(DEFAULT_LOCALE, "en");
	});

	it("en and ar carry the same typed set of keys", () => {
		assert.deepEqual(catalogKeys(en), catalogKeys(ar));
		assert.ok(catalogKeys(en).length > 0);
	});

	it("both dictionaries carry the prepared wording and emotes", () => {
		for (const value of Object.values(en) as string[]) {
			assert.ok(value.length > 0, "an English message is empty");
		}
		for (const value of Object.values(ar) as string[]) {
			assert.ok(value.length > 0, "an Arabic message is empty");
		}

		assert.match(en["emote.playing"], /^<:/);
		assert.match(ar["emote.playing"], /^<:/);
	});
});

describe("localizable", () => {
	it("resolves a key and interpolates params for its locale", () => {
		assert.equal(
			localizable("en").t("play.started", { label: "Al-Kahf" }),
			"**<:play:1384273884622229514> Playing** Al-Kahf.",
		);
		assert.equal(
			localizable("ar").t("play.started", { label: "الكهف" }),
			"**<:play:1384273884622229514> جارٍ تشغيل** الكهف.",
		);
	});
});