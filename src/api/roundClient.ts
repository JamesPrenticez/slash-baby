import type {
	BalanceResponse,
	CurrentResponse,
	HistoryResponse,
	PlayMessage,
	PlayRequest,
	PlayResponse,
	RoundResponse
} from "@/types/api";
import type { PlayerDecision } from "@/types/decision";

import { authedRequest } from "./http";

// The only place that builds the `{ idempotencyKey, message: { <verb>: ... } }` envelope (contract §4).
const play = (idempotencyKey: string, message: PlayMessage) =>
	authedRequest<PlayResponse>("POST", "/game/play", { idempotencyKey, message } satisfies PlayRequest);

/** Debits the wager and opens a round. Make one `idempotencyKey` per bet click and reuse it on every retry. */
export const startRound = (wagerMinorUnits: number, idempotencyKey: string) =>
	play(idempotencyKey, { start: { wagerMinorUnits } });

/** Records one decision. `sequenceNumber` is 1-based: `decisions.length + 1`. */
export const decide = ({ roundId, decisionId, optionId, sequenceNumber }: PlayerDecision, idempotencyKey: string) =>
	play(idempotencyKey, { decide: { roundId, decisionId, optionId, sequenceNumber } });

/** Credits the payout of a resolved round, once. Safe to resend with the same key or any other. */
export const settle = (roundId: string, idempotencyKey: string) => play(idempotencyKey, { settle: { roundId } });

export const getBalance = () => authedRequest<BalanceResponse>("GET", "/game/balance");

/** Resume: the balance plus the open round in whatever status it is in. Never changes state. */
export const getCurrent = () => authedRequest<CurrentResponse>("POST", "/game/current", {});

export const getRound = (roundId: string) =>
	authedRequest<RoundResponse>("GET", `/game/round/${encodeURIComponent(roundId)}`);

/** Settled rounds, newest first. The server clamps `limit` to 1..50. */
export const getHistory = (limit = 10, offset = 0) =>
	authedRequest<HistoryResponse>("GET", `/game/history?limit=${limit}&offset=${offset}`);
