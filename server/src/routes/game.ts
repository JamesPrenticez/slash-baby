// Reads: balance, current, round/:roundId and history (contract §3, §5).
// Auth is checked in http.ts for everything under /api/game. None of these change state.

import type { BalanceResponse, CurrentResponse, HistoryResponse, RoundResponse } from "../../../src/types/api.ts";
import { requireSession, route } from "../http.ts";
import { historyOf, openRoundOf, ownRound, roundOf } from "../rounds.ts";

route("GET", "/api/game/balance", ctx => {
	const { player } = requireSession(ctx.req);
	return { balanceMinorUnits: player.balanceMinorUnits, currency: player.currency.code } satisfies BalanceResponse;
});

route("POST", "/api/game/current", ctx => {
	const { player } = requireSession(ctx.req);
	const base = { balanceMinorUnits: player.balanceMinorUnits, currency: player.currency.code };
	const open = openRoundOf(player.playerId);
	return (
		open ? { ...base, active: true, round: roundOf(open) } : { ...base, active: false }
	) satisfies CurrentResponse;
});

route(
	"GET",
	"/api/game/round/:roundId",
	ctx =>
		({ round: roundOf(ownRound(requireSession(ctx.req).player.playerId, ctx.params.roundId)) }) satisfies RoundResponse
);

/** An integer query value, else the fallback (a bad value is not an error: history is a read). */
const intParam = (value: string | null, fallback: number) => {
	const n = Number(value);
	return value !== null && value !== "" && Number.isSafeInteger(n) ? n : fallback;
};

route("GET", "/api/game/history", ctx => {
	const { player } = requireSession(ctx.req);
	const limit = Math.min(50, Math.max(1, intParam(ctx.query.get("limit"), 10)));
	const offset = Math.max(0, intParam(ctx.query.get("offset"), 0));
	return historyOf(player.playerId, limit, offset) satisfies HistoryResponse;
});
