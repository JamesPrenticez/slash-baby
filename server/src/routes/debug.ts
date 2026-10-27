// /api/debug/* (contract §10). Whether these answer at all is decided per request in http.ts (config.debugRoutes),
// and everything here except /session sits behind the bearer check there. The simulation /simulate sets is applied in http.ts.

import { startSession } from "./session.ts";
import type { BalanceResponse } from "../../../src/types/api.ts";
import type { DebugForce, DebugSimulation } from "../../../src/types/debug.ts";
import { config } from "../config.ts";
import { debugRecord, debugStateOf, resetDebug, setPlayerSeed } from "../debug-state.ts";
import { CATEGORIES, forcedCandidates } from "../fixtures.ts";
import { bodyObject, type Ctx, HttpError, requireSession, route } from "../http.ts";
import { forgetKeys } from "../idempotency.ts";
import { checkedAdd, isMinorUnits } from "../money.ts";
import { debugRoundOf, ownRound, resetRounds } from "../rounds.ts";
import { expireSession, type Player } from "../sessions.ts";

const DEBUG_PLAYER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const DEFAULT_CREDIT = 100_000;
const POLICIES = ["fixed", "choice_constrained"];

const bad = (message: string) => new HttpError(400, "invalid_debug_request", message);
const body = (ctx: Ctx) => bodyObject(ctx, "invalid_debug_request");
const balanceOf = ({ balanceMinorUnits, currency }: Player): BalanceResponse => ({
	balanceMinorUnits,
	currency: currency.code
});

/** Reads `value` as a string-or-null field of a force (absent counts as null). */
function optionalString(value: unknown, name: string): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") throw bad(`${name} must be a string or null`);
	return value;
}

/** A force the server can honour: at least one selector, and at least one fixture matching it. */
function parseForce(raw: Record<string, unknown>): DebugForce {
	const fixtureId = optionalString(raw.fixtureId, "fixtureId");
	const category = optionalString(raw.category, "category");
	const policy = optionalString(raw.policy, "policy");
	const { sticky = false } = raw;
	if (typeof sticky !== "boolean") throw bad("sticky must be a boolean");
	if (fixtureId === null && category === null && policy === null) {
		throw bad("force needs a fixtureId, category or policy, or send { force: null } to clear");
	}
	if (category !== null && !CATEGORIES.some(c => c === category)) throw bad(`Unknown category: ${category}`);
	if (policy !== null && !POLICIES.includes(policy)) throw bad(`Unknown policy: ${policy}`);
	const force = { fixtureId, category, policy, sticky } as DebugForce;
	if (forcedCandidates(force).length === 0) throw bad("No fixture matches that force");
	return force;
}

route("POST", "/api/debug/session", ctx => {
	const b = body(ctx);
	const { playerId } = b;
	if (typeof playerId !== "string" || !DEBUG_PLAYER_ID.test(playerId)) {
		throw bad("playerId must be 1 to 64 characters of A-Z, a-z, 0-9, _ or -");
	}
	return startSession(`debug:${playerId}`, b, "invalid_debug_request");
});

route("GET", "/api/debug/state", ctx => debugStateOf(requireSession(ctx.req).player));

route("POST", "/api/debug/balance/set", ctx => {
	const { player } = requireSession(ctx.req);
	const { balanceMinorUnits } = body(ctx);
	if (!isMinorUnits(balanceMinorUnits)) throw bad("balanceMinorUnits must be a non-negative safe integer");
	player.balanceMinorUnits = balanceMinorUnits;
	return balanceOf(player);
});

route("POST", "/api/debug/balance/credit", ctx => {
	const { player } = requireSession(ctx.req);
	const { amountMinorUnits = DEFAULT_CREDIT } = body(ctx);
	if (!isMinorUnits(amountMinorUnits)) throw bad("amountMinorUnits must be a non-negative safe integer");
	try {
		player.balanceMinorUnits = checkedAdd(player.balanceMinorUnits, amountMinorUnits);
	} catch {
		throw bad("That credit would overflow the balance");
	}
	return balanceOf(player);
});

route("POST", "/api/debug/force", ctx => {
	const { player } = requireSession(ctx.req);
	const b = body(ctx);
	debugRecord(player.playerId).force = "force" in b && b.force === null ? null : parseForce(b);
	return debugStateOf(player);
});

const TIMER_MAX_MS = 2_147_483_647;
const intIn = (value: unknown, min: number, max: number): value is number =>
	Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** The simulate fields that were provided, validated. Nothing is applied unless all of them are valid. */
function parseSimulation(raw: Record<string, unknown>): Partial<DebugSimulation> {
	const patch: Partial<DebugSimulation> = {};
	for (const name of ["latencyMs", "resolveDelayMs"] as const) {
		if (!(name in raw)) continue;
		if (!intIn(raw[name], 0, TIMER_MAX_MS)) throw bad(`${name} must be an integer from 0 to ${TIMER_MAX_MS}`);
		patch[name] = raw[name];
	}
	if ("dropAfterAccept" in raw) {
		if (!intIn(raw.dropAfterAccept, 0, Number.MAX_SAFE_INTEGER))
			throw bad("dropAfterAccept must be a non-negative integer");
		patch.dropAfterAccept = raw.dropAfterAccept;
	}
	if ("errorRate" in raw) {
		const { errorRate } = raw;
		if (typeof errorRate !== "number" || !(errorRate >= 0 && errorRate <= 1))
			throw bad("errorRate must be a number from 0 to 1");
		patch.errorRate = errorRate;
	}
	if ("failNext" in raw) {
		const { failNext } = raw;
		if (failNext === null) {
			patch.failNext = null;
		} else {
			const f = typeof failNext === "object" && !Array.isArray(failNext) ? (failNext as Record<string, unknown>) : {};
			if (!intIn(f.count, 1, Number.MAX_SAFE_INTEGER)) throw bad("failNext.count must be a positive integer");
			if (!intIn(f.status, 400, 599)) throw bad("failNext.status must be an integer from 400 to 599");
			const { verb } = f;
			if (verb !== undefined && verb !== "start" && verb !== "decide" && verb !== "settle") {
				throw bad("failNext.verb must be start, decide or settle");
			}
			patch.failNext =
				verb === undefined ? { count: f.count, status: f.status } : { count: f.count, status: f.status, verb };
		}
	}
	return patch;
}

route("POST", "/api/debug/simulate", ctx => {
	const { player } = requireSession(ctx.req);
	const patch = parseSimulation(body(ctx));
	Object.assign(debugRecord(player.playerId).simulation, patch);
	return debugStateOf(player);
});

route("POST", "/api/debug/seed", ctx => {
	const { player } = requireSession(ctx.req);
	const { seed } = body(ctx);
	if (seed !== null && (typeof seed !== "string" || seed.length < 1 || seed.length > 64)) {
		throw bad("seed must be a string of 1 to 64 characters, or null");
	}
	setPlayerSeed(player.playerId, seed);
	return debugStateOf(player);
});

route("POST", "/api/debug/reset", ctx => {
	const { player } = requireSession(ctx.req);
	resetRounds(player.playerId);
	forgetKeys(player.playerId);
	resetDebug(player.playerId);
	player.balanceMinorUnits = config.startingBalanceMinorUnits;
	return debugStateOf(player);
});

route("GET", "/api/debug/round/:roundId", ctx =>
	debugRoundOf(ownRound(requireSession(ctx.req).player.playerId, ctx.params.roundId))
);

route("POST", "/api/debug/expire-session", ctx => {
	expireSession(requireSession(ctx.req));
	return { ok: true };
});
