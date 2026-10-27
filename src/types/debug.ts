import type { EventPlanId, OutcomeCategory, OutcomePolicy, RoundRecord, RoundStatus } from "./round.ts";

export type DebugForce = {
	fixtureId: string | null;
	category: OutcomeCategory | null;
	policy: OutcomePolicy["type"] | null;
	sticky: boolean;
};

export type DebugSimulation = {
	latencyMs: number;
	errorRate: number;
	failNext: { count: number; status: number; verb?: "start" | "decide" | "settle" } | null;
	dropAfterAccept: number;
	resolveDelayMs: number;
};

export type DebugFixtureInfo = {
	fixtureId: string;
	category: OutcomeCategory;
	policy: OutcomePolicy["type"];
	eventPlanId: EventPlanId;
	decisionPointIds: string[];
};

export type DebugState = {
	mock: true;
	contractVersion: string;
	playerId: string;
	seed: string;
	roundsPlayed: number;
	force: DebugForce | null;
	simulation: DebugSimulation;
	fixtures: DebugFixtureInfo[];
	currencies: { code: string; minorUnitExponent: number }[];
};

/** GET /api/debug/round/:roundId. `round` is the same record GET /api/game/round/:roundId returns. */
export type DebugRoundResponse = { round: RoundRecord; debug: DebugRoundInfo };

export type DebugRoundInfo = {
	fixtureId: string;
	/** The force in effect when the round started (a copy), or null when the round was drawn from the seed. */
	forced: DebugForce | null;
	/** The player's seed when the round started. */
	seed: string;
	/** 0-based, see the determinism rule in section 10. `draw(seed, roundIndex)` reproduces an unforced round. */
	roundIndex: number;
	/** Oldest first. The first entry is the status at creation. `at` is when the server recorded the change (ISO 8601 UTC). */
	statusHistory: { status: RoundStatus; at: string }[];
	/** Each key first processed for this round, in first-use order. A replay of a key is not listed again. */
	idempotencyKeys: { verb: "start" | "decide" | "settle"; key: string; at: string }[];
};
