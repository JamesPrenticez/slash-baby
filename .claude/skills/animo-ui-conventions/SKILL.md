---
name: animo-ui-conventions
description: Enforces Animo Gaming's UI/styling conventions — always check @animo-gaming/ui before building a new component, its stylesheet must be imported once at the app entry point, CSS variables only for color and font (never a raw hex or px value), color-mix() for any transparent variant of a color variable, and the font-variable naming scheme. Use this whenever adding or changing a React component, writing CSS/styled-components, or picking a color or font size in an Animo Gaming repo.
---

# Animo UI Conventions

Before adding a UI component or writing styles in an Animo Gaming repo,
apply the rules below.

## `@animo-gaming/ui` is always installed

Every Animo project depends on `@animo-gaming/ui`. Before building any new
UI element (button, modal, input, badge, etc.) **or icon**, list what's
actually in it:

```bash
bash .claude/skills/animo-ui-conventions/ui-inventory.sh            # everything
bash .claude/skills/animo-ui-conventions/ui-inventory.sh chevron    # filtered
```

One call prints every component and every icon, read from the installed
package. **Use it rather than grepping around `node_modules` yourself** —
hand-derived inventories have been wrong in practice more than once: a
chevron hand-built in CSS while `ChevronDownIcon` existed, and a `☰` glyph
rendered while `MenuIcon` sat in the same barrel the audio icons came from.
The script also prints the version, since the export map changes between
releases.

**Icons ship as their own set** under the `@animo-gaming/ui/icons` subpath;
import from there rather than the root barrel, which may or may not
re-export them depending on the version.

- **It exists** → use it. Don't reimplement it locally.
- **It doesn't exist, but something close does** → stop and ask the user:
  should this reuse/extend the existing component, or is a new one
  justified?

  For **icons** specifically, "something close" is usually the answer and
  doesn't need a question: if the exact icon isn't there, use the nearest
  one that is (no gear icon, but `MenuIcon` opens a settings panel fine).
  When the nearest one doesn't really fit the action — a `ChevronDownIcon`
  standing in as the close control on a drawer that slides in from the
  right, where "down" reads as collapse — still use it, and **name it in
  the same "needs a decision" section as a missing icon**. That's how the
  library's icon set grows from real friction instead of nobody mentioning
  it.
  What's never the answer is drawing your own — **a Unicode character
  (`☰`, `✕`, `▾`) or a CSS-border shape is not an acceptable substitute for
  an icon component**, even inline, even as a placeholder. Those don't take
  the icon components' size/color props, so they drift out of scale and off
  the palette the moment anything around them changes. If nothing in the
  barrel is close enough, that's the library-gap case below — ask.
- **It doesn't exist, and the gap looks like it belongs in the shared
  library** (a generic, reusable piece — not something specific to this
  game/feature: a progress bar, a modal, tabs, a tooltip) → **stop before
  writing the component and ask**, offering two paths:
  1. Update the component in `@animo-gaming/ui` first (in that package's
     repo), publish it, bump the version here, then resume.
  2. Build it locally in this project instead, scoped to this feature.

  This is a step, not a judgment call: the moment you're about to create a
  file for a generic component that isn't in the library, that's the
  trigger. Deciding well and mentioning it afterwards is the failure mode
  this rule exists to prevent — four template test rounds produced four
  silent local components and zero questions.

  **If you genuinely can't ask** (a background or non-interactive run that
  has no one to answer), take path 2 — build it locally, scoped to this
  feature — and put it at the *top* of your final report under a "needs a
  decision" heading, named as a library gap. Don't bury it in a list of
  choices made.

## Its stylesheet must be imported — check this every session, not just when you add a component

`@animo-gaming/ui` ships its own CSS (`@animo-gaming/ui/styles.css`) — every
component from the package, including icons, renders unstyled/unsized
without it. This is a standing check, not something to verify only on
sessions that touch a `@animo-gaming/ui` component: **every time you open
`src/main.tsx` (or the app's entry point) for any reason, glance for this
import before you do anything else:**

```ts
import "@animo-gaming/ui/styles.css";
```

Missing → add it immediately, once, at the entry point (never per-component,
never per-CSS-file). Don't defer this or fold it into unrelated work as an
afterthought — it's a one-line fix the moment it's noticed.

## Check the user can actually see it

A component that satisfies every rule here can still be invisible, and no
test layer catches it — `toBeVisible()` asserts layout, not that a person
can see the thing. "It's in the DOM and the test passes" is precisely the
evidence that doesn't count here.

So for **each state the feature has** — empty, loading, error, open,
mid-animation — confirm the element is:

1. **Inside the viewport** at a normal size, not appended below the fold.
2. **Not covered** by anything pinned, sticky, or overlaid.
3. **Contrasting** with the color it actually lands on, not the color of
   the surface it was designed against.
4. **Reachable without hunting** — the user shouldn't have to scroll to
   find feedback about something they just clicked.

Both failures this rule exists for looked completely fine in the code:

- A progress bar filled with `--color-white`, translated above its dark
  parent bar so it landed on the white page. White on white.
- Three loading skeletons appended to an already-overflowing list: the
  first behind the pinned "load more" button, the other two past the fold.
  The user clicked and saw nothing change.

Screenshots are the check, but only if aimed — one taken at the wrong
scroll position, or of the wrong state, shows a UI that looks correct. If
the element you're verifying isn't in the frame, that's the bug, not a bad
screenshot.

If the color an element needs isn't in the palette, that's the ask case
below — not a reason to reach for the nearest token and hope.

## Before you commit: run the token check

```bash
bash .claude/skills/animo-ui-conventions/check-css-tokens.sh
```

Raw hex/`rgba()`, raw font sizes in any unit, colors and font sizes in
inline styles, and a missing (or duplicated) `@animo-gaming/ui/styles.css`
import are all pattern matches with one right answer — so let the script
find them instead of re-reading your own CSS for them. It exits non-zero
with file:line for each finding. A `font-size: 0.8125em` once slipped
through a self-check because the rule listed `px` and `rem`; the script
doesn't have opinions about units.

What it *can't* judge, and what the rules below are for: whether the color
you picked is the right one, whether a component should have come from the
library, and whether the result is actually visible.

## Colors and fonts are CSS variables only

Never hardcode a hex color, `rgb()`/`rgba()` value, or a raw `px`/`rem` font
size in a component or stylesheet.

- **Colors**: use an existing `--color-*` variable. If none fits, use the
  closest existing one rather than defining a new color. Don't introduce a
  new color value without asking the user first — the palette is meant to
  stay closed.

  It lives in `src/styles/colors.css`, and it's small on purpose:
  `--color-black`, `--color-white`, and three roles — `primary`,
  `secondary`, `negative` — each with a `-hover` and `-accent` variant.
  Pick by **role, not by hue**: a destructive action is
  `--color-negative`, not "the red one". There is no neutral grey ramp; a
  muted tone is `color-mix()` off `--color-black`, per the next rule.
- **Transparent variants of a color** (an overlay, a hover tint, a faded
  border): don't hardcode `rgba()`/`rgb(… / N%)` or a new hex+alpha value,
  even as a one-off. Derive it from the existing `--color-*` variable with
  `color-mix()`:

  ```css
  background: color-mix(in srgb, var(--color-black) 50%, transparent);
  ```

  This keeps the transparent version tied to the base token — if the base
  color changes, the transparent variant follows automatically.
- **Reach for the composite font token, not `font-size`.** Typography is
  set with the `font` shorthand in one declaration, so weight, size, line
  height, and family stay locked together:

  ```css
  .label {
  	font: var(--font-{family}-bold-sm);
  }
  ```

  Setting a bare `font-size` is the exception, not the default — if you're
  writing one, check first that no composite token covers the case.

- **Font variables**: composite font tokens live in `src/styles/fonts.css`
  and follow this naming scheme:

  ```
  --font-{family}-{weight if not the family's default}-{size}: [weight] [size]/[line-height] [family];
  ```

  Each part is itself a variable, never a literal:

  ```css
  --font-{family}-bold-sm: var(--font-weight-semibold) var(--font-size-sm)/1 var(--font-{family});
  ```

  **`{family}` is per-project; the rest of the vocabulary is not.** Which
  families exist changes with the brand, so read `src/styles/fonts.css` for
  the actual names — never assume the family from another project, or from
  an example in this skill. The `{weight}` and `{size}` segments stay the
  same everywhere, so `-bold-sm` means the same thing whatever the family is.

  Reuse an existing font variable if one already matches; only define a new
  one when the combination genuinely doesn't exist yet — and compose it from
  the existing `--font-weight-*` / `--font-size-*` / family variables, so a
  ramp change still propagates.

- **The weight segment is a role, not a number.** `-bold-` means "this
  family's emphasised style", which is whichever `--font-weight-*` the token
  actually resolves to — often `--font-weight-semibold`, not `700`. If you
  need to know the real weight, read the token's value; don't infer it from
  the name, and don't "correct" a `-bold-` token that resolves to semibold.

  The segment is **omitted** when the weight is the family's default — either
  because the family ships a single weight, or because that family's base
  style is the normal one. So all three of these are correctly named:

  ```css
  --font-{single-weight-family}-md:  /* one weight only, nothing to distinguish */
  --font-{family}-md:                /* this family's normal-weight style */
  --font-{family}-bold-md:           /* this family's emphasised style */
  ```

  Unlike the palette, `--font-weight-*` is growable like the size ramp: if a
  design needs a step that isn't there, add it (`--font-weight-medium: 500`)
  and compose a token from it rather than writing the number inline.

- **Variable-width families need a second declaration.** A width axis is a
  variation setting, not part of the `font` shorthand, so `font-variation-settings`
  has to sit alongside it or the width silently doesn't apply:

  ```css
  font: var(--font-{family}-bold-base);
  font-variation-settings: var(--font-width-narrow);
  ```

  This applies to **any** variable font with a width axis, not one specific
  family — check `src/styles/fonts.css` for which families are variable and
  which `--font-width-*` values exist. A family without a width axis ignores
  the declaration, so adding it "just in case" is not harmless: it reads as
  a deliberate narrow style to the next person.

- **Font sizes**: `1rem = 10px` — `src/styles/fonts.css` sets
  `html { font-size: 10px }` deliberately, so `--font-size-base: 1.6rem` is
  16px and the ramp reads as "size ÷ 10". Don't undo that root value, and
  don't convert a rem token to px because the number looked wrong.

  Check for an existing `--font-size-*` variable before picking one. The ramp
  runs `legal, xxs, xs, base, sm, md, lg, xl, xxl, xxxl, xxxxl, xxxxxl` —
  note `base` sits between `xs` and `sm`, so it is *not* the middle of the
  ramp. Nothing on it fits? Add the missing step and use that — a size ramp
  is meant to grow, unlike the palette. What's not allowed is skipping the
  token: no raw font size in a component stylesheet, in **any** unit —
  `px`, `rem`, `em`, `%`, or a keyword.

## When something doesn't fit

If a design calls for a **color** with no existing variable, or a component
with no clean match in `@animo-gaming/ui`, stop and ask rather than
inventing a one-off value or a throwaway local component — the palette and
the shared library are meant to stay consistent across every Animo project.

A missing **font size** is the one case that doesn't need a question: add
the step to the ramp as described above and carry on. The distinction is
that a new color changes the palette, while a new size fills a hole in a
scale that already implies it.
