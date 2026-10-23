#!/usr/bin/env bash
# Strips create-vite's demo boilerplate down to a blank starting point and
# seeds Animo's compliant CSS token names. Run once, right after the config
# files have been copied in (animo-init Step 4) and before `pnpm install`.
set -euo pipefail

# App.tsx/main.tsx get rewritten below; App.css and index.css are demo-only.
# index.css in particular has to go — main.tsx now imports src/styles/index.css
# instead, so leaving it would strand create-vite's demo CSS in the tree.
rm -f src/App.css src/index.css
rm -rf src/assets/*   # keep the directory itself, just empty it out

cat >src/App.tsx <<'EOF'
function App() {
	return null;
}

export default App;
EOF

cat >src/main.tsx <<'EOF'
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";

import "@animo-gaming/ui/styles.css";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>
);
EOF

# Generic, project-agnostic helpers only — no demo tokens, no component styles.
# create-vite has no src/styles, so this has to exist before the writes below.
mkdir -p src/styles
cat >src/styles/index.css <<'EOF'
@import url("./reset.css");

@import url("./base-variables.css");
@import url("./colors.css");
@import url("./fonts.css");

body {
	margin: 0;
	text-rendering: optimizeLegibility;
	-webkit-font-smoothing: antialiased;
}
EOF

cat >src/styles/reset.css <<'EOF'
@import "normalize.css";

html,
body,
div,
span,
applet,
object,
iframe,
h1,
h2,
h3,
h4,
h5,
h6,
p,
blockquote,
pre,
a,
abbr,
acronym,
address,
big,
cite,
code,
del,
em,
img,
ins,
kbd,
q,
s,
samp,
small,
strike,
strong,
sub,
sup,
tt,
var,
b,
u,
i,
center,
dl,
dt,
dd,
ol,
ul,
li,
fieldset,
form,
label,
legend,
table,
caption,
tbody,
tfoot,
thead,
tr,
th,
td,
article,
aside,
canvas,
details,
embed,
figure,
figcaption,
footer,
header,
menu,
nav,
output,
section,
summary,
time,
mark,
audio,
button,
video {
	margin: 0;
	padding: 0;
	padding-inline: 0;
	border: 0;
}
EOF

cat >src/styles/base-variables.css <<'EOF'
:root {
	/*
	 * Non-color, non-font tokens go here — spacing, radii, z-index, durations.
	 * Empty on purpose: seeding a scale nobody asked for just gets ignored or
	 * half-replaced. Add steps as the project needs them.
	 */
}
EOF

cat >src/styles/colors.css <<'EOF'
:root {
	--color-black: #000000;
	--color-white: #FFFFFF;

	--color-primary: #f2b93a;
	--color-primary-hover: #e7b64f;
	--color-primary-accent: #ffde96;

	--color-secondary: #16a34a;
	--color-secondary-hover: #388e3c;
	--color-secondary-accent: #a5d6a7;

	--color-negative: #f82738;
	--color-negative-hover: #ff3b3b;
	--color-negative-accent: #ff6f61;
}
EOF

cat >src/styles/fonts.css <<'EOF'
/* Replace font family and sizes here */
@import url("https://fonts.googleapis.com/css2?family=Bungee&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Zalando+Sans:ital,wdth,wght@0,75..125,200..900;1,75..125,200..900&display=swap");
:root {
	--font-size-legal: 1rem;
	--font-size-xxs: 1.2rem;
	--font-size-xs: 1.4rem;
	--font-size-base: 1.6rem;
	--font-size-sm: 1.8rem;
	--font-size-md: 2.4rem;

	--font-size-lg: 2.8rem;
	--font-size-xl: 3.2rem;
	--font-size-xxl: 4rem;
	--font-size-xxxl: 4.8rem;
	--font-size-xxxxl: 8rem;
	--font-size-xxxxxl: 9.6rem;

	--font-width-narrow: "wdth" 90;
	--font-width-normal: "wdth" 100;

	--font-weight-bold: 700;
	--font-weight-semibold: 600;
	--font-weight-normal: 400;

	/* Bungee Font Styles */
	--font-bungee: "Bungee", sans-serif;
	--font-bungee-legal: var(--font-weight-bold) var(--font-size-legal)/1 var(--font-bungee);
	--font-bungee-xxs: var(--font-weight-bold) var(--font-size-xxs)/1 var(--font-bungee);
	--font-bungee-xs: var(--font-weight-bold) var(--font-size-xs)/1 var(--font-bungee);
	--font-bungee-base: var(--font-weight-bold) var(--font-size-base)/1 var(--font-bungee);
	--font-bungee-sm: var(--font-weight-bold) var(--font-size-sm)/1 var(--font-bungee);
	--font-bungee-md: var(--font-weight-bold) var(--font-size-md)/1 var(--font-bungee);
	--font-bungee-lg: var(--font-weight-bold) var(--font-size-lg)/1 var(--font-bungee);
	--font-bungee-xl: var(--font-weight-bold) var(--font-size-xl)/1 var(--font-bungee);
	--font-bungee-xxl: var(--font-weight-bold) var(--font-size-xxl)/1 var(--font-bungee);
	--font-bungee-xxxl: var(--font-weight-bold) var(--font-size-xxxl)/1 var(--font-bungee);
	--font-bungee-xxxxl: var(--font-weight-bold) var(--font-size-xxxxl)/1 var(--font-bungee);
	--font-bungee-xxxxxl: var(--font-weight-bold) var(--font-size-xxxxxl)/1 var(--font-bungee);

	/* Zalando Font Styles */
	--font-zalando: "Zalando Sans", sans-serif;
	--font-zalando-legal: var(--font-weight-normal) var(--font-size-legal)/1.2 var(--font-zalando);
	--font-zalando-xxs: var(--font-weight-normal) var(--font-size-xxs)/1.2 var(--font-zalando);
	--font-zalando-xs: var(--font-weight-normal) var(--font-size-xs)/1.2 var(--font-zalando);
	--font-zalando-base: var(--font-weight-normal) var(--font-size-base)/1.2 var(--font-zalando);
	--font-zalando-sm: var(--font-weight-normal) var(--font-size-sm)/1.2 var(--font-zalando);

	/* Zalando Bold Narrow Font Styles */
	/* The width axis isn't part of the `font` shorthand, so every one of these
	   needs `font-variation-settings` declared alongside it or the narrow width
	   silently doesn't apply. eg:
		font: var(--font-zalando-bold-base);
		font-variation-settings: var(--font-width-narrow);
	*/
	--font-zalando-bold-xxs: var(--font-weight-semibold) var(--font-size-xxs)/1 var(--font-zalando);
	--font-zalando-bold-xs: var(--font-weight-semibold) var(--font-size-xs)/1 var(--font-zalando);
	--font-zalando-bold-base: var(--font-weight-semibold) var(--font-size-base)/1 var(--font-zalando);
	--font-zalando-bold-sm: var(--font-weight-semibold) var(--font-size-sm)/1 var(--font-zalando);
	--font-zalando-bold-md: var(--font-weight-semibold) var(--font-size-md)/1 var(--font-zalando);
	--font-zalando-bold-lg: var(--font-weight-semibold) var(--font-size-lg)/1 var(--font-zalando);
}

html,
body {
	color: var(--color-black);
	font-family: var(--font-zalando);
	font-size: 10px;
	line-height: 100%;
}

button {
	color: var(--color-black);
	font-family: var(--font-bungee);
}

EOF

# vite.config.js points setupFiles at this path, so it must exist before the
# first `vitest run` — otherwise the suite fails on a config the project never
# wrote itself. It's a file at the root of src/, not a src/test/ directory:
# tests are colocated with their source, and a directory named "test" reads as
# an invitation to put them somewhere else.
cat >src/vitest.setup.ts <<'EOF'
import "@testing-library/jest-dom/vitest";
EOF

# The blessed directories from the structure standard (.claude/docs/ANIMO.md).
# Created up front so the shape is visible without a doc lookup — git can't
# track an empty directory, hence the .gitkeep in each. Anything outside this
# list is a stop-and-ask, so an agent can't quietly add src/lib or src/helpers.
for bucket in api assets components constants hooks stores styles types utils; do
	mkdir -p "src/$bucket"
	[ -n "$(ls -A "src/$bucket" 2>/dev/null)" ] || : >"src/$bucket/.gitkeep"
done

# playwright.config.ts points testDir at ./e2e. An empty directory can't be
# committed, and a missing one makes "no e2e tests" invisible — so seed the
# smoke spec that proves the Playwright setup itself works. Feature specs still
# get written after the feature exists.
mkdir -p e2e
cat >e2e/app.spec.ts <<'EOF'
import { expect, test } from "@playwright/test";

test("the app mounts", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("#root")).toBeAttached();
});
EOF

echo "scaffold-cleanup: stripped App.tsx/App.css, updated main.tsx, emptied src/assets, seeded tokens, created src/ buckets, src/vitest.setup.ts, e2e/app.spec.ts"
