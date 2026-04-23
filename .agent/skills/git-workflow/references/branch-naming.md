# Branch Naming Conventions

## Pattern

```
<type>/<short-description>
```

Uses same type vocabulary as Conventional Commits.

## Examples

| Type | Branch name |
|------|-------------|
| Feature | `feat/oauth-pkce-flow` |
| Bug fix | `fix/auth-timeout-edge-case` |
| Refactor | `refactor/consolidate-provider-detection` |
| Chore | `chore/update-anthropic-sdk` |
| Docs | `docs/api-reference-update` |
| CI | `ci/add-e2e-test-step` |

## Rules

- Lowercase only
- Hyphens as separators (no underscores, no spaces)
- Keep descriptions short: 3-5 words max
- No ticket numbers in branch name (those go in commit message and PR)
- Never work directly on `main`

## Branch Lifecycle

```
main
 └── feat/new-feature       ← branch off main
      └── [commits]
      └── PR opened
      └── PR merged → main
      └── remote branch deleted
      └── /clean_gone removes local branch
```
