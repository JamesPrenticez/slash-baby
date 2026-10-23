#!/usr/bin/env bash
# New-project scaffold: everything in animo-init Steps 3-10 that has exactly
# one correct outcome. No judgment lives here — the skill still owns the
# PixiJS question, the partial-project case, registry-auth guidance, and the
# final report.
#
# Usage: bash .claude/skills/animo-init/scaffold.sh [--no-git]
#   --no-git   skip `git init` and the scaffold commit (user said it isn't a repo)
#
# Exit codes the skill should react to:
#   2  partial project (source files but no package.json) — stop and ask the user
#   3  `pnpm install` failed on the private registry — tell the user to run
#      `pnpm setup:registry` (needs `gh auth login`) and re-run
#   4  create-vite produced the wrong template — bug, do not continue
set -euo pipefail

do_git=1
[ "${1:-}" = "--no-git" ] && do_git=0

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

# ── Preflight ────────────────────────────────────────────────────────────
if [ -f package.json ]; then
	echo "package.json exists — this is existing-project mode, which never runs this script." >&2
	exit 1
fi
if [ -d src ] || ls -- *.ts *.tsx 2>/dev/null | grep -q .; then
	echo "Source files but no package.json — partial project, ask the user how to proceed." >&2
	exit 2
fi

# ── Step 3: Vite + React + TS ────────────────────────────────────────────
# create-vite refuses a non-empty directory non-interactively, so scaffold in a
# temp dir and merge. Target must be "." from inside $tmp: passing an absolute
# path hits a create-vite path-join bug that nests the project one level down.
# No `--` separator: it swallows --template and silently yields vanilla-ts.
step "Scaffolding Vite + React + TS"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
(cd "$tmp" && pnpm create vite@latest . --template react-ts >/dev/null)
cp -an "$tmp"/. .
rm -rf "$tmp"
trap - EXIT

grep -q '"react"' package.json && grep -q '"react-dom"' package.json || {
	echo "Scaffold produced the wrong template (no react/react-dom)." >&2
	exit 4
}

# create-vite stamps "name" from the directory it ran in — the temp dir here.
pnpm pkg set name="$(basename "$PWD")" >/dev/null

# ── Step 4: config files ─────────────────────────────────────────────────
step "Applying Animo configs"
# vite.config.ts      → Animo's is .js; cp -n can't see the collision across
#                       extensions, so both would survive.
# tsconfig.{app,node} → create-vite's project-references split, superseded by
#                       Animo's flat tsconfig.json. Nothing references them.
# .oxlintrc.json      → create-vite now scaffolds oxlint; Animo uses eslint.
rm -f vite.config.ts tsconfig.app.json tsconfig.node.json .oxlintrc.json

# These three collide on every fresh scaffold — Animo's version always wins.
cp -f .claude/configs/.gitignore .claude/configs/tsconfig.json .claude/configs/vite.config.js .
# Everything else: never clobber something already on disk.
cp -n .claude/configs/.editorconfig .claude/configs/.npmrc .claude/configs/.prettierignore \
      .claude/configs/commitlint.config.js .claude/configs/eslint.config.js \
      .claude/configs/prettier.config.js .claude/configs/playwright.config.ts .
mkdir -p .vscode .husky .github/workflows scripts
cp -n .claude/configs/.vscode/*.json .vscode/
cp -n .claude/configs/.husky/* .husky/
cp -n .claude/configs/.github/workflows/*.yml .github/workflows/
cp -n .claude/configs/scripts/*.sh scripts/
chmod +x scripts/*.sh .husky/pre-commit .husky/commit-msg

# Not tidiness: .claude/configs/{tsconfig.json,playwright.config.ts} sitting
# beside the root's own gives typescript-eslint two candidate tsconfigRootDirs
# once `git add -A` stages .claude/, and every staged .ts/.tsx fails to parse.
rm -rf .claude/configs

# ── Step 4.5: strip the demo scaffold ────────────────────────────────────
step "Stripping create-vite demo content"
bash .claude/skills/animo-init/scaffold-cleanup.sh

# ── Step 5: package.json ─────────────────────────────────────────────────
step "Merging package.json scripts and lint-staged"
node - <<'NODE'
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
// Add missing scripts; never replace one create-vite or the user already set,
// except "lint", which create-vite points at oxlint.
const scripts = {
	lint: "eslint .",
	format: "prettier --write .",
	test: "vitest",
	"e2e:test": "playwright test",
	"setup:registry": "bash ./scripts/setup-github-registry.sh",
	preinstall: "bash ./scripts/check-github-registry.sh",
	prepare: "husky"
};
pkg.scripts = pkg.scripts || {};
for (const [k, v] of Object.entries(scripts)) {
	if (k === "lint" || pkg.scripts[k] === undefined) pkg.scripts[k] = v;
}
pkg["lint-staged"] = pkg["lint-staged"] || {
	"*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
	"*.{json,jsonc,css,md,yml,yaml,html}": ["prettier --write"]
};
fs.writeFileSync("package.json", JSON.stringify(pkg, null, "\t") + "\n");
NODE

# oxlint's config went in Step 4 and the "lint" script above replaced its
# script — without this the devDependency sits there unused.
grep -q '"oxlint"' package.json && pnpm remove oxlint >/dev/null

step "Installing dependencies"
pnpm add -D \
	@commitlint/cli @commitlint/config-conventional \
	eslint @eslint/js typescript-eslint eslint-config-prettier \
	eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-plugin-simple-import-sort \
	globals prettier husky lint-staged \
	vitest @vitest/coverage-v8 happy-dom \
	@testing-library/react @testing-library/jest-dom @testing-library/user-event \
	@playwright/test vite-plugin-svgr >/dev/null

# Runtime deps, not dev: src/styles/reset.css @imports normalize.css, so it has
# to be resolvable at build time.
pnpm add normalize.css >/dev/null

pnpm add @animo-gaming/ui >/dev/null || {
	echo "Could not install @animo-gaming/ui — likely the private registry." >&2
	echo "Tell the user to run 'gh auth login' then 'pnpm setup:registry', and re-run." >&2
	exit 3
}

# ── Step 6: SVG module declaration ───────────────────────────────────────
# Current create-vite keeps vite/client types in tsconfig.app.json, which
# Animo's flat tsconfig replaces — so without the reference line below, .svg /
# .png / .css imports stop typechecking.
step "Writing src/vite-env.d.ts"
cat >src/vite-env.d.ts <<'EOF'
/// <reference types="vite/client" />

declare module "*.svg?react" {
	import { FunctionComponent, SVGProps } from "react";
	const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement>>;
	export default ReactComponent;
}
EOF

# The @animo-gaming/ui/styles.css import used to be spliced into main.tsx
# here. scaffold-cleanup.sh (Step 4.5) now writes main.tsx wholesale with the
# import already in it, so this step only ever printed "already imported".

# ── Steps 7-8: docs/ and root CLAUDE.md ──────────────────────────────────
mkdir -p docs
if [ ! -f CLAUDE.md ]; then
	cat >CLAUDE.md <<'EOF'
@.claude/docs/ANIMO.md

# CLAUDE.md

<!-- Project-specific architecture, commands, and conventions go below. -->
EOF
elif ! grep -q '^@\.claude/docs/ANIMO\.md' CLAUDE.md; then
	printf '@.claude/docs/ANIMO.md\n\n%s' "$(cat CLAUDE.md)" >CLAUDE.md
fi

# ── Step 9: install and verify ───────────────────────────────────────────
# git first: husky's `prepare` script fails without a .git directory.
if [ "$do_git" = 1 ] && [ ! -d .git ]; then
	git init -q
fi

step "Installing and verifying"
pnpm install >/dev/null
pnpm exec tsc --noEmit
# Vite's own App.tsx/main.tsx fail simple-import-sort out of the box on every
# fresh scaffold — expected, not a problem to surface.
pnpm exec eslint . --fix >/dev/null 2>&1 || true
# eslint-config-prettier turns the formatting rules off, so --fix above leaves
# the heredoc-written CSS untouched. Without this the scaffold commits
# unformatted files and the first `pnpm format` shows up as an unrelated diff.
pnpm format >/dev/null
pnpm lint
pnpm exec vitest run --passWithNoTests >/dev/null
# @playwright/test being installed doesn't mean a spec can run; without the
# browser binaries the first `pnpm e2e:test` dies on a missing executable.
pnpm exec playwright install chromium >/dev/null 2>&1 || \
	echo "note: playwright browser download failed (offline?) — e2e can't run until it succeeds" >&2

# ── Step 10: commit the scaffold ─────────────────────────────────────────
if [ "$do_git" = 1 ] && [ -d .git ]; then
	step "Committing the scaffold"
	git add -A
	git commit -q -m "chore: scaffold project from animo-claude-template"
fi

printf '\n\033[1m✓ scaffold complete\033[0m — %s\n' \
	"$([ "$do_git" = 1 ] && echo 'committed as "chore: scaffold project from animo-claude-template"' || echo 'not a git repo, nothing committed')"
