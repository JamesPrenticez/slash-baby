#!/usr/bin/env bash
# SessionStart hook: checks (never installs, never writes) two things and
# prints advisory reminders. Purely advisory — never blocks the session.

notices=()

# 1. ponytail + RTK
missing=()
if ! claude plugin list 2>/dev/null | grep -q '^ponytail@ponytail'; then
	missing+=("ponytail")
fi
if ! command -v rtk >/dev/null 2>&1 || ! rtk gain >/dev/null 2>&1; then
	missing+=("rtk")
fi
if [ ${#missing[@]} -gt 0 ]; then
	notices+=("missing ${missing[*]} — run /animo-setup to install")
fi

# 2. Template copied in but never applied: .claude/configs/ exists (the
# template is present) but eslint.config.js at the project root doesn't
# (init hasn't run yet, or this is an existing project that hasn't opted in).
if [ -d "./.claude/configs" ] && [ ! -f "./eslint.config.js" ]; then
	notices+=("Animo template found but not applied — run /animo-init")
fi

if [ ${#notices[@]} -gt 0 ]; then
	# Plain stdout/stderr text from a command hook isn't shown to the user —
	# Claude Code only surfaces a hook's output via JSON's systemMessage field.
	msg=$(printf 'animo-claude-template: %s\n' "${notices[@]}")
	jq -n --arg msg "$msg" '{systemMessage: $msg}'
fi

exit 0
