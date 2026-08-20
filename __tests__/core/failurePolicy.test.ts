import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideFailureResponse } from "../../src/events/interactionCreate";
import { localizable } from "../../src/i18n/locale";

const t = localizable("en");

describe("decideFailureResponse", () => {
	describe("autocomplete", () => {
		it("logs with no response whether or not it is responsive", () => {
			assert.deepEqual(decideFailureResponse("autocomplete", false, t), {
				action: "log",
			});
			assert.deepEqual(decideFailureResponse("autocomplete", true, t), {
				action: "log",
			});
		});
	});

	describe("messageComponent", () => {
		it("replies when nothing was responded to yet", () => {
			assert.deepEqual(decideFailureResponse("messageComponent", false, t), {
				action: "reply",
				content: t.t("error.componentGeneric"),
			});
		});

		it("follows up when already responded to", () => {
			assert.deepEqual(decideFailureResponse("messageComponent", true, t), {
				action: "followUp",
				content: t.t("error.componentGeneric"),
			});
		});
	});

	describe("chatInput", () => {
		it("replies when nothing was responded to yet", () => {
			assert.deepEqual(decideFailureResponse("chatInput", false, t), {
				action: "reply",
				content: t.t("error.commandGeneric"),
			});
		});

		it("follows up when already responded to", () => {
			assert.deepEqual(decideFailureResponse("chatInput", true, t), {
				action: "followUp",
				content: t.t("error.commandGeneric"),
			});
		});
	});

	describe("locale-aware error replies", () => {
		it("renders the error in the guild's locale", () => {
			const ar = localizable("ar");

			assert.equal(
				decideFailureResponse("chatInput", false, ar).content,
				"حدث خطأ أثناء تنفيذ هذا الأمر!",
			);
			assert.equal(
				decideFailureResponse("messageComponent", false, ar).content,
				"حدث خطأ أثناء معالجة هذا المكوّن!",
			);
		});
	});
});