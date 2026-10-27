import type { DecisionPoint } from "@/types/decision";
import type { RoundRecord } from "@/types/round";

import { initialLocal, type LocalProgress } from "./roundMachine";

export const buildLocal = (over: Partial<LocalProgress> = {}): LocalProgress => ({ ...initialLocal, ...over });

export const buildDecision = (type: DecisionPoint["type"] = "upgrade"): DecisionPoint => ({
	id: "d1",
	type,
	options: [],
	timeoutPolicy: "pause",
	outcomeEffect: "presentation_only"
});

export const buildRound = (over: Partial<RoundRecord> = {}): RoundRecord => ({
	roundId: "r1",
	wagerMinorUnits: 100,
	currency: "EUR",
	outcomePolicy: { type: "fixed", outcomeId: "o1", payoutMinorUnits: 0 },
	eventPlanId: "plan_loss",
	status: "running",
	createdAt: "2026-01-01T00:00:00.000Z",
	pendingDecision: null,
	decisions: [],
	outcome: null,
	settlement: null,
	...over
});
