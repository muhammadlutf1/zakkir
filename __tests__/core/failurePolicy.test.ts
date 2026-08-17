import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideFailureResponse } from "../../src/core/failurePolicy";

describe("decideFailureResponse", () => {
	describe("autocomplete", () => {
		it("logs with no response whether or not it is responsive", () => {
			assert.deepEqual(decideFailureResponse("autocomplete", false), {
				action: "log",
			});
			assert.deepEqual(decideFailureResponse("autocomplete", true), {
				action: "log",
			});
		});
	});

	describe("messageComponent", () => {
		it("replies when nothing was responded to yet", () => {
			assert.deepEqual(decideFailureResponse("messageComponent", false), {
				action: "reply",
				content: "There was an error while handling that component!",
			});
		});

		it("follows up when already responded to", () => {
			assert.deepEqual(decideFailureResponse("messageComponent", true), {
				action: "followUp",
				content: "There was an error while handling that component!",
			});
		});
	});

	describe("chatInput", () => {
		it("replies when nothing was responded to yet", () => {
			assert.deepEqual(decideFailureResponse("chatInput", false), {
				action: "reply",
				content: "There was an error while executing this command!",
			});
		});

		it("follows up when already responded to", () => {
			assert.deepEqual(decideFailureResponse("chatInput", true), {
				action: "followUp",
				content: "There was an error while executing this command!",
			});
		});
	});
});
