#!/usr/bin/env bash
# Prints everything @animo-gaming/ui exports, read from the installed package.
# Use this instead of grepping around node_modules by hand: hand-derived
# inventories have been wrong in practice (a chevron drawn in CSS while
# ChevronDownIcon existed; a ☰ glyph rendered while MenuIcon sat in the same
# barrel), and the export map changes between versions.
#
# Usage: bash .claude/skills/animo-ui-conventions/ui-inventory.sh [pattern]
#   pattern   optional case-insensitive filter, e.g. `… icon` or `… chevron`
set -uo pipefail

pkg="node_modules/@animo-gaming/ui"
if [ ! -d "$pkg" ]; then
	echo "@animo-gaming/ui is not installed here — run 'pnpm add @animo-gaming/ui' first." >&2
	exit 1
fi

filter="${1:-}"
show() { [ -z "$filter" ] && cat || grep -i -- "$filter" || true; }

printf '@animo-gaming/ui %s\n\n' "$(node -p "require('./$pkg/package.json').version" 2>/dev/null || echo '?')"

echo "── Components (import from \"@animo-gaming/ui\") ───────"
sed -n 's/^export { \([A-Za-z]*\).*/\1/p' "$pkg/dist/index.d.ts" 2>/dev/null | sort -u | show

echo
echo "── Icons (import from \"@animo-gaming/ui/icons\") ──────"
sed -n 's/^export { \([A-Za-z]*\).*/\1/p' "$pkg/dist/icons/index.d.ts" 2>/dev/null | sort -u | show

echo
echo "── Props ─────────────────────────────────────────────"
echo "Read the component's .d.ts before using it, e.g.:"
echo "  cat $pkg/dist/components/Toggle/Toggle.d.ts"
echo
echo "Nothing here fits? That's the stop-and-ask case — component, icon, or token."
