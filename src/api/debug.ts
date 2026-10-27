// Imported only behind `import.meta.env.VITE_DEBUG === "true"` (a static import from debug UI, or the dynamic import in
// http.ts), so a production build contains none of it.
import type { BalanceResponse, SessionResponse } from "@/types/api";
import type { DebugForce, DebugRoundResponse, DebugSimulation, DebugState } from "@/types/debug";

import { authedRequest, bootstrapSession, request } from "./http";
import { randomHex } from "./ids";

const PLAYER_ID_KEY = "debugPlayerId";
let playerId: string | undefined;

/** A per-browser tester id kept in `localStorage`, so every tester and every Playwright context is its own player. */
export function getDebugPlayerId(): string {
	if (playerId) return playerId;
	try {
		playerId = localStorage.getItem(PLAYER_ID_KEY) ?? undefined;
	} catch {
		// storage blocked: fall through to a per-page-load id
	}
	if (!playerId) {
		playerId = `tester-${randomHex(4)}`;
		try {
			localStorage.setItem(PLAYER_ID_KEY, playerId);
		} catch {
			// storage blocked: the id just will not survive a reload
		}
	}
	return playerId;
}

/** Unauthenticated bootstrap as `debug:<playerId>`. `bootstrapSession` calls this when the debug flag is on. */
export const bootstrapDebugSession = (currency?: string) =>
	request<SessionResponse>("POST", "/debug/session", { playerId: getDebugPlayerId(), currency });

/** New session for the same player under another currency (label and exponent only). 409 `round_already_started` while a round is open. */
export const switchCurrency = (currency: string) => bootstrapSession(currency);

export const getDebugState = () => authedRequest<DebugState>("GET", "/debug/state");

export const setBalance = (balanceMinorUnits: number) =>
	authedRequest<BalanceResponse>("POST", "/debug/balance/set", { balanceMinorUnits });

export const creditBalance = (amountMinorUnits?: number) =>
	authedRequest<BalanceResponse>("POST", "/debug/balance/credit", { amountMinorUnits });

/** Forces the outcome of the next round (or every later one with `sticky`). `null` clears it. */
export const setForce = (force: DebugForce | null) =>
	authedRequest<DebugState>("POST", "/debug/force", force ?? { force: null });

export const setSimulation = (patch: Partial<DebugSimulation>) =>
	authedRequest<DebugState>("POST", "/debug/simulate", patch);

/** Clears this player's rounds, keys, force and simulation; restores the starting balance. */
export const resetPlayer = () => authedRequest<DebugState>("POST", "/debug/reset");

/** Marks the calling token expired, so the next request exercises the 401 path. */
export const expireSession = () => authedRequest<{ ok: true }>("POST", "/debug/expire-session");

/** Sets the per-player PRNG seed (`null` restores the server default) and resets the round counter. */
export const setSeed = (seed: string | null) => authedRequest<DebugState>("POST", "/debug/seed", { seed });

/** The round plus mock internals (fixture id, seed, status history, idempotency keys), for "copy round JSON" and replay. */
export const getDebugRound = (roundId: string) =>
	authedRequest<DebugRoundResponse>("GET", `/debug/round/${encodeURIComponent(roundId)}`);
