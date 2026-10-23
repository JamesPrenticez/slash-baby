# Animo Gaming — Claude Code Standards

Shared conventions for working on any Animo Gaming project with Claude Code.
Pulled into this project's root `CLAUDE.md` via `@.claude/docs/ANIMO.md` —
project-specific architecture and commands belong in that root file, not here.

## Tooling

- **ponytail** and **RTK** should be active every session. If a session-start
  warning says either is missing, run the `animo-setup` skill (or `/animo-setup`).
- Git conventions (commits, branches, PRs, releases, hotfixes) are the
  `animo-git-conventions` skill — see that skill, not this doc, for the rules
  and for `assets/PULL_REQUEST_TEMPLATE.md`.
- Stage and commit only the files you changed for the task at hand. Don't
  `git add -A`/`git add .` if the working tree has unrelated changes already
  sitting in it — stage those files by name instead, and leave anything you
  didn't touch unstaged for the user to review themselves.
- UI/styling conventions (`@animo-gaming/ui` reuse, CSS variable rules) are the
  `animo-ui-conventions` skill.

## Don't invent requirements

A feature request describes a goal, not a full spec. Filling a genuine
implementation gap (which state library, how a component is structured) is
normal engineering judgment — keep doing that. But adding behavior nobody
asked for is not: making an optional field mandatory, adding a validation
rule, changing what a button does, restricting input that wasn't restricted
in the request. If the request doesn't say a checkbox is required, don't
make it required.

When you notice yourself about to add a rule or constraint the request
didn't state, stop and ask instead of picking silently — same as the
"stop and ask" rule in `animo-ui-conventions` for a color or component gap.
Say what you were about to assume and why, so the user can correct it in
one line instead of finding it after the fact.

**Worked examples** — the line is whether a *user-visible constraint* is
being added, not whether a decision is being made at all:

- Reasonable default (just build it): "add a settings panel" → you pick
  where it lives in the layout, what state library holds its values, how
  it's split into components. None of that constrains what the user can do.
- Invented requirement (stop and ask): "add a settings panel" → you decide
  only one setting can be open at a time (an accordion), or that a field is
  required, or that changes need a confirm step before saving. Each of these
  changes what the user is able to do or must do, and the request never said
  so — even though, like the checkbox case, it can look like an
  implementation detail from the inside.

The tell: would a user notice this as a rule they now have to follow, or a
capability that's now missing? If yes, it's a requirement you invented, not
a default you filled in.

## Project structure

**First: does this project already have a structure?** Everything below
describes a project scaffolded by `/animo-init`. In a codebase that predates
this template, **the layout already on disk wins** — put a new file where
that project's own convention puts it, even when this section says
otherwise.

- Project uses `src/features/`, `__tests__/`, `src/lib/`, `@utils`-style
  aliases, or anything else that contradicts this section? Follow the
  project. A standards doc doesn't get to overrule a working codebase built
  by someone else.
- **Never convert existing structure as a side effect of another task.** Not
  a rename, not a move, not "while I was in there". If the mismatch is worth
  fixing, say so and let the user decide — same rule as a config that
  differs from Animo's in `animo-init`'s existing-project mode.
- Only when the project has no established answer for the kind of file
  you're adding does this section decide it.

The rest of this section is the rule for new projects, and the tiebreaker
for genuinely ambiguous cases anywhere.

`src/` is organised by what a file **is**, not which feature it belongs to.
These nine directories are the whole set, and the scaffold creates all of
them up front:

```
src/
  api/          HTTP clients, data access
  assets/       images/fonts/SVGs imported by code
  components/   React components
  constants/    shared constant values
  hooks/        custom React hooks
  stores/       shared application state
  styles/       global CSS and design tokens
  types/        types crossing module boundaries
  utils/        pure helpers
  App.tsx  main.tsx  vitest.setup.ts  vite-env.d.ts
```

**The list is closed** — for a project scaffolded from it. If something
doesn't fit one of the nine, stop and ask; same rule as a color with no
variable. Don't create `lib/`, `helpers/`, `services/`, or `contexts/`;
`services/` is `api/`, `contexts/` is `stores/`, and `lib/`/`helpers/` are
`utils/`. `App.tsx` and `main.tsx` sitting loose at the root of `src/` is
the one deliberate exception to everything below.

Closed does **not** mean a project that already has other directories is in
violation — see the scoping rule at the top of this section. It means don't
*add* a tenth to a tree that follows this standard.

**Components are directories, everything else is a flat file.** Only
components have a stylesheet to group, so only they earn a folder:

```
components/GameCard/          hooks/useWallet.ts
  GameCard.tsx                hooks/useWallet.test.ts
  GameCard.module.css         utils/formatCurrency.ts
  GameCard.test.tsx           api/walletClient.ts
  index.ts                    stores/walletStore.ts
```

PascalCase for components (directory and files), camelCase everywhere else,
always matching the primary export.

**`index.ts` belongs only inside a component directory.** Never write
`components/index.ts` or any other per-directory barrel — they cause
circular imports and defeat tree-shaking.

**`types/` is for shared types only.** A type with a single consumer is
declared and exported from the module that uses it — `ButtonProps` lives in
`Button.tsx`. `types/` holds domain models and API shapes that cross module
boundaries.

**Imports go through `@/`.** It's aliased to `src/` in both `tsconfig.json`
and `vite.config.js`, and it's the only alias — no `@utils`, no `@typings`.
Use `./` for siblings; `../` is an ESLint error inside `src/`, so a
cross-directory import that traverses upward will fail `pnpm lint`.

That ESLint rule ships in Animo's `eslint.config.js`. A project running its
own ESLint config doesn't have it, and its import style is whatever that
config allows — match the file you're editing, don't introduce `@/` into a
codebase that resolves imports some other way.

**Tests sit next to what they cover** — see Unit tests below. `e2e/` at the
project root is the exception.

**Assets**: anything imported by code goes in `src/assets/`, where it gets
hashed and bundled and a wrong path fails the build. `public/` is only for
files needing a fixed URL that are never imported — `favicon.ico`,
`robots.txt`, `og-image.png`.

## CSS

Component styles are **CSS Modules** — `ComponentName.module.css` next to
the component, imported as `import styles from "./ComponentName.module.css"`
and used as `className={styles.thing}`. `@animo-gaming/ui` is built the same
way, and scoping means class names don't need a BEM prefix to stay unique.

Global styles live in `src/styles/` and stay plain CSS — that's where the
tokens are declared, and the only place a raw color or size value is allowed:

- `index.css` — the single entry the app imports; `@import`s the rest
- `reset.css` — `normalize.css` plus the element zero-out
- `base-variables.css` — non-color, non-font tokens (spacing, radii, z-index)
- `colors.css` — the palette
- `fonts.css` — the size ramp and composite font tokens

Only `src/styles/index.css` is imported from `src/main.tsx`; the others are
pulled in through it, never imported by a component. See the
`animo-ui-conventions` skill for how to use the tokens.

**Layout is mobile-first.** Custom properties don't work inside `@media`
conditions, so these are values to write directly into `min-width` queries.
Base styles are unqualified (mobile); layer up from there:

```css
.thing {
	/* mobile — base, no query */
}
@media (min-width: 768px) {
	/* tablet */
}
@media (min-width: 1024px) {
	/* desktop */
}
```

Never start at desktop and walk down with `max-width` — Playwright covers
portrait mobile, landscape mobile, and desktop, so a desktop-first layout
fails two of the three.

## Comments

Code should be self-explanatory through meaningful names. Comment only where
a comment genuinely adds information the code can't — keep it short.

Document functions with JSDoc when the function's contract isn't obvious from
its name and signature:

```js
/**
 * Adds two numbers together.
 * @param {number} a - The first number.
 * @param {number} b - The second number.
 * @returns {number} The sum of a and b.
 */
function add(a, b) {
	return a + b;
}
```

## Formatting

`.editorconfig` and Prettier are the source of truth — tabs, width 120,
double quotes, no trailing commas, `arrowParens: "avoid"`. Don't hand-format
against these; let Prettier own it (`pnpm format`), and let ESLint own
correctness (`eslint-config-prettier` is last in the config so the two never
fight).

## Unit tests

- **Colocated**: `Thing.test.tsx` sits beside `Thing.tsx`, inside the
  component's directory. No `__tests__/` folders and no mirrored tree — a
  missing test should be obvious from the directory listing. In a project
  that already puts tests somewhere else, put yours where its tests already
  live (see the scoping rule under Project structure).
- Shared test helpers are the one thing that can't be colocated. Put them in
  `utils/` with the rest of the helpers, not in a test-only directory.
- Write the test before the change it covers — not after,
  unless it's a trivial change.
- Fixing a bug that a missing test let through, or a bug fix at all? Add the
  test that would have caught it.
- Target 80% coverage (`vite.config.js`'s `test.coverage.thresholds` enforces
  this — CI fails under it).
- Extract repeated test setup/assertions into shared helpers rather than
  copy-pasting across test files.
- Use judgment on what's worth testing: does the user's ability to complete
  the task break if this is wrong? Test it. Is it purely cosmetic (styling
  that doesn't block the flow)? Skip it.
- The pre-commit hook runs tests and rejects a commit that only adds failing
  tests — which blocks committing the "test" half of test-first before the
  "code" half exists. If the user explicitly needs that ordering provable in
  git history, `git commit --no-verify` for that one test-only commit is the
  sanctioned exception — not a routine way to skip the hook.

## Playwright (e2e) tests

**Finishing a feature means writing its e2e spec.** Not "consider adding" —
the feature isn't done, and isn't ready to commit, until `e2e/` has a spec
covering it. Three consecutive template test rounds shipped interactive
features (an accordion, a settings panel, a toggle list) with full unit
coverage and zero e2e, because the rules below described *how* to write
them without anything ever saying *now write them*. So: build the feature,
verify it, **write the e2e spec**, then commit.

The only features exempt are the display-only ones named below. If you
think a feature is exempt, say so explicitly in your report rather than
silently skipping — "no e2e: static banner, no interaction" is a fine
answer; silence isn't.

- Written after the feature exists, not before — and updated when the
  feature's behavior changes.
- Test the way a user actually uses the feature, not implementation details.
- Same rule as unit tests: extract repeated patterns, don't duplicate them.
- No 80% target here — just make sure the user's actual goal is achievable.
- Skip e2e coverage for non-functional, display-only components.
- Cover desktop, landscape mobile, and portrait mobile, across Chrome,
  Firefox, and Safari — see `playwright.config.ts`.

## SVGs

- `vite-plugin-svgr` handles SVG imports (already wired into `vite.config.js`).
- `vite-env.d.ts` in the project must declare the `?react` import shape.
- Import SVGs with `?react` so they load as React components:
  `import Icon from "./icon.svg?react"`.

## Docs

This file and everything else under `.claude/` is the shared template, not
project documentation. Any markdown file written _while building the
project_ (design notes, runbooks, architecture writeups, etc.) goes under
that project's own root `docs/` directory — never under `.claude/`.
