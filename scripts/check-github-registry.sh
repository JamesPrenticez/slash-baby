#!/usr/bin/env bash
#
# Runs on preinstall. Fails fast with instructions when this machine cannot
# reach GitHub Packages, instead of letting pnpm report a misleading
# "404 Not Found / @animo-gaming/ui is not in the npm registry".

set -euo pipefail

# CI supplies credentials via NODE_AUTH_TOKEN; nothing to check.
if [ -n "${CI:-}" ] || [ -n "${NODE_AUTH_TOKEN:-}" ]; then
  exit 0
fi

NPMRC="${NPM_CONFIG_USERCONFIG:-$HOME/.npmrc}"

if [ -f "$NPMRC" ] && grep -q '^//npm.pkg.github.com/:_authToken=' "$NPMRC"; then
  exit 0
fi

cat >&2 <<'MSG'

  ✗ This project installs @animo-gaming/* from GitHub Packages, which needs
    a one-time authentication step on your machine.

    Run:

        pnpm setup:registry

    then run `pnpm install` again.

    (GitHub Packages requires a token for every npm install, even for public
    packages. The script reads one from the GitHub CLI, so there is no
    personal access token to create by hand.)

MSG
exit 1
