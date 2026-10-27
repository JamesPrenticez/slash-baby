// Payout and outcome building (contract §4). Integer arithmetic only: no floats, no decimal parsing.

import { RESOLUTION_TABLES, TABLE_CATEGORIES } from "./decisions.ts";
import type { Fixture } from "./fixtures.ts";
import { checkedMul } from "./money.ts";
import { byteStream, rollWeighted } from "./rng.ts";
import type { PlayerDecision } from "../../src/types/decision.ts";
import type { FinaleId, OutcomeCategory, OutcomePolicy, ResolvedOutcome } from "../../src/types/round.ts";

export const RESOLUTION_VERSION = "mock-1";

const BPS = 10_000;

const FINALE: Record<OutcomeCategory, FinaleId> = {
	loss: "defeat",
	small_win: "victory",
	standard_win: "victory",
	big_win: "victory",
	major_win: "victory",
	jackpot: "jackpot"
};

/**
 * floor(wager * multiplierBps / 10_000). The product is guarded by `Number.isSafeInteger`; the division is exact
 * integer subtraction rather than a float divide, so it cannot round up across a whole unit.
 */
export function payoutFor(wagerMinorUnits: number, multiplierBps: number): number {
	const product = checkedMul(wagerMinorUnits, multiplierBps);
	return (product - (product % BPS)) / BPS;
}

/** The Policy A policy and the resolved outcome of a fixture for this wager. Same fixture and wager, same payout. */
export function resolveFixed(
	roundId: string,
	fixture: Fixture,
	wagerMinorUnits: number
): { outcomePolicy: OutcomePolicy; outcome: ResolvedOutcome } {
	const payoutMinorUnits = payoutFor(wagerMinorUnits, fixture.multiplierBps);
	return {
		outcomePolicy: { type: "fixed", outcomeId: fixture.outcomeId, payoutMinorUnits },
		outcome: {
			roundId,
			outcomeId: fixture.outcomeId,
			category: fixture.category,
			payoutMinorUnits,
			presentationId: FINALE[fixture.category],
			resolutionVersion: RESOLUTION_VERSION
		}
	};
}

/** Placeholder multipliers (basis points) a Policy B round pays, by the category its last decision resolves to. */
const CATEGORY_BPS: Record<OutcomeCategory, number> = {
	loss: 0,
	small_win: 12_000,
	standard_win: 20_000,
	big_win: 50_000,
	major_win: 250_000,
	jackpot: 1_000_000
};

export const RESOLUTION_REF = "mock-table-1";

const authoritativeOf = (fixture: Fixture) =>
	fixture.decisions.find(d => d.outcomeEffect === "authoritative_resolution");

/** The policy a round starts with: fixed for Policy A, the permitted choices and table reference for Policy B. */
export function policyOf(roundId: string, fixture: Fixture, wagerMinorUnits: number): OutcomePolicy {
	if (fixture.policy === "fixed") return resolveFixed(roundId, fixture, wagerMinorUnits).outcomePolicy;
	return {
		type: "choice_constrained",
		policyId: `${fixture.fixtureId}_policy`,
		permittedChoices: authoritativeOf(fixture)?.options.map(o => o.id) ?? [],
		resolutionRef: RESOLUTION_REF
	};
}

/**
 * Resolves a Policy B round once its authoritative decision is recorded. The category is `forcedCategory` when a debug
 * force set one (whatever option was chosen), otherwise a weighted draw from the chosen option's table. The draw is a
 * pure function of (seed, roundIndex, chosen option), so the same seed and decisions give the same outcome.
 */
export function resolveChoice(
	roundId: string,
	fixture: Fixture,
	wagerMinorUnits: number,
	decisions: PlayerDecision[],
	seed: string,
	roundIndex: number,
	forcedCategory: OutcomeCategory | null
): ResolvedOutcome {
	const point = authoritativeOf(fixture);
	const chosen = decisions.find(d => d.decisionId === point?.id);
	const ruleId = point?.options.find(o => o.id === chosen?.optionId)?.resolutionRuleId;
	const weights = ruleId && RESOLUTION_TABLES[ruleId];
	if (!weights) throw new Error(`No resolution table for ${fixture.fixtureId}`);
	const category = forcedCategory ?? TABLE_CATEGORIES[rollWeighted(byteStream(seed, "resolve", roundIndex), weights)];
	return {
		roundId,
		outcomeId: `${fixture.fixtureId}_${category}`,
		category,
		payoutMinorUnits: payoutFor(wagerMinorUnits, CATEGORY_BPS[category]),
		presentationId: FINALE[category],
		resolutionVersion: RESOLUTION_VERSION
	};
}
