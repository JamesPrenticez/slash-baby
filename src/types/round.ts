import type { DecisionPoint, PlayerDecision } from "./decision.ts";

export type OutcomeCategory = "loss" | "small_win" | "standard_win" | "big_win" | "major_win" | "jackpot";
export type RoundStatus = "accepted" | "running" | "awaiting_choice" | "resolved" | "settled";

/** Grows with the phase that adds a plan. Edit here first. The client's map is Record<EventPlanId, PresentationPlan>. */
export type EventPlanId =
	| "plan_loss"
	| "plan_small_win"
	| "plan_standard_win"
	| "plan_big_win"
	| "plan_major_win"
	| "plan_jackpot"
	// Rounds with decision points get their own ids (contract section 12).
	| "plan_small_win_weapon"
	| "plan_loss_evolution"
	| "plan_big_win_weapon_evolution"
	| "plan_choice_route";

/** Finale selected by outcome_reveal. Per the §7.2 naming rule: VictoryFinisher, DefeatSequence, JackpotCelebration. */
export type FinaleId = "defeat" | "victory" | "jackpot";

export type OutcomePolicy =
	| { type: "fixed"; outcomeId: string; payoutMinorUnits: number }
	| { type: "choice_constrained"; policyId: string; permittedChoices: string[]; resolutionRef: string };

export type ResolvedOutcome = {
	roundId: string;
	outcomeId: string;
	category: OutcomeCategory; // addition to §4.4
	payoutMinorUnits: number;
	presentationId: FinaleId;
	resolutionVersion: string;
};

export type SettlementRecord = {
	roundId: string;
	wagerMinorUnits: number;
	payoutMinorUnits: number;
	currency: string;
	settlementId: string;
	settledAt: string; // addition
};

export type RoundRecord = {
	roundId: string;
	wagerMinorUnits: number;
	currency: string;
	outcomePolicy: OutcomePolicy;
	eventPlanId: EventPlanId;
	status: RoundStatus;
	// additions to §4.4, so one record is enough to resume or replay:
	createdAt: string;
	pendingDecision: DecisionPoint | null; // set iff status === "awaiting_choice"
	decisions: PlayerDecision[];
	outcome: ResolvedOutcome | null; // set from "resolved"
	settlement: SettlementRecord | null; // set iff "settled"
};

export type HistoryEntry = {
	roundId: string;
	createdAt: string;
	settledAt: string;
	wagerMinorUnits: number;
	payoutMinorUnits: number;
	currency: string;
	category: OutcomeCategory;
};
