import type { ApiErrorBody, ApiErrorCode, SessionResponse } from "@/types/api";

/** `network_error` and `timeout` have `status === 0`. `bad_response` keeps the HTTP status of a reply that is not a contract error body. */
export type ClientErrorCode = ApiErrorCode | "network_error" | "timeout" | "bad_response";

/** Every failed call throws this. `code` is the server's error code (contract §8) or one of the client-side codes above. */
export class ApiError extends Error {
	status: number;
	code: ClientErrorCode;
	constructor(status: number, code: ClientErrorCode, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

// Placeholders (contract §1, §2).
const REQUEST_TIMEOUT_MS = 15_000;
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;

// The page's own hostname, so a phone that opened the game by LAN IP reaches the server on the same host.
const apiBase = () => import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:3001/api`;

let token: string | null = null;
let currency: string | undefined;
let bootstrapping: Promise<SessionResponse> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
const expiredHandlers = new Set<() => void>();

/** Called whenever a request 401s, i.e. a token we believed valid was dead. Returns an unsubscribe function. */
export function onSessionExpired(handler: () => void): () => void {
	expiredHandlers.add(handler);
	return () => expiredHandlers.delete(handler);
}

async function errorFrom(res: Response, label: string): Promise<ApiError> {
	const body: Partial<ApiErrorBody> | null = await res.json().catch(() => null);
	const error = body?.error;
	return error && typeof error.code === "string" && typeof error.message === "string"
		? new ApiError(res.status, error.code, error.message)
		: new ApiError(res.status, "bad_response", `${label} failed with status ${res.status}`);
}

/**
 * One HTTP call with a 15 s timeout. POST always sends a JSON body (`{}` when none is given). Resolves with the parsed
 * JSON; rejects with `ApiError` for an error reply, a timeout or a network failure. Never retries.
 */
export async function request<T>(method: "GET" | "POST", path: string, body?: unknown, bearer?: string): Promise<T> {
	const label = `${method} ${path}`;
	const headers: Record<string, string> = {};
	if (bearer) headers.Authorization = `Bearer ${bearer}`;
	if (method === "POST") headers["Content-Type"] = "application/json";
	try {
		const res = await fetch(apiBase() + path, {
			method,
			headers,
			body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
		if (!res.ok) throw await errorFrom(res, label);
		return (await res.json()) as T;
	} catch (e) {
		if (e instanceof ApiError) throw e;
		const reason = e instanceof Error ? e : new Error(String(e));
		const timedOut = reason.name === "TimeoutError" || reason.name === "AbortError";
		throw new ApiError(0, timedOut ? "timeout" : "network_error", `${label} failed: ${reason.message}`);
	}
}

function refreshToken() {
	const stale = token;
	if (!stale) return;
	request<{ sessionToken: string }>("POST", "/session/refresh", undefined, stale)
		.then(({ sessionToken }) => {
			// Only if nothing (a 401-driven re-bootstrap, a currency switch) replaced the session meanwhile.
			if (token === stale) token = sessionToken;
		})
		.catch(() => {
			// Not fatal: the token lives until its TTL, and a 401 on the next call re-bootstraps.
		});
}

function adopt(session: SessionResponse): SessionResponse {
	token = session.sessionToken;
	currency = session.config.currency;
	clearInterval(refreshTimer);
	refreshTimer = setInterval(refreshToken, REFRESH_INTERVAL_MS);
	return session;
}

async function requestSession(wanted?: string): Promise<SessionResponse> {
	if (import.meta.env.VITE_DEBUG === "true") return (await import("./debug")).bootstrapDebugSession(wanted);
	return request<SessionResponse>("POST", "/session", { currency: wanted });
}

/**
 * Mints a session and makes it the current one. Concurrent calls share one in-flight request. `currency` defaults to
 * the current session's, so a re-bootstrap keeps the player's currency. A failure leaves the old session untouched.
 */
export function bootstrapSession(wanted?: string): Promise<SessionResponse> {
	bootstrapping ??= requestSession(wanted ?? currency)
		.then(adopt)
		.finally(() => {
			bootstrapping = null;
		});
	return bootstrapping;
}

/**
 * An authenticated call. Bootstraps a session if there is none. On a 401 it fires `onSessionExpired`, drops the token,
 * bootstraps a new session and retries the same request once, with the same body (so the same `idempotencyKey`).
 * A second 401 throws.
 */
export async function authedRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		const bearer = token ?? (await bootstrapSession()).sessionToken;
		try {
			return await request<T>(method, path, body, bearer);
		} catch (e) {
			if (attempt === 2 || !(e instanceof ApiError) || e.status !== 401) throw e;
			// Another call may already have replaced the dead token; then just retry with that one.
			if (token === bearer) {
				token = null;
				expiredHandlers.forEach(handler => handler());
			}
		}
	}
}

/** Forgets the session without notifying anyone. For tests. */
export function resetSession() {
	token = null;
	currency = undefined;
	bootstrapping = null;
	clearInterval(refreshTimer);
	refreshTimer = undefined;
}
