// Per-player idempotency keys (contract §9). A key maps to the exact message it was first used for and the response
// that produced. The same key and message replays that response; the same key and another message is a conflict.
// Only successful requests are remembered, so a rejected one can be retried under the same key once the cause is fixed.
// ponytail: unbounded, for the life of the process. Fine for a dev mock; evict by age if a long-lived deployment needs it.

import { HttpError } from "./http.ts";
import type { PlayMessage, PlayResponse } from "../../src/types/api.ts";

type Stored = { message: string; response: PlayResponse };

const stores = new Map<string, Map<string, Stored>>();

/** `message` is the normalised PlayMessage built in routes/play.ts, with a fixed key order, so stringify is canonical. */
const canonical = (message: PlayMessage) => JSON.stringify(message);

/** The stored response for a key already used with this message (marked `replayed`), or undefined for a new key. Throws 409 for another message. */
export function replayOf(playerId: string, key: string, message: PlayMessage): PlayResponse | undefined {
	const stored = stores.get(playerId)?.get(key);
	if (!stored) return undefined;
	if (stored.message !== canonical(message)) {
		throw new HttpError(409, "idempotency_key_reused", "That idempotency key was already used for a different request");
	}
	const { response } = structuredClone(stored);
	response.message.replayed = true;
	return response;
}

/** Stores a snapshot of the response, so later changes to the round do not rewrite what a replay returns. */
export function remember(playerId: string, key: string, message: PlayMessage, response: PlayResponse): void {
	let store = stores.get(playerId);
	if (!store) stores.set(playerId, (store = new Map()));
	store.set(key, { message: canonical(message), response: structuredClone(response) });
}

export function forgetKeys(playerId: string): void {
	stores.delete(playerId);
}
