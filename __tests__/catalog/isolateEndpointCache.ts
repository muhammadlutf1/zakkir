import { mock } from "node:test";
import { config } from "../../src/config";

let clock = 0;

/**
 * The Catalog's endpoint cache is module-level and shared across every test
 * in the process, while mock.timers restarts at epoch 0 for each test. Each
 * test therefore jumps the mocked clock well past everything earlier tests
 * could have written (their ticks plus one TTL of freshness), so no stale
 * entry is ever served as fresh.
 */
export function isolateEndpointCache() {
	mock.timers.enable({ apis: ["Date"] });
	clock += config.catalog.ttlMs * 10;
	mock.timers.tick(clock);
}
