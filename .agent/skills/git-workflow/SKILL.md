---
name: git-workflow
version: "1.0.0"
description: >
  Comprehensive Git workflow skill for committing, branching, PRs, code review, and repo
  maintenance. Trigger on: "commit", "push", "create a PR", "open a pull request", "code review",
  "clean branches", "gone branches", "merge", "branch", "git", "stash", "rebase", or any request
  to manage version control, review changes, or prepare code for shipping.
source: extracted and enhanced from commit-commands + code-review plugins
---

# Git Workflow

Opinionated, safe Git operations that match this repository's conventions. Every action defaults to
non-destructive. Destructive operations (force-push, reset --hard, branch -D) require explicit user
confirmation.

---

## Commit Style — This Repo

Recent history reveals the project uses **Conventional Commits** with optional scope:

```
<type>(<scope>): <summary> (#<issue-number>)
```

| Type | When |
|------|------|
| `feat` | new capability or behaviour |
| `fix` | bug correction |
| `refactor` | structural change, no behaviour change |
| `chore` | maintenance, deps, config |
| `docs` | documentation only |
| `test` | tests only |

- Scope in parentheses when the change is localised to a subsystem (e.g. `fix(cli):`, `fix(compaction):`)
- Issue number appended at end when work closes a tracked issue
- Imperative present tense: "add", "fix", "remove" — not "added", "fixes"
- Max ~72 chars on the subject line

---

## Workflows

### 1. Quick Commit (`/commit`)

**When to use:** Staged or unstaged changes ready to land on the current branch.

**Steps:**
1. Run `git status` and `git diff HEAD` to understand the full changeset
2. Run `git log --oneline -10` to match commit message style
3. Draft a Conventional Commit message
4. Stage the relevant files (avoid `.env`, credentials, lock files unless intentional)
5. Commit via heredoc to preserve formatting

**Safety checks:**
- Never commit secrets (`.env`, `*.pem`, `credentials.json`)
- Never use `--no-verify`
- If hook fails → fix the issue, stage again, create a NEW commit (never amend)

---

### 2. Full Branch → PR (`/commit-push-pr`)

**When to use:** Feature or fix is complete and ready for review.

**Steps:**
1. Check current branch — if on `main`, create a feature branch first:
   ```bash
   git checkout -b <type>/<short-description>
   ```
2. Stage and commit (follow Workflow 1 rules)
3. Push with tracking:
   ```bash
   git push -u origin <branch>
   ```
4. Create PR via `gh pr create`:
   - Title: mirrors commit subject (≤70 chars)
   - Body: Summary (1-3 bullets) + Test plan checklist
   - Base branch: `main`

**Requirements:** `gh` CLI installed and authenticated (`gh auth login`)

---

### 3. Code Review a PR (`/code-review <PR-number>`)

Multi-agent deep review. Run on any open, non-draft PR.

**Phase 1 — Eligibility (Haiku agent):**
- Skip if: closed, draft, automated, already reviewed, or trivially simple

**Phase 2 — Context gathering (Haiku agent):**
- Fetch PR diff: `gh pr diff <number>`
- Collect relevant CLAUDE.md files from modified directories

**Phase 3 — Summary (Haiku agent):**
- Summarise the change in 2-3 sentences

**Phase 4 — Parallel review (5 Sonnet agents):**
| Agent | Focus |
|-------|-------|
| #1 | CLAUDE.md compliance |
| #2 | Shallow bug scan (changes only, skip pre-existing issues) |
| #3 | Git blame & history context |
| #4 | Prior PR comments on same files |
| #5 | Code comments compliance |

**Phase 5 — Confidence scoring (parallel Haiku per issue):**
Score 0–100. Filter out anything below 80.

**Phase 6 — Post comment via `gh pr comment`:**
```
### Code review

Found N issues:

1. <description> (CLAUDE.md says "...")
   <github.com/owner/repo/blob/<full-sha>/path/file.ext#L10-L15>
```

---

### 4. Branch Cleanup (`/clean_gone`)

Remove local branches whose remote tracking branch has been deleted.

**Steps:**
```bash
# Update remote refs
git fetch --prune

# List [gone] branches
git branch -v | grep '\[gone\]'

# For each [gone] branch:
# 1. Check for associated worktrees → git worktree list
# 2. Remove worktree first if present → git worktree remove --force <path>
# 3. Delete branch → git branch -D <branch>
```

**Safety:** Only deletes branches already removed from the remote. Never touches `main`.

---

### 5. Interactive Branch Management

Common patterns available on request:

| Task | Command |
|------|---------|
| List all branches (local + remote) | `git branch -a` |
| Switch to existing branch | `git checkout <branch>` |
| Create + switch to new branch | `git checkout -b <branch>` |
| Delete local branch (safe) | `git branch -d <branch>` |
| Rename current branch | `git branch -m <new-name>` |
| Compare branch to main | `git diff main...<branch>` |
| Rebase onto main | `git fetch && git rebase origin/main` |
| View commit graph | `git log --oneline --graph --all` |

---

### 6. Stash Operations

| Task | Command |
|------|---------|
| Stash with description | `git stash push -m "description"` |
| List stashes | `git stash list` |
| Apply latest | `git stash pop` |
| Apply specific | `git stash apply stash@{N}` |
| Drop specific | `git stash drop stash@{N}` |

---

## Safety Protocol (always enforced)

- Never force-push to `main` or `master`
- Never `reset --hard` without explicit user confirmation
- Never `git clean -f` without explicit user confirmation
- Never `--no-verify` (bypass hooks) — fix the hook instead
- Never amend a published commit; create a new one
- Never commit `.env`, secrets, or binary blobs unless user explicitly confirms
- Never auto-push; confirm push intent first unless running a `/commit-push-pr` workflow

---

## Reference Files

- [Conventional Commits spec](./references/conventional-commits.md)
- [PR template](./references/pr-template.md)
- [Branch naming conventions](./references/branch-naming.md)
