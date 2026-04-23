# Pull Request Template

## Structure

```markdown
## Summary
- <what changed — one bullet per logical area>
- <why it was needed>
- <any notable trade-offs or alternatives considered>

## Test plan
- [ ] <specific test step 1>
- [ ] <specific test step 2>
- [ ] Edge cases covered: <list>

🤖 Generated with [Claude Code](https://claude.ai/code)
```

## Title Rules

- Mirror the commit subject (type: description)
- ≤70 characters
- Reference issue number if applicable: `fix: improve auth timeout handling (#6772)`

## Body Guidelines

- **Summary**: 1-3 bullets covering what changed and why. Not a code walkthrough — that's what the
  diff is for.
- **Test plan**: Actionable checklist. Each item should be something a reviewer can verify
  themselves.
- Avoid screenshots unless showing a UI change.
- Tag related issues with `Closes #N` or `Fixes #N` in footer to auto-close on merge.

## gh pr create Command

```bash
gh pr create \
  --title "fix(cli): improve provider detection for auth.py envvars" \
  --base main \
  --body "$(cat <<'EOF'
## Summary
- Updated provider detection to prefer `auth.py` env vars over `models.dev` lookup
- Fixes edge case where local env vars were silently overridden

## Test plan
- [ ] `ANTHROPIC_API_KEY` set via auth.py resolves correctly
- [ ] Fallback to models.dev still works when auth.py not present
- [ ] No regression on existing provider tests

Closes #6755

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```
