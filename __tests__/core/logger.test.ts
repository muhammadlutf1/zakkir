import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

before(() => {
	process.env.NODE_ENV = "production";
	delete process.env.LOG_LEVEL;
});

describe("resolveLogLevel", () => {
	it("defaults to debug in development", async () => {
		const { resolveLogLevel } = await import("../../src/core/logger");

		assert.equal(resolveLogLevel({}), "debug");
	});

	it("defaults to info in production", async () => {
		const { resolveLogLevel } = await import("../../src/core/logger");

		assert.equal(resolveLogLevel({ NODE_ENV: "production" }), "info");
	});

	it("honors LOG_LEVEL", async () => {
		const { resolveLogLevel } = await import("../../src/core/logger");

		assert.equal(resolveLogLevel({ LOG_LEVEL: "warn" }), "warn");
		assert.equal(
			resolveLogLevel({ NODE_ENV: "production", LOG_LEVEL: "trace" }),
			"trace",
		);
	});
});

describe("createLogger", () => {
	it("returns a single shared logger per module name", async () => {
		const { createLogger } = await import("../../src/core/logger");

		assert.equal(createLogger("shared"), createLogger("shared"));
		assert.notEqual(createLogger("shared"), createLogger("other"));
	});

	it("binds the module name into emitted log lines", () => {
		const loggerUrl = pathToFileURL(
			join(dirname(fileURLToPath(import.meta.url)), "../../src/core/logger"),
		).href;

		const dir = mkdtempSync(join(tmpdir(), "logger-test-"));
		const fixture = join(dir, "fixture.ts");

		writeFileSync(
			fixture,
			[
				`import { createLogger } from ${JSON.stringify(loggerUrl)};`,
				`createLogger("first-module").info("first message");`,
				`createLogger("second-module").info("second message");`,
			].join("\n"),
		);

		try {
			const stdout = execFileSync(
				process.execPath,
				["--import", "tsx", fixture],
				{ encoding: "utf8", env: { ...process.env, NODE_ENV: "production" } },
			);

			const lines = stdout
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line));

			assert.equal(lines[0].module, "first-module");
			assert.equal(lines[0].msg, "first message");
			assert.equal(lines[1].module, "second-module");
			assert.equal(lines[1].msg, "second message");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});