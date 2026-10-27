// Outcome fixtures (BUILD-PLAN §4.3, contract §10 and §11). Each round is one fixture, picked by the seeded draw or by a
// debug force. Most are Policy A (the payout is fixed at start); the last four carry decision points (W3-B5).
// PLACEHOLDERS: the multipliers and category weights below stand in for BUILD-PLAN §18 #6, not a product decision.

import { ROUTE_CHOICE, WEAPON_CHOICE, WEAPON_EVOLUTION } from "./decisions.ts";
import { byteStream, rollInt, rollWeighted } from "./rng.ts";
import type { DebugFixtureInfo, DebugForce } from "../../src/types/debug.ts";
import type { DecisionPoint } from "../../src/types/decision.ts";
import type { EventPlanId, OutcomeCategory, OutcomePolicy } from "../../src/types/round.ts";

export type Fixture = {
	fixtureId: string;
	category: OutcomeCategory;
	policy: OutcomePolicy["type"];
	outcomeId: string;
	/** Payout in basis points of the wager: 10_000 pays the wager back. Integer. Unused by Policy B. */
	multiplierBps: number;
	eventPlanId: EventPlanId;
	/** In order. Empty for a round that resolves at start. */
	decisions: DecisionPoint[];
};

const fixed = (
	fixtureId: string,
	category: OutcomeCategory,
	multiplierBps: number,
	eventPlanId: EventPlanId,
	decisions: DecisionPoint[] = []
): Fixture => ({
	fixtureId,
	category,
	policy: "fixed",
	outcomeId: `${fixtureId}_outcome`,
	multiplierBps,
	eventPlanId,
	decisions
});

export const FIXTURES: Fixture[] = [
	fixed("loss_1", "loss", 0, "plan_loss"),
	fixed("loss_2", "loss", 0, "plan_loss"),
	fixed("small_win_1", "small_win", 12_000, "plan_small_win"),
	fixed("small_win_2", "small_win", 15_000, "plan_small_win"),
	fixed("standard_win_1", "standard_win", 20_000, "plan_standard_win"),
	fixed("standard_win_2", "standard_win", 30_000, "plan_standard_win"),
	fixed("big_win_1", "big_win", 50_000, "plan_big_win"),
	fixed("big_win_2", "big_win", 100_000, "plan_big_win"),
	fixed("major_win_1", "major_win", 250_000, "plan_major_win"),
	fixed("major_win_2", "major_win", 500_000, "plan_major_win"),
	fixed("jackpot_1", "jackpot", 1_000_000, "plan_jackpot"),
	fixed("jackpot_2", "jackpot", 5_000_000, "plan_jackpot"),
	// Policy A with decisions: the payout is fixed at start and no option can change it.
	fixed("dagger_choice_small", "small_win", 15_000, "plan_small_win_weapon", [WEAPON_CHOICE]),
	fixed("evolution_loss", "loss", 0, "plan_loss_evolution", [WEAPON_EVOLUTION]),
	fixed("evolution_big", "big_win", 50_000, "plan_big_win_weapon_evolution", [WEAPON_CHOICE, WEAPON_EVOLUTION]),
	// Policy B: the last decision picks the category, so `category` here is nominal and the plan names none.
	{
		fixtureId: "vault_route",
		category: "standard_win",
		policy: "choice_constrained",
		outcomeId: "vault_route_outcome",
		multiplierBps: 0,
		eventPlanId: "plan_choice_route",
		decisions: [ROUTE_CHOICE]
	}
];

/** Decision rounds are reached by `force` only until the client can play them (W7-F14); flip this to put them in the draw. */
export const DECISION_FIXTURES_IN_DRAW = false;

/** Relative chance of each category in the seeded draw, in display order. */
const CATEGORY_WEIGHTS: [OutcomeCategory, number][] = [
	["loss", 40],
	["small_win", 25],
	["standard_win", 20],
	["big_win", 10],
	["major_win", 4],
	["jackpot", 1]
];

export const CATEGORIES = CATEGORY_WEIGHTS.map(([category]) => category);

/** The fixture of an unforced round. Pure in (seed, roundIndex): a forced round never shifts what later rounds draw. */
export function draw(seed: string, roundIndex: number): Fixture {
	const stream = byteStream(seed, "outcome", roundIndex);
	const [category] =
		CATEGORY_WEIGHTS[
			rollWeighted(
				stream,
				CATEGORY_WEIGHTS.map(([, weight]) => weight)
			)
		];
	const pool = FIXTURES.filter(
		f => f.category === category && f.policy === "fixed" && (DECISION_FIXTURES_IN_DRAW || f.decisions.length === 0)
	);
	return pool[rollInt(stream, pool.length)];
}

/**
 * The fixtures a force allows: `fixtureId` alone when set. Otherwise `policy: "choice_constrained"` allows every Policy B
 * fixture (its `category` is what the last decision resolves to, so it never filters them), and anything else allows the
 * decision-free Policy A fixtures matching `category`. A fixed fixture with decisions is reached by `fixtureId`.
 */
export function forcedCandidates(force: DebugForce): Fixture[] {
	if (force.fixtureId) return FIXTURES.filter(f => f.fixtureId === force.fixtureId);
	if (force.policy === "choice_constrained") return FIXTURES.filter(f => f.policy === "choice_constrained");
	return FIXTURES.filter(
		f => f.policy === "fixed" && f.decisions.length === 0 && (!force.category || f.category === force.category)
	);
}

/** The fixture of a forced round: one of the candidates, picked by a draw keyed on (seed, roundIndex) too. */
export function drawForced(force: DebugForce, seed: string, roundIndex: number): Fixture {
	const pool = forcedCandidates(force);
	return pool[rollInt(byteStream(seed, "force", roundIndex), pool.length)];
}

export const fixtureInfo = (f: Fixture): DebugFixtureInfo => ({
	fixtureId: f.fixtureId,
	category: f.category,
	policy: f.policy,
	eventPlanId: f.eventPlanId,
	decisionPointIds: f.decisions.map(d => d.id)
});
