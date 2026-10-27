import { GAME_ASSETS } from "./manifest";
import { LAYERS, RUN_SPEED } from "./world";

describe("world", () => {
	it("moves the ground exactly at run speed and the other layers slower, far to near", () => {
		const factors = LAYERS.map(layer => layer.factor);
		expect(factors.at(-1)).toBe(1);
		expect(factors).toEqual([...factors].sort((a, b) => a - b));
		expect(RUN_SPEED).toBeGreaterThan(0);
	});

	it("has a manifest entry for every layer", () => {
		const aliases = GAME_ASSETS.map(asset => asset.alias);
		for (const { alias } of LAYERS) expect(aliases).toContain(alias);
	});
});
