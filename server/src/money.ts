// Money is integer minor units everywhere (contract §0). There is no decimal parsing or formatting in the server:
// these guards are the whole money toolkit, and an unsafe result throws instead of silently losing precision.

/** A non-negative integer that JavaScript represents exactly. */
export const isMinorUnits = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

function checked(result: number, what: string): number {
	if (!Number.isSafeInteger(result)) throw new RangeError(`${what} is not a safe integer`);
	return result;
}

export const checkedAdd = (a: number, b: number) => checked(a + b, `${a} + ${b}`);

export const checkedMul = (a: number, b: number) => checked(a * b, `${a} * ${b}`);
