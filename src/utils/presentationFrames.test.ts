import {
	COIN_POOL,
	coinCount,
	coinFrame,
	countDescendants,
	eventProgress,
	monsterFrame,
	rampFactor,
	waveAssassinPose
} from "./presentationFrames";

describe("eventProgress and rampFactor", () => {
	it("clamps progress and treats a zero-length event as done", () => {
		expect(eventProgress(500, 1000)).toBe(0.5);
		expect(eventProgress(2000, 1000)).toBe(1);
		expect(eventProgress(-5, 1000)).toBe(0);
		expect(eventProgress(0, 0)).toBe(1);
	});

	it("eases from 0 to 1 and is monotonic", () => {
		expect(rampFactor(0)).toBe(0);
		expect(rampFactor(1)).toBe(1);
		expect(rampFactor(0.5)).toBe(0.5);
		expect(rampFactor(0.25)).toBeLessThan(rampFactor(0.75));
		expect(rampFactor(3)).toBe(1);
	});
});

describe("coinCount", () => {
	it("scales with intensity within the pool", () => {
		expect(coinCount(1)).toBe(8);
		expect(coinCount(0)).toBe(1);
		expect(coinCount(100)).toBe(COIN_POOL);
		expect(coinCount(Number.NaN)).toBe(8);
	});
});

describe("coinFrame", () => {
	const base = { count: 4, durationMs: 2000, startX: 800, endX: 100, baseY: 300 };

	it("is hidden before its spawn and after landing", () => {
		expect(coinFrame({ ...base, index: 1, elapsedMs: 0 }).visible).toBe(false);
		expect(coinFrame({ ...base, index: 0, elapsedMs: 900 }).visible).toBe(false);
	});

	it("flies from start to end, rising mid-flight", () => {
		const first = coinFrame({ ...base, index: 0, elapsedMs: 0 });
		expect(first).toEqual({ visible: true, x: 800, y: 300 });
		const mid = coinFrame({ ...base, index: 0, elapsedMs: 450 });
		expect(mid.x).toBe(450);
		expect(mid.y).toBeLessThan(300);
	});

	it("lands the last coin as the event ends, and shows none after", () => {
		expect(coinFrame({ ...base, index: 3, elapsedMs: 1999 }).visible).toBe(true);
		expect(coinFrame({ ...base, index: 3, elapsedMs: 2000 }).visible).toBe(false);
	});

	it("hides pool slots beyond the count", () => {
		expect(coinFrame({ ...base, index: 9, elapsedMs: 1000 }).visible).toBe(false);
	});

	it("copes with a single coin and a zero duration", () => {
		expect(coinFrame({ ...base, count: 1, index: 0, elapsedMs: 0 }).visible).toBe(true);
		expect(coinFrame({ ...base, durationMs: 0, index: 0, elapsedMs: 0 }).visible).toBe(false);
	});
});

describe("monsterFrame", () => {
	it("walks in, stands, then is struck and fades", () => {
		expect(monsterFrame(0, 0, 900, 400)).toEqual({ x: 900, alpha: 1, hit: false });
		expect(monsterFrame(0.2, 0, 900, 400).x).toBe(650);
		expect(monsterFrame(0.5, 0, 900, 400)).toEqual({ x: 400, alpha: 1, hit: false });
		const struck = monsterFrame(0.8, 0, 900, 400);
		expect(struck.hit).toBe(true);
		expect(struck.alpha).toBeCloseTo(0.5);
		expect(monsterFrame(1, 0, 900, 400).alpha).toBe(0);
	});

	it("spaces later monsters behind the first", () => {
		expect(monsterFrame(0.5, 1, 900, 400).x).toBeGreaterThan(monsterFrame(0.5, 0, 900, 400).x);
	});

	it("has the assassin attack once they arrive", () => {
		expect(waveAssassinPose(0.1)).toBe("idle");
		expect(waveAssassinPose(0.4)).toBe("attack");
	});
});

describe("countDescendants", () => {
	it("counts every nested child but not the root", () => {
		const tree = { children: [{ children: [{}, {}] }, {}] };
		expect(countDescendants(tree)).toBe(4);
		expect(countDescendants({})).toBe(0);
		expect(countDescendants(null)).toBe(0);
	});
});
