import assert from "node:assert/strict";
import { describe, it } from "node:test";
import pauseComponent from "../../src/components/player-panel/pause";
import repeatComponent from "../../src/components/player-panel/repeat";
import repeatModeComponent from "../../src/components/player-panel/repeatMode";
import selectComponent from "../../src/components/player-panel/select";
import skipComponent from "../../src/components/player-panel/skip";
import stopComponent from "../../src/components/player-panel/stop";

const ROUTES: Array<{
	component: typeof pauseComponent;
	accepts: string[];
	rejects: string[];
}> = [
	{
		component: pauseComponent,
		accepts: ["player-panel:pause"],
		rejects: ["player-panel:pauses", "rewayah-play:18:1:1"],
	},
	{
		component: stopComponent,
		accepts: ["player-panel:stop"],
		rejects: ["player-panel:skip"],
	},
	{
		component: skipComponent,
		accepts: ["player-panel:skip"],
		rejects: ["player-panel:stop"],
	},
	{
		component: repeatComponent,
		accepts: ["player-panel:repeat"],
		rejects: ["player-panel:repeat:off", "radio:confirm"],
	},
	{
		component: repeatModeComponent,
		accepts: [
			"player-panel:repeat:off",
			"player-panel:repeat:track",
			"player-panel:repeat:all",
		],
		rejects: ["player-panel:repeat", "player-panel:repeat:nope"],
	},
	{
		component: selectComponent,
		accepts: ["player-panel:select"],
		rejects: ["player-panel:selected"],
	},
];

describe("player-panel component routing", () => {
	for (const { component, accepts, rejects } of ROUTES) {
		it(`${accepts[0]} matches its customIds`, () => {
			for (const customId of accepts) {
				assert.ok(component.match(customId), customId);
			}
		});

		it(`${accepts[0]} rejects foreign customIds`, () => {
			for (const customId of rejects) {
				assert.ok(!component.match(customId), customId);
			}
		});
	}

	it("exactly one registered component matches each panel customId", () => {
		const components = ROUTES.map((route) => route.component);
		const customIds = ROUTES.flatMap((route) => route.accepts);

		for (const customId of customIds) {
			const matches = components.filter((component) =>
				component.match(customId),
			);
			assert.equal(matches.length, 1, customId);
		}
	});
});
