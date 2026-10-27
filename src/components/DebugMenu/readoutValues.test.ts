import type { Application } from "pixi.js";

import { type Probe } from "@/utils/debugProbe";

import { READOUTS, readoutValues } from "./readoutValues";

const probe = (overrides: Partial<Probe> = {}): Probe => ({
	scrollX: 0,
	speed: 0,
	fps: 0,
	app: null,
	assets: "",
	animation: "",
	animationTime: 0,
	commits: 0,
	presentationObjects: 0,
	failAssets: false,
	...overrides
});

const dom = { canvases: 1, sharedTickerListeners: 1 };

describe("readoutValues", () => {
	it("has a value for every readout row", () => {
		expect(Object.keys(readoutValues(probe(), dom)).sort()).toEqual(READOUTS.map(row => row.key).sort());
	});

	it("shows a dash for anything not published yet", () => {
		expect(readoutValues(probe(), dom)).toMatchObject({
			fps: "—",
			tickerListeners: "—",
			assets: "—",
			animation: "—"
		});
	});

	it.each([
		["scrollX", { scrollX: 1234.56 }, "1235"],
		["speed", { speed: 253.7 }, "254"],
		["fps", { fps: 59.6 }, "60"],
		["assets", { assets: "ready" }, "ready"],
		["animation", { animation: "death" }, "death"],
		["animationTime", { animationTime: 1.23456 }, "1.23"],
		["animationTime", { animationTime: 0 }, "0"],
		["commits", { commits: 7 }, "7"],
		["presentationObjects", { presentationObjects: 3 }, "3"]
	] as const)("formats %s", (key, overrides, expected) => {
		expect(readoutValues(probe(overrides), dom)[key]).toBe(expected);
	});

	it("reads the DOM counts it is given", () => {
		expect(readoutValues(probe(), { canvases: 2, sharedTickerListeners: 5 })).toMatchObject({
			canvases: "2",
			sharedTickerListeners: "5"
		});
	});

	it("counts the listeners of the live application's ticker", () => {
		const app = { ticker: { count: 4 } } as unknown as Application;
		expect(readoutValues(probe({ app }), dom).tickerListeners).toBe("4");
	});

	it("shows a dash for an application that has been destroyed", () => {
		const destroyed = { ticker: null } as unknown as Application;
		expect(readoutValues(probe({ app: destroyed }), dom).tickerListeners).toBe("—");
	});
});
