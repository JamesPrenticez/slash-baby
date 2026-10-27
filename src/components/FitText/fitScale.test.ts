import { fitScale } from "./fitScale";

describe("fitScale", () => {
	it.each([
		{ name: "text narrower than its box stays at 1", available: 200, natural: 100, scale: 1 },
		{ name: "exact fit stays at 1", available: 100, natural: 100, scale: 1 },
		{ name: "text wider than its box shrinks to fit", available: 100, natural: 200, scale: 0.5 },
		{ name: "much wider text shrinks a long way", available: 50, natural: 400, scale: 0.125 },
		{ name: "a huge box never scales above 1", available: 1e9, natural: 1, scale: 1 },
		{ name: "no room (hidden) is left at 1", available: 0, natural: 100, scale: 1 },
		{ name: "negative room (padding wider than box) is left at 1", available: -4, natural: 100, scale: 1 },
		{ name: "no text yet is left at 1", available: 100, natural: 0, scale: 1 },
		{ name: "NaN is left at 1", available: Number.NaN, natural: 100, scale: 1 },
		{ name: "infinite text is left at 1, not 0", available: 100, natural: Number.POSITIVE_INFINITY, scale: 1 }
	])("$name", ({ available, natural, scale }) => {
		expect(fitScale(available, natural)).toBe(scale);
	});
});
