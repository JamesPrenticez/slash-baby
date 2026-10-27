// In-memory round store and the start and settle rules (contract §4, §6). Wiped on restart.
// Keyed by playerId, not session: a token refresh or a new session must not orphan an open round. At most one open
// (not settled) round per player. Handlers run synchronously, so there is no await between reading and writing the
// wallet or a round: validate everything first, then mutate, and a failure part-way cannot leave a half-applied start.

import { randomUUID } from "node:crypto";

import { config } from "./config.ts";
import { debugRecord } from "./debug-state.ts";
import { draw, drawForced, type Fixture } from "./fixtures.ts";
import { HttpError } from "./http.ts";
import { checkedAdd, isMinorUnits } from "./money.ts";
import { policyOf, resolveChoice, resolveFixed } from "./outcomes.ts";
import { type Player, setOpenRoundGuard } from "./sessions.ts";
import type { DebugRoundInfo, DebugRoundResponse } from "../../src/types/debug.ts";
import type { HistoryEntry, RoundRecord, RoundStatus } from "../../src/types/round.ts";

export type Verb = DebugRoundInfo["idempotencyKeys"][number]["verb"];

/** The wire record plus the mock internals `GET /api/debug/round/:roundId` exposes (already in wire shape). */
export type Entry = {
	playerId: string;
	record: RoundRecord;
	debug: DebugRoundInfo;
	fixture: Fixture;
	/** When the last decision of a Policy B round was recorded under a debug `resolveDelayMs`; null otherwise. */
	heldSince: number | null;
};

const entries = new Map<string, Entry>();
const openByPlayer = new Map<string, string>();

setOpenRoundGuard(playerId => {
	if (openByPlayer.has(playerId)) {
		throw new HttpError(409, "round_already_started", "Settle the open round before switching currency");
	}
});

const logKey = (entry: Entry, verb: Verb, key: string) =>
	entry.debug.idempotencyKeys.push({ verb, key, at: new Date().toISOString() });

const setStatus = (entry: Entry, status: RoundStatus) => {
	entry.record.status = status;
	entry.debug.statusHistory.push({ status, at: new Date().toISOString() });
};

/** Resolves the round: Policy A from its fixture (the options never matter), Policy B from the decisions. */
function resolve(entry: Entry): void {
	const { record, fixture, debug } = entry;
	record.outcome =
		fixture.policy === "fixed"
			? resolveFixed(record.roundId, fixture, record.wagerMinorUnits).outcome
			: resolveChoice(
					record.roundId,
					fixture,
					record.wagerMinorUnits,
					record.decisions,
					debug.seed,
					debug.roundIndex,
					debug.forced?.category ?? null
				);
	entry.heldSince = null;
	setStatus(entry, "resolved");
}

/** A Policy B round held by `resolveDelayMs` resolves on the first read after the delay, read from debug state now. */
function release(entry: Entry): Entry {
	const delay = debugRecord(entry.playerId).simulation.resolveDelayMs;
	if (entry.heldSince !== null && Date.now() - entry.heldSince >= delay) resolve(entry);
	return entry;
}

export const openRoundOf = (playerId: string): Entry | undefined => {
	const entry = entries.get(openByPlayer.get(playerId) ?? "");
	return entry && release(entry);
};

/** The player's own round. Missing and someone else's are the same 404 (contract §3). */
export function ownRound(playerId: string, roundId: string): Entry {
	const entry = entries.get(roundId);
	if (entry?.playerId !== playerId) throw new HttpError(404, "round_not_found", "No such round for this player");
	return release(entry);
}

/**
 * Validates the wager, debits it atomically, draws the fixture (forced or seeded) and creates the round, already
 * `resolved`, or `awaiting_choice` on the first decision point when the fixture has any. Rejects in this order: 400 `invalid_bet`, 409
 * `round_already_started`, 402 `insufficient_balance`. A rejected start consumes no round index and spends no force.
 */
export function startRound(player: Player, wagerMinorUnits: unknown, key: string): Entry {
	if (
		!isMinorUnits(wagerMinorUnits) ||
		wagerMinorUnits < config.minWagerMinorUnits ||
		wagerMinorUnits > config.maxWagerMinorUnits
	) {
		throw new HttpError(
			400,
			"invalid_bet",
			`Wager must be a whole number of minor units from ${config.minWagerMinorUnits} to ${config.maxWagerMinorUnits}`
		);
	}
	const { playerId } = player;
	if (openByPlayer.has(playerId)) {
		throw new HttpError(409, "round_already_started", "A round is already open for this player");
	}
	if (wagerMinorUnits > player.balanceMinorUnits) {
		throw new HttpError(402, "insufficient_balance", "Wager exceeds the balance");
	}

	const state = debugRecord(playerId);
	const roundIndex = state.roundsPlayed;
	const forced = state.force && structuredClone(state.force);
	const fixture = state.force ? drawForced(state.force, state.seed, roundIndex) : draw(state.seed, roundIndex);
	const roundId = randomUUID();
	const outcomePolicy = policyOf(roundId, fixture, wagerMinorUnits);
	const [pending] = fixture.decisions;
	const status: RoundStatus = pending ? "awaiting_choice" : "resolved";
	const at = new Date().toISOString();

	// Nothing below can throw: the debit, the counter and the force change together.
	player.balanceMinorUnits -= wagerMinorUnits;
	state.roundsPlayed++;
	if (state.force && !state.force.sticky) state.force = null;
	const entry: Entry = {
		playerId,
		record: {
			roundId,
			wagerMinorUnits,
			currency: player.currency.code,
			outcomePolicy,
			eventPlanId: fixture.eventPlanId,
			status,
			createdAt: at,
			pendingDecision: pending ? structuredClone(pending) : null,
			decisions: [],
			outcome: pending ? null : resolveFixed(roundId, fixture, wagerMinorUnits).outcome,
			settlement: null
		},
		debug: {
			fixtureId: fixture.fixtureId,
			forced,
			seed: state.seed,
			roundIndex,
			statusHistory: [{ status, at }],
			idempotencyKeys: []
		},
		fixture,
		heldSince: null
	};
	logKey(entry, "start", key);
	entries.set(roundId, entry);
	openByPlayer.set(playerId, roundId);
	return entry;
}

/**
 * Records one decision against the pending decision point (contract §4). Checks run in this order: 404 unknown round,
 * 409 `decision_already_recorded` (the sequence number is taken, whatever the round's status now), 409
 * `round_not_awaiting_choice`, 409 `stale_decision` (wrong decision or not the next number), 400 `invalid_option`.
 * The same key replaying is answered earlier from the idempotency store and never gets here.
 */
export function decideRound(
	player: Player,
	decision: { roundId: string; decisionId: string; optionId: string; sequenceNumber: number },
	key: string
): Entry {
	const entry = ownRound(player.playerId, decision.roundId);
	const { record, fixture } = entry;
	const { decisionId, optionId, sequenceNumber } = decision;
	if (sequenceNumber >= 1 && sequenceNumber <= record.decisions.length) {
		throw new HttpError(409, "decision_already_recorded", "That decision was already recorded");
	}
	const pending = record.pendingDecision;
	if (record.status !== "awaiting_choice" || !pending) {
		throw new HttpError(409, "round_not_awaiting_choice", "The round has no decision pending");
	}
	if (decisionId !== pending.id || sequenceNumber !== record.decisions.length + 1) {
		throw new HttpError(409, "stale_decision", "That is not the pending decision");
	}
	if (!pending.options.some(o => o.id === optionId)) {
		throw new HttpError(400, "invalid_option", "That option is not offered by the pending decision");
	}

	record.decisions.push({ roundId: record.roundId, decisionId, optionId, sequenceNumber });
	const next = fixture.decisions[record.decisions.length];
	record.pendingDecision = next ? structuredClone(next) : null;
	if (!next) {
		if (fixture.policy === "choice_constrained" && debugRecord(player.playerId).simulation.resolveDelayMs > 0) {
			entry.heldSince = Date.now();
			setStatus(entry, "running");
		} else {
			resolve(entry);
		}
	}
	logKey(entry, "decide", key);
	return entry;
}

/** Settled rounds of the player, newest first (rounds settle in creation order: at most one is open at a time). */
export function historyOf(playerId: string, limit: number, offset: number): { rounds: HistoryEntry[]; total: number } {
	const settled = [...entries.values()].filter(e => e.playerId === playerId && e.record.status === "settled").reverse();
	const rounds = settled.slice(offset, offset + limit).map(({ record }) => ({
		roundId: record.roundId,
		createdAt: record.createdAt,
		settledAt: record.settlement!.settledAt,
		wagerMinorUnits: record.wagerMinorUnits,
		payoutMinorUnits: record.settlement!.payoutMinorUnits,
		currency: record.currency,
		category: record.outcome!.category
	}));
	return { rounds, total: settled.length };
}

/**
 * Credits the outcome's payout once and moves the round to `settled`. A round already settled returns its stored
 * settlement and never credits again, whatever key is sent (contract §4).
 */
export function settleRound(player: Player, roundId: string, key: string): Entry {
	const entry = ownRound(player.playerId, roundId);
	const { record } = entry;
	if (record.status !== "settled") {
		if (record.status !== "resolved" || !record.outcome) {
			throw new HttpError(409, "round_not_resolved", "The round has not resolved yet");
		}
		const { payoutMinorUnits } = record.outcome;
		const balanceMinorUnits = checkedAdd(player.balanceMinorUnits, payoutMinorUnits);
		const settledAt = new Date().toISOString();

		player.balanceMinorUnits = balanceMinorUnits;
		record.status = "settled";
		record.settlement = {
			roundId,
			wagerMinorUnits: record.wagerMinorUnits,
			payoutMinorUnits,
			currency: record.currency,
			settlementId: randomUUID(),
			settledAt
		};
		entry.debug.statusHistory.push({ status: "settled", at: settledAt });
		openByPlayer.delete(player.playerId);
	}
	logKey(entry, "settle", key);
	return entry;
}

/** Forgets every round of the player (debug reset). */
export function resetRounds(playerId: string): void {
	for (const [roundId, entry] of entries) if (entry.playerId === playerId) entries.delete(roundId);
	openByPlayer.delete(playerId);
}

/** A snapshot of the wire record, safe to store or send. */
export const roundOf = (entry: Entry): RoundRecord => structuredClone(entry.record);

export const debugRoundOf = (entry: Entry): DebugRoundResponse =>
	structuredClone({ round: entry.record, debug: entry.debug });
