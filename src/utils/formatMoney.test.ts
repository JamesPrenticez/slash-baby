import { formatMoney } from "./formatMoney";

describe("formatMoney", () => {
	it.each([
		// exponent 2
		[0, 2, "USD", "$0.00"],
		[5, 2, "USD", "$0.05"],
		[99, 2, "USD", "$0.99"],
		[100, 2, "USD", "$1.00"],
		[1050, 2, "USD", "$10.50"],
		[100000, 2, "USD", "$1,000.00"],
		[123456789, 2, "EUR", "€1,234,567.89"],
		[250, 2, "GBP", "£2.50"],
		// exponent 0
		[0, 0, "JPY", "¥0"],
		[1, 0, "JPY", "¥1"],
		[1500, 0, "JPY", "¥1,500"],
		[100000, 0, "JPY", "¥100,000"],
		// exponent 3
		[0, 3, "USD", "$0.000"],
		[5, 3, "USD", "$0.005"],
		[1500, 3, "USD", "$1.500"],
		[1234567, 3, "USD", "$1,234.567"],
		// negatives
		[-5, 2, "USD", "-$0.05"],
		[-1050, 2, "USD", "-$10.50"],
		[-1500, 0, "JPY", "-¥1,500"]
	])("formats %i with exponent %i in %s as %s", (minor, exponent, currency, expected) => {
		expect(formatMoney(minor, exponent, currency)).toBe(expected);
	});

	it("stays exact at the top of the safe integer range, where minor / 100 would not", () => {
		expect(formatMoney(Number.MAX_SAFE_INTEGER, 2, "USD")).toBe("$90,071,992,547,409.91");
		expect(formatMoney(Number.MAX_SAFE_INTEGER, 0, "JPY")).toBe("¥9,007,199,254,740,991");
	});

	it("rejects anything that is not an integer amount", () => {
		expect(() => formatMoney(10.5, 2, "USD")).toThrow(RangeError);
		expect(() => formatMoney(Number.NaN, 2, "USD")).toThrow(RangeError);
		expect(() => formatMoney(Number.MAX_SAFE_INTEGER + 1, 2, "USD")).toThrow(RangeError);
	});

	it("rejects an invalid exponent", () => {
		expect(() => formatMoney(100, -1, "USD")).toThrow(RangeError);
		expect(() => formatMoney(100, 1.5, "USD")).toThrow(RangeError);
		expect(() => formatMoney(100, 7, "USD")).toThrow(RangeError);
	});
});
