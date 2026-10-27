// Router and request plumbing over node:http. No framework: the surface is small and fixed (contract §3).
// Routes self-register by calling route() when their module is imported (see index.ts).

import type { IncomingMessage, ServerResponse } from "node:http";

import { config } from "./config.ts";
import { debugRecord, nextFailureRoll } from "./debug-state.ts";
import { findSession, type Session } from "./sessions.ts";
import type { ApiErrorBody, ApiErrorCode } from "../../src/types/api.ts";
import type { DebugSimulation } from "../../src/types/debug.ts";

export type Ctx = {
	req: IncomingMessage;
	res: ServerResponse;
	/** Parsed JSON body, or {} for a GET or an empty body. */
	body: unknown;
	/** Captures from the route pattern, e.g. `:roundId`. */
	params: Record<string, string>;
	query: URLSearchParams;
};

export type Handler = (ctx: Ctx) => unknown;

/** Thrown by handlers to answer with a structured error (contract §8). */
export class HttpError extends Error {
	status: number;
	code: ApiErrorCode;
	constructor(status: number, code: ApiErrorCode, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

type Route = { method: string; segments: string[]; handler: Handler };

const routes: Route[] = [];

export function route(method: string, pattern: string, handler: Handler): void {
	routes.push({ method, segments: pattern.split("/").filter(Boolean), handler });
}

function findRoute(method: string, parts: string[]) {
	for (const r of routes) {
		if (r.method !== method || r.segments.length !== parts.length) continue;
		const params: Record<string, string> = {};
		const hit = r.segments.every((seg, i) => {
			if (!seg.startsWith(":")) return seg === parts[i];
			params[seg.slice(1)] = parts[i];
			return true;
		});
		if (hit) return { handler: r.handler, params };
	}
	return undefined;
}

/** The session behind the request's bearer token. Throws 401 `invalid_session` for a missing, unknown, rotated or idle one. */
export function requireSession(req: IncomingMessage): Session {
	const auth = req.headers.authorization;
	const session = findSession(auth?.startsWith("Bearer ") ? auth.slice(7) : undefined);
	if (!session) throw new HttpError(401, "invalid_session", "Missing, unknown or expired session token");
	return session;
}

/** The body as a JSON object. Anything else (array, string, null) is rejected with `code`. */
export function bodyObject(ctx: Ctx, code: ApiErrorCode = "invalid_request"): Record<string, unknown> {
	const { body } = ctx;
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new HttpError(400, code, "Request body must be a JSON object");
	}
	return body as Record<string, unknown>;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	if (chunks.length === 0) return {};
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new HttpError(400, "invalid_json", "Request body is not valid JSON");
	}
}

function send(res: ServerResponse, status: number, payload: unknown): void {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(payload));
}

/** Percent-decoded path segments. Decoding happens before any check, so `/api/%64ebug` cannot slip past the debug guard. */
function pathSegments(rawPath: string): string[] {
	try {
		return rawPath.split("/").filter(Boolean).map(decodeURIComponent);
	} catch {
		throw new HttpError(404, "not_found", "No such route");
	}
}

/** The play verb in a request body, for `failNext.verb`. */
function playVerb(body: unknown): string | undefined {
	const message = (body as { message?: unknown } | null)?.message;
	if (typeof message !== "object" || message === null) return undefined;
	return ["start", "decide", "settle"].find(verb => verb in message);
}

/**
 * Debug transport injection for one player's game request (contract §10), before the handler runs: `failNext`, then
 * `errorRate`. Throws the simulated failure; nothing has been processed. `errorRate` draws from its own stream.
 */
function injectFailure(sim: DebugSimulation, playerId: string, isPlay: boolean, body: unknown): void {
	const { failNext } = sim;
	if (failNext && (!failNext.verb || (isPlay && playVerb(body) === failNext.verb))) {
		if (--failNext.count <= 0) sim.failNext = null;
		throw new HttpError(failNext.status, "simulated_error", "Simulated failure (debug failNext)");
	}
	if (sim.errorRate > 0 && nextFailureRoll(playerId) < sim.errorRate) {
		throw new HttpError(500, "simulated_error", "Simulated failure (debug errorRate)");
	}
}

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
	const started = Date.now();
	const method = req.method ?? "GET";
	const [rawPath = "", rawQuery = ""] = (req.url ?? "/").split("?", 2);
	let failure = "";
	let session: Session | undefined;

	// Auth is a bearer header, never a cookie, so any origin may call (contract §1).
	res.setHeader("access-control-allow-origin", "*");

	try {
		if (method === "OPTIONS") {
			res.writeHead(204, {
				"access-control-allow-methods": "GET, POST, OPTIONS",
				"access-control-allow-headers": "authorization, content-type",
				"access-control-max-age": "600"
			});
			res.end();
			return;
		}

		const parts = pathSegments(rawPath);
		const [root, area, leaf] = parts;
		if (root === "api" && area === "debug") {
			// Debug routes answer exactly like an unknown route when the server has them off.
			if (!config.debugRoutes) throw new HttpError(404, "not_found", `No route for ${method} /${parts.join("/")}`);
			// Everything under /api/debug needs a token except the bootstrap. Checked before routing, so an unknown path is a 401 too.
			if (!(parts.length === 3 && leaf === "session")) requireSession(req);
		} else if (root === "api" && area === "game") {
			session = requireSession(req);
		}

		const found = findRoute(method, parts);
		if (!found) throw new HttpError(404, "not_found", `No route for ${method} /${parts.join("/")}`);

		const body = method === "GET" ? {} : await readJson(req);
		const isPlay = method === "POST" && parts.join("/") === "api/game/play";
		// Simulation applies to the player's game requests only; debug routes are exempt so they can always undo it.
		const sim = session && debugRecord(session.player.playerId).simulation;
		if (session && sim) {
			if (sim.latencyMs > 0) await new Promise(resolve => setTimeout(resolve, sim.latencyMs));
			injectFailure(sim, session.player.playerId, isPlay, body);
		}
		const result = await found.handler({ req, res, body, params: found.params, query: new URLSearchParams(rawQuery) });
		if (isPlay && sim && sim.dropAfterAccept > 0) {
			// Fully processed (debited, round stored, key remembered); the answer never leaves.
			sim.dropAfterAccept--;
			failure = "dropped";
			res.socket?.destroy();
			return;
		}
		if (!res.writableEnded) send(res, 200, result);
	} catch (err) {
		const e =
			err instanceof HttpError ? err : new HttpError(500, "server_error", "Unexpected error in the mock server");
		if (!(err instanceof HttpError) && config.logRequests) console.error(err);
		failure = e.code;
		send(res, e.status, { error: { code: e.code, message: e.message } } satisfies ApiErrorBody);
	} finally {
		if (config.logRequests) {
			console.log(`${method} ${rawPath} ${res.statusCode} ${Date.now() - started}ms${failure && ` ${failure}`}`);
		}
	}
}

route("GET", "/api/health", () => ({
	status: "ok",
	mock: config.mock,
	contractVersion: config.contractVersion,
	uptime: process.uptime()
}));
