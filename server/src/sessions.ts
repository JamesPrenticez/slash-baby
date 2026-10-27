// In-memory players and sessions (contract §2). Wiped on restart.
// The wallet belongs to the player, not the session: a new session for the same player sees the same balance.
// ponytail: expired sessions are only dropped when their token is looked up, fine for a dev mock.

import { randomUUID } from "node:crypto";

import { config } from "./config.ts";

export type Currency = (typeof config.currencies)[number];

export type Player = { playerId: string; currency: Currency; balanceMinorUnits: number };

export type Session = { token: string; player: Player; lastSeenAt: number };

const players = new Map<string, Player>();
const sessions = new Map<string, Session>();

export const findCurrency = (code: string) => config.currencies.find(c => c.code === code);

// rounds.ts registers a guard here that throws 409 `round_already_started` while the player has an open round. Sessions
// cannot import rounds.ts (it imports this file), so it is a callback. Without one, any switch is allowed.
let assertNoOpenRound: (playerId: string) => void = () => {};

export const setOpenRoundGuard = (guard: (playerId: string) => void) => {
	assertNoOpenRound = guard;
};

/**
 * Mints a session for the player, creating the wallet on first sight. A given `currency` relabels the wallet (no FX).
 * A switch to a different currency is refused by the open-round guard, before anything changes.
 */
export function createSession(playerId: string, currency?: Currency): Session {
	let player = players.get(playerId);
	if (!player) {
		player = {
			playerId,
			currency: findCurrency(config.defaultCurrency) ?? config.currencies[0],
			balanceMinorUnits: config.startingBalanceMinorUnits
		};
		players.set(playerId, player);
	}
	if (currency && currency.code !== player.currency.code) {
		assertNoOpenRound(playerId);
		player.currency = currency;
	}
	const session: Session = { token: randomUUID(), player, lastSeenAt: Date.now() };
	sessions.set(session.token, session);
	return session;
}

/** The live session for a token, or undefined if unknown, rotated away or idle for longer than the TTL. */
export function findSession(token: string | undefined): Session | undefined {
	const session = token ? sessions.get(token) : undefined;
	if (!session) return undefined;
	const now = Date.now();
	if (now - session.lastSeenAt > config.sessionTtlMs) {
		sessions.delete(session.token);
		return undefined;
	}
	session.lastSeenAt = now;
	return session;
}

/** Swaps the session's token for a fresh one. The old token is dead immediately, so each token refreshes once. */
export function rotateToken(session: Session): string {
	sessions.delete(session.token);
	session.token = randomUUID();
	sessions.set(session.token, session);
	return session.token;
}

/** Kills the token, so the caller's next request takes the 401 path. */
export function expireSession(session: Session): void {
	sessions.delete(session.token);
}
