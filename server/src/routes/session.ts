// POST /api/session and POST /api/session/refresh (contract §2).

import type { ApiErrorCode, SessionResponse } from "../../../src/types/api.ts";
import { config } from "../config.ts";
import { bodyObject, HttpError, requireSession, route } from "../http.ts";
import { createSession, findCurrency, rotateToken } from "../sessions.ts";

/**
 * Validates `body.currency` and mints a session for the player. Shared with POST /api/debug/session.
 * `badBody` is the code for a malformed `currency` (a debug route reports `invalid_debug_request`).
 */
export function startSession(
	playerId: string,
	body: Record<string, unknown>,
	badBody: ApiErrorCode = "invalid_request"
): SessionResponse {
	const { currency: code } = body;
	if (code !== undefined && typeof code !== "string") throw new HttpError(400, badBody, "currency must be a string");
	const currency = code === undefined ? undefined : findCurrency(code);
	if (code !== undefined && !currency) throw new HttpError(400, "invalid_currency", `Unknown currency: ${code}`);

	const { token, player } = createSession(playerId, currency);
	return {
		sessionToken: token,
		playerId: player.playerId,
		balanceMinorUnits: player.balanceMinorUnits,
		config: {
			mock: config.mock,
			contractVersion: config.contractVersion,
			currency: player.currency.code,
			minorUnitExponent: player.currency.minorUnitExponent,
			minWagerMinorUnits: config.minWagerMinorUnits,
			maxWagerMinorUnits: config.maxWagerMinorUnits,
			defaultWagerMinorUnits: config.defaultWagerMinorUnits,
			wagerStepsMinorUnits: config.wagerStepsMinorUnits
		}
	};
}

route("POST", "/api/session", ctx =>
	startSession(`anon:${ctx.req.socket.remoteAddress ?? "unknown"}`, bodyObject(ctx))
);

route("POST", "/api/session/refresh", ctx => ({ sessionToken: rotateToken(requireSession(ctx.req)) }));
