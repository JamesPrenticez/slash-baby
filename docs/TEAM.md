# Slash Baby build team

How the agent team builds `docs/BUILD-PLAN.MD`. Written 2026-10-25.

Precedence: this file records the user's later decisions, so it wins over `BUILD-PLAN.MD` where they disagree. `CLAUDE.md` and `.claude/docs/ANIMO.md` win over both, except for the overrides listed below.

## Roles

| Role            | Agent file                          | Owns                                                                                                                                                                      | Never                                                                                |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Lead            | the main Claude session             | Dispatching, sequencing waves, user contact, `pnpm add`/`install` between waves                                                                                           | Writes feature code while a wave is running                                          |
| Project manager | `.claude/agents/project-manager.md` | `docs/STATUS.md`, `docs/API-CONTRACT.md`, this file. Plans phases, runs every CI gate, signs off, polices scope                                                           | Edits anything outside those three files                                             |
| Backend         | `.claude/agents/backend.md`         | `server/**`, `src/api/**`, wire types in `src/types/**`, `src/utils/testFetch.ts` (the one `utils/` file it owns), the root scripts and config lines that boot the server | Touches `src/components/`, `src/hooks/`, `src/stores/`, `src/styles/`, `src/assets/` |
| Frontend        | `.claude/agents/frontend.md`        | The rest of `src/**` (components, hooks, stores, styles, assets, constants, utils except `testFetch.ts`, `App.tsx`), `e2e/**`, `index.html`                               | Touches `server/**` or `src/api/**`; computes a payout or outcome                    |

Subagents cannot spawn other subagents, so the lead dispatches all of them. The project manager plans and verifies; it does not dispatch.

Shared config (`package.json`, `vite.config.js`, `playwright.config.ts`, `eslint.config.js`, `tsconfig.json`, `src/vite-env.d.ts`, `src/styles/colors.css`): small `Edit`s only, never a whole-file `Write`, and re-read the file immediately before editing because another agent may have changed it. Only the agent the lead names may run `pnpm add` or `pnpm install` in a given wave.

## Overrides to the build plan

1. **No `@animo-gaming/ui`.** The user decided to ignore the library entirely. This supersedes BUILD-PLAN §0.3 "UI reuse", §8.7 "Reuse first" and "Gaps", and §18 #3. UI is ported locally from `C:\Users\prent\animo\hooked\src\components` and `...\hooked\src\hooked-ui` (hooked is a copy of Never Give Up), and from NGU's `src/components/ui`. A port copies the behaviour and look and rewrites the rest to this repo's standards:
   - Styling is **CSS Modules** with tokens from `src/styles/`. No `styled-components`, and no raw hex or px colour or font outside `src/styles/`. New palette entries go in `colors.css`.
   - Layout is the nine-directory structure: a component is a PascalCase directory with `index.ts`, `@/` imports across directories, no per-directory barrels.
   - Stores are `zustand` (added when first needed). Icons are SVGs imported with `?react`.
   - Remove the library's stylesheet import from `main.tsx` if it clashes or nothing uses it, and report it. Leave `package.json` alone.
2. **A real mock backend.** `server/` at the repo root is a dev-only mock game server, modelled on NGU's `src/api/index.ts` contract and implemented the way `hooked/server` is (`node:http`, `node:test`, Node type stripping, no framework). This replaces BUILD-PLAN §8.3's `api/localRoundClient.ts` and `constants/outcomeFixtures.ts`: outcomes live on the server, so the client holds none. `src/api/` is the typed fetch client. Phase 3 ("local simulation") becomes "rounds against the mock server" and Phase 7 becomes hardening that integration (idempotency, reconciliation, recovery).
   - The server is labelled MOCK everywhere and is never imported by `src/`, except type-only imports of the wire types in `src/types/`.
   - Transport, session, auth and debug design come from NGU. Money follows the plan: integer minor units on the wire, no floats. Where NGU and the plan disagree, the plan wins and `docs/API-CONTRACT.md` says so.
3. **Betting UI mirrors NGU's `user-interface.tsx`**: top bar, bottom bar (balance, bet, call to action, menu, audio), round history, and the menu, game info, bet history and volume modals. Not built, because the plan has no matching feature: autoplay (plan §14 non-goal), bonus/automine/battle, difficulty, fairness/seeds, and NGU's "return to player" camera button. Game info text is placeholder copy.
4. **Debug menu for manual testing**, which is not in the plan (it only mentions debug tools in Phase 9). Rules:
   - Modelled on NGU's `debug-toolbar.tsx`/`debug-toggle.tsx` and hooked's `debug.modal.tsx`, with a matching `/api/debug/*` surface on the server.
   - On when `VITE_DEBUG === "true"`. `pnpm dev` turns it on through `.env.development`. It must be absent from the production bundle, which the PM verifies by grepping `dist/`.
   - Server debug routes register only when the server config enables them.
   - **Every phase ships the debug controls for its own features** in the same phase. Examples: set balance and credit, force an outcome category or fixture, fire a single presentation event, readouts for scroll/speed/FPS/round state/active event, latency and failure injection, drop the connection after bet accept, replay a round by id, copy round JSON.
   - Debug controls may only call debug endpoints. They can never change what a non-debug round does.
5. **Git.** No commits, branches or pushes unless the user asks. Jira IDs are unknown and must not be invented. Work stays in the working tree. Each verified chunk ends with a proposed one-line Conventional Commit and the exact file list to stage by name.

Open decisions in BUILD-PLAN §18 take their stated defaults, except #3 (answered above). Product parameters (#6) are labelled placeholder constants in `server/` only.

## Rules for every agent

- Read `CLAUDE.md`, `.claude/docs/ANIMO.md`, BUILD-PLAN §0, §8.3, §8.4 and §16–18, and this file before touching anything.
- Do not invent requirements. A user-visible rule the plan or the user did not state is a question for the lead, not a default. Say what you were about to assume.
- Ponytail applies: no abstraction, config or file before the phase that needs it, and reuse what exists.
- Test first, colocated. Frontend/shared units use Vitest; the server uses `node:test` beside the code. A feature is not done until it has an e2e spec (display-only work is exempt, and the report says so).
- CI gates, all of which must pass before a phase is reported done: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run --coverage`, `pnpm build`, the server's typecheck and tests, and `pnpm e2e:test`.
- Report outcomes faithfully. A failing gate is reported with its output, a skipped step is reported as skipped, and nothing is described as verified unless it was run.
- Money is integer minor units. The renderer and the client never decide or recompute an outcome or payout. `Math.random()` never touches an outcome.
- Markdown written while building goes in `docs/`, never `.claude/`.

## Report format

End every task with: files changed (paths), what is complete, gates run and their results, known limitations, requests for other roles, and a proposed one-line commit message with the files to stage.

## PM clarifications (2026-10-25)

Added by the project manager after the wave 0 review. They fill gaps and change none of the user's decisions above. The lead or the user may overrule any of them.

1. **Wire types.** `src/types/*` is backend-owned except `src/types/presentation.ts`, which is client-only (the server never sends a plan) and frontend-owned. Wire type files use `export type` only, import siblings with `./` (never `@/`, the server cannot resolve it) and must compile under `erasableSyntaxOnly`, because the server loads them with Node type stripping. See `docs/API-CONTRACT.md` section 12.
2. **Extra backend files.** Backend also owns `.env.development` (`VITE_DEBUG=true`), the server steps in `.github/workflows/ci.yml`, and `docs/MOCK-SERVER.md`. The charter asks for a README, but `.claude/docs/ANIMO.md` puts project markdown in `docs/`.
3. **No `nodemon`.** `dev:server` is `node --watch` (Node 24). The only packages expected in the whole build are `concurrently` (W1-B1 installs it) and `zustand` (the lead installs it before W2).
4. **Wave rule.** Two tasks in the same wave never edit the same file. Shared files have one named editor per wave in `docs/STATUS.md`; any other task reports the gap instead of editing.
5. **Gate command.** Run e2e as `pnpm e2e:test --reporter=line`. The default `html` reporter opens a report server after a failure and hangs a non-interactive shell.
6. **Idempotency keys** use `crypto.getRandomValues`, not `crypto.randomUUID()` (undefined on plain-HTTP LAN origins, which is how a phone reaches the dev server) and never `Math.random()`.
7. **Debug in production.** Debug UI and `src/api/debug.ts` load only behind `import.meta.env.VITE_DEBUG === "true"` and a dynamic `import()`. The PM checks `dist/` for `DebugMenu`, `debugProbe`, `React commits` and `/debug` every wave.
8. **Pixi leaves and coverage.** Each new Pixi-only component directory is added to `test.coverage.exclude` in `vite.config.js` by the task that creates it (BUILD-PLAN §18 #2 default is accepted and already applied for `GameCanvas`, `ParallaxWorld` and `Assassin`).

### Added after the wave 1 review (2026-10-25)

9. **Shared test helpers.** `.claude/docs/ANIMO.md` puts shared test helpers in `utils/`, so the fetch-mock helper moves from `src/api/testFetch.ts` to `src/utils/testFetch.ts` (done in W2-B3). It stays backend-owned, as a single-file exception to the frontend's `utils/`. `server/src/testing.ts` stays where it is: it is server-side (`node:test`), and a new route module must be imported in both `server/src/index.ts` and `server/src/testing.ts`.
10. **"Registered" debug routes.** Override 4's "register only when the server config enables them" is read as "answer only when enabled". `server/src/http.ts` checks `config.debugRoutes` per request, before auth and routing, and a disabled `/api/debug/*` is indistinguishable from an unknown route. Proven by `server/src/routes/debug.test.ts`, `server/src/index.test.ts` and a probe of a `NODE_ENV=production` server (contract section 10).
11. **Playwright reporter.** `playwright.config.ts` keeps `reporter: "html"` because humans read the HTML report. It is not changed. Agents and the PM always pass `--reporter=line` (clarification 5). The wave 0 defect about the reporter is withdrawn.
12. **Canvas follows its host.** Pixi's `resizeTo` listens to window `resize` only, so a host that changes size for any other reason (late CSS, a scrollbar, a bar mounting, a font swap) leaves the canvas stale. Every Pixi canvas sized from a DOM element also observes that element with a `ResizeObserver`. An e2e test resizes the host without resizing the window (W2-F6).
13. **Global CSS never waits on the network.** `src/styles/*.css` contains no `@import url(https://...)`. A `<style>` with a pending external `@import` holds back the whole sheet in WebKit and Firefox, so `body { margin: 0 }` and every token are missing while Pixi measures its host. Fonts load from `<link>` tags in `index.html` (or are self-hosted); W2-F3 does this.
14. **`parseFloat` and `toFixed`.** The ban protects money: nothing in `server/`, `src/api/`, `formatMoney` or any money path uses them. A pixel measurement such as `FitText` reading padding may use `Number.parseFloat`, with a one-line comment.
15. **Stylesheet scope (open, user decision U-15).** `.claude/docs/ANIMO.md` says `src/styles/` is "the only place a raw color or size value is allowed". The NGU-style primitives built in W1 carry `rem` literals for their own geometry (a toggle 4.6rem wide), as NGU does, and Phase 1 already had two. Until the user answers U-15, agents reuse an existing token whenever one has the value, the PM audits colours and `px` strictly (none exist outside media queries), and `rem` literals are reported, not blocked.

### Added after the wave 2 review (2026-10-26)

16. **StrictMode stays.** `src/main.tsx` keeps `<StrictMode>`. A Pixi `<Application>` must survive its dev-only double effect, including a mount that happens after `init` could already have resolved (a remount, a Retry, a late asset load). `@pixi/react` 8.0.5 destroys an initialised application when the simulated cleanup runs late; `GameCanvas` mounts the `<Application>` so that cannot happen (W3-F7a). The fix is never to remove StrictMode.
17. **e2e must pass at the default worker count.** Software WebGL under 8 workers starves a page, so a spec waits on polled readouts with generous per-assertion timeouts, uses `test.slow()` for long ones, and does not rely on fixed sleeps. No retries are added to `playwright.config.ts` to hide a flake; the PM measures with `--repeat-each=5`.
18. **Coverage waits.** A unit test that waits on a lazy chunk gives its first `findBy` an explicit timeout, because the coverage run is slower than a plain run.
