#!/usr/bin/env bash
#
# Authenticates this machine against GitHub Packages so that @animo-gaming/*
# packages can be installed. Run once per machine:
#
#   pnpm setup:registry
#
# Writes an auth token into your personal ~/.npmrc. The project's committed
# .npmrc only routes the @animo-gaming scope; it holds no credentials.
#
# In CI, do not run this. Set NODE_AUTH_TOKEN to the built-in GITHUB_TOKEN.

set -euo pipefail

REGISTRY_HOST='npm.pkg.github.com'
NPMRC="${NPM_CONFIG_USERCONFIG:-$HOME/.npmrc}"
AUTH_LINE_PREFIX="//${REGISTRY_HOST}/:_authToken="

die() {
  echo "error: $*" >&2
  exit 1
}

command -v gh >/dev/null 2>&1 || die "the GitHub CLI is required.
  Install it:  brew install gh
  Then:        gh auth login"

gh auth status >/dev/null 2>&1 || die "you are not logged in to GitHub.
  Run:  gh auth login"

# The registry rejects tokens without read:packages. Checking up front turns a
# confusing 404 at install time into an actionable message now.
if ! gh auth status 2>&1 | grep -q 'read:packages'; then
  echo "Your GitHub token is missing the 'read:packages' scope. Adding it..."
  gh auth refresh -h github.com -s read:packages
fi

TOKEN="$(gh auth token)"
[ -n "$TOKEN" ] || die "could not read a token from the GitHub CLI."

# Fail now if the token cannot actually read the registry, rather than leaving a
# broken line in ~/.npmrc for someone to debug later.
STATUS="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://${REGISTRY_HOST}/@animo-gaming/ui" || true)"

if [ "$STATUS" != '200' ]; then
  die "GitHub Packages returned HTTP ${STATUS} for @animo-gaming/ui.
  Check you are a member of the animo-gaming org, then re-run."
fi

touch "$NPMRC"
chmod 600 "$NPMRC"

# Idempotent: drop any previous line for this registry, then append the current
# token. Preserves every other setting in the file.
TMP="$(mktemp)"
grep -v "^${AUTH_LINE_PREFIX}" "$NPMRC" > "$TMP" || true
printf '%s%s\n' "$AUTH_LINE_PREFIX" "$TOKEN" >> "$TMP"
mv "$TMP" "$NPMRC"
chmod 600 "$NPMRC"

echo "✓ Authenticated against ${REGISTRY_HOST} (token written to ${NPMRC})"
echo "  You can now run: pnpm install"
