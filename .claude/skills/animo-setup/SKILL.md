---
name: animo-setup
description: Installs and verifies the Animo Gaming Claude Code toolchain (ponytail plugin, RTK CLI) for this project. Use when the user says "animo setup", "/animo-setup", "set up claude for this project", or when the SessionStart check hook has flagged ponytail or RTK as missing.
---

# Animo Setup

Installs the two tools every Animo project's `.claude/settings.json` expects:
**ponytail** (a Claude Code plugin) and **RTK** (a CLI, installed on the
machine, wired in via the user's global `~/.claude` hook — not part of this
project's settings).

This is the only place that actually runs install commands. The
`SessionStart` hook (`.claude/hooks/session-start-check.sh`) only checks and
prints a reminder — it never installs anything itself, so setup always
happens on request, here.

## Steps

1. **Check ponytail.**

   ```bash
   claude plugin list | grep 'ponytail@ponytail'   # no ^ anchor: entries are indented
   ```

   If missing:

   ```bash
   claude plugin marketplace add DietrichGebert/ponytail
   claude plugin install ponytail@ponytail
   ```

   `.claude/settings.json` already sets `"enabledPlugins": {"ponytail@ponytail": true}`
   and registers the marketplace under `extraKnownMarketplaces`, so a fresh
   clone usually only needs the plugin content pulled down — confirm with the
   check above before reinstalling.

2. **Check RTK.**

   ```bash
   rtk --version && rtk gain
   ```

   If `rtk` is not found, or `rtk gain` fails (see the name-collision note
   below):

   ```bash
   brew install rtk
   rtk init -g
   ```

   **Name collision**: `reachingforthejack/rtk` (Rust Type Kit) uses the same
   binary name. If `rtk gain` errors out instead of showing token-savings
   analytics, the wrong `rtk` is on `PATH` — tell the user rather than
   reinstalling blindly.

3. **Tell the user to restart the session.** Both a newly installed plugin and
   a newly installed RTK hook only take effect in a new Claude Code session —
   this one won't pick them up.

## When something's already installed

Don't reinstall a tool that's already present and working. Report what's
already set up and skip straight to whatever's actually missing.
