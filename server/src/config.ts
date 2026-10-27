// MOCK game server configuration. Env-driven with dev-safe defaults, so it runs with zero setup.
// Everything under "PLACEHOLDERS" is a stand-in for BUILD-PLAN §18 #6 (contract §11), not a product decision.

const int = (value: string | undefined, fallback: number) => {
	const n = Number(value);
	return value !== undefined && value !== "" && Number.isInteger(n) && n >= 0 ? n : fallback;
};

const production = process.env.NODE_ENV === "production";

export const config = {
	mock: true as const,
	contractVersion: "0.2",
	/** 0 asks the OS for a free port (the entry test does this). */
	port: int(process.env.SERVER_PORT, 3001),
	/** All interfaces, so a phone on the LAN can reach the dev server. */
	host: process.env.SERVER_HOST ?? "0.0.0.0",
	/** /api/debug/* answers 404 not_found when false. Read per request, so tests can flip it. */
	debugRoutes: !production,
	logRequests: !production,

	// PLACEHOLDERS
	sessionTtlMs: 60 * 60 * 1000,
	defaultCurrency: "USD",
	currencies: [
		{ code: "USD", minorUnitExponent: 2 },
		{ code: "EUR", minorUnitExponent: 2 },
		{ code: "GBP", minorUnitExponent: 2 },
		{ code: "JPY", minorUnitExponent: 0 }
	],
	startingBalanceMinorUnits: 100_000,
	minWagerMinorUnits: 10,
	maxWagerMinorUnits: 50_000,
	defaultWagerMinorUnits: 100,
	wagerStepsMinorUnits: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 50_000],
	/** PRNG seed a player gets until /api/debug/seed changes it. */
	defaultSeed: "slash-baby-mock"
};
