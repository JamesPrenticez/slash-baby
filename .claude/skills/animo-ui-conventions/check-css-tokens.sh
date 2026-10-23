#!/usr/bin/env bash
# Checks the mechanical half of animo-ui-conventions: raw colors, raw font
# sizes, hardcoded transparency, and the entry-point stylesheet import. These
# are pattern matches with one right answer — no reason to spend a model's
# attention re-deriving them, and self-checks have missed them before
# (`font-size: 0.8125em` slipped through a rule that listed px and rem).
#
# It cannot judge whether a color *choice* is right, or whether a component
# should have come from the library. That stays with the skill.
#
# Usage: bash .claude/skills/animo-ui-conventions/check-css-tokens.sh [dir]
# Exit: 0 clean, 1 findings printed
set -uo pipefail

dir="${1:-src}"
found=0
report() { found=1; printf '\033[33m%s\033[0m\n' "$1"; }

# src/styles/ is the global layer — reset, palette, and the font ramp all
# declare raw values there by definition, so it's excluded wholesale rather
# than by filename. Component styles are *.module.css elsewhere in the tree.
css=$(find "$dir" -name '*.css' -not -path '*/styles/*' 2>/dev/null)
[ -z "$css" ] && css=""

# Raw colors: hex, rgb(), rgba(), hsl(). Allowed in src/styles/ only, where the
# palette is defined.
hits=$(printf '%s\n' $css | xargs grep -nE '(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\()' 2>/dev/null || true)
if [ -n "$hits" ]; then
	report "Raw color values — use a --color-* variable, or color-mix() for a transparent variant:"
	echo "$hits" | sed 's/^/    /'
fi

# Raw font sizes in any unit. `font-size: var(--font-size-…)` is the only form.
# The trailing class must exclude whitespace as well as "v": with a bare [^v],
# the greedy [[:space:]]* matches nothing and [^v] matches the space itself, so
# every correct `font-size: var(…)` gets flagged.
hits=$(printf '%s\n' $css | xargs grep -nE 'font-size:[[:space:]]*[^v[:space:]]' 2>/dev/null || true)
if [ -n "$hits" ]; then
	report "Raw font sizes — add the step to the --font-size-* ramp and use var():"
	echo "$hits" | sed 's/^/    /'
fi

# The `font:` shorthand is the normal way to set type, so it's the other place
# a raw size hides. `font: var(--font-…)` is the only allowed form; the
# negated class must exclude whitespace for the same reason as above.
# `font-size`/`font-family`/`font-weight`/etc. are longhands, not this — the
# [^-] guards against matching them.
hits=$(printf '%s\n' $css | xargs grep -nE 'font:[[:space:]]*[^v[:space:]-]' 2>/dev/null || true)
if [ -n "$hits" ]; then
	report "Raw values in the 'font:' shorthand — use a composite var(--font-{family}-{weight}-{size}) token:"
	echo "$hits" | sed 's/^/    /'
fi

# Inline styles carrying colors or font sizes bypass the stylesheet entirely.
hits=$(grep -rnE 'style=\{\{[^}]*(color|background|fontSize)' "$dir" --include='*.tsx' 2>/dev/null || true)
if [ -n "$hits" ]; then
	report "Colors/font sizes in inline styles — move them into the component's .module.css:"
	echo "$hits" | sed 's/^/    /'
fi

# The library's stylesheet must be imported exactly once, at the entry point.
entry=""
for f in "$dir/main.tsx" "$dir/main.ts" "$dir/index.tsx"; do
	[ -f "$f" ] && { entry="$f"; break; }
done
if [ -n "$entry" ]; then
	if ! grep -q '@animo-gaming/ui/styles.css' "$entry"; then
		report "Missing '@animo-gaming/ui/styles.css' in $entry — every library component renders unstyled without it."
	fi
	extra=$(grep -rln '@animo-gaming/ui/styles.css' "$dir" 2>/dev/null | grep -v "^$entry$" || true)
	[ -n "$extra" ] && report "Imported outside the entry point (should be once, at $entry): $extra"
fi

[ "$found" = 0 ] && echo "✓ css tokens clean"
exit "$found"
