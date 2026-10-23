#!/usr/bin/env bash
# Existing-project audit. READ-ONLY — this script must never create, modify,
# or delete anything. It prints what the project has, what it lacks, and what
# differs from Animo's version. Deciding what to do about any of that is the
# skill's job, and the user's call.
#
# Usage: bash .claude/skills/animo-init/audit-existing.sh
#
# "a|b|c" means any one of those files satisfies the concern — a project using
# .eslintrc.cjs has a different answer, not a gap.
set -uo pipefail

FILES="
.editorconfig
.npmrc
.prettierignore
prettier.config.js|.prettierrc|.prettierrc.json|.prettierrc.js
eslint.config.js|eslint.config.mjs|.eslintrc.cjs|.eslintrc.json
commitlint.config.js|.commitlintrc.json|.commitlintrc.js
tsconfig.json
vite.config.js|vite.config.ts
playwright.config.ts|playwright.config.js|cypress.config.ts
.husky/pre-commit|lefthook.yml|.pre-commit-config.yaml|.githooks/pre-commit
.husky/commit-msg|lefthook.yml|.githooks/commit-msg
.github/workflows/ci.yml|.github/workflows/main.yml|.gitlab-ci.yml
.vscode/settings.json
src/test/setup.ts|src/setupTests.ts|vitest.setup.ts
e2e|tests/e2e|cypress
CLAUDE.md
docs
"

echo "── Files ─────────────────────────────────────────────"
for entry in $FILES; do
	found=""
	for f in $(echo "$entry" | tr '|' ' '); do
		[ -e "$f" ] && { found="$f"; break; }
	done
	if [ -n "$found" ]; then
		printf 'present  %s\n' "$found"
	else
		printf 'MISSING  %s\n' "$entry"
	fi
done

echo
echo "── package.json ──────────────────────────────────────"
if [ -f package.json ]; then
	node - <<'NODE'
const pkg = require(process.cwd() + "/package.json");
const scripts = ["lint", "format", "test", "e2e:test", "prepare"];
for (const s of scripts) {
	console.log(pkg.scripts?.[s] ? `present  script ${s} = ${pkg.scripts[s]}` : `MISSING  script ${s}`);
}
console.log(pkg["lint-staged"] ? "present  lint-staged block" : "MISSING  lint-staged block");
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
console.log(deps["@animo-gaming/ui"] ? `present  @animo-gaming/ui ${deps["@animo-gaming/ui"]}` : "MISSING  @animo-gaming/ui");
// Report the project's own answers so the skill doesn't propose a duplicate.
const alt = ["jest", "vitest", "@playwright/test", "cypress", "husky", "lefthook", "oxlint", "biome", "@biomejs/biome"]
	.filter(d => deps[d]);
if (alt.length) console.log("note     already uses: " + alt.join(", "));
NODE
else
	echo "no package.json — this is new-project mode, not this script"
fi

echo
echo "── Tooling ───────────────────────────────────────────"
# No ^ anchor: `claude plugin list` indents entries and prefixes them with a
# marker glyph, so an anchored match always reports it missing.
claude plugin list 2>/dev/null | grep -q 'ponytail@ponytail' \
	&& echo "present  ponytail" || echo "MISSING  ponytail"
rtk gain >/dev/null 2>&1 \
	&& echo "present  rtk" || echo "MISSING  rtk (or the wrong 'rtk' is on PATH — see animo-setup)"

echo
echo "Nothing above has been changed. Report it, then ask before adding anything."
