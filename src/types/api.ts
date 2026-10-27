import type { HistoryEntry, RoundRecord } from "./round.ts";

export type GameConfig = {
	mock: true;
	contractVersion: string;
	currency: string;
	minorUnitExponent: number;
	minWagerMinorUnits: number;
	maxWagerMinorUnits: number;
	defaultWagerMinorUnits: number;
	wagerStepsMinorUnits: number[];
};

export type SessionResponse = {
	sessionToken: string;
	playerId: string;
	balanceMinorUnits: number;
	config: GameConfig;
};

export type PlayMessage =
	| { start: { wagerMinorUnits: number } }
	| { decide: { roundId: string; decisionId: string; optionId: string; sequenceNumber: number } }
	| { settle: { roundId: string } };

export type PlayRequest = { idempotencyKey: string; message: PlayMessage };
export type PlayResponse = {
	roundId: string;
	message: { round: RoundRecord; balanceMinorUnits: number; replayed?: true };
};

export type BalanceResponse = { balanceMinorUnits: number; currency: string };
export type CurrentResponse = BalanceResponse & ({ active: false } | { active: true; round: RoundRecord });
export type RoundResponse = { round: RoundRecord };
export type HistoryResponse = { rounds: HistoryEntry[]; total: number };

export type ApiErrorCode =
	| "invalid_json"
	| "invalid_request"
	| "invalid_message"
	| "invalid_bet"
	| "invalid_option"
	| "invalid_currency"
	| "invalid_debug_request"
	| "invalid_session"
	| "insufficient_balance"
	| "round_not_found"
	| "not_found"
	| "round_already_started"
	| "round_not_awaiting_choice"
	| "stale_decision"
	| "decision_already_recorded"
	| "round_not_resolved"
	| "idempotency_key_reused"
	| "server_error"
	| "simulated_error";
export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };
