# Conventional Commits — Quick Reference

## Format

```
<type>(<optional-scope>): <summary>

[optional body]

[optional footer(s)]
```

## Types

| Type | Use for |
|------|---------|
| `feat` | A new feature (correlates with MINOR in SemVer) |
| `fix` | A bug fix (correlates with PATCH in SemVer) |
| `refactor` | Code restructuring without behaviour change |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace — no logic change |
| `chore` | Build process, dependency updates, config |
| `ci` | CI/CD pipeline changes |
| `revert` | Reverting a prior commit |

## Breaking Changes

Append `!` after the type/scope for breaking changes:
```
feat(api)!: remove deprecated endpoint
```
Or use `BREAKING CHANGE:` in the footer.

## Examples from This Repo

```
fix: OpenClaw migration now shows dry-run preview before executing (#6769)
fix(compaction): don't halve context_length on output-cap-too-large errors
fix(cli): prefer auth.py env vars over models.dev in provider detection (#6755)
feat(auth): add OAuth2 PKCE flow support
refactor: consolidate provider detection into single module
chore: update dependencies to latest patch versions
```

## Rules

1. Subject line ≤72 chars
2. Imperative mood ("add" not "added", "fix" not "fixes")
3. No period at end of subject
4. Blank line between subject and body
5. Body wraps at 72 chars, explains *why* not *what*
