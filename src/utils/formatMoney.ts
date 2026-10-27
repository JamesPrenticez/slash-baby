const symbolOf = (currency: string) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency })
		.formatToParts(0)
		.filter(part => part.type === "currency")
		.map(part => part.value)
		.join("");

/**
 * Formats integer minor units as money using integer arithmetic only, never `minor / 100`.
 * @param minor - Amount in minor units, a safe integer (negative allowed).
 * @param exponent - Decimal places of the currency (0 for JPY, 2 for USD, 3 for KWD).
 * @param currency - ISO 4217 code, used for the symbol only.
 * @returns For example `$1,000.05`, `¥1,500`, `$0.005`.
 * @throws RangeError when `minor` is not a safe integer or `exponent` is not a small non-negative integer.
 */
export function formatMoney(minor: number, exponent: number, currency: string): string {
	if (!Number.isSafeInteger(minor)) throw new RangeError(`formatMoney: ${minor} is not a safe integer`);
	if (!Number.isInteger(exponent) || exponent < 0 || exponent > 6) {
		throw new RangeError(`formatMoney: invalid exponent ${exponent}`);
	}

	const scale = 10 ** exponent;
	const abs = Math.abs(minor);
	const fraction = abs % scale;
	const whole = (abs - fraction) / scale;

	const decimals = exponent > 0 ? `.${String(fraction).padStart(exponent, "0")}` : "";
	return `${minor < 0 ? "-" : ""}${symbolOf(currency)}${whole.toLocaleString("en-US")}${decimals}`;
}
