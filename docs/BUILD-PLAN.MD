# SLASH BABY

## Casino Burst Game — Hybrid GDD & AI Agent Build Specification

**Document type:** Game Design Document + Technical Architecture + Implementation Plan
**Genre:** Casino burst game / animated instant-win game
**Visual style:** Anime fantasy, cute and lethal, MapleStory-inspired
**Platform:** Mobile-first, responsive desktop
**Frontend:** React 19 + TypeScript (Vite)
**Rendering:** PixiJS 8 through `@pixi/react`; the assassin is a Spine skeleton
**Round format:** Bet → Burst → Outcome → Payout
**Player controls:** Betting, discrete upgrade choices, discrete risk/reward choices. No real-time movement or combat controls.
**Revision:** v2, 2026-10-24. Aligned to the project's `.claude` standards (§0, §8.3). Phase 1 is now the scrolling world with the running assassin (§8.5, §12).

---

# 0. Starting point and working agreements

Read this section first. It records what exists in the repository and which project rules override anything later in this document. Where this document and `CLAUDE.md` or `.claude/` disagree, the project rules win.

## 0.1 Repository state (2026-10-24)

| Area          | State                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template      | Scaffolded from `animo-claude-template`. `src/App.tsx` renders `null`; the nine standard `src/` directories exist and are empty                                                                   |
| Present       | React 19.3, TypeScript 6, Vite 8, Vitest 5 (happy-dom), Playwright, ESLint 10 + Prettier, Husky + lint-staged, `@animo-gaming/ui` 0.1.36                                                          |
| Not installed | `pixi.js`, `@pixi/react`, `@esotericsoftware/spine-pixi-v8`, `zustand`. Each is added in the phase that first needs it                                                                            |
| Art           | `src/assets/spine-boy/` holds Esoteric's Spine Boy sample as the stand-in character (§11.5). The real assassin export is not in the repo. There are no backgrounds, enemies, effects or audio yet |
| Uncommitted   | `docs/` and `src/assets/spine-boy/` are untracked                                                                                                                                                 |
| CI            | `pnpm lint`, `tsc --noEmit`, `vitest run --coverage` (80% gate) and `pnpm build`; a separate Playwright job runs `e2e/`                                                                           |
| Pre-commit    | lint-staged, then `vitest run --changed`                                                                                                                                                          |

## 0.2 Reference implementation: Never Give Up (NGU)

`C:\Users\prent\animo\never-give-up` is the same team's PixiJS 8 + `@pixi/react` + Spine game. Slash Baby borrows its scrolling and Spine techniques (adapted in §8.5 and §8.6) but not its architecture wholesale. NGU's world is built around a camera that pans through a tunnel being dug; Slash Baby has no camera movement.

| NGU file                                         | Useful for                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/components/game/Tunnel.tsx`                 | Composing one scrolling row: layered background, characters, effects, and per-frame updates written to refs, not React state |
| `src/components/game/ParallaxBg.tsx`             | The parallax layer ladder (`LAYER_SPEEDS`), `TilingSprite` layers at a fixed logical height, baking blurred mist             |
| `src/components/game/Stage.tsx`                  | A tiling backdrop that extends past the world on every side                                                                  |
| `src/components/game/Digger.tsx`                 | Spine wrapper: logical-to-Spine animation map, height-derived scale, safe `complete` handling, cleanup                       |
| `src/manifest.ts`, `src/hooks/useAssetLoader.ts` | Asset manifest (`?url` imports, atlas `data.images` map) and the loader retry strategy                                       |
| `src/App.tsx`                                    | `Application` setup: `resolution = min(devicePixelRatio, 2)`, `autoDensity`, `ticker.maxFPS = 60`                            |

## 0.3 Project rules that apply to every phase

These come from `CLAUDE.md`, `.claude/docs/ANIMO.md` and the skills under `.claude/skills/`.

- **Structure:** `src/` has nine closed directories (§8.3). Components are directories; everything else is a flat file. No new top-level directories and no per-directory barrels.
- **Imports:** `@/` across directories, `./` for siblings. `../` is an ESLint error.
- **Styling:** CSS Modules per component, CSS variables only for colour and font, mobile-first `min-width` queries at 768px and 1024px.
- **UI reuse:** check `@animo-gaming/ui` first (`bash .claude/skills/animo-ui-conventions/ui-inventory.sh`). Icons come from `@animo-gaming/ui/icons`. A missing component or icon is a stop-and-ask (§18), not a local invention.
- **Tests:** written before the change, colocated beside the code, 80% coverage enforced in CI. Shared test helpers live in `utils/`.
- **e2e:** a feature is not finished until `e2e/` has a spec for it. Display-only components are exempt, and the report says so. Specs run on desktop, portrait mobile and landscape mobile across Chrome, Firefox and Safari.
- **No invented requirements:** this document is a goal, not a complete spec. Do not add a user-visible rule it does not state (a required field, a validation limit, a confirm step, a restriction). If one seems necessary, ask and say what you were about to assume. Unspecified product parameters are listed in §18.
- **Git:** Conventional Commits (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`), branches named `<type>/<JIRA-ID>/<short-title>`, PRs from the bundled template. One branch and PR per phase. Stage files by name; never `git add -A`.
- **Formatting and comments:** Prettier owns formatting (tabs, width 120, double quotes). Comment only what the code cannot say; use JSDoc where a contract is not obvious from name and signature.
- **Docs:** markdown written while building the project goes in `docs/`, never `.claude/`.
- **Laziness (ponytail):** no abstraction, config or file before the phase that needs it. Reuse what exists. Add a dependency only when a few lines cannot do the job.

---

# 1. Executive summary

SLASH BABY is a casino burst game presented as a continuous anime action sequence.

The player wagers on a round. After the round begins, a female assassin automatically runs through a fantasy environment, collecting coins, fighting monsters, finding upgrades, triggering power-ups, suffering setbacks and encountering increasingly spectacular threats.

The player does not control the assassin directly.

Instead, the player may make discrete choices at predefined decision points, such as choosing between two weapons or accepting a risky treasure encounter. These choices are processed by explicit game rules and must be compatible with the round's outcome model.

The round concludes with a win, loss or other configured result. The game then presents the outcome through an animated finale and displays the payout.

The core product is not an action game simulation. It is an **outcome-driven casino game whose presentation is an anime action spectacle**.

## Design pillars

1. **Betting is the primary action.** The player should be able to understand the game immediately.
2. **The burst is the entertainment.** Every encounter, upgrade and visual effect contributes to the experience.
3. **Choices are discrete and meaningful.** They create anticipation without turning the game into a conventional skill-based runner.
4. **Outcomes are authoritative.** The animation cannot change or invent a payout.
5. **Events are reusable.** The game should support many visually distinct rounds without requiring a unique animation sequence for every outcome.
6. **The game is data-driven.** New weapons, monsters, events, environments and result sequences should be addable without rewriting the core engine.

---

# 2. Product scope

## 2.1 What the game is

- A casino game with a wager, round lifecycle, defined outcome and payout.
- An automated side-scrolling anime presentation.
- A sequence of authored encounters selected or assembled according to an outcome model.
- A system of optional upgrade and risk/reward decisions.
- A reusable event library that allows many different rounds to be presented.
- A React application with a PixiJS-rendered game world.

## 2.2 What the game is not

- An endless runner.
- A real-time combat game.
- A platformer requiring precise timing.
- A skill-based action game where player reflexes determine the result.
- A physics simulation in which incidental collisions determine the payout.
- A game in which visual coin collection directly creates monetary value without an authoritative reward rule.

The assassin may jump, dodge, attack, stumble and die, but these actions are autonomous presentation events, not player-controlled mechanics.

---

# 3. Core casino round

## 3.1 Primary loop

```text
IDLE
  |
  v
BET CONFIGURATION
  |
  v
BET ACCEPTED
  |
  v
ROUND INITIALISATION
  |
  v
AUTOMATED BURST
  |
  +----> UPGRADE DECISION
  |
  +----> RISK / REWARD DECISION
  |
  v
OUTCOME REVEAL
  |
  v
PAYOUT PRESENTATION
  |
  v
ROUND SETTLED
  |
  v
IDLE / NEXT BET
```

Decision points return the game to the automated burst after the player makes a valid selection. Their effect on the outcome is defined by the configured game rules.

A round must have one authoritative settlement. It cannot settle twice, and the presentation must not change the settlement.

## 3.2 Player interaction

The player can:

- Set their wager.
- Start a round.
- Choose an available upgrade when prompted.
- Accept or decline an optional risk/reward offer.
- Watch the automated burst.
- View the outcome and payout.
- Start another round.

The player cannot:

- Control movement.
- Aim attacks.
- Choose when the assassin attacks.
- Trigger an attack through rapid tapping.
- Avoid damage through reaction speed.
- Manipulate the outcome through rendering or animation timing.

The game must not imply that reflexes determine a payout when they do not.

## 3.3 Suggested round duration

Initial target: approximately 20–40 seconds per round, including decision points.

This is a tuning target, not a hard technical limit. The engine should support configurable durations and shorter or longer bonus sequences.

Allow the player to configure animation speed where appropriate, but changing playback speed must never alter the outcome, payout or decision deadlines.

Playback-speed and skip options can be restricted by jurisdiction or operator. Treat which speeds are offered as configuration, not hardcoded UI, and confirm the allowed set before building the control (§18).

---

# 4. Outcome model

The outcome system is the most important part of the architecture. It must be designed before implementing detailed combat or reward animations.

## 4.1 Outcome and presentation are separate

Use four distinct concepts:

**1. Wager:** The amount committed to the round.

**2. Outcome:** The authoritative result or outcome constraints produced by the game's approved outcome mechanism.

**3. Event plan:** The ordered presentation sequence used to communicate the outcome and support valid player choices.

**4. Settlement:** The final monetary calculation and recorded transaction.

These concepts may reference each other, but they must not be interchangeable.

For example, the fact that the assassin collects 500 visual coins does not mean the player receives 500 currency units. Visual coins may represent atmosphere, bonus tokens or a defined component of the settlement calculation.

## 4.2 Support two outcome policies

The engine should support both of the following models through an explicit configuration.

### Policy A — Fixed outcome

The authoritative outcome is established before the burst begins.

The animation and any subsequent decisions must remain compatible with that outcome.

Choices can affect cosmetic presentation, weapon selection, bonus effects or the route through an outcome-equivalent event plan. They cannot secretly change a fixed payout.

Use this policy for rounds where the entire monetary result must be known before the animation begins.

### Policy B — Constrained outcome with choices

The game establishes an authoritative outcome policy or permitted outcome set. The player makes predefined choices, and the approved outcome mechanism resolves the result according to explicit rules.

For example, the player may choose between:

- A safer, lower-variance bonus.
- A riskier, higher-variance bonus.
- A weapon with consistent damage.
- A weapon with a chance of a larger bonus.

The rules must specify whether the choice affects probability, reward eligibility, payout distribution or only presentation.

The exact result may be resolved after the choice if the game rules require it. It must still be determined by the authoritative outcome mechanism, not by PixiJS, animation timing or client-side improvisation.

**Important:** A game cannot truthfully claim both that a final payout is completely fixed before the round and that an uncommitted player choice can change that payout. The selected policy must define which information is fixed, when it becomes fixed and what choices are allowed to affect.

## 4.3 Outcome categories

Define configurable outcome categories such as:

- Loss.
- Small win.
- Standard win.
- Big win.
- Major win.
- Jackpot.

These are presentation and reward categories. They are not substitutes for actual payout values or probabilities.

Each category should map to a configurable set of presentation events, intensity settings and finale types.

Do not hardcode payout probabilities or promise particular win frequencies in the renderer. Any probabilities, return-to-player parameters, maximum payouts and other mathematical properties belong in a separately tested game mathematics specification.

## 4.4 Round data contract

Use strongly typed data contracts. A preliminary model:

```ts
type OutcomePolicy =
	| {
			type: "fixed";
			outcomeId: string;
			payoutMinorUnits: number;
	  }
	| {
			type: "choice_constrained";
			policyId: string;
			permittedChoices: string[];
			resolutionRef: string;
	  };

type RoundRecord = {
	roundId: string;
	wagerMinorUnits: number;
	currency: string;
	outcomePolicy: OutcomePolicy;
	eventPlanId: string;
	status: "accepted" | "running" | "awaiting_choice" | "resolved" | "settled";
};

type ResolvedOutcome = {
	roundId: string;
	outcomeId: string;
	payoutMinorUnits: number;
	presentationId: string;
	resolutionVersion: string;
};

type PlayerDecision = {
	roundId: string;
	decisionId: string;
	optionId: string;
	sequenceNumber: number;
};

type SettlementRecord = {
	roundId: string;
	wagerMinorUnits: number;
	payoutMinorUnits: number;
	currency: string;
	settlementId: string;
};
```

This is an architectural starting point. Production contracts must be adapted to the selected backend, jurisdiction, currency rules and game mathematics.

For a constrained-outcome round, the `outcomePolicy` is not itself the final outcome. The resolved outcome must be obtained from the authoritative resolution service when the applicable rules say it is ready.

All monetary values should use integer minor units or an equivalent exact decimal representation. Never use ordinary floating-point arithmetic for monetary settlement.

---

# 5. Upgrade system

Upgrades are discrete choices presented at predetermined points in the burst. They are not earned through player reflexes.

The presentation should make each choice visually exciting and easy to understand.

## 5.1 Upgrade families

### Weapon upgrades

| Upgrade       | Presentation                                  | Potential gameplay role               |
| ------------- | --------------------------------------------- | ------------------------------------- |
| Twin Daggers  | A second blade materialises                   | Fast, dual-blade combat archetype     |
| Crimson Edge  | Blade glows red                               | Heavy damage archetype                |
| Shadow Blades | Spectral daggers orbit the assassin           | Multi-target archetype                |
| Piercing Edge | A long crescent slash tears through enemies   | Piercing attack archetype             |
| Dragon Fang   | Blade expands into an enormous glowing weapon | Elite or boss encounter archetype     |
| Soul Reaper   | Purple energy surrounds the weapon            | Soul and combo presentation archetype |

### Movement and power upgrades

| Upgrade        | Presentation                                                      |
| -------------- | ----------------------------------------------------------------- |
| Shadow Sprint  | Speed lines, afterimages and accelerated scenery                  |
| Phantom Dash   | Assassin blinks forward                                           |
| Time Fracture  | Background and enemies slow dramatically                          |
| Crimson Frenzy | Red aura and rapid attack animation                               |
| Shadow Cloak   | Assassin becomes translucent and surrounded by dark energy        |
| Overdrive      | Weapon, eyes and aura intensify for the remainder of the sequence |

### Treasure upgrades

| Upgrade        | Presentation                                      |
| -------------- | ------------------------------------------------- |
| Gold Magnet    | Coins fly toward the assassin                     |
| Treasure Sense | Hidden caches glow through the environment        |
| Golden Echo    | Coin trails duplicate visually                    |
| Jackpot Charm  | A glowing charm triggers a special bonus sequence |

These are initial content concepts, not final mathematical definitions. Their actual reward effects must be specified separately.

## 5.2 Upgrade choice flow

Example:

1. The assassin reaches an upgrade shrine.
2. The burst pauses or transitions into a short decision presentation.
3. Two or three upgrade cards appear.
4. Each card displays its name, icon and concise description.
5. The player chooses one option.
6. The decision is validated and recorded.
7. The burst resumes with the selected upgrade's visual presentation.
8. The event engine continues according to the authoritative round rules.

The UI must clearly indicate whether an upgrade affects payout, future outcome eligibility, event presentation or only the visual sequence.

## 5.3 Choice resolution rules

Every choice must define:

- When the choice becomes available.
- The options presented.
- Whether the choice affects monetary outcome.
- The permitted result transitions.
- Whether the choice is optional.
- The deadline or timeout policy.
- The fallback behaviour if the player does not respond.
- Whether the choice is recorded by the server.
- How the choice is represented in the event plan.

Do not allow the client to submit arbitrary upgrade identifiers or invent a new outcome branch. The server or trusted game engine must validate that the selected option is legal for the current round.

For real-money use, decision deadlines, disconnects, timeouts and incomplete rounds require explicit approved rules. They must not silently turn into an unannounced loss or change the payout.

---

# 6. Risk/reward decisions

Risk/reward choices provide tension and variety without requiring physical skill.

## 6.1 Example choices

**Treasure route**

- Safe route: modest, predictable bonus opportunity.
- Cursed vault: higher-variance reward opportunity under explicitly defined rules.

**Weapon shrine**

- Reliable weapon: consistent performance against the next encounter.
- Unstable weapon: a riskier reward profile with a chance of a more spectacular outcome.

**Blood pact**

- Accept a curse that changes the permitted outcome or reward distribution.
- Decline and continue with the existing rules.

**Elite encounter**

- Enter an optional high-risk encounter.
- Bypass it using the permitted alternative route.

These choices are conceptual examples. Their final monetary effects must be specified by the game mathematics and outcome rules.

## 6.2 Decision data contract

```ts
type DecisionOption = {
	id: string;
	title: string;
	description: string;
	visualTheme: string;
	resolutionRuleId: string;
};

type DecisionPoint = {
	id: string;
	type: "upgrade" | "risk_reward";
	options: DecisionOption[];
	defaultOptionId?: string;
	timeoutPolicy: "default" | "pause" | "abort_if_permitted";
	outcomeEffect: "presentation_only" | "authoritative_resolution";
};
```

The timeout policy is a product configuration and must agree with the approved rules. `abort_if_permitted` must not be treated as an automatic refund or cancellation unless the actual transaction rules permit it.

---

# 7. Outcome-to-animation mapping

This is the heart of the game.

The round engine determines what the player is entitled to receive. The presentation system translates the result into an entertaining sequence.

The renderer does not decide whether a win occurs.

## 7.1 Outcome presentation pipeline

```text
AUTHORITATIVE ROUND DATA
          |
          v
VALIDATED OUTCOME / POLICY
          |
          v
VALIDATED PLAYER DECISIONS
          |
          v
OUTCOME RESOLUTION, IF REQUIRED
          |
          v
PRESENTATION PLAN
          |
          v
EVENT SEQUENCER
          |
          v
PIXIJS ANIMATION
          |
          v
OUTCOME REVEAL
          |
          v
SETTLEMENT DISPLAY
```

If the outcome is already resolved before the animation, the presentation plan can be generated directly from it.

If player choices are allowed to affect resolution, the event plan must support the applicable decision points without revealing or contradicting information that the game's rules say should remain hidden.

## 7.2 Event plan schema

```ts
type PresentationEvent =
	| {
			type: "run_intro";
			durationMs: number;
	  }
	| {
			type: "coin_trail";
			durationMs: number;
			intensity: number;
	  }
	| {
			type: "monster_wave";
			durationMs: number;
			monsterIds: string[];
	  }
	| {
			type: "weapon_upgrade";
			durationMs: number;
			upgradeId: string;
	  }
	| {
			type: "trap_hit";
			durationMs: number;
			severity: "minor" | "major";
	  }
	| {
			type: "decision_point";
			decisionPointId: string;
	  }
	| {
			type: "boss_encounter";
			durationMs: number;
			bossId: string;
	  }
	| {
			type: "outcome_reveal";
			durationMs: number;
			presentationId: string;
	  };

type PresentationPlan = {
	planId: string;
	version: string;
	events: PresentationEvent[];
};
```

The production schema should include validated references, optional parameters, asset requirements and supported skip behaviour. The event list must not be trusted as an authority for monetary value.

**Naming rule.** Every library event in §7.4 maps to a plan event type by snake_case (`RunIntro` becomes `run_intro`, `CoinBurst` becomes `coin_burst`). Events that are a beat inside a larger one are not plan-level types: `MonsterKill` happens inside `monster_wave`, `BossIntroduction` opens `boss_encounter`, and `VictoryFinisher`, `DefeatSequence` and `JackpotCelebration` are the finales selected by `outcome_reveal.presentationId`. `decision_point` covers both upgrade and risk/reward decisions; `DecisionPoint.type` tells them apart. The union above is the starting set and grows as each event is built. It is not a promise that all eighteen exist up front.

## 7.3 Example mapping

| Outcome category | Event sequence                                                       | Finale                   |
| ---------------- | -------------------------------------------------------------------- | ------------------------ |
| Loss             | Run intro → coins → weak mobs → trap or defeat sequence              | Dramatic defeat          |
| Small win        | Run intro → coins → monster kills → minor treasure                   | Modest reward reveal     |
| Standard win     | Run intro → weapon upgrade → elite kill → treasure                   | Satisfying victory       |
| Big win          | Run intro → power surge → weapon evolution → boss defeat             | Large reward celebration |
| Jackpot          | Run intro → escalating upgrades → elite waves → dramatic boss climax | Special jackpot sequence |

The mapping is illustrative. The approved outcome model must define the actual permitted payout categories and event mappings.

A loss may still contain impressive combat, coins and upgrades. A large win may be shown through an especially spectacular boss encounter. The visual sequence communicates the result but must not promise a reward that the authoritative outcome does not support.

## 7.4 Reusable event library

Build events as modular, reusable components:

- `RunIntro`
- `CoinTrail`
- `CoinBurst`
- `MonsterWave`
- `MonsterKill`
- `EliteEncounter`
- `WeaponUpgrade`
- `SpeedSurge`
- `TreasureChest`
- `RiskRewardChoice`
- `TrapHit`
- `Stumble`
- `BossIntroduction`
- `BossEncounter`
- `VictoryFinisher`
- `DefeatSequence`
- `OutcomeReveal`
- `JackpotCelebration`

Each event defines its entry conditions, presentation duration, asset dependencies, completion signal and cleanup behaviour.

Events must be interruptible or recoverable according to the round lifecycle. A browser refresh, lost connection or PixiJS crash must not leave the monetary round unresolved simply because an animation failed.

---

# 8. React and PixiJS architecture

## 8.1 React responsibilities

React owns all conventional application UI:

- Main menu.
- Bet configuration.
- Balance display.
- Start button.
- Upgrade and risk/reward selection panels.
- HUD overlays.
- Outcome and payout screens.
- Round history.
- Settings and animation speed.
- Error, loading and recovery screens.

React's DOM UI does not draw game-world entities. The Pixi scene itself is built with `@pixi/react`, as in NGU: structural pieces such as the world layers, the assassin and a monster are declarative components, while anything high-count or short-lived (coins, sparks, trails) is created imperatively inside a single component from pooled objects or a `ParticleContainer`. Never one React element per particle, and never a React state update per frame (§8.5).

## 8.2 PixiJS responsibilities

PixiJS owns the animated game world:

- Assassin sprite and animations.
- Scrolling backgrounds and parallax.
- Monster sprites and combat animations.
- Weapons and upgrade effects.
- Collectibles and treasure.
- Particle effects and impact flashes.
- Screen shake, hit-stop and visual transitions.
- Boss sequences.
- Environmental effects.

## 8.3 Project structure

The repository uses the Animo standard layout, so the earlier `app/`, `ui/`, `game/`, `domain/`, `data/` and `tests/` proposal is replaced. `src/` is organised by what a file **is**. These nine directories are a closed set: do not add `game/`, `domain/`, `lib/`, `helpers/`, `services/` or `contexts/` without asking.

```text
src/
  api/          round API client, local simulation adapter
  assets/       Spine, textures and fonts imported by code
  components/   React components, DOM and Pixi alike (one directory each)
  constants/    typed config and content data
  hooks/        custom React hooks
  stores/       shared application state
  styles/       global CSS and design tokens
  types/        types crossing module boundaries
  utils/        pure helpers
  App.tsx  main.tsx
```

A component is a directory (`ParallaxWorld/ParallaxWorld.tsx`, `.module.css`, `.test.tsx`, `index.ts`). Everything else is a flat camelCase file. `index.ts` exists only inside a component directory. A type with one consumer is declared in the module that uses it; `types/` holds contracts shared across modules.

### Where each concept from this plan lives

| Concept                                                                   | Location                                                                                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Bet, HUD, decision, results and recovery panels                           | `components/BetPanel/`, `HudBar/`, `DecisionPanel/`, `ResultsPanel/`, `RecoveryScreen/`                                                |
| Pixi canvas host and scene root                                           | `components/GameCanvas/`                                                                                                               |
| Scrolling world (§8.5)                                                    | `components/ParallaxWorld/`                                                                                                            |
| Assassin, monsters, boss                                                  | `components/Assassin/`, `components/Monster/`, `components/Boss/`                                                                      |
| Presentation events (`RunIntro`, `CoinTrail`, …)                          | One component per event, e.g. `components/CoinTrail/`, mounted for whichever event the sequencer reports as active                     |
| Event sequencer, round state machine, presentation mapper, parallax maths | `utils/eventSequencer.ts`, `utils/roundMachine.ts`, `utils/presentationMapper.ts`, `utils/parallax.ts`. Pure: no Pixi or React imports |
| Round, presentation and UI state (the three layers in §8.4)               | `stores/roundStore.ts`, `stores/presentationStore.ts`, `stores/settingsStore.ts`                                                       |
| Presentation clock, asset loading                                         | `hooks/usePresentationClock.ts`, `hooks/useAssetLoader.ts`                                                                             |
| Round API contract and production client                                  | `api/roundClient.ts`                                                                                                                   |
| Local simulation adapter and outcome fixtures (§9.5)                      | `api/localRoundClient.ts`, `constants/outcomeFixtures.ts`                                                                              |
| Contracts: `RoundRecord`, `PlayerDecision`, `PresentationPlan`, …         | `types/round.ts`, `types/decision.ts`, `types/presentation.ts`                                                                         |
| Data-driven content: upgrades, monsters, bosses, presentation maps        | `constants/upgrades.ts`, `monsters.ts`, `bosses.ts`, `presentationMaps.ts`. Plain typed constants                                      |
| World tuning, animation name map, asset manifest                          | `constants/world.ts`, `constants/assassinAnimations.ts`, `constants/manifest.ts`                                                       |
| Tests                                                                     | Colocated `*.test.ts(x)`; shared helpers in `utils/`; Playwright specs in root `e2e/`                                                  |

Files appear in the phase that needs them. This table says where something goes when it exists; it is not a list to scaffold up front. "Data-driven" means typed constants for now; move content to JSON only if non-developers will author it.

Phase 2's `PresentationController` is realised as `usePresentationClock` plus `presentationStore`, and its `EventSequencer` is the pure `utils/eventSequencer.ts`. Neither needs to be a class.

## 8.4 Rendering and domain separation

Maintain three distinct state layers:

1. **Authoritative domain state:** wager, accepted choices, resolved outcome and settlement status.
2. **Presentation state:** active event, playback position, animation speed and current visual scene.
3. **UI state:** visible panels, bet controls, choice selections and displayed results.

Do not allow a presentation event to modify authoritative monetary state.

Do not store the only copy of a round's authoritative outcome in a React component or PixiJS display object.

Use a controlled interface between the domain and presentation layers. UI updates should be batched rather than sent on every animation frame.

## 8.5 Scrolling world (adapted from NGU)

This is built first (Phase 1). The assassin holds a fixed horizontal position on screen and the world scrolls past her.

### What NGU does

- **Wide world, panning camera.** `pixi-viewport` follows the digger through a tunnel that is `blocks × TUNNEL_CHUNK` wide, and a mask reveals the tunnel as it is dug.
- **Parallax ladder.** `ParallaxBg` stacks full-width `TilingSprite` layers. Each frame a layer's `position.x` moves by `viewportDeltaX × (1 − LAYER_SPEEDS[i])`, with speeds `1/16, 1/8, 1/4, 1/2, 3/4`, so far layers lag the camera.
- **Near field.** Wall tiles are appended as the player advances, a floor `TilingSprite` runs the full width, and ceiling segments and torches are placed along it.
- **Mist.** Blurred `TilingSprite` layers are baked once with `cacheAsTexture({ resolution: 0.5 })` instead of re-running a `BlurFilter` every frame. Half resolution also keeps the texture under the 16384px limit.
- **Scale and resolution.** Textures are authored at 2048px and scaled to a fixed logical height (`TUNNEL_HEIGHT = 400`). The `Application` uses `resolution = min(devicePixelRatio, 2)`, `autoDensity` and `ticker.maxFPS = 60`.
- **No per-frame React work.** Positions live in refs (`xRef`) that `useTick` reads. React state changes only on phase changes.

### What changes for Slash Baby

| Concern       | NGU                                                    | Slash Baby                                                                                                                                                         |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Camera        | `pixi-viewport` pans across a wide world               | None. The assassin holds a fixed screen position and the world moves. Drop `pixi-viewport`, the mask, tile appending and world-width growth                        |
| Scroll source | Viewport left delta                                    | One `scrollX` (world pixels travelled), advanced from the presentation clock: `scrollX += runSpeed × deltaMS × playbackSpeed`                                      |
| Layer motion  | `position.x += Δ × (1 − factor)` on world-wide sprites | Each layer is a screen-wide `TilingSprite` with `tilePosition.x = −scrollX × factor`. Repeating is free and layer size does not depend on round length             |
| Ground        | Floor sprite spans the tunnel                          | Ground factor is exactly `1.0`, so the ground moves at `runSpeed` and sets the assassin's footing                                                                  |
| Randomness    | `Math.random()` for tiles and torches                  | Any decoration scatter is seeded (from `roundId` once rounds exist) so a round replays identically. `Math.random()` never touches anything outcome-related         |
| Blur          | Runtime `BlurFilter`, then baked                       | Prefer pre-blurred art. If a runtime blur is unavoidable, bake it the NGU way                                                                                      |
| Foot sliding  | Not an issue (walks block to block)                    | Tie ground speed to the run animation: `runSpeed = STRIDE_PX ÷ RUN_CYCLE_S × timeScale`. `STRIDE_PX` is a calibration constant, tuned by eye against the art scale |
| Canvas size   | `resizeTo={window}`                                    | `resizeTo` the canvas host element, because the React overlay shares the screen. Fix the logical world **height**, scale to fit it, and let the width flex         |

The logical world height (`WORLD_HEIGHT` in `constants/world.ts`) is a placeholder, settled when the first real art arrives. NGU's equivalent is 400 units against 2048px sources.

### Layer stack

Tuning values, not requirements. Far to near:

| Layer                 | Factor | Content                                |
| --------------------- | ------ | -------------------------------------- |
| Sky                   | `0`    | Static or near-static gradient, clouds |
| Far                   | `1/16` | Distant mountains or castle silhouette |
| Mid-far               | `1/8`  | Hills, ruins                           |
| Mid                   | `1/4`  | Forest line                            |
| Near                  | `1/2`  | Trees, foliage                         |
| Ground                | `1`    | The path the assassin runs on          |
| Foreground (optional) | `1.25` | Fast grass or fog passing in front     |

Draw order: sky to near, ground, assassin, event content (monsters, coins, effects), foreground, screen-space effects. The factors reuse NGU's ladder; adjust by eye.

`runSpeed` is presentation state. Shadow Sprint raises it, Time Fracture lowers it, and an encounter can ease it to zero while the assassin fights. Changes are eased rather than stepped so the world never pops. Playback speed multiplies it and may change only how fast the same sequence plays.

### Phase 1 art

There is no background art yet. Phase 1 uses generated placeholder textures with a distinct silhouette per layer, loaded through the same manifest entries real art will use, so replacing a layer is a manifest change. Real layers should be seamless horizontally, share one height so a single tile scale applies, be authored at 2× the logical height for high-DPI screens, and stay at or under 2048px per side for mobile GPUs.

## 8.6 The character (Spine)

- **Runtime version.** Phase 1 uses the Spine Boy stand-in, exported from Spine **4.3.75-beta**, so install `@esotericsoftware/spine-pixi-v8@^4.3.10`, the same runtime as NGU. A check with `spine-core` 4.3.10 parsed `spineboy-ess.json` and `spineboy-pro.json` against `spineboy-pma.atlas` without error. The real assassin is **4.2.43**. It also parsed under 4.3.10, but that only shows the JSON reads, not that it renders identically, and Spine's guidance is that the runtime matches the export's major.minor. Before the assassin comes back, re-export it from a 4.3 editor, or confirm it renders correctly on the 4.3 runtime in a browser (§18).
- **Files.** Keep three: `spineboy-ess.json`, `spineboy-pma.atlas` and `spineboy-pma.png`; the rest of the folder is not needed (§11.5). The `.atlas` extension is what Spine's Pixi loader matches. The atlas has `pma:true` (premultiplied alpha), so check edges for dark fringing on first render. The assassin's atlas arrived as `.atlas.txt`, which that loader would not match, so rename it to `.atlas` when it is added.
- **Loading.** Import the skeleton JSON, atlas and PNG with `?url`, and map the PNG through the atlas entry's `data.images` as NGU's manifest does, so the hashed filename resolves. Register the loaders with the side-effect import of `@esotericsoftware/spine-pixi-v8` and `extend({ Spine })` for `@pixi/react`. Set the retry strategy NGU sets on `Assets.loader.loadOptions`.
- **Rig facts.** Both rigs have the root at the feet, so scale from a target on-screen height as `Digger` does with `getLocalBounds()`. Spine Boy `ess` has 18 bones, no IK, and bounds of about 471 × 732 units. The assassin has 26 bones and 4 IK constraints, with bounds of about 603 × 911 units. Its `01*` slots carry no attachments (an unused alternate part set, harmless), and `02sword` and `02handle` are separate slots, which is what makes code-driven weapon changes possible (§11.5).
- **Animations present.** Spine Boy `ess`: `idle`, `walk`, `run`, `jump`, `hit`, `death`, `shoot` and `aim` (a 0s pose). `spineboy-pro` swaps `hit` for `hoverboard`, `portal`, `idle-turn` and `run-to-idle`. The assassin: `Idle`, `Walk`, `Run`, `Jump`, `Hit`, `Die`, `SwordAttak01`, `SwordAttak02` ("Attak" is the exported spelling). Keep the exact names in `constants/assassinAnimations.ts` as a logical-to-Spine map, like NGU's `PLAYER_ANIMATION_MAP`, so swapping character or fixing a spelling is a one-line change.
- **Wrapper.** `components/Assassin/` follows `Digger`. It takes a logical animation name and maps it to the Spine name, sets `defaultMix = 0.2`, forwards `complete` only for the current track entry (Spine also emits it for superseded and looping entries), swaps animations in `useLayoutEffect` so the swap lands in the same commit as the state that caused it, and destroys the Spine on unmount. Unlike `Digger`, x is fixed, so there is no `xRef`.

## 8.7 UI layer and styling

The React overlay sits above the canvas. The canvas fills its host element, and the overlay does not capture pointer events outside its controls.

- **Reuse first.** `@animo-gaming/ui` 0.1.36 provides `BetInput`, `IncrementSelector`, `Stepper`, `StepperPopup`, `Button`, `IconButton`, `Toggle`, `Checkbox` and `Input`. Icons from `@animo-gaming/ui/icons` include `AudioFullIcon`, `AudioMutedIcon`, `TurboIcon`, `MenuIcon` and `RotateIcon`. `AutoplayIcon` stays unused: production autoplay is a non-goal (§14). The library stylesheet is already imported once in `src/main.tsx`.
- **Gaps.** There is no decision or upgrade card, modal, results or payout panel, loading screen or progress bar, round-history list, or error screen. Each is a stop-and-ask under `animo-ui-conventions` (§18).
- **Tokens only.** Colours and fonts come from CSS variables (`src/styles/colors.css`, `fonts.css`). The game's own palette is added there, not hardcoded in components. A canvas fill cannot read a CSS variable, so resolve it with `getComputedStyle` first, as NGU's `Vignette` does.
- **Mobile-first.** Base styles are mobile; layer up with `min-width: 768px` and `1024px`. Never start at desktop and walk down.
- **Check it is visible.** For every state a feature has (loading, running, awaiting choice, results, error), take a screenshot at portrait mobile, landscape mobile and desktop, and confirm the element is in the viewport, uncovered and contrasting. A passing `toBeVisible()` does not prove that.

## 8.8 Testing strategy

- **Pixi cannot run under Vitest.** The unit-test environment is happy-dom, which has no WebGL. All logic that matters therefore lives in pure `utils/` functions, stores and hooks that need no renderer, and the Pixi components that consume them stay thin.
- **Unit tests** cover the sequencer, round machine, presentation mapper, parallax maths and stores, plus DOM panels with Testing Library. Time is injected (the presentation clock is handed a `deltaMS`), so no test needs real timers or a ticker.
- **Pixi leaf components** (`ParallaxWorld`, `Assassin`, event scenes) are verified by Playwright and screenshots, not by mocking Pixi.
- **Coverage gate.** `vite.config.js` measures every `src/**/*.{ts,tsx}` file against 80%. Untested Pixi leaf components would pull the total under it. The proposal is to exclude those component directories in `test.coverage.exclude` with a comment giving this reason. That edit is a decision (§18); the alternative is mock-based tests.
- **e2e.** Each phase adds a Playwright spec across the seven configured projects. Headless WebGL on the CI runner is unverified for Firefox and WebKit, so Phase 1 includes a spike to confirm it. Assert on the DOM overlay first (round state text, button states) and treat canvas pixels as secondary.
- **Test-first.** Write the failing test before the change. The pre-commit hook runs `vitest run --changed`; CI runs the full suite with coverage.

## 8.9 Cross-cutting requirements (recommended)

None of these are in the original brief. They are standard for this kind of game and cheap to build in early. Confirm or drop each (§18).

- **Reduced motion.** Honour `prefers-reduced-motion`: no screen shake, flash or zoom pulses. Scrolling continues.
- **Flashing.** No more than three flashes per second in any effect, jackpot included (WCAG 2.3.1).
- **Audio.** Browsers block audio before a user gesture, so sound starts only after the first interaction, with a mute control. Phase 8 adds hooks only.
- **Performance.** Target 60fps on a mid-range phone, resolution capped at 2, `maxFPS = 60`, no per-frame allocation in tick callbacks and no React render per frame. Profile on a real device in Phase 1.
- **Text.** All text is DOM or a font, never baked into art, so it can be localised.

---

# 9. Casino backend and payout integrity

For a real-money product, the frontend must be treated as an untrusted client. A production implementation needs a secure backend and an approved game mathematics and compliance specification.

## 9.1 Round lifecycle API

A conceptual API might provide:

- `POST /rounds` — request a new round.
- `POST /rounds/{id}/start` — start an accepted round if the protocol requires a separate start.
- `POST /rounds/{id}/decisions` — submit a permitted choice.
- `GET /rounds/{id}` — retrieve authoritative round status.
- `GET /rounds/{id}/settlement` — retrieve settlement information.
- `GET /rounds/history` — retrieve permitted history.

The final endpoints depend on the backend architecture. A production system must avoid duplicate wager acceptance and duplicate settlement when requests are retried.

## 9.2 Server responsibilities

The authoritative service must:

- Validate wager limits and available balance.
- Accept or reject the wager atomically.
- Assign a unique round ID.
- Apply the approved outcome mechanism.
- Validate all player choices.
- Resolve outcomes at the rule-defined stage.
- Calculate the exact payout.
- Settle the round exactly once.
- Maintain an auditable round record.
- Support recovery after disconnection.
- Reject stale, duplicate or invalid decisions.

If outcomes are generated using randomness, the implementation must use the approved, appropriately secured and audited mechanism. Do not use `Math.random()` or client-side random generation as the authoritative outcome source.

## 9.3 Settlement rules

Define these terms precisely:

- **Wager:** Amount staked.
- **Payout:** Total amount returned to the player, including the stake if the game rules define it that way.
- **Net result:** Payout minus wager.
- **Multiplier:** The defined ratio used by the game mathematics and displayed in the UI.
- **Bonus:** Any additional amount or entitlement governed by the approved rules.

The frontend must display the server-authoritative values. It must not recalculate the monetary result from visual coins, monster kills, animation duration or locally inferred multipliers.

## 9.4 Idempotency and recovery

Every wager, decision and settlement request needs a defined retry policy.

A repeated request must not:

- Deduct the wager twice.
- Apply a decision twice.
- Create a second round.
- Pay the same round twice.

If the client disconnects during a burst, it should retrieve the authoritative round status and resume or reconstruct the presentation as permitted by the game rules.

The frontend must never assume a payout has been credited just because the victory animation completed.

## 9.5 Development mode

Before a backend is available, use a clearly labelled local simulation adapter.

It may supply fixture outcomes, sample balances and deterministic test sequences. It must not be presented as a secure real-money implementation.

Keep the simulation adapter separate from the production adapter so the UI and event presentation can be developed without accidentally introducing client-authoritative payout logic.

---

# 10. Game state machine

Use explicit state transitions.

```text
IDLE
  |
  v
CONFIGURING_BET
  |
  v
SUBMITTING_BET
  |
  v
ROUND_ACCEPTED
  |
  v
PRESENTATION_RUNNING
  |
  +----> AWAITING_UPGRADE
  |
  +----> AWAITING_RISK_CHOICE
  |
  +----> RESOLVING_OUTCOME
  |
  v
OUTCOME_CONFIRMED
  |
  v
SETTLEMENT_PENDING
  |
  v
SETTLED
  |
  v
RESULTS
  |
  v
IDLE
```

Additional recovery states:

- `LOADING`
- `REQUEST_FAILED`
- `CONNECTION_LOST`
- `RECOVERING_ROUND`
- `ROUND_STATUS_UNKNOWN`

The implementation must distinguish a failed request from a failed round. If a wager request times out, the client must reconcile with the server before retrying or starting another round.

For fixed-outcome rounds, `OUTCOME_CONFIRMED` can occur before the presentation starts. For choice-constrained rounds, it may occur later according to the approved resolution rules.

A presentation may finish before settlement is confirmed. In that case, show a suitable pending state rather than inventing a final credited balance.

## 10.1 How the three state vocabularies relate

This document describes a round three ways: the player-facing loop (§3.1), the client state machine above, and the server's `RoundRecord.status` (§4.4). They are one model seen from three places.

| `RoundRecord.status` (server, authoritative) | Client state                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| none yet                                     | `IDLE`, `CONFIGURING_BET`, `SUBMITTING_BET`                                        |
| `accepted`                                   | `ROUND_ACCEPTED`                                                                   |
| `running`                                    | `PRESENTATION_RUNNING`, and `RESOLVING_OUTCOME` while a resolution is pending      |
| `awaiting_choice`                            | `AWAITING_UPGRADE`, `AWAITING_RISK_CHOICE`                                         |
| `resolved`                                   | `OUTCOME_CONFIRMED`, then `SETTLEMENT_PENDING` until the settlement record arrives |
| `settled`                                    | `SETTLED`, then `RESULTS`                                                          |

The client state is a function of the server status and local presentation progress. Presentation may lag the server and never leads it: the client does not enter `OUTCOME_CONFIRMED` or `SETTLED` because an animation finished. The recovery states (`LOADING`, `REQUEST_FAILED`, `CONNECTION_LOST`, `RECOVERING_ROUND`, `ROUND_STATUS_UNKNOWN`) are client-only. Keep the mapping in one pure function in `utils/roundMachine.ts` so it is tested once.

---

# 11. Art and animation requirements

## 11.1 Main character

Required animation set:

- Run loop.
- Basic dagger attacks.
- Heavy attack.
- Weapon transformation.
- Speed boost.
- Damage reaction.
- Stumble.
- Death or defeat.
- Victory finisher.
- Jackpot celebration.

Animations should use consistent scale, anchor points and timing. The character should remain the focal point throughout the burst.

## 11.2 Enemies

Initial roster:

- Slime.
- Mushroom monster.
- Goblin.
- Armoured knight.
- Flying wisp.
- Elite demon.
- One distinctive boss.

Each monster requires a readable idle or movement animation, an attack or hit reaction where needed, and a death animation.

## 11.3 Environment

Start with one polished environment and several parallax layers. Expand to new biomes after the event sequencing system works.

Environment layers should be independent of the event engine so the same event can be reused across different locations where appropriate.

## 11.4 Visual escalation

Use a controlled intensity scale:

- **Level 1:** Ordinary running and small encounters.
- **Level 2:** More coins, faster attacks and brighter effects.
- **Level 3:** Weapon transformations and elite enemies.
- **Level 4:** Screen emphasis, large monsters and major impact effects.
- **Level 5:** Exceptional finale, jackpot effects and dramatic reveal.

This intensity scale controls presentation only. It must not be used to infer or calculate monetary outcomes.

## 11.5 Asset inventory and gaps (2026-10-24)

### Stand-in character: Spine Boy (in the repo)

`src/assets/spine-boy/` holds Esoteric Software's sample character (Spine 4.3.75-beta). It is a development placeholder, not game art, and Esoteric's licence for sample assets should be checked before it ships in any build. It does not close the animation gaps in the assassin table below: it has no melee attack, celebration or transformation. It does cover Phases 1 and 2.

| Logical animation                                                          | Spine Boy `ess`                 | Notes                                                  |
| -------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| Run                                                                        | `run` (0.67s)                   |                                                        |
| Idle                                                                       | `idle` (1.67s), `walk` (1.00s)  |                                                        |
| Jump                                                                       | `jump` (1.33s)                  | Longer than the assassin's 0.33s                       |
| Hit, stumble                                                               | `hit` (0.33s)                   | Stumble is `hit` then `run`                            |
| Die                                                                        | `death` (4.93s)                 | Long for a 20–40s round: trim it, or seek near the end |
| Attack                                                                     | `shoot` (0.40s)                 | Ranged, not a dagger. Fine as a placeholder            |
| Speed boost                                                                | `run` with a faster `timeScale` | `hoverboard` on the `pro` rig is a closer match        |
| Heavy attack, weapon transformation, victory finisher, jackpot celebration | None                            | Placeholders plus effects, as in the assassin table    |

**Files to keep:** `spineboy-ess.json`, `spineboy-pma.atlas`, `spineboy-pma.png`. The other seven are not needed. The `.skel` files duplicate the JSON in binary. `spineboy.atlas` and `spineboy.png` are the non-premultiplied twin of the pma pair, and the project standardises on premultiplied. `spineboy-run.*` is an image sequence that neither skeleton references. `spineboy-pro.*` is a larger rig (67 bones) that adds `hoverboard`, `portal`, `idle-turn` and `run-to-idle` but drops `hit`; it uses the same pma atlas, so bring it in during Phase 6 if a hoverboard speed surge or a portal jackpot stand-in is wanted. Unreferenced files are not bundled, so the cost of keeping them is clutter, not build size.

### Assassin (final character, not currently in the repo)

The export is `CharacterSpineAnimation_02.json` (Spine 4.2.43) with `CharacterAnimation_02.atlas.txt`, `CharacterAnimation_02.png` (1782×358, premultiplied alpha) and `CharacterAnimation_02.spine` (the editor project, which nothing in code imports).

| Needed (§11.1)            | In the rig today                              | Plan                                                                                                                                                  |
| ------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run loop                  | `Run` (0.73s)                                 | Use as is                                                                                                                                             |
| Basic dagger attacks      | `SwordAttak01` (0.77s), `SwordAttak02` (1.0s) | Use as is                                                                                                                                             |
| Damage reaction           | `Hit` (0.67s)                                 | Use as is                                                                                                                                             |
| Death or defeat           | `Die` (1.0s)                                  | Use as is                                                                                                                                             |
| Idle (pre-round, results) | `Idle` (1.67s), `Walk` (1.33s)                | Use as is                                                                                                                                             |
| Dodge or leap             | `Jump` (0.33s)                                | Autonomous presentation only                                                                                                                          |
| Heavy attack              | None                                          | `SwordAttak02` as a stand-in with a scale-up effect; request an animation if it looks weak                                                            |
| Weapon transformation     | None                                          | Code-driven: scale, tint or swap `02sword` and `02handle`, plus an effect layer. Twin Daggers needs a second blade: a second sword slot or an overlay |
| Speed boost               | None (procedural)                             | `runSpeed` ramp, faster `Run` `timeScale`, speed lines and afterimages                                                                                |
| Stumble                   | None                                          | `Hit` then `Run` as a placeholder                                                                                                                     |
| Victory finisher          | None                                          | `SwordAttak02` plus effect as a placeholder                                                                                                           |
| Jackpot celebration       | None                                          | `Jump` plus effect as a placeholder                                                                                                                   |

The `.spine` file sits under `src/assets/` only because it arrived with the rest. It is source art, not a code asset; whether to keep it there is the owner's call.

### Still needed

| Asset                                                                  | First needed   | Notes                                                |
| ---------------------------------------------------------------------- | -------------- | ---------------------------------------------------- |
| Background layers and ground tile                                      | Phase 1        | Spec in §8.5. Generated placeholders until supplied  |
| Coins                                                                  | Phase 2        | Placeholder shapes until supplied                    |
| Monsters (slime, mushroom, goblin, knight, wisp, elite demon) and boss | Phase 2 onward | Idle or move, hit and death each. Placeholders (§14) |
| Effects: slash, hit spark, speed lines, glow, coin burst               | Phase 4 onward | Procedural or sprite sheets                          |
| UI skin and card art                                                   | Phase 5        | Pending the §18 library-gap decision                 |
| Audio                                                                  | Phase 8        | Hooks only until supplied                            |

---

# 12. Implementation plan for the AI coding agent

Build in phases, each producing a runnable, testable result. Do not start by building the complete game, and do not create dozens of placeholder systems without integrating them.

**Phase order changed in v2.** Phase 1 is now the scrolling world and running assassin. §4 says the outcome model must be designed before detailed combat or reward animations; Phase 1 is neither. It is outcome-free infrastructure that de-risks rendering, the Spine pipeline and scroll feel before the casino layers depend on them. The §4.4 contracts are written in Phase 3, before any outcome-driven event (Phase 4).

## How every phase runs

1. Branch `feat/<JIRA-ID>/<short-title>`. Ask for the Jira ID; do not invent one.
2. Write the failing unit test first for any logic, beside the code it covers.
3. Build the phase.
4. Add the e2e spec for any functional feature. Display-only work is exempt, and the report says so.
5. Run the CI gates locally: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec vitest run --coverage`, `pnpm build`, `pnpm e2e:test`.
6. Check each new state visually at portrait mobile, landscape mobile and desktop (§8.7).
7. Commit with Conventional Commits, staging files by name. Open the PR from the template, with screenshots under Demo.
8. Report files changed, what is complete, tests run and known limitations.

## Phase 1 — Scrolling world and running assassin (build first)

**Objective:** Stand up the PixiJS pipeline, the NGU-style parallax scroll (§8.5) and the Spine assassin running on it. Phase 1 is deliberately outcome-free: no bets, rounds, events or decisions. It proves rendering, scroll feel, the asset pipeline and cleanup, which every later phase depends on.

Implement, in this order:

1. **Dependencies and assets.** Add `pixi.js@^8.17.1`, `@pixi/react@^8.0.5` and `@esotericsoftware/spine-pixi-v8@^4.3.10` (§8.6). Keep only the three Spine Boy files listed in §11.5. Do not add `pixi-viewport`, `zustand`, `styled-components` or `howler`; nothing in this phase needs them.
2. **Canvas.** `components/GameCanvas/` hosts the `Application`: `resizeTo` the host element, `resolution = min(devicePixelRatio, 2)`, `autoDensity`, `ticker.maxFPS = 60`, logical-height scaling.
3. **Asset loading.** `constants/manifest.ts` and `hooks/useAssetLoader.ts`, with NGU's retry strategy. A load failure shows a visible error, not a blank canvas.
4. **Parallax world.** `components/ParallaxWorld/` with the layer stack from §8.5 on placeholder textures, driven by the pure `utils/parallax.ts` and tuned in `constants/world.ts`.
5. **Assassin.** `components/Assassin/` (§8.6) playing `Run` on the ground line, with `STRIDE_PX` calibrated so her feet do not slide.
6. **Run control.** A ref-held `runSpeed` that eases between standing (`Idle`) and running (`Run`). One Run/Stop `Button` from `@animo-gaming/ui`, in the React overlay, drives it. This is a harness to prove DOM-over-canvas layering and that React state changes never restart the canvas; Phase 3 replaces it with the real bet panel.
7. **Cleanup and resize.** Mounting, unmounting and remounting (StrictMode does this in development) leaves exactly one canvas and one ticker callback. Rotating or resizing keeps the scroll position and does not stretch the canvas.

Acceptance criteria:

- The app launches and every CI gate passes.
- The assassin runs on a seamless multi-layer parallax with no visible tile seams and no foot sliding at the default speed.
- Each layer moves at its configured factor and the ground moves at exactly `runSpeed` (unit-tested in `utils/parallax.ts`).
- Scroll distance depends on elapsed time and speed, not frame count: the same duration at 30fps and 60fps gives the same distance (unit-tested).
- Layout is correct at portrait mobile, landscape mobile and desktop, checked by screenshot.
- No React render per frame, verified with the profiler or a render-count check.
- Remounting leaves no duplicate tickers, listeners or canvases. Spine instances and textures are destroyed on unmount.
- The Spine Boy stand-in loads, and `idle`, `run`, `jump`, `hit`, `death` and `shoot` play without console errors or alpha fringing.
- Headless WebGL availability on the CI runner is confirmed for Chromium, Firefox and WebKit. Where a browser lacks it, the e2e spec states which assertions are DOM-only.
- An e2e spec loads the app, checks the canvas and overlay, and exercises Run/Stop across the seven projects.
- React UI remains independent of the renderer: removing the canvas does not break overlay tests.
- Frame rate is profiled once on a real mid-range phone and the result recorded in the PR.

## Phase 2 — Automated presentation engine

**Objective:** Build a reusable sequencer for authored events on top of the Phase 1 world.

Implement:

- `PresentationController`, realised as `hooks/usePresentationClock.ts` plus `stores/presentationStore.ts`. The clock advances by ticker `deltaMS × playbackSpeed` and feeds the sequencer.
- `EventSequencer`, realised as the pure `utils/eventSequencer.ts`. Given a `PresentationPlan` and elapsed time, it returns the active event and what has completed. No Pixi or React imports.
- Event start, completion and cancellation. An event completes by elapsed time or by an external signal, such as a decision being made.
- Presentation timeline.
- Playback speed configuration.
- Asset readiness checks.
- Event logging.
- `zustand`, added here because presentation state is now shared between the canvas and the overlay.

Create three initial events as components, with placeholder art where needed:

1. `RunIntro`: builds on the Phase 1 run by easing `runSpeed` up from standing.
2. `CoinTrail`: placeholder coins from one pooled, imperative component.
3. `MonsterWave`: placeholder monsters, with the assassin's attack and `Hit` animations.

Acceptance criteria:

- Events play in a defined order.
- Event completion advances the sequence reliably.
- Pausing or speeding up playback cannot change authoritative data.
- Replaying the same presentation plan produces the same event order.
- Failed assets or interrupted animations cannot leave the sequencer permanently stuck.
- The sequencer is unit-tested without a renderer, using injected `deltaMS`.
- Cancelling or restarting mid-event leaves no coins, monsters or ticker callbacks behind.
- An e2e spec plays the three-event plan end to end and asserts on the overlay.

## Phase 3 — Local round simulation

**Objective:** Implement the casino lifecycle without real-money integration.

Implement:

- Bet configuration.
- Local fixture round creation.
- Round state machine.
- Fixed-outcome fixtures.
- Outcome categories.
- Event-plan selection.
- Results screen.
- Retry flow.

Acceptance criteria:

- A player can place a simulated bet, start a round and reach the results screen.
- Outcomes come from explicit fixtures rather than the renderer.
- The same fixture produces the same result.
- A round cannot transition to results twice.
- Local simulation is clearly separated from production integrations.

## Phase 4 — Outcome-to-presentation mapping

**Objective:** Turn structured outcomes into distinct animated bursts.

Implement:

- Outcome-to-presentation mappings.
- Presentation intensity settings.
- Win and loss event sequences.
- Weapon upgrade events.
- Trap and stumble events.
- Victory and defeat finales.
- Jackpot finale placeholder.

Acceptance criteria:

- Every configured outcome category has a valid presentation mapping.
- Missing mappings produce a controlled fallback rather than a crash.
- Presentation events cannot alter the outcome or payout.
- The final presentation is consistent with the authoritative outcome category.

## Phase 5 — Decision system

**Objective:** Introduce upgrades and risk/reward choices.

Implement:

- Upgrade option definitions.
- Risk/reward option definitions.
- React choice panels.
- Decision-point scheduling.
- Decision validation.
- Timeout and fallback handling.
- Choice recording.
- Resumption of the presentation after a decision.

Start with:

- Twin Daggers versus Shadow Blades.
- Safe treasure route versus riskier vault.
- One optional weapon evolution.

Acceptance criteria:

- Only valid options can be selected.
- Each decision is recorded once.
- Invalid or duplicate decisions are rejected.
- The round follows the configured outcome policy.
- The choice UI clearly describes relevant effects.
- Fixed-outcome rounds cannot have their payout silently changed by a choice.
- Choice-constrained rounds use the authoritative resolution rules.

## Phase 6 — Combat and spectacle library

**Objective:** Create enough reusable visual content to support compelling rounds.

Implement:

- Assassin attack animations.
- Monster hit and death sequences.
- Weapon transformations.
- Coin bursts.
- Speed surges.
- Trap impacts.
- Elite encounter.
- Boss introduction and finale.
- Particle pooling and effect cleanup.

Acceptance criteria:

- All events can be reused from different presentation plans.
- Events use consistent timing and asset contracts.
- No event modifies monetary state.
- Effects clean up correctly on completion, cancellation and restart.

## Phase 7 — Backend integration and settlement

**Objective:** Replace simulated round data with authoritative server responses.

Implement:

- API client.
- Wager acceptance flow.
- Round status retrieval.
- Decision submission.
- Outcome retrieval or resolution.
- Settlement retrieval.
- Idempotency handling.
- Disconnect recovery.
- Round history integration.

Acceptance criteria:

- The client never generates authoritative real-money outcomes.
- Duplicate requests cannot double-settle a round.
- Wager and payout values come from authoritative records.
- Unknown round status triggers reconciliation.
- The UI never declares a credited payout solely because an animation has finished.
- All monetary calculations use exact arithmetic.

## Phase 8 — Full-round integration

**Objective:** Deliver the complete experience.

Implement:

- Main menu.
- Bet panel.
- Automated burst.
- Decision overlays.
- Outcome reveal.
- Settlement display.
- Results summary.
- Replay or next-round flow.
- Sound and music hooks.
- Error and recovery UI.

Acceptance criteria:

- A complete round works from bet configuration through settlement and results.
- Every decision point resolves correctly.
- The same authoritative round can be reconstructed after a reload.
- UI, domain state and presentation state remain consistent.

## Phase 9 — Testing and polish

**Objective:** Prepare the game for formal product testing.

Implement:

- Unit tests for round state transitions.
- Integration tests for outcome mapping.
- Tests for duplicate requests and settlement.
- Deterministic presentation replay.
- Disconnect and refresh tests.
- Responsive layout tests.
- Performance profiling.
- Debug tools for inspecting round and event timelines.

Acceptance criteria:

- No duplicate settlement.
- No outcome changes caused by frame-rate variation.
- No stuck presentation state after an asset or event failure.
- No invalid decisions accepted.
- No payout inferred from animation.
- The complete round can be reproduced for debugging.

---

# 13. Required automated tests

The AI agent must add tests alongside implementation rather than postponing all testing until the end.

Minimum test suite:

1. Bet validation rejects invalid wager amounts.
2. A round can only be accepted once.
3. The same fixed outcome maps to the expected presentation.
4. A presentation event cannot change the authoritative payout.
5. An upgrade choice must belong to the current decision point.
6. A repeated decision cannot be applied twice.
7. An outcome-constrained choice follows the configured resolution policy.
8. Settlement is idempotent.
9. A network timeout triggers reconciliation rather than an assumed loss.
10. A presentation failure does not alter settlement.
11. Replaying an event plan preserves event order.
12. Changing playback speed does not alter payout.
13. A page reload can recover the round's authoritative status.
14. A missing animation asset uses a safe fallback.
15. A round cannot be settled in both a win and loss state.

Where the backend is not available, test the client against deterministic mocks and clearly labelled fixtures.

## 13.1 Tests added by the scrolling world, and where tests live

16. Scroll distance depends on elapsed time and speed, not on frame rate.
17. Each parallax layer offset equals `−scrollX × factor` and wraps seamlessly at the tile width.
18. Ground speed derived from `STRIDE_PX` and `timeScale` is monotonic in `timeScale`.
19. Mounting, unmounting and remounting the canvas leaves one canvas and no stray ticker callbacks (e2e).

Placement: tests 1–2, 5–8, 11–12 and 15–18 are unit tests on `utils/` and `stores/`. Tests 3–4, 10 and 14 are mapper and sequencer tests. Tests 9 and 13 are `api/` client tests against a mocked transport (Phase 7). Test 19 and everything visual are Playwright specs in `e2e/`. Reusable builders (a round, a plan, a fake clock) go in `utils/`, not copied between test files.

---

# 14. Non-goals for the first prototype

Do not initially build:

- Real-money wallet infrastructure.
- A complete mathematical model for all payout categories.
- Dozens of monster types.
- Multiple biomes.
- Spine rigs beyond the assassin.
- Persistent meta-progression.
- Multiplayer.
- Player-controlled movement.
- Real-time combat controls.
- Complex physics.
- A large catalogue of upgrades.
- Production autoplay or automated wagering.

The prototype should establish the architecture and validate the presentation model before expanding content or integrating a real-money backend.

---

# 15. First milestone

The first deliverable is a working vertical slice with:

- One React application.
- One PixiJS scene.
- An animated assassin running through a scrolling environment.
- Three reusable presentation events.
- A local simulated round with an explicit outcome.
- One upgrade decision.
- One risk/reward decision.
- A win or loss finale.
- A results screen.
- A test proving that changing animation playback does not change the result.

The prototype must be able to play a complete round from beginning to end without requiring a production backend.

The local fixture system must remain isolated from any future production outcome or settlement service.

---

# 16. Instructions to the AI coding agent

Before writing code:

1. Read `CLAUDE.md` and §0. The repository has been inspected; the findings are in §0.1. Re-check only what may have changed (`git status`, `package.json`).
2. Check `@animo-gaming/ui` before building any UI (`bash .claude/skills/animo-ui-conventions/ui-inventory.sh`).
3. Open the NGU reference files listed in §0.2 for the part you are building.
4. Write a short plan for the phase. List any convention conflict or open decision from §18 that blocks it, and ask instead of assuming.

During implementation:

- Use TypeScript and explicit data contracts, placed per §8.3.
- Keep domain, presentation and UI state separate.
- Build modular events with predictable lifecycle methods.
- Treat all client inputs as untrusted.
- Keep all monetary settlement logic outside the renderer.
- Use local fixtures until an authoritative backend is available.
- Write the test first and colocate it. Write the e2e spec before calling a functional feature done.
- Write per-frame state to refs, never to React state.
- Run the CI gates after each phase (§12): lint, typecheck, tests with coverage, build, e2e.
- Do not claim a feature is complete unless it is implemented and tested.
- Do not rewrite unrelated parts of the repository, and do not restructure existing files as a side effect of another task.
- Do not add a user-visible rule the brief does not state. Ask.
- Use placeholder art where final assets are unavailable.
- Report files changed, functionality completed, tests run and known limitations.

**First instruction:** Implement Phase 1 only (§12): a React + TypeScript + PixiJS application in which the Spine assassin runs through a parallax-scrolling world, with a clean separation between the UI and the canvas. Start once the blocking decision in §18 (coverage handling) is answered or its default accepted. When it builds, passes every gate and runs reliably, proceed to Phase 2.

# 17. Definition of done

The initial prototype is complete when:

- The player can place a simulated bet.
- A round is created with an explicit outcome fixture or configured outcome policy.
- The assassin runs automatically through a sequence of reusable events.
- Upgrade and risk/reward choices appear at predefined points.
- Choices are validated and recorded.
- The presentation follows the outcome rules.
- The round concludes with an outcome reveal.
- The results screen displays the correct simulated payout.
- The same fixture and decisions can be replayed reproducibly.
- Presentation errors, refreshes and duplicate actions do not create contradictory results.
- Automated tests confirm that the renderer cannot alter the outcome or payout.

The objective is to establish a reliable casino burst architecture first, then scale the experience through more elaborate animations, upgrade effects, event sequences, bosses and environments.

---

# 18. Open decisions

Items the brief does not settle. Each has a default so work can continue. Only #2 blocks Phase 1; #1 matters when the real assassin replaces the stand-in. Under the project's "don't invent requirements" rule, anything user-visible here is a question, not an assumption.

| #   | Decision                                                                                                                                                                                                               | Default if unanswered                                                                                                                                                                          | Blocks                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | **Spine runtime version.** The Spine Boy stand-in is 4.3.75-beta and matches NGU's runtime. The assassin is 4.2.43 (§8.6).                                                                                             | Use `@esotericsoftware/spine-pixi-v8@^4.3.10` with Spine Boy now. Before the assassin returns, re-export it from a 4.3 editor (preferred), or verify it in a browser on 4.3, or pin `~4.2.120` | Assassin swap-in         |
| 2   | **Coverage gate vs Pixi leaf components** (§8.8).                                                                                                                                                                      | Exclude the pure-Pixi component directories from `test.coverage` with a comment, and cover them with e2e                                                                                       | Phase 1 (CI)             |
| 3   | **Library gaps** (§8.7): decision and upgrade cards, results or payout panel, modal, loading screen or progress bar, history list, error screen. Add to `@animo-gaming/ui` first, or build locally?                    | Generic pieces (modal, progress bar, error screen) are library candidates, so ask before building. Game-specific pieces (decision cards, outcome reveal) are built locally                     | Phases 3, 5, 8           |
| 4   | **Layout and orientation.** A side-scroller in portrait shows a narrow slice of world. Where do the bet controls sit in each orientation?                                                                              | Fixed logical height, flexible width, assassin at a fixed fraction of screen width. Portrait: canvas above, controls below. Landscape and desktop: controls overlay the canvas edge            | Phase 1 visuals, Phase 3 |
| 5   | **Art supply:** backgrounds, monsters, boss, effects, audio, and whether the missing assassin animations (§11.5) will be authored.                                                                                     | Placeholders. The manifest makes swapping them a one-line change                                                                                                                               | Phases 1–6 polish        |
| 6   | **Product parameters not in the brief:** currency, bet limits and steps, real-money or demo at launch, target jurisdictions (which can restrict turbo, skip and playback speed), decision-timeout policy, maximum win. | Clearly labelled placeholder constants, in the local simulation only                                                                                                                           | Phase 3 onward           |
| 7   | **Jira ticket IDs** for branch names.                                                                                                                                                                                  | Ask when branching                                                                                                                                                                             | Each phase               |
| 8   | **Cross-cutting requirements** (§8.9): reduced motion, flash limits, audio policy, 60fps target, localisable text.                                                                                                     | Build them in                                                                                                                                                                                  | Phase 1 onward           |

---

**Final design principle:** The player bets on the round, makes a few defined strategic choices, and watches the assassin's world unfold. The round engine governs the result; the presentation engine makes that result exciting.
