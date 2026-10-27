// POST /api/game/play: the one endpoint for every state change (contract §4). The envelope is checked here, then
// idempotency, then the verb. Handlers are synchronous, so replay lookup and processing cannot interleave.

import type { PlayMessage, PlayRequest, PlayResponse } from "../../../src/types/api.ts";
import { bodyObject, type Ctx, HttpError, requireSession, route } from "../http.ts";
import { remember, replayOf } from "../idempotency.ts";
import { decideRound, roundOf, settleRound, startRound } from "../rounds.ts";

const VERBS = ["start", "decide", "settle"] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const bad = (message: string) => new HttpError(400, "invalid_request", message);

/**
 * Checks the envelope and the shape of the one verb, and rebuilds the message with a fixed key order (unknown fields
 * dropped), which is what idempotency compares. Whether the values are acceptable (`invalid_bet`, balance, state) is the
 * verb's business and comes after the replay lookup.
 */
function parsePlay(ctx: Ctx): { key: string; message: PlayMessage } {
	const { idempotencyKey: key, message } = bodyObject(ctx) as Partial<PlayRequest> & Record<string, unknown>;
	if (typeof key !== "string" || key.length < 16 || key.length > 64) {
		throw bad("idempotencyKey must be a string of 16 to 64 characters");
	}
	const verbs = isObject(message) ? VERBS.filter(verb => verb in message) : [];
	if (!isObject(message) || verbs.length !== 1) {
		throw new HttpError(400, "invalid_message", "message must contain exactly one of start, decide or settle");
	}
	const args = (message as Record<string, unknown>)[verbs[0]];
	if (!isObject(args)) throw bad(`${verbs[0]} must be an object`);

	switch (verbs[0]) {
		case "start":
			return { key, message: { start: { wagerMinorUnits: args.wagerMinorUnits as number } } };
		case "settle":
			if (typeof args.roundId !== "string") throw bad("settle.roundId must be a string");
			return { key, message: { settle: { roundId: args.roundId } } };
		case "decide": {
			const { roundId, decisionId, optionId, sequenceNumber } = args;
			if (typeof roundId !== "string" || typeof decisionId !== "string" || typeof optionId !== "string") {
				throw bad("decide.roundId, decisionId and optionId must be strings");
			}
			if (!Number.isSafeInteger(sequenceNumber)) throw bad("decide.sequenceNumber must be an integer");
			return { key, message: { decide: { roundId, decisionId, optionId, sequenceNumber: sequenceNumber as number } } };
		}
	}
}

route("POST", "/api/game/play", ctx => {
	const { player } = requireSession(ctx.req);
	const { key, message } = parsePlay(ctx);

	const replay = replayOf(player.playerId, key, message);
	if (replay) return replay;

	let entry;
	if ("start" in message) {
		entry = startRound(player, message.start.wagerMinorUnits, key);
	} else if ("settle" in message) {
		entry = settleRound(player, message.settle.roundId, key);
	} else {
		entry = decideRound(player, message.decide, key);
	}

	const response: PlayResponse = {
		roundId: entry.record.roundId,
		message: { round: roundOf(entry), balanceMinorUnits: player.balanceMinorUnits }
	};
	remember(player.playerId, key, message, response);
	return response;
});
