// Decision points and Policy B resolution tables (BUILD-PLAN §5, §6, §12 Phase 5; contract §4, §6).
// PLACEHOLDERS: the copy, options and weights below stand in for game maths that does not exist yet (BUILD-PLAN §18 #6).
// Timeout policy is `pause` for all of them (decision U-3): the round waits, nothing is auto-picked.

import type { DecisionPoint } from "../../src/types/decision.ts";
import type { OutcomeCategory } from "../../src/types/round.ts";

/** Twin Daggers vs Shadow Blades. Visual only: the options share one rule that cannot touch money. */
export const WEAPON_CHOICE: DecisionPoint = {
	id: "weapon_choice",
	type: "upgrade",
	timeoutPolicy: "pause",
	outcomeEffect: "presentation_only",
	options: [
		{
			id: "twin_daggers",
			title: "Twin Daggers",
			description: "A second blade materialises. Visual only: it does not change your payout.",
			visualTheme: "twin_daggers",
			resolutionRuleId: "presentation_only"
		},
		{
			id: "shadow_blades",
			title: "Shadow Blades",
			description: "Spectral daggers orbit the assassin. Visual only: it does not change your payout.",
			visualTheme: "shadow_blades",
			resolutionRuleId: "presentation_only"
		}
	]
};

/** The one optional weapon evolution (decision U-10). Declining is a normal option, not a skip button. */
export const WEAPON_EVOLUTION: DecisionPoint = {
	id: "weapon_evolution",
	type: "risk_reward",
	timeoutPolicy: "pause",
	outcomeEffect: "presentation_only",
	options: [
		{
			id: "evolve",
			title: "Evolve",
			description: "The weapon transforms for the rest of the run. Visual only: it does not change your payout.",
			visualTheme: "evolved_weapon",
			resolutionRuleId: "presentation_only"
		},
		{
			id: "keep",
			title: "Keep",
			description: "Carry on with the current weapon. Your payout is the same either way.",
			visualTheme: "current_weapon",
			resolutionRuleId: "presentation_only"
		}
	]
};

/** Safe treasure route vs riskier vault. Policy B: the chosen option's table resolves the round. */
export const ROUTE_CHOICE: DecisionPoint = {
	id: "route_choice",
	type: "risk_reward",
	timeoutPolicy: "pause",
	outcomeEffect: "authoritative_resolution",
	options: [
		{
			id: "safe_route",
			title: "Safe route",
			description: "A modest, predictable treasure. Fewer losses, smaller wins.",
			visualTheme: "safe_route",
			resolutionRuleId: "vault_safe_table"
		},
		{
			id: "risky_vault",
			title: "Riskier vault",
			description: "Higher variance. More losses, but the biggest wins are only here.",
			visualTheme: "risky_vault",
			resolutionRuleId: "vault_risky_table"
		}
	]
};

/** Category order of every table below. */
export const TABLE_CATEGORIES: OutcomeCategory[] = [
	"loss",
	"small_win",
	"standard_win",
	"big_win",
	"major_win",
	"jackpot"
];

/** Integer weights per category, in `TABLE_CATEGORIES` order, keyed by `resolutionRuleId`. */
export const RESOLUTION_TABLES: Record<string, number[]> = {
	vault_safe_table: [10, 50, 40, 0, 0, 0],
	vault_risky_table: [50, 10, 10, 15, 10, 5]
};
