// Run: pnpm test:server
// Request-level tests for the router plumbing: CORS, errors, path params, auth guards.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { bodyObject, route } from "./http.ts";
import { startTestServer } from "./testing.ts";

let api: Awaited<ReturnType<typeof startTestServer>>;

before(async () => {
	api = await startTestServer();
	route("GET", "/api/test/echo/:id", ctx => ({ params: ctx.params, query: Object.fromEntries(ctx.query) }));
	route("POST", "/api/test/body", ctx => bodyObject(ctx));
	route("GET", "/api/test/boom", () => {
		throw new Error("secret detail");
	});
});

after(() => api.close());

test("GET /api/health says it is the mock", async () => {
	const { status, json } = await api.call("GET", "/api/health");
	assert.equal(status, 200);
	assert.equal(json.status, "ok");
	assert.equal(json.mock, true);
	assert.equal(json.contractVersion, "0.2");
	assert.equal(typeof json.uptime, "number");
});

test("OPTIONS returns 204 with the contract's CORS headers, on any path", async () => {
	for (const path of ["/api/game/play", "/api/health", "/nowhere"]) {
		const { status, headers } = await api.call("OPTIONS", path);
		assert.equal(status, 204, path);
		assert.equal(headers.get("access-control-allow-origin"), "*");
		assert.equal(headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
		assert.equal(headers.get("access-control-allow-headers"), "authorization, content-type");
		assert.equal(headers.get("access-control-max-age"), "600");
	}
});

test("every response carries access-control-allow-origin, errors included", async () => {
	assert.equal((await api.call("GET", "/api/health")).headers.get("access-control-allow-origin"), "*");
	assert.equal((await api.call("GET", "/nowhere")).headers.get("access-control-allow-origin"), "*");
});

test("an unknown route is 404 not_found", async () => {
	const { status, json } = await api.call("GET", "/nowhere");
	assert.equal(status, 404);
	assert.equal(json.error.code, "not_found");
	assert.equal(typeof json.error.message, "string");
});

test("a known path with the wrong method is 404 not_found", async () => {
	assert.equal((await api.call("POST", "/api/health", { body: {} })).json.error.code, "not_found");
});

test("a malformed percent-escape is 404 not_found, not a crash", async () => {
	const { status, json } = await api.call("GET", "/api/test/echo/%E0%A4%A");
	assert.equal(status, 404);
	assert.equal(json.error.code, "not_found");
});

test("malformed JSON is 400 invalid_json", async () => {
	const { status, json } = await api.call("POST", "/api/test/body", { rawBody: "{not json" });
	assert.equal(status, 400);
	assert.equal(json.error.code, "invalid_json");
});

test("a JSON body that is not an object is 400 invalid_request, an empty body is {}", async () => {
	for (const rawBody of ["[]", "5", "null", '"x"']) {
		const { status, json } = await api.call("POST", "/api/test/body", { rawBody });
		assert.equal(status, 400, rawBody);
		assert.equal(json.error.code, "invalid_request");
	}
	const empty = await api.call("POST", "/api/test/body");
	assert.equal(empty.status, 200);
	assert.deepEqual(empty.json, {});
});

test("path params are decoded and the query string is parsed", async () => {
	const { json } = await api.call("GET", "/api/test/echo/r%2F1?limit=10&offset=5");
	assert.deepEqual(json, { params: { id: "r/1" }, query: { limit: "10", offset: "5" } });
});

test("a handler that throws is a generic 500 server_error that leaks nothing", async () => {
	const { status, json } = await api.call("GET", "/api/test/boom");
	assert.equal(status, 500);
	assert.equal(json.error.code, "server_error");
	assert.ok(!JSON.stringify(json).includes("secret detail"));
});

test("everything under /api/game needs a valid token, even a path that does not exist", async () => {
	const missing = await api.call("GET", "/api/game/no-such-route");
	assert.equal(missing.status, 401);
	assert.equal(missing.json.error.code, "invalid_session");

	const unknown = await api.call("GET", "/api/game/no-such-route", { token: "not-a-token" });
	assert.equal(unknown.status, 401);

	const { sessionToken } = await api.newDebugSession("http-game");
	const authed = await api.call("GET", "/api/game/no-such-route", { token: sessionToken });
	assert.equal(authed.status, 404, "with a token it is just an unknown route");
});

test("the guard cannot be dodged with a doubled slash, a trailing slash or percent-encoding", async () => {
	for (const path of ["//api//game/balance", "/api/game/balance/", "/api/%67ame/balance"]) {
		assert.equal((await api.call("GET", path)).status, 401, path);
	}
	for (const path of ["//api/debug/state", "/api/%64ebug/state"]) {
		assert.equal((await api.call("GET", path)).status, 401, path);
	}
});

test("an Authorization header that is not a bearer token is 401", async () => {
	for (const authorization of ["Basic abc", "Bearer", "Bearer ", "abc"]) {
		const { status, json } = await api.call("GET", "/api/game/balance", { headers: { authorization } });
		assert.equal(status, 401, authorization);
		assert.equal(json.error.code, "invalid_session");
	}
});
