// Run: pnpm test:server
// Payout arithmetic and outcome building (contract §4): integer only, floor rounding, safe-integer guard.

import assert from "node:assert/strict";
import { test } from "node:test";

import { FIXTURES } from "./fixtures.ts";
import { payoutFor, RESOLUTION_VERSION, resolveChoice, resolveFixed } from "./outcomes.ts";
import type { OutcomeCategory } from "../../src/types/round.ts";

test("payoutFor is floor(wager * bps / 10000), exactly, in integers", () => {
	const table: [wager: number, bps: number, payout: number][] = [
		[100, 0, 0],
		[100, 10_000, 100],
		[100, 12_000, 120],
		[101, 12_000, 121], // 121.2 floors
		[1, 9_999, 0], // 0.9999 floors
		[3, 15_000, 4], // 4.5 floors
		[10, 1, 0],
		[50_000, 5_000_000, 25_000_000], // jackpot at the maximum wager
		[333, 33_333, 1_109] // 1109.98... floors, never rounds up
	];
	for (const [wager, bps, payout] of table) assert.equal(payoutFor(wager, bps), payout, `${wager} x ${bps}`);
});

test("payoutFor throws instead of returning an imprecise number", () => {
	assert.throws(() => payoutFor(Number.MAX_SAFE_INTEGER, 10_000), RangeError);
	assert.throws(() => payoutFor(2 ** 40, 2 ** 20), RangeError);
});

test("payoutFor stays exact for the largest safe products", () => {
	// Products just under 2^53: a float division could round up across a whole unit here, integer subtraction cannot.
	assert.equal(payoutFor(900_719_925_474, 9_999), 900_629_853_481, "floor of 900719925474 * 9999 / 10000");
	assert.equal(payoutFor(9_007_199_254_740, 1_000), 900_719_925_474, "product 9007199254740000 is still safe");
});

test("resolveFixed builds a fixed policy and the resolved outcome from one payout", () => {
	const fixture = FIXTURES.find(f => f.category === "big_win")!;
	const { outcomePolicy, outcome } = resolveFixed("round-1", fixture, 250);
	const payout = payoutFor(250, fixture.multiplierBps);
	assert.deepEqual(outcomePolicy, { type: "fixed", outcomeId: fixture.outcomeId, payoutMinorUnits: payout });
	assert.deepEqual(outcome, {
		roundId: "round-1",
		outcomeId: fixture.outcomeId,
		category: "big_win",
		payoutMinorUnits: payout,
		presentationId: "victory",
		resolutionVersion: RESOLUTION_VERSION
	});
});

test("the finale follows the category: defeat, victory, jackpot", () => {
	const finale = (category: string) =>
		resolveFixed(
			"r",
			FIXTURES.find(f => f.category === category)!,
			100
		).outcome.presentationId;
	assert.equal(finale("loss"), "defeat");
	for (const win of ["small_win", "standard_win", "big_win", "major_win"]) assert.equal(finale(win), "victory", win);
	assert.equal(finale("jackpot"), "jackpot");
});

test("resolveChoice: each option draws from its own table, reproducibly, and a forced category overrides it", () => {
	const vault = FIXTURES.find(f => f.fixtureId === "vault_route")!;
	const resolve = (optionId: string, seed: string, forced: OutcomeCategory | null = null) =>
		resolveChoice(
			"r",
			vault,
			1000,
			[{ roundId: "r", decisionId: "route_choice", optionId, sequenceNumber: 1 }],
			seed,
			0,
			forced
		);
	const seen = { safe_route: new Set<string>(), risky_vault: new Set<string>() };
	for (let i = 0; i < 600; i++) {
		for (const optionId of ["safe_route", "risky_vault"] as const) {
			const outcome = resolve(optionId, `seed-${i}`);
			assert.deepEqual(outcome, resolve(optionId, `seed-${i}`), "same seed and decisions, same outcome");
			assert.equal(
				outcome.payoutMinorUnits,
				payoutFor(
					1000,
					{ loss: 0, small_win: 12_000, standard_win: 20_000, big_win: 50_000, major_win: 250_000, jackpot: 1_000_000 }[
						outcome.category
					]
				)
			);
			seen[optionId].add(outcome.category);
		}
	}
	assert.deepEqual([...seen.safe_route].sort(), ["loss", "small_win", "standard_win"], "weight 0 means never");
	assert.equal(seen.risky_vault.size, 6, "the risky table reaches every category");
	assert.equal(resolve("safe_route", "x", "jackpot").category, "jackpot");
	assert.equal(resolve("risky_vault", "x", "loss").payoutMinorUnits, 0);
	assert.throws(() => resolveChoice("r", vault, 1000, [], "x", 0, null));
});
