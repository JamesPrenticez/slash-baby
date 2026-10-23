#!/usr/bin/env bash
# Claude Code status line — mirrors default Starship style
# Inputs via stdin as JSON

input=$(cat)

# Directory: show basename like Starship default
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
dir=$(basename "$cwd")

# Git branch from worktree or git
branch=$(echo "$input" | jq -r '.worktree.branch // .workspace.git_worktree // empty' 2>/dev/null)
if [ -z "$branch" ]; then
  branch=$(git -C "$cwd" --no-optional-locks rev-parse --abbrev-ref HEAD 2>/dev/null)
fi

# Model display name
model=$(echo "$input" | jq -r '.model.display_name // ""')

# Context usage
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# ANSI colors (dimmed-friendly)
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

# Build output
out=""

# Directory (cyan, like Starship default)
[ -n "$dir" ] && out="${out}$(printf "${CYAN}%s${RESET}" "$dir")"

# Git branch (green with branch symbol)
[ -n "$branch" ] && out="${out} $(printf "${GREEN} %s${RESET}" "$branch")"

# Model (blue)
[ -n "$model" ] && out="${out} $(printf "${BLUE}[%s]${RESET}" "$model")"

# Context usage (yellow when available)
if [ -n "$used" ]; then
  used_int=$(printf '%.0f' "$used")
  out="${out} $(printf "${YELLOW}ctx:%s%%${RESET}" "$used_int")"
fi

printf "%b" "$out"
