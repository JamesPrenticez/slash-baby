import type { Application } from "pixi.js";

import { countCommit, probe, publishFrame, resetProbe } from "./debugProbe";

const app = {} as Application;

describe("debugProbe", () => {
	beforeEach(resetProbe);

	it("starts empty", () => {
		expect(probe).toEqual({
			scrollX: 0,
			speed: 0,
			fps: 0,
			app: null,
			assets: "",
			animation: "",
			animationTime: 0,
			commits: 0,
			presentationObjects: 0,
			failAssets: false
		});
	});

	it("publishes the world state of a frame", () => {
		publishFrame(app, 120, 250, 16);
		expect(probe).toMatchObject({ app, scrollX: 120, speed: 250 });
	});

	it("takes the first frame's rate as is, then smooths toward later ones", () => {
		publishFrame(app, 0, 0, 20);
		expect(probe.fps).toBeCloseTo(50);

		publishFrame(app, 0, 0, 10);
		// Moves a tenth of the way from 50 to 100.
		expect(probe.fps).toBeCloseTo(55);
	});

	it("ignores a frame with no elapsed time instead of reporting infinity", () => {
		publishFrame(app, 0, 0, 20);
		publishFrame(app, 5, 0, 0);
		expect(probe.fps).toBeCloseTo(50);
		expect(probe.scrollX).toBe(5);
	});

	it("counts commits", () => {
		countCommit();
		countCommit();
		expect(probe.commits).toBe(2);
	});

	it("resets everything", () => {
		publishFrame(app, 9, 9, 16);
		countCommit();
		probe.assets = "ready";
		probe.animation = "run";
		probe.animationTime = 3;

		resetProbe();

		expect(probe.app).toBeNull();
		expect(probe).toMatchObject({
			scrollX: 0,
			speed: 0,
			fps: 0,
			assets: "",
			animation: "",
			animationTime: 0,
			commits: 0,
			presentationObjects: 0,
			failAssets: false
		});
	});
});
