# Animo Gaming — Git Workflow & Conventions

Full source document. See SKILL.md for a quick-reference summary of the
parts you'll need most often (commit format, branch naming). Come here for
the branching strategy, PR process, and hotfix process.

## 1. Commit messages (slim Conventional Commits)

We follow a trimmed-down version of the Conventional Commits standard.
Scope, body, and footers are optional. Only the type and subject are
required.

Format:

```
<type>: <subject>

[optional body]

[optional footer]
```

An optional scope is allowed when it adds clarity: `<type>(<scope>): <subject>`

Allowed types:

| Type | Use for |
|---|---|
| `feat` | A new feature or user-facing capability |
| `fix` | A bug fix |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `chore` | Tooling, dependencies, build config (no production behaviour change) |
| `docs` | Documentation only |
| `test` | Adding or updating tests |

Rules:

- Use imperative mood in the subject: "add prepaid list endpoint", not "added" or "adds".
- Start the subject lowercase and leave off the trailing full stop.
- Keep the subject under roughly 72 characters.
- The Jira ID lives in the branch name and the PR, so it is optional in the commit. If you want it in the commit, add a footer: `Refs: ANIMO-123`.
- Flag a breaking change with a `!` after the type, or a `BREAKING CHANGE:` footer.

Examples:

```
feat: add freebet prepaids list endpoint
fix: guard against null reward_uuid on cancel
refactor: extract Hub88 money scaling into a helper
chore: bump phaser to 3.80
docs: document the free chips reward lifecycle
test: cover rewards/create error paths
```

A breaking change:

```
feat!: change reward status to RewardStatus union
BREAKING CHANGE: Reward.status no longer accepts raw strings.
```

## 2. Branch naming

All working branches use the format: `<type>/<JIRA-ID>/<short-title>`

Rules:

- `type`: the same vocabulary as commit types (feat, fix, refactor, chore, docs, test), lowercase.
- `JIRA-ID`: the ticket key in uppercase, for example `ANIMO-123`.
- `short-title`: a kebab-case version of the ticket title, lowercase, around two to five words.

Examples:

```
feat/ANIMO-123/free-chips-prepaid-list
fix/ANIMO-204/reward-uuid-null-check
chore/ANIMO-310/bump-phaser-version
docs/ANIMO-288/freebets-workflow-overview
```

The branch type does not have to match every commit on the branch one to
one. It reflects the primary intent of the work tied to the ticket.

## 3. Branching strategy

We run a release-train model: one long-lived branch, one deployment
(release) branch per cycle, and short-lived feature branches.

**Long-lived branches**

| Branch | Represents | Updated by |
|---|---|---|
| `master` | Production | Merges from staging only. Tagged per release. |

`master` is protected. Nobody commits to it directly.

**Deployment (release) branches**

- Named with semantic versioning: `version/<major>.<minor>.<patch>`, for example `version/1.0.0`.
- Cut from `master` at the start of a release cycle, so it shares the same baseline that feature branches use.
- Collects the features intended for that release.
- Deployed to staging once the scope is complete.
- Merged into `master` once the release has been tested in staging.

**Feature branches**

- Cut from `master`.
- Named using the convention in section 2.
- Merged into the active deployment branch through a pull request.
- Short-lived. Deleted after merge.

Because both the deployment branch and the feature branches are cut from
`master`, they start from an identical baseline. That keeps merges into the
deployment branch clean and avoids drift while a release is in flight.

**Release lifecycle**

1. Cut the deployment branch from `master`: `version/1.0.0`.
2. Developers create feature branches from `master`.
3. Developers open PRs to merge their feature branches into the active deployment branch.
4. Each PR is reviewed, passes CI, and is approved before merge.
5. When the release scope is complete, deploy the branch to staging.
6. QA tests the release on staging.
7. Once verified, merge release into `master`.
8. Tag `master` with the release version (for example `v1.0.0`) and deploy to production.
9. Delete the deployment branch once the release is out.

## 4. Pull request and review process

**Opening a PR**

- One PR per feature branch, targeting the active deployment branch.
- Title follows the commit convention, for example `feat: add freebet prepaids list endpoint`.
- Description includes:
  - What changed and why.
  - A link to the Jira ticket.
  - Testing notes (how it was verified, edge cases covered).
  - Screenshots or recordings for any UI or game-rendering change.
- Keep PRs small and focused. A reviewable PR is one a reviewer can hold in their head.

**Reviewer responsibilities**

- Confirm the change does what the ticket asks and nothing more.
- Check correctness, readability, security, and performance.
- Verify type safety is fixed at the source rather than cast at the point of use.
- Leave actionable comments. Approve only when satisfied.

**Author responsibilities**

- Respond to every comment. Resolve threads once addressed.
- Re-request review after substantial changes.
- Do not self-approve.

## 5. Hotfix process

The release train is the default path, but production incidents need a
faster lane.

1. Branch from `master`: `fix/ANIMO-xxx/<short-title>`.
2. Open a PR back into `master`. It still requires review and green CI, just on an expedited basis.
3. After merge, tag `master` with a patch bump (for example `v1.0.1`) and deploy.
4. Forward-merge the hotfix into any active deployment branch, so the fix is not lost in the next release.
