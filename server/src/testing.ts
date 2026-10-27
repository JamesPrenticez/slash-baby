// Shared helper for request-level tests: the real handler behind a real socket on an ephemeral port.
// Importing it registers every route, exactly as index.ts does.

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { config } from "./config.ts";
import { handle } from "./http.ts";
import type { PlayMessage } from "../../src/types/api.ts";

import "./routes/session.ts";
import "./routes/debug.ts";
import "./routes/play.ts";
import "./routes/game.ts";

export type Reply = {
	status: number;
	headers: Headers;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests assert on the shape themselves
	json: any;
};

export type CallOptions = { token?: string; body?: unknown; rawBody?: string; headers?: Record<string, string> };

export async function startTestServer() {
	config.logRequests = false;
	const server = createServer(handle);
	await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
	const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

	async function call(
		method: string,
		path: string,
		{ token, body, rawBody, headers: extra }: CallOptions = {}
	): Promise<Reply> {
		const headers: Record<string, string> = { ...extra };
		if (token) headers.authorization = `Bearer ${token}`;
		const payload = rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
		if (payload !== undefined) headers["content-type"] = "application/json";
		const res = await fetch(`${base}${path}`, { method, headers, body: payload });
		const text = await res.text();
		return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : undefined };
	}

	/** A fresh debug player, so a test never shares a wallet with another. */
	async function newDebugSession(playerId: string, currency?: string) {
		const { json } = await call("POST", "/api/debug/session", { body: { playerId, currency } });
		return json as {
			sessionToken: string;
			playerId: string;
			balanceMinorUnits: number;
			config: Record<string, unknown>;
		};
	}

	/** POST /api/game/play with a fresh idempotency key unless one is given. */
	const play = (token: string, message: PlayMessage, idempotencyKey: string = randomUUID()) =>
		call("POST", "/api/game/play", { token, body: { idempotencyKey, message } });

	const start = (token: string, wagerMinorUnits: number, idempotencyKey?: string) =>
		play(token, { start: { wagerMinorUnits } }, idempotencyKey);

	const settle = (token: string, roundId: string, idempotencyKey?: string) =>
		play(token, { settle: { roundId } }, idempotencyKey);

	/** POST /api/debug/force. Pass `null` to clear. A fixtureId, category or policy is needed; `sticky` defaults to false. */
	const force = (token: string, patch: Record<string, unknown> | null) =>
		call("POST", "/api/debug/force", { token, body: patch ? { sticky: false, ...patch } : { force: null } });

	const close = () =>
		new Promise<void>(resolve => {
			server.close(() => resolve());
			server.closeAllConnections();
		});

	return { call, play, start, settle, force, newDebugSession, close };
}
