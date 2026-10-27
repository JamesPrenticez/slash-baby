# Slash Baby MOCK game server

**This is a dev-only mock. It is not a real-money implementation**, and says so in its startup log and in `GET /api/health` (`"mock": true`). It stands in for the real game service so the client can be built against a real HTTP wire. Everything it knows about currency, limits and payouts is a placeholder constant in `server/src/config.ts` (BUILD-PLAN §18 #6), not a product decision.

The wire contract is `docs/API-CONTRACT.md`. This file covers how to run and extend the server.

## Run

```bash
pnpm dev            # client (Vite, :3000) and server (:3001) together
pnpm dev:server     # server only, restarts on change (node --watch)
pnpm typecheck:server
pnpm test:server    # node:test, request-level against the real handler
```

There is no build step and no dependency: Node strips the TypeScript types itself (Node 24). Imports inside `server/` carry the `.ts` extension. `.env.development` sets `VITE_DEBUG=true` for the client in dev.

| Env var       | Default   | Meaning                                                                |
| ------------- | --------- | ---------------------------------------------------------------------- |
| `SERVER_PORT` | `3001`    | Port. `0` picks a free one. It collides with NGU's server if both run. |
| `SERVER_HOST` | `0.0.0.0` | Interface. All interfaces, so a phone on the LAN can reach it.         |
| `NODE_ENV`    | unset     | `production` turns off `/api/debug/*` and request logging.             |

State is in memory and is lost on restart.

## Layout

| File                                                              | Role                                                                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `server/src/index.ts`                                             | Entry point. Imports the route modules, listens, logs the MOCK banner.                                                        |
| `server/src/config.ts`                                            | Env and placeholder constants.                                                                                                |
| `server/src/http.ts`                                              | Router, JSON body, CORS, `HttpError`, request log, `requireSession`, `GET /api/health`.                                       |
| `server/src/sessions.ts`                                          | Players (wallets), sessions, token rotation, 60 minute idle TTL.                                                              |
| `server/src/rng.ts`, `fixtures.ts`, `outcomes.ts`, `decisions.ts` | Seeded PRNG (HMAC streams, no `Math.random`), 15 Policy A fixtures and one Policy B, integer payout `floor(wager*bps/10000)`. |
| `server/src/rounds.ts`, `idempotency.ts`, `debug-state.ts`        | Round store with start and settle, per-player key store, per-player seed, counter, force and simulation defaults.             |
| `server/src/money.ts`                                             | Integer guards. Money is integer minor units, never a float or a decimal string.                                              |
| `server/src/routes/*.ts`                                          | Route modules. They register themselves with `route()` when imported.                                                         |
| `server/src/testing.ts`                                           | Test helper: the real handler on an ephemeral port.                                                                           |

The server imports the wire types from `src/types/` with `import type` only, and nothing in `src/` imports the server.

## Implemented so far

`GET /api/health`, `POST /api/session`, `POST /api/session/refresh`, `GET /api/game/balance`, `POST /api/game/current`, `GET /api/game/round/:roundId`, `GET /api/game/history`, `POST /api/game/play` (`start`, `decide`, `settle`). Debug: `session`, `state`, `balance/set`, `balance/credit`, `force`, `simulate`, `seed`, `reset`, `round/:roundId`, `expire-session`. Fixtures without decisions are Policy A and start already `resolved`. Four carry decisions (`decisions.ts`): `dagger_choice_small`, `evolution_loss`, `evolution_big` (Policy A, presentation only) and `vault_route` (Policy B, a weighted table per option from the seeded stream). They start `awaiting_choice` and are reached by `force` only (`DECISION_FIXTURES_IN_DRAW` in `fixtures.ts`). A debug `resolveDelayMs` holds a Policy B round `running` until a later read.

## Behaviour worth knowing

- **Auth.** Anything under `/api/game/` needs a bearer token, and so does anything under `/api/debug/` except `/api/debug/session`. The check runs before routing, so an unknown path without a token is 401, not 404.
- **Debug routes.** When `config.debugRoutes` is false every `/api/debug/*` path answers exactly like an unknown route (404 `not_found`), including `/api/debug/session`.
- **Wallets belong to the player.** An anonymous player is `anon:<remote address>`, a debug player is `debug:<playerId>`. A new session for the same player sees the same balance.
- **Currency.** A session request may relabel the wallet (`USD`, `EUR`, `GBP`, `JPY`). There is no conversion; the balance number is unchanged.
- **Tokens.** Refresh rotates the token and the old one is dead at once, so each token refreshes once.

- **Simulation** (`/api/debug/simulate`, applied in `http.ts`). It acts on the calling player's `/api/game/*` requests only; `/api/debug/*` and the session bootstrap are exempt. Order: `latencyMs`, then `failNext`, then `errorRate` (its own seeded stream, so fixtures never shift), then the handler. A simulated failure is `simulated_error` with nothing applied. `dropAfterAccept` destroys the socket after a `play` call succeeded (debited, round stored, key remembered); replay the same key to get the round back with `replayed: true`. `resolveDelayMs` holds a Policy B round `running` after its last decision until a later read.

## Tests

`pnpm test:server` runs every `*.test.ts` against the real handler on an ephemeral port. Two suites are the hardening matrix:

- `server/src/contract.test.ts`: one conformance test per endpoint (status, shape, every reachable error code of contract §8; `server_error` has no trigger), and every `*MinorUnits` field is checked to be a safe integer.
- `server/src/recovery.test.ts`: `dropAfterAccept` then same-key replay for `start`, `decide` and `settle`; `current` after a dropped reply and after a reload mid-decision; settling twice; concurrent `start` and `settle` calls (different keys: one round, one debit, one credit; same key: replays); same key with a different body is 409; another player's round is 404; keys are per player; a Policy A choice never moves the payout.

## Adding a route

Create `server/src/routes/<name>.ts`, call `route(method, pattern, handler)`, import the module from `index.ts` and from `testing.ts`. Throw `HttpError(status, code, message)` for failures, with a `code` from `ApiErrorCode`. A handler that needs the player calls `requireSession(ctx.req)`.
