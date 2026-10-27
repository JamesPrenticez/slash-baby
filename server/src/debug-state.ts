// Per-player debug state (contract §10): PRNG seed, round counter, force and simulation. In memory, wiped on restart.
// Kept dumb on purpose: routes/debug.ts validates, rounds.ts reads and advances it, and the simulation fields are
// read by http.ts (W3-B4). Every player has a record, debug session or not, because the seed and counter drive all draws.

import { config } from "./config.ts";
import { fixtureInfo, FIXTURES } from "./fixtures.ts";
import { failureRoll } from "./rng.ts";
import type { Player } from "./sessions.ts";
import type { DebugForce, DebugSimulation, DebugState } from "../../src/types/debug.ts";

export type DebugRecord = {
	seed: string;
	/** Rounds started since the last reset or seed call. It is the next round's index (determinism rule, contract §10). */
	roundsPlayed: number;
	force: DebugForce | null;
	simulation: DebugSimulation;
	/** Draws taken from the failure stream so far. Internal: it is not on the wire. */
	failureRolls: number;
};

const records = new Map<string, DebugRecord>();

const noSimulation = (): DebugSimulation => ({
	latencyMs: 0,
	errorRate: 0,
	failNext: null,
	dropAfterAccept: 0,
	resolveDelayMs: 0
});

/** The player's record, created with defaults on first sight. Mutable: callers change it in place. */
export function debugRecord(playerId: string): DebugRecord {
	let record = records.get(playerId);
	if (!record) {
		records.set(
			playerId,
			(record = { seed: config.defaultSeed, roundsPlayed: 0, force: null, simulation: noSimulation(), failureRolls: 0 })
		);
	}
	return record;
}

/** Clears force, simulation and counters. The seed stays, so a reset replays the same run. */
export function resetDebug(playerId: string): void {
	Object.assign(debugRecord(playerId), { roundsPlayed: 0, force: null, simulation: noSimulation(), failureRolls: 0 });
}

/** Sets the seed (`null` restores the server default) and restarts both counters, so a run can be reproduced. */
export function setPlayerSeed(playerId: string, seed: string | null): void {
	Object.assign(debugRecord(playerId), { seed: seed ?? config.defaultSeed, roundsPlayed: 0, failureRolls: 0 });
}

/** The next draw of the player's failure stream. It never touches the outcome stream. */
export function nextFailureRoll(playerId: string): number {
	const record = debugRecord(playerId);
	return failureRoll(record.seed, record.failureRolls++);
}

/** GET /api/debug/state. */
export function debugStateOf(player: Player): DebugState {
	const { seed, roundsPlayed, force, simulation } = debugRecord(player.playerId);
	return {
		mock: config.mock,
		contractVersion: config.contractVersion,
		playerId: player.playerId,
		seed,
		roundsPlayed,
		force,
		simulation,
		fixtures: FIXTURES.map(fixtureInfo),
		currencies: config.currencies
	};
}
