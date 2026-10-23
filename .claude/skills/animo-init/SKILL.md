---
name: animo-init
description: Boilerplates a project to Animo Gaming standards using the files under .claude/configs. Use when the user says "animo init", "/animo-init", "initialise this as an Animo project", "set this project up", or when the SessionStart hook flags the template as present but not applied.
---

# Animo Init

Applies the config templates in `.claude/configs/` to the project, and makes
sure the tooling (ponytail, RTK) is installed. What it does depends on
whether this is a brand-new project or an existing one — **detect this
first, don't assume.**

## Step 0: detect the mode

```bash
[ -f package.json ] && echo "existing" || echo "new"
```

- **No `package.json`** → **new-project mode**: run the full scaffold below.
- **`package.json` exists** → **existing-project mode**: go to the
  existing-project section immediately below and do not read past it. The
  scaffold steps are for empty directories only.

---

# Existing-project mode: audit, ask, then apply only what's approved

**The hard rule: change nothing.** In this mode `animo-init` does not
create, copy, modify, or delete a single file, does not install a package,
does not add a script, does not run `git init` or commit, and does not
delete a skill — **until the user has approved that specific change**.

This is stricter than "don't overwrite". Adding a file that isn't there yet
is still a change: an existing project has a working setup that someone
else built, and a config appearing unannounced can break a build, a hook,
or a teammate's assumptions. The default answer to every gap is *no*; the
user turns individual items on.

Two consequences worth stating plainly, because they're easy to get wrong:

- **A file that already exists is never touched.** Not overwritten, not
  merged, not "brought in line". If the project's `eslint.config.js`
  differs from Animo's, that's a difference to *report*, not to fix. Say
  what differs and let the user decide; reconciling it is a separate task
  they can ask for.
- **Pruning is a change too.** Don't delete the PixiJS skills, or anything
  else, without asking — even when it's obviously unused.

## Step E1: audit, in read-only

```bash
bash .claude/skills/animo-init/audit-existing.sh
```

It prints present/missing for every config concern, the Animo `package.json`
scripts, `lint-staged`, `@animo-gaming/ui`, what the project already uses
instead (Jest, lefthook, biome…), and whether ponytail/RTK are installed. It
writes nothing.

Read its output; don't re-derive it by hand. The equivalent inline loop was
`bash`-only and printed `MISSING` for all seventeen entries under `zsh` —
which in this mode means offering to add seventeen files to a fully
configured project.

<details><summary>What the script checks, if you need to extend it</summary>

The concern list lives at the top of the script as `FILES`, one concern per
line, where `a|b|c` means any one of those satisfies it. Two rules if you
edit it:

- **No `read -ra`/arrays.** This has to run under zsh as well as bash, and a
  shell error prints `MISSING` for every line. After any change, run it
  against a project you know is complete and confirm every line says
  `present`.
- **A different answer is not a gap.** `.eslintrc.cjs` instead of
  `eslint.config.js`, Jest instead of Vitest, lefthook instead of husky —
  add it as an alternative rather than reporting a hole. The `note already
  uses:` line exists so the skill never proposes a duplicate of something
  the project already solved.

</details>

## Step E2: report the gaps before asking about them

Give the user the picture first: what's present, what's missing, and for
anything present that differs from Animo's version, what the difference is
in one line. No recommendations dressed up as findings — "your
`tsconfig.json` has `strict: false`, Animo's has it on" is a fact; "you
should turn strict on" is a decision that's theirs.

## Step E3: ask, with "add nothing" as the default

Use `AskUserQuestion` (multi-select) over the missing items, grouped so the
list stays short — for example: linting/formatting configs, git hooks
(`husky` + `commitlint`), test setup (`vitest` config, `src/vitest.setup.ts`),
e2e (`playwright.config.ts` + `e2e/`), CI workflow, editor settings.

Make clear in the question that nothing is applied unless it's ticked, and
that each one lands as a new file only — nothing existing gets modified.

Ask separately, because these carry consequences beyond a file appearing:

- **`@animo-gaming/ui`** — adding a dependency changes the lockfile and
  needs registry auth. Ask before installing anything.
- **`package.json` scripts / `lint-staged`** — this edits a file the project
  already owns. Only with explicit approval, one field at a time, and never
  replacing a script that's already defined under that name.
- **PixiJS skills** — ask before deleting them.
- **ponytail + RTK** — these install software on the user's machine. Ask
  first; if approved, follow `animo-setup`'s steps 1 and 2.

## Step E4: apply only what was ticked

Copy approved files with `cp -n` — never `cp -f`, in this mode there is no
"Animo's version always wins". If `cp -n` skips something, that means the
file appeared or existed after all: report it and move on, don't force it.

Don't run `pnpm install` unless a dependency was approved. Don't commit —
in an existing repo the working tree belongs to the user, and staging their
files is exactly the kind of surprise this mode exists to avoid. Tell them
what changed and let them review it themselves.

## Step E5: report

List what was added, what was declined, and what was skipped because it
already existed. Then say what governs standards going forward regardless
of which files were added: `animo-git-conventions`, `animo-ui-conventions`,
and `.claude/docs/ANIMO.md` — those are skills and docs, they don't need
any config to apply.

**Stop here.** Everything below this line is new-project mode.

---

# New-project mode

The steps below run **only** when there was no `package.json`. They copy,
overwrite, delete, install, and commit — all of which is safe in an empty
directory and none of which is acceptable in someone's existing project.

## Step 1: PixiJS or not?

Ask the user: does this project use PixiJS?

- **No** → delete the PixiJS skill collection, it's dead weight otherwise:
  ```bash
  rm -rf .claude/skills/pixijs .claude/skills/pixijs-*
  ```
- **Yes** → leave it. `.claude/skills/pixijs` is the router skill; it triggers
  the ~25 `pixijs-*` sub-skills as needed.

## Step 2: ponytail + RTK

Same checks and install commands as the `animo-setup` skill — follow that
skill's steps 1 and 2 now (check `claude plugin list` / `rtk gain`, install
via the marketplace/brew commands if missing).

---

## The rest of the scaffold

### Step 3: run the scaffold

```bash
bash .claude/skills/animo-init/scaffold.sh          # or --no-git if the user
                                                    # said this isn't a repo
```

One command, one outcome. It does what used to be nine narrated steps:
scaffolds Vite+React+TS through a temp dir, fixes the `name` create-vite
stamps from that temp dir, applies the configs (Animo's `.gitignore`,
`tsconfig.json`, `vite.config.js` always win; everything else is `cp -n`),
deletes the superseded `vite.config.ts`/`tsconfig.app.json`/
`tsconfig.node.json`/`.oxlintrc.json`, removes `.claude/configs`, runs
`scaffold-cleanup.sh`, merges the scripts and `lint-staged` block, installs
every devDependency plus `@animo-gaming/ui`, drops `oxlint`, writes
`src/vite-env.d.ts`, creates `docs/` and the root `CLAUDE.md`, runs
`git init` before `pnpm install` so husky's `prepare` works, verifies
(`tsc` → `eslint --fix` → `lint` → `vitest` → `playwright install`), and
commits the scaffold on its own.

Each of those has exactly one right answer, and the reasoning behind the
non-obvious ones lives in comments in the script — read it there rather
than re-deriving it here.

**Your job is the exit code**, not the steps:

| Exit | Meaning | What to do |
|---|---|---|
| `0` | scaffolded and committed | go to Step 11 |
| `1` | `package.json` exists | wrong mode — you're in existing-project mode |
| `2` | source files but no `package.json` | stop and ask the user how to proceed; don't overwrite anything |
| `3` | `@animo-gaming/ui` install failed | private registry: tell the user to `gh auth login`, then `pnpm setup:registry`, then re-run |
| `4` | wrong Vite template | a real bug in the scaffold — report it, don't paper over it |

Anything else that goes wrong: read the script's output and use judgment.
Don't hand-repeat the steps it already did.

### Step 11: report back

Summarize what was scaffolded, what was skipped (e.g. files `cp -n` refused
to overwrite), whether ponytail/RTK were newly installed (→ remind the user
to restart the session), and whether PixiJS skills were kept or pruned.
