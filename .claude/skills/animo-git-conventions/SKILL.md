---
name: animo-git-conventions
description: Enforces Animo Gaming's git workflow — slim Conventional Commits message format, "type/JIRA-ID/short-title" branch naming, the release-train branching strategy (master, version/x.y.z deployment branches, feature branches), a bundled PR template, and the hotfix process. Use this whenever working in any Animo Gaming repo (ANIMO-xxx Jira tickets) and about to commit, create/name a branch, open or describe a pull request, cut a release, or handle a production hotfix — even if the user just says "commit this", "make a branch for ANIMO-123", "open a PR", "cut the release branch", or "we need a hotfix", without mentioning "conventions" or "workflow" explicitly.
---

# Animo Gaming Git Conventions

Before committing, naming a branch, or opening a PR in an Animo Gaming
repo, apply the rules below. They exist so that commit history, branches,
and PRs stay predictable across the team and tooling (release tags,
changelogs) that parses them keeps working.

## Commit messages

Format: `<type>: <subject>` (scope optional: `<type>(<scope>): <subject>`)

Types: `feat` `fix` `refactor` `chore` `docs` `test`

- Imperative mood, lowercase start, no trailing period: `add prepaid list endpoint`, not `Added prepaid list endpoint.`
- Subject under ~72 characters.
- Jira ID is optional in the commit (it already lives in the branch name and PR). If included, use a footer: `Refs: ANIMO-123`.
- Breaking change: `feat!: ...` or a `BREAKING CHANGE:` footer.

```
feat: add freebet prepaids list endpoint
fix: guard against null reward_uuid on cancel
```

## Branch naming

Format: `<type>/<JIRA-ID>/<short-title>`

- `type` from the same vocabulary as commits, lowercase.
- `JIRA-ID` uppercase, e.g. `ANIMO-123`.
- `short-title` kebab-case, 2-5 words.

```
feat/ANIMO-123/free-chips-prepaid-list
fix/ANIMO-204/reward-uuid-null-check
```

If the user hasn't given you a Jira ID and one is needed for a branch name,
ask for it rather than inventing one.

## Before opening a PR

Fill out `assets/PULL_REQUEST_TEMPLATE.md` exactly — same section
headings, same order, same emoji, same checkbox layout. Don't improvise a
different structure (no custom "Testing notes" or "Summary" sections in
place of it); this template is what reviewers expect to see, and tooling
may parse it. Read the template file itself before writing the PR so you
copy its structure precisely rather than from memory.

- `{PR Title}` follows the commit convention from above (e.g. `refactor: extract wallet balance calculation into shared util`) — keep the Jira ID out of the title; it has its own line.
- Check off the one `Type of Task` box that applies.
- `Changes` and `Impact` are where the what/why from `references/git-conventions.md` section 4 goes.
- `Demo` is where screenshots/recordings belong for UI or game-rendering changes; otherwise say not applicable.
- Target the active deployment branch (`version/x.y.z`), not `master`, unless this is a hotfix (see below).

Also read `references/git-conventions.md` section 4 for reviewer/author
responsibilities (respond to every comment, don't self-approve, etc.) —
those aren't part of the template but still apply.

## Release branches, release lifecycle, and hotfixes

These come up less often — read `references/git-conventions.md` sections
3 and 5 when the user is cutting a release branch (`version/<major>.<minor>.<patch>`
from `master`), walking through the release lifecycle, or handling a
production hotfix (branch from `master` as `fix/ANIMO-xxx/<short-title>`,
PR back into `master`, patch-bump tag, then forward-merge into any active
deployment branch).

## When something doesn't fit

If a request doesn't cleanly match one of the six commit/branch types, or
the situation isn't covered above, say so and ask rather than guessing —
these conventions are read by teammates and tooling, so consistency
matters more than speed here.
