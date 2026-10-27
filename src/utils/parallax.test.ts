import { advanceScroll, easeSpeed, groundSpeed, layerOffset, logicalWidth } from "./parallax";

describe("advanceScroll", () => {
	it("moves by speed × elapsed time", () => {
		expect(advanceScroll(100, 200, 500)).toBe(200);
	});

	it("covers the same distance at 30fps and 60fps", () => {
		let at30 = 0;
		let at60 = 0;
		for (let i = 0; i < 30; i++) at30 = advanceScroll(at30, 300, 1000 / 30);
		for (let i = 0; i < 60; i++) at60 = advanceScroll(at60, 300, 1000 / 60);
		expect(at30).toBeCloseTo(300);
		expect(at60).toBeCloseTo(300);
	});

	it("scales with playback speed", () => {
		expect(advanceScroll(0, 100, 1000, 2)).toBe(200);
	});
});

describe("layerOffset", () => {
	it("is −scrollX × factor", () => {
		expect(layerOffset(400, 0.25, 1000)).toBe(-100);
	});

	it("never moves a factor-0 layer", () => {
		expect(layerOffset(12345, 0, 1000)).toBe(0);
	});

	it("wraps at the tile width", () => {
		expect(layerOffset(1250, 1, 1000)).toBeCloseTo(-250);
		expect(layerOffset(2000, 1, 1000)).toBe(0);
	});

	it("moves the ground exactly as far as the scroll", () => {
		expect(layerOffset(300, 1, 1000)).toBe(-300);
	});
});

describe("groundSpeed", () => {
	it("is stride ÷ cycle", () => {
		expect(groundSpeed(300, 0.5, 1)).toBe(600);
	});

	it("is monotonic in timeScale", () => {
		const speeds = [0.5, 1, 1.5, 2].map(t => groundSpeed(300, 0.67, t));
		expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
	});
});

describe("easeSpeed", () => {
	it("approaches the target without overshooting", () => {
		let speed = 0;
		for (let i = 0; i < 20; i++) {
			speed = easeSpeed(speed, 300, 16, 150);
			expect(speed).toBeLessThanOrEqual(300);
		}
		expect(speed).toBeGreaterThan(200);
	});

	it("settles at the target instead of creeping forever", () => {
		expect(easeSpeed(0.1, 0, 16, 150)).toBe(0);
	});

	it("takes the same time at 30fps and 60fps", () => {
		let at30 = 0;
		let at60 = 0;
		for (let i = 0; i < 15; i++) at30 = easeSpeed(at30, 300, 1000 / 30, 150);
		for (let i = 0; i < 30; i++) at60 = easeSpeed(at60, 300, 1000 / 60, 150);
		expect(at30).toBeCloseTo(at60);
	});
});

describe("logicalWidth", () => {
	it("keeps the world height fixed and lets the width flex", () => {
		expect(logicalWidth(800, 400, 400)).toBe(800);
		expect(logicalWidth(800, 800, 400)).toBe(400);
	});
});
