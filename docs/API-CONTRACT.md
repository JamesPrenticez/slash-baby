# Slash Baby API contract (MOCK server)

Draft v0.2, 2026-10-26 (the wire is unchanged from v0.1; see the changelog). Owner: project manager. **A contract change is made here first, then implemented.** Backend owns the implementation (`server/`, `src/api/`, wire types); frontend consumes it only through `src/api/`.

This is the dev-only mock game server described in `docs/TEAM.md` override 2. It is not a real-money implementation and says so in its startup log, in `GET /api/health` and in `docs/MOCK-SERVER.md`. Domain types come from BUILD-PLAN §4.4, §6.2 and §7.2; transport, session and debug design come from NGU (`never-give-up/src/api/index.ts`, `server/src/`) and hooked (`hooked/server/src/`).

## 0. Where this differs from NGU, hooked and the plan

| Topic                | Decision                                                                                                                | Why                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Money                | Integer minor units (`number`) in fields named `…MinorUnits`. No decimal strings, no floats.                            | BUILD-PLAN §4.4 and §9.3 win over NGU and hooked (`"1.00"` strings). `toFixed(2)` and `parseFloat` do not appear in `src/`.                                              |
| Request envelope     | NGU's `POST /api/game/play` with `{ message: { <verb>: {...} } }`, exactly one verb. Plus a top-level `idempotencyKey`. | One endpoint keeps retries, the idempotency store and the debug latency hook in one place. The plan's REST sketch (§9.1) is explicitly non-final. Both references agree. |
| Response envelope    | `{ roundId, message: { round, balanceMinorUnits, replayed? } }` for every verb. Same shape for all three verbs.         | NGU and hooked wrap in `message` so a real RGS adapter drops in. Returning the whole `RoundRecord` each time means the client never merges partial state.                |
| Error body           | `{ error: { code, message } }` (hooked), not NGU's `{ error: "text" }`.                                                 | The client must branch on the failure (`insufficient_balance`, `round_already_started`, `invalid_session`) and NGU's bare string cannot be branched on safely.           |
| Insufficient balance | HTTP 402 (NGU), not 400 (hooked).                                                                                       | Either works. NGU is the reference named in TEAM.md.                                                                                                                     |
| Operator launch      | Dropped. `POST /api/session` mints the session directly. No HMAC round trip, no `?sessionToken=` URL adoption.          | The frontend cannot hold a secret, so the round trip proves nothing for a mock. The wire the client sees is unchanged.                                                   |
| Idempotency key      | In the body, not an `Idempotency-Key` header.                                                                           | No extra CORS header to forget, and the key travels with the exact body it protects.                                                                                     |
| Debug auth           | `/api/debug/*` needs the bearer token (except `/api/debug/session`). State is per player.                               | Parallel e2e workers and testers sharing a deployment must not share forced outcomes. hooked's global debug state would make e2e flaky.                                  |
| Presentation plan    | Server sends `eventPlanId`. The client owns the id to events table (section 7).                                         | Durations and asset ids are presentation data. A plan can never carry money.                                                                                             |
| `accepted` status    | In the wire union and handled by the client mapper, but the mock never emits it (section 6).                            | The plan does not say what moves `accepted` to `running`. The mock's `start` response is already past it.                                                                |
| Settlement           | Explicit `settle` verb after the finale. The server never credits a payout on its own.                                  | Makes `resolved` and `SETTLEMENT_PENDING` real, matches hooked's `complete`, and makes "settlement is idempotent" (§13 #8) testable. See section 4, decision U-5.        |

## 1. Transport

- Base URL: `import.meta.env.VITE_API_URL ?? \`${location.protocol}//${location.hostname}:3001/api\``. The page's own hostname is used so a phone that opens the game by LAN IP reaches the server on the same host. Only the port differs.
- Server: `node:http`, no framework. `SERVER_PORT` (default `3001`), `SERVER_HOST` (default `0.0.0.0`, so phones on the LAN can reach it). All routes are under `/api`.
- JSON in and out, `content-type: application/json`, camelCase fields. Zero values are emitted, not omitted. `createdAt` and `settledAt` are ISO 8601 UTC strings.
- CORS: the mock replies `access-control-allow-origin: *` to everything (auth is a bearer header, never a cookie). `OPTIONS` returns 204 with `access-control-allow-methods: GET, POST, OPTIONS`, `access-control-allow-headers: authorization, content-type`, `access-control-max-age: 600`.
- `GET /api/health` (no auth): `{ status: "ok", mock: true, contractVersion: "0.2", uptime }`. `config.contractVersion` (section 2) and `DebugState.contractVersion` (section 10) report the same string, `"0.2"`, the version of this document. It changes only when this file's version does.
- Unknown route: 404 `not_found`. Malformed JSON: 400 `invalid_json`.
- Request bodies: every `POST` sends a JSON object, `{}` when the call has no fields (`session/refresh`, `game/current`, `debug/reset`, `debug/expire-session`). The server also reads an empty body as `{}`. A `GET` has no body.
- Client timeout per request: 15 s, set with `AbortSignal.timeout(15_000)`. Its `TimeoutError` (or an `AbortError`) is reported as `ApiError` code `timeout`, status 0. Placeholder constant in `src/api/http.ts`.

## 2. Session and auth

| Call                        | Auth   | Body                      | Response                                                                    |
| --------------------------- | ------ | ------------------------- | --------------------------------------------------------------------------- |
| `POST /api/session`         | none   | `{ currency? }`           | `SessionResponse`. Player is `anon:<remote address>`.                       |
| `POST /api/debug/session`   | none   | `{ playerId, currency? }` | `SessionResponse`. Player is `debug:<playerId>`. Debug-enabled server only. |
| `POST /api/session/refresh` | bearer | none                      | `{ sessionToken }`                                                          |

- Every `/api/game/*` and `/api/debug/*` call (except `/api/debug/session`) carries `Authorization: Bearer <sessionToken>`.
- The wallet belongs to the player, not the session. A new session for the same player sees the same balance and open round. Wallets live in memory and reset when the server restarts.
- Sessions expire after 60 minutes without a valid request (placeholder `SESSION_TTL_MS`). Each valid request refreshes the clock.
- **Refresh.** The client refreshes every 20 minutes. Refresh rotates the token and the old token is dead immediately, so each token can be refreshed once. The client swaps the token only if no re-bootstrap replaced it meanwhile (NGU's rule).
- **401.** Any `/api/game/*` or `/api/debug/*` call with a missing, unknown or expired token returns 401 `invalid_session`. The client then: fires `onSessionExpired`, drops the token, bootstraps a new session, and **retries the same request once with the same `idempotencyKey`**. A second 401 throws `ApiError`. A lost refresh response therefore costs nothing.
- Concurrent bootstraps are de-duplicated (one in-flight promise), as in NGU.
- Debug builds (`VITE_DEBUG === "true"`) call `/api/debug/session` with a `playerId` kept in `localStorage` (`debugPlayerId`), so every tester and every Playwright context is its own player. The id is `tester-` plus 8 chars from `crypto.getRandomValues`, wrapped in `try/catch` for blocked storage. NGU's `Math.random()` id is not copied.
- Currency switch (debug): bootstrap a new session for the same player with another `currency`. Only the label and exponent change; there is no FX conversion. Refused with 409 `round_already_started` while a round is open.

## 3. Endpoints

| Method and path                | Auth   | Purpose                                                                    |
| ------------------------------ | ------ | -------------------------------------------------------------------------- |
| `GET /api/health`              | none   | Liveness and contract version                                              |
| `POST /api/session`            | none   | Bootstrap                                                                  |
| `POST /api/session/refresh`    | bearer | Rotate token                                                               |
| `GET /api/game/balance`        | bearer | `BalanceResponse`                                                          |
| `POST /api/game/current`       | bearer | Resume: balance plus the open round if any. Body `{}`. (POST as in NGU.)   |
| `POST /api/game/play`          | bearer | Every state change: `start`, `decide`, `settle`                            |
| `GET /api/game/round/:roundId` | bearer | One of the player's own rounds, any status. Also the replay source.        |
| `GET /api/game/history`        | bearer | Settled rounds, newest first. `?limit=10&offset=0`, limit clamped to 1..50 |
| `/api/debug/*`                 | bearer | Section 10. Registered only when the server enables debug routes.          |

A round that belongs to another player returns 404 `round_not_found`, the same as a missing one. There is at most one open (not `settled`) round per player.

## 4. `POST /api/game/play`

Request: `PlayRequest`. `message` holds **exactly one** of the verbs below, otherwise 400 `invalid_message`. `idempotencyKey` is required (a non-empty string of 16 to 64 characters), otherwise 400 `invalid_request`. (`GET` reads and body-less `POST`s follow the body rule in section 1.)

| Verb     | Body                                                | Effect                                                                                                                                                                                                                                  | Errors                                                                                                                                                                                                                          |
| -------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`  | `{ wagerMinorUnits }`                               | Validates the wager, debits it, creates the round, picks the fixture (or the forced one), attaches `outcomePolicy` and `eventPlanId`. Returns the round in its post-start status (section 6).                                           | 400 `invalid_bet` (not a safe integer, below min or above max), 402 `insufficient_balance`, 409 `round_already_started`                                                                                                         |
| `decide` | `{ roundId, decisionId, optionId, sequenceNumber }` | Records one decision against the pending decision point. `sequenceNumber` is 1-based and must equal `decisions.length + 1`. Applies the policy: Policy A never changes the payout, Policy B may resolve the round on the last decision. | 404 `round_not_found`, 409 `round_not_awaiting_choice`, 409 `stale_decision` (wrong `decisionId` or `sequenceNumber`), 409 `decision_already_recorded` (that sequence number is taken by a different key), 400 `invalid_option` |
| `settle` | `{ roundId }`                                       | Credits `outcome.payoutMinorUnits` once and moves the round to `settled`. A round already `settled` returns the stored settlement and never credits again, whatever key is sent.                                                        | 404 `round_not_found`, 409 `round_not_resolved`                                                                                                                                                                                 |

**`decide` check order (first match wins).** The same key replaying is answered from the idempotency store before any of this. Then: 404 `round_not_found`; 409 `decision_already_recorded` when `sequenceNumber` is between 1 and `decisions.length`, **whatever the round's status now** (so a repeat of the last decision, sent with a new key after the round has resolved, is `decision_already_recorded` and not `round_not_awaiting_choice`); 409 `round_not_awaiting_choice` when the round is not `awaiting_choice`; 409 `stale_decision` when `decisionId` is not the pending one or `sequenceNumber` is not `decisions.length + 1` (this includes 0 and negative numbers); 400 `invalid_option`. A malformed field (a non-string id, a non-integer `sequenceNumber`) is 400 `invalid_request` before all of these.

Response (200 for all verbs, including a replay): `PlayResponse`. `balanceMinorUnits` is the authoritative balance after the verb. `replayed: true` appears only when the response is a stored replay.

Payout and settlement are computed only by the server, with integer arithmetic (placeholder rule: `floor(wager * multiplierBps / 10_000)`, guarded by `Number.isSafeInteger`). The client displays `outcome.payoutMinorUnits` and `settlement.payoutMinorUnits` and never computes either.

## 5. Reads

- `GET /api/game/balance` returns `{ balanceMinorUnits, currency }`.
- `POST /api/game/current` returns `{ balanceMinorUnits, currency, active: false }` or `{ balanceMinorUnits, currency, active: true, round }`. It never changes state. It returns the round in whatever status it is in, including `resolved` (unsettled), so the client can finish it.
- `GET /api/game/round/:roundId` returns `{ round }`. The client replays a settled round by feeding this record to the presentation. It is deterministic: the same `eventPlanId` and `decisions` give the same event order.
- `GET /api/game/history?limit&offset` returns `{ rounds: HistoryEntry[], total }`, settled rounds only, newest first. `total` is the player's count of settled rounds, whatever `limit` and `offset` are. A read never fails on its query: `limit` defaults to 10 and is clamped to 1..50; `offset` defaults to 0 and is clamped to 0 or more; a missing, empty, non-numeric or non-integer value (`abc`, `1.5`) falls back to the default, and an out-of-range one is clamped. An `offset` past the end returns `rounds: []`.

## 6. Round status, and what the client does with it

Server `status` is authoritative and is a function of the round record only. The server does not know how far the animation has got. The client state is a function of `status` plus local progress, and presentation never leads the server (BUILD-PLAN §10.1). The pure function `roundMachine(round | null, local)` in `src/utils/roundMachine.ts` implements this table and is tested once.

`local` = `{ request: none | start | decide | settle, presentation: idle | running | at_decision | finished, failure: none | request_failed | connection_lost | status_unknown }`.

| Server `status`   | `local`                                                          | Client state                                                                                           |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| no round          | `request: none`                                                  | `IDLE`, or `CONFIGURING_BET` while the bet panel is being edited                                       |
| no round          | `request: start`                                                 | `SUBMITTING_BET`                                                                                       |
| `accepted`        | any                                                              | `ROUND_ACCEPTED`. Never emitted by the mock.                                                           |
| `running`         | `presentation: running`                                          | `PRESENTATION_RUNNING`                                                                                 |
| `running`         | `presentation: finished`                                         | `RESOLVING_OUTCOME`. Poll `GET /round/:id` until the status changes.                                   |
| `awaiting_choice` | `presentation: running`                                          | `PRESENTATION_RUNNING` (the plan has not reached the decision point yet)                               |
| `awaiting_choice` | `presentation: at_decision`, `pendingDecision.type: upgrade`     | `AWAITING_UPGRADE`                                                                                     |
| `awaiting_choice` | `presentation: at_decision`, `pendingDecision.type: risk_reward` | `AWAITING_RISK_CHOICE`                                                                                 |
| `resolved`        | `presentation: running`                                          | `PRESENTATION_RUNNING` with `outcomeConfirmed = true`. The result stays hidden until `outcome_reveal`. |
| `resolved`        | `presentation: finished`, `request: none`                        | `OUTCOME_CONFIRMED`, then immediately send `settle`                                                    |
| `resolved`        | `presentation: finished`, `request: settle`                      | `SETTLEMENT_PENDING`                                                                                   |
| `settled`         | `presentation: running`                                          | `PRESENTATION_RUNNING` (reload or recovery: the round was settled elsewhere). Balance may update.      |
| `settled`         | `presentation: finished`                                         | `SETTLED`, then `RESULTS` until the player starts the next bet                                         |
| any               | `failure: request_failed`                                        | `REQUEST_FAILED` (a definite error: the server did not apply the request)                              |
| any               | `failure: connection_lost`                                       | `CONNECTION_LOST` (network error or timeout: the server may or may not have applied it)                |
| any               | recovering (replaying the same key or calling `current`)         | `RECOVERING_ROUND`                                                                                     |
| any               | `failure: status_unknown`                                        | `ROUND_STATUS_UNKNOWN` (replays exhausted)                                                             |
| boot              | session or `current` pending                                     | `LOADING`                                                                                              |

Status transitions the mock implements:

- `start`, fixture with at least one decision point: `awaiting_choice` with `pendingDecision` set. This holds from the moment of `start`, while the opening events are still playing.
- `start`, fixture with no decision point, Policy A: `resolved` at once (outcome known, not yet credited).
- `decide` that leaves another decision pending: `awaiting_choice`, next `pendingDecision`.
- `decide` that records the last decision: Policy A and Policy B both go to `resolved`. If debug `resolveDelayMs` is set, a Policy B round is `running` until that time has passed and is resolved lazily by the next read. This is how `RESOLVING_OUTCOME` is exercised.
- `settle`: `resolved` to `settled`, credit applied once.

**Cells the table leaves open (ruled in W3-V, implemented by `roundMachine`).** (1) `awaiting_choice` with `presentation: finished` is treated like `at_decision`: a plan that ended on its decision point must still show the choice, or the round would deadlock. (2) `resolved` with `presentation` of `idle` or `at_decision`, and `running` with any presentation other than `finished`, fall back to `PRESENTATION_RUNNING` (the presentation has not caught up). (3) `settled` with `presentation: finished` is `SETTLED` whatever `request` says. (4) The failure, `recovering` and `loading` rows win over every status row, in the order `loading`, `status_unknown`, `recovering`, `connection_lost`, `request_failed`. (5) `outcomeConfirmed` is true only for server status `resolved`; for a `settled` round a consumer reads `round.outcome`, which the server has set. (6) `roundStore` ignores a second `settled` snapshot for a round whose results were already reached; a later replay of that same round (W9) must call `reset()` first. (7) `roundStore.beginAction` reuses the pending key only for the same verb and cannot see the message; the caller must not change a message while a possibly-applied action is pending (reconcile first).

Policy A fixes the payout at `start` (`outcomePolicy.payoutMinorUnits`) and decisions are recorded but cannot change it. Policy B has no payout until the last decision resolves it. Resolution is `f(seed, round index, decisions)`, so the same seed and decisions replay to the same outcome. A decision point's timeout policy in the mock is `pause`: the round waits indefinitely (decision U-3).

## 7. Who builds the PresentationPlan

**The client.** The server returns `eventPlanId` on the round, and, once the round resolves, `outcome.category` and `outcome.presentationId` (the finale). `src/constants/presentationMaps.ts` maps `EventPlanId` to a `PresentationPlan`. Reasons: events carry durations and asset ids that are presentation data; the server must not know about art; a plan cannot carry or change money. The server's fixtures type `eventPlanId` as `EventPlanId` (a union in `src/types/round.ts`), and the client map is `Record<EventPlanId, PresentationPlan>`, so the two cannot drift at compile time. An id the client does not know (a newer server) falls back to a generic plan and logs it (Phase 4 criterion).

- `outcome_reveal.presentationId` is read from `ResolvedOutcome.presentationId` when the plan reaches that event. It is not stored in the plan.
- For Policy B the plan must be outcome-neutral until the last decision. If a category-specific body is ever needed after the last decision, add `tailPlanId` to `ResolvedOutcome` **here first**.

## 8. Errors

Body: `{ error: { code, message } }`. Handlers throw `HttpError(status, code, message)`. Rejected requests are not stored for idempotency, so the same key can be retried after the cause is fixed (for example after a credit).

| Status | `code`                      | When                                                                     |
| ------ | --------------------------- | ------------------------------------------------------------------------ |
| 400    | `invalid_json`              | Body is not JSON                                                         |
| 400    | `invalid_request`           | Missing or malformed field (including `idempotencyKey`)                  |
| 400    | `invalid_message`           | `message` does not contain exactly one known verb                        |
| 400    | `invalid_bet`               | Wager is not a safe integer, or outside min and max                      |
| 400    | `invalid_option`            | `optionId` is not an option of the pending decision                      |
| 400    | `invalid_currency`          | Unknown currency at bootstrap                                            |
| 400    | `invalid_debug_request`     | Bad body on a debug route                                                |
| 401    | `invalid_session`           | Missing, unknown, expired or already-rotated token                       |
| 402    | `insufficient_balance`      | Wager exceeds balance                                                    |
| 404    | `round_not_found`           | Missing, or not this player's                                            |
| 404    | `not_found`                 | Unknown route, or a debug route while debug is off                       |
| 409    | `round_already_started`     | `start` while a round is open, or currency switch while a round is open  |
| 409    | `round_not_awaiting_choice` | `decide` when no decision is pending                                     |
| 409    | `stale_decision`            | `decisionId` is not the pending one, or `sequenceNumber` is not the next |
| 409    | `decision_already_recorded` | That sequence number is already recorded under a different key           |
| 409    | `round_not_resolved`        | `settle` before the round is resolved                                    |
| 409    | `idempotency_key_reused`    | Same key, different `message`                                            |
| 500    | `server_error`              | Unexpected                                                               |
| 500+   | `simulated_error`           | Debug `failNext` or `errorRate`. Nothing was applied.                    |

Client-side codes, reported by `src/api/http.ts` as `ClientErrorCode = ApiErrorCode | "network_error" | "timeout" | "bad_response"` (a client type, not on the wire):

| `code`          | `status`                 | When                                                                                                                                                                                                     |
| --------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `network_error` | 0                        | `fetch` rejected (server down, connection dropped, CORS failure)                                                                                                                                         |
| `timeout`       | 0                        | The 15 s timeout fired                                                                                                                                                                                   |
| `bad_response`  | the HTTP status received | The reply is not a contract error body: a non-2xx without `{ error: { code, message } }` (a proxy's HTML 502, say), or a 2xx whose body is not JSON. The server may or may not have applied the request. |

`ApiError` carries `status`, `code` and the message. The reconcile rule (section 9) classifies by **status**, never by code: status 0 and any 5xx are "may have been applied" and replay with the same key; any other 4xx is definite.

## 9. Idempotency and failure handling

- The client makes one `idempotencyKey` per **logical action** (one per bet click, per decision, per settle) and reuses it on every retry of that action, including the retry after a 401. Keys are 128 random bits from `crypto.getRandomValues`, formatted as a UUID v4. **Do not use `crypto.randomUUID()`**: it does not exist on plain-HTTP LAN origins, which is how a phone reaches the dev server. Never `Math.random()`. The pending key is held in the round store so a user "Retry" resends it.
- The server keeps, per player, `key -> { verb, canonical message, response }` for the life of the process. Same key and same message returns the stored response with `replayed: true`. Same key and a different message is 409 `idempotency_key_reused`. The stored response is the one from first processing, so a replayed `start` shows the round as it was at `start`; call `current` for the live state.
- Natural-key protection also holds under a **different** key: one open round (`round_already_started`), one decision per sequence number, one settlement per round. No sequence of keys can debit twice for one round or credit one round twice.
- Handlers run synchronously: no `await` between reading and writing the wallet or round. Debug latency is applied before the handler.
- **Reconcile rule.** For a mutating call that ends with status 0 (`network_error`, `timeout`) or any 5xx (including `simulated_error` and a `bad_response` carrying a 5xx or a 2xx): replay the same key up to 2 more times (500 ms, then 1500 ms; placeholders in `src/api/http.ts`). If it still fails, surface `CONNECTION_LOST` then `ROUND_STATUS_UNKNOWN`, call `current`, and do **not** start another round or mint a new key for that action. A definite 4xx is `REQUEST_FAILED` and nothing was applied. A timed-out wager is never assumed lost (BUILD-PLAN §10, §13 #9).
- Boot: `session`, then `current`. An open round is resumed from its `RoundRecord` and `eventPlanId`. What the player sees on resume is decision U-4.

## 10. Debug surface

Answered only when the server enables debug routes (`config.debugRoutes`, default `NODE_ENV !== "production"`). The mock registers the routes always and checks the flag per request in `server/src/http.ts`, before auth and routing, so with debug off every path under `/api/debug/` (with or without a token, percent-encoded or with doubled slashes, `session` included) is the same 404 `not_found` as an unknown route. Every route except `/api/debug/session` needs the bearer token and acts on **that player**. The client calls them only from `src/api/debug.ts`, which is imported only behind `import.meta.env.VITE_DEBUG === "true"`, so a production build contains none of it (`/debug` must not appear in `dist/`).

Debug can change which outcome a **new** round gets and can break the transport. It cannot rewrite a round that already exists, and it adds no field to a non-debug response.

| Route                            | Body                                                                             | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/debug/session`        | `{ playerId, currency? }`                                                        | Section 2. `playerId` is 1 to 64 chars of `[A-Za-z0-9_-]`, else 400 `invalid_debug_request`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `GET /api/debug/state`           | none                                                                             | `DebugState` (below), including the fixture list and the currency list for menus.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `POST /api/debug/balance/set`    | `{ balanceMinorUnits }`                                                          | Sets the exact balance. Returns `BalanceResponse`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `POST /api/debug/balance/credit` | `{ amountMinorUnits? }`                                                          | Adds to the balance (default 100000). Returns `BalanceResponse`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `POST /api/debug/force`          | `DebugForce` or `{ force: null }`                                                | Forces the outcome of the next round (`sticky: false`) or every later round (`sticky: true`). `fixtureId` picks one fixture exactly. `category` picks a seeded-random fixture of that category. `policy` restricts to fixed or choice-constrained. For a choice-constrained round, `category` is also what the last decision resolves to, whatever option was chosen (this is "force decision results"). Returns `DebugState`.                                                                                                                                                                |
| `POST /api/debug/simulate`       | any of `latencyMs`, `errorRate`, `failNext`, `dropAfterAccept`, `resolveDelayMs` | Merges the provided fields into `DebugSimulation`. `latencyMs`: added to every non-debug request. `errorRate` (0..1): chance of a simulated 500 before processing, drawn from a separate seeded stream so it never shifts outcomes. `failNext: { count, status, verb? }`: fail the next `count` matching requests with that status before processing. `dropAfterAccept`: for the next N `play` calls, process fully (debit, create round, store the key) and then destroy the socket without answering. `resolveDelayMs`: Policy B resolution is deferred by this long. Returns `DebugState`. |
| `POST /api/debug/reset`          | none                                                                             | Clears this player's rounds, idempotency keys, force and simulation, restores the starting balance, resets the round counter. The session stays valid. Returns `DebugState`.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `POST /api/debug/expire-session` | none                                                                             | Marks the calling token expired, so the next request exercises the 401 path. Returns `{ ok: true }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `POST /api/debug/seed`           | `{ seed: string \| null }`                                                       | Sets the per-player PRNG seed (null restores the server default) and resets the round counter, so a run can be reproduced. Returns `DebugState`.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `GET /api/debug/round/:roundId`  | none                                                                             | `DebugRoundResponse = { round: RoundRecord, debug: DebugRoundInfo }` (section 12), for "copy round JSON" and replay. `round` is exactly what `GET /api/game/round/:roundId` returns; `debug` adds the mock internals. 404 `round_not_found` if not this player's.                                                                                                                                                                                                                                                                                                                             |

**Simulation bounds (400 `invalid_debug_request`, nothing changed; all fields are checked before any is applied).** `latencyMs` and `resolveDelayMs`: integers from 0 to 2,147,483,647 (the `setTimeout` limit; the client's own 15 s timeout is what makes a large latency useful). `dropAfterAccept`: integer 0 or more. `errorRate`: a number from 0 to 1. `failNext`: `null`, or `{ count, status, verb? }` with `count` an integer of 1 or more, `status` an integer from **400 to 599** (the error body is `simulated_error` at that status, so section 8's "500+" row is a default, not a limit) and `verb` one of `start`, `decide`, `settle`. Simulation applies to the **player's own `/api/game/*` requests only**: debug routes, session routes and health are exempt, so a tester can always undo it. `failNext` without a `verb` matches every game request (reads included); with a `verb` it matches only that `play` verb. `dropAfterAccept` counts only `play` calls that were processed successfully (a rejected one is answered normally and does not use up the count). Order per request: latency, then `failNext`, then `errorRate`, then the handler. `resolveDelayMs` is read when a Policy B round records its last decision and again on each read, so changing it affects a round already held.

**Debug request validation (all `invalid_debug_request`, status 400, nothing changed).** `balance/set` and `balance/credit` need a non-negative safe integer; a credit whose result would exceed `Number.MAX_SAFE_INTEGER`, or a set above it, is refused rather than clamped (no float money, no wraparound). `force` needs a `fixtureId`, `category` or `policy` (or `{ force: null }`), a known category and policy, and **at least one fixture matching the whole combination**; a force that matches no fixture is refused when set, so a later round never fails to draw. `seed` is a string of 1 to 64 characters or null. A malformed `playerId` is the same code.

`GET /api/game/round/:roundId` is the replay source for the client. The debug route only adds mock internals, nested under `debug` so `round` stays a plain `RoundRecord`.

**Determinism rule (for `seed`, `reset` and `force`).** `roundIndex` is the player's 0-based count of started rounds since the last `reset` or `seed` call, and `DebugState.roundsPlayed` is the same counter. Every started round consumes one index, forced or not. The fixture of an unforced round is `draw(seed, roundIndex)`, a pure function, so a forced round never shifts what later rounds draw. A forced `category` picks among that category's fixtures with a draw keyed on `(seed, roundIndex)` too. `errorRate` draws from a separate stream. Same seed and same index therefore always give the same `fixtureId`, `eventPlanId` and payout.

## 11. Mock configuration (placeholders, labelled in `server/src/config.ts`)

All of these are placeholders for BUILD-PLAN §18 #6. None is a product decision.

| Constant                | Value                                                                         |
| ----------------------- | ----------------------------------------------------------------------------- |
| Currency and exponent   | `USD`, 2. Debug list: `USD` 2, `EUR` 2, `GBP` 2, `JPY` 0.                     |
| Starting balance        | 100000 (1000.00)                                                              |
| Wager min, max, default | 10, 50000, 100                                                                |
| Wager steps             | 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000                     |
| Session TTL, refresh    | 60 min inactivity, client refresh every 20 min                                |
| Payout multipliers      | In basis points per fixture; floor rounding                                   |
| Categories              | `loss`, `small_win`, `standard_win`, `big_win`, `major_win`, `jackpot` (§4.3) |

## 12. Wire types

Placed in `src/types/`. The server imports them with `import type` only, so every file here: uses `export type` only (no enums, no namespaces, no runtime values), imports siblings with `./` (never `@/`, which the server cannot resolve), and compiles under `erasableSyntaxOnly`. Types used by one module only stay in that module.

Backend owns these files. `src/types/presentation.ts` is the exception: it is client-only, and the frontend owns it (the event union grows as each event is built, §7.2).

```ts
// src/types/round.ts  (backend)
import type { DecisionPoint, PlayerDecision } from "./decision.ts";

export type OutcomeCategory = "loss" | "small_win" | "standard_win" | "big_win" | "major_win" | "jackpot";
export type RoundStatus = "accepted" | "running" | "awaiting_choice" | "resolved" | "settled";

/** Grows with the phase that adds a plan. Edit here first. The client's map is Record<EventPlanId, PresentationPlan>. */
export type EventPlanId =
	| "plan_loss"
	| "plan_small_win"
	| "plan_standard_win"
	| "plan_big_win"
	| "plan_major_win"
	| "plan_jackpot"
	// Rounds with decision points need a plan that contains the decision_point event, so they get their own ids.
	// Policy A (outcome fixed at start): category then decisions. Policy B: neutral, it must not name a category.
	| "plan_small_win_weapon"
	| "plan_loss_evolution"
	| "plan_big_win_weapon_evolution"
	| "plan_choice_route";

/** Finale selected by outcome_reveal. Per the §7.2 naming rule: VictoryFinisher, DefeatSequence, JackpotCelebration. */
export type FinaleId = "defeat" | "victory" | "jackpot";

export type OutcomePolicy =
	| { type: "fixed"; outcomeId: string; payoutMinorUnits: number }
	| { type: "choice_constrained"; policyId: string; permittedChoices: string[]; resolutionRef: string };

export type ResolvedOutcome = {
	roundId: string;
	outcomeId: string;
	category: OutcomeCategory; // addition to §4.4
	payoutMinorUnits: number;
	presentationId: FinaleId;
	resolutionVersion: string;
};

export type SettlementRecord = {
	roundId: string;
	wagerMinorUnits: number;
	payoutMinorUnits: number;
	currency: string;
	settlementId: string;
	settledAt: string; // addition
};

export type RoundRecord = {
	roundId: string;
	wagerMinorUnits: number;
	currency: string;
	outcomePolicy: OutcomePolicy;
	eventPlanId: EventPlanId;
	status: RoundStatus;
	// additions to §4.4, so one record is enough to resume or replay:
	createdAt: string;
	pendingDecision: DecisionPoint | null; // set iff status === "awaiting_choice"
	decisions: PlayerDecision[];
	outcome: ResolvedOutcome | null; // set from "resolved"
	settlement: SettlementRecord | null; // set iff "settled"
};

export type HistoryEntry = {
	roundId: string;
	createdAt: string;
	settledAt: string;
	wagerMinorUnits: number;
	payoutMinorUnits: number;
	currency: string;
	category: OutcomeCategory;
};
```

```ts
// src/types/decision.ts  (backend). §6.2 verbatim, plus PlayerDecision from §4.4.
export type DecisionOption = {
	id: string;
	title: string;
	description: string;
	visualTheme: string;
	resolutionRuleId: string;
};

export type DecisionPoint = {
	id: string; // this is the `decisionId` on the wire
	type: "upgrade" | "risk_reward";
	options: DecisionOption[];
	defaultOptionId?: string;
	timeoutPolicy: "default" | "pause" | "abort_if_permitted"; // the mock only uses "pause"
	outcomeEffect: "presentation_only" | "authoritative_resolution";
};

export type PlayerDecision = { roundId: string; decisionId: string; optionId: string; sequenceNumber: number };
```

```ts
// src/types/api.ts  (backend)
import type { HistoryEntry, RoundRecord } from "./round.ts";

export type GameConfig = {
	mock: true;
	contractVersion: string;
	currency: string;
	minorUnitExponent: number;
	minWagerMinorUnits: number;
	maxWagerMinorUnits: number;
	defaultWagerMinorUnits: number;
	wagerStepsMinorUnits: number[];
};

export type SessionResponse = {
	sessionToken: string;
	playerId: string;
	balanceMinorUnits: number;
	config: GameConfig;
};

export type PlayMessage =
	| { start: { wagerMinorUnits: number } }
	| { decide: { roundId: string; decisionId: string; optionId: string; sequenceNumber: number } }
	| { settle: { roundId: string } };

export type PlayRequest = { idempotencyKey: string; message: PlayMessage };
export type PlayResponse = {
	roundId: string;
	message: { round: RoundRecord; balanceMinorUnits: number; replayed?: true };
};

export type BalanceResponse = { balanceMinorUnits: number; currency: string };
export type CurrentResponse = BalanceResponse & ({ active: false } | { active: true; round: RoundRecord });
export type RoundResponse = { round: RoundRecord };
export type HistoryResponse = { rounds: HistoryEntry[]; total: number };

export type ApiErrorCode =
	| "invalid_json"
	| "invalid_request"
	| "invalid_message"
	| "invalid_bet"
	| "invalid_option"
	| "invalid_currency"
	| "invalid_debug_request"
	| "invalid_session"
	| "insufficient_balance"
	| "round_not_found"
	| "not_found"
	| "round_already_started"
	| "round_not_awaiting_choice"
	| "stale_decision"
	| "decision_already_recorded"
	| "round_not_resolved"
	| "idempotency_key_reused"
	| "server_error"
	| "simulated_error";
export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };
```

```ts
// src/types/debug.ts  (backend). Imported by the client only inside debug code.
import type { EventPlanId, OutcomeCategory, OutcomePolicy, RoundRecord, RoundStatus } from "./round.ts";

export type DebugForce = {
	fixtureId: string | null;
	category: OutcomeCategory | null;
	policy: OutcomePolicy["type"] | null;
	sticky: boolean;
};

export type DebugSimulation = {
	latencyMs: number;
	errorRate: number;
	failNext: { count: number; status: number; verb?: "start" | "decide" | "settle" } | null;
	dropAfterAccept: number;
	resolveDelayMs: number;
};

export type DebugFixtureInfo = {
	fixtureId: string;
	category: OutcomeCategory;
	policy: OutcomePolicy["type"];
	eventPlanId: EventPlanId;
	decisionPointIds: string[];
};

export type DebugState = {
	mock: true;
	contractVersion: string;
	playerId: string;
	seed: string;
	roundsPlayed: number;
	force: DebugForce | null;
	simulation: DebugSimulation;
	fixtures: DebugFixtureInfo[];
	currencies: { code: string; minorUnitExponent: number }[];
};

/** GET /api/debug/round/:roundId. `round` is the same record GET /api/game/round/:roundId returns. */
export type DebugRoundResponse = { round: RoundRecord; debug: DebugRoundInfo };

export type DebugRoundInfo = {
	fixtureId: string;
	/** The force in effect when the round started (a copy), or null when the round was drawn from the seed. */
	forced: DebugForce | null;
	/** The player's seed when the round started. */
	seed: string;
	/** 0-based, see the determinism rule in section 10. `draw(seed, roundIndex)` reproduces an unforced round. */
	roundIndex: number;
	/** Oldest first. The first entry is the status at creation. `at` is when the server recorded the change (ISO 8601 UTC). */
	statusHistory: { status: RoundStatus; at: string }[];
	/** Each key first processed for this round, in first-use order. A replay of a key is not listed again. */
	idempotencyKeys: { verb: "start" | "decide" | "settle"; key: string; at: string }[];
};
```

`src/api/debug.ts` returns `DebugRoundResponse` from `getDebugRound` and drops its interim `DebugRoundRecord` type. `ClientErrorCode` (section 8) is a client type in `src/api/http.ts`, not part of the wire files.

```ts
// src/types/presentation.ts  (FRONTEND). BUILD-PLAN §7.2, starting set. Not on the wire.
export type PresentationEvent =
	| { type: "run_intro"; durationMs: number }
	| { type: "coin_trail"; durationMs: number; intensity: number }
	| { type: "monster_wave"; durationMs: number; monsterIds: string[] }
	| { type: "weapon_upgrade"; durationMs: number; upgradeId: string }
	| { type: "trap_hit"; durationMs: number; severity: "minor" | "major" }
	| { type: "decision_point"; decisionPointId: string }
	| { type: "boss_encounter"; durationMs: number; bossId: string }
	| { type: "outcome_reveal"; durationMs: number }; // presentationId comes from ResolvedOutcome, see section 7

export type PresentationPlan = { planId: string; version: string; events: PresentationEvent[] };
```

Money display: format minor units with integer division and zero padding (`utils/formatMoney.ts`, tested, driven by `minorUnitExponent`), never `value / 100` into a float.

## 13. Changelog

- v0.2 (2026-10-26, W3 verification). Still `"0.2"`: the only wire change is additive (four new `EventPlanId` members, and the client already falls back on an unknown id, section 7). Rulings: `EventPlanId` gains `plan_small_win_weapon`, `plan_loss_evolution`, `plan_big_win_weapon_evolution` and `plan_choice_route` (B5 had parked the Policy B fixture `vault_route` on `plan_standard_win`, which names a category before the choice; the three Policy A decision fixtures `dagger_choice_small`, `evolution_loss`, `evolution_big` take the other three, so each plan can contain its `decision_point`); section 4 `decide` check order (`decision_already_recorded` before `round_not_awaiting_choice`); section 5 history query fallback; section 6 cells the table left open (the `roundMachine` and `roundStore` behaviours); section 10 simulation bounds (`failNext.status` 400..599, game requests only).
- v0.1 (2026-10-25): first draft.
- v0.2 (2026-10-26, W2 verification). `contractVersion` is `"0.2"` everywhere (health, `config`, `DebugState`), as this file already was; the mock had been reporting `"0.1"`. Section 10 documents the overflow and no-matching-fixture refusals as 400 `invalid_debug_request`. No wire shape changed.
- v0.2 (2026-10-25, W1 verification). No change to any endpoint, field or status of a non-debug call. Added: section 1 body rule (`POST` always sends a JSON object, `{}` when empty) and timeout wording (`AbortSignal.timeout`); section 8 client codes table with `bad_response` and the by-status classification; section 9 reconcile wording; section 10 debug-off behaviour ("answered", gated per request), `DebugRoundResponse` / `DebugRoundInfo` for `GET /api/debug/round/:roundId` (nested, replaces "RoundRecord plus extras"), and the determinism rule; section 12 `DebugRoundResponse`, `DebugRoundInfo`. Implemented by W2-B3 (debug round route, `src/types/debug.ts`, `src/api/debug.ts`) and W8-B7 (`bad_response` for an unparsable 2xx).
