# Sub-skill: Support Documentation

Generates support articles, how-to guides, troubleshooting flows, and FAQs.
Always read `BRAND.md` in full before generating any content.

## When to use
- Writing help center articles
- Creating step-by-step how-to guides
- Building troubleshooting trees
- Drafting FAQs from common questions
- Writing onboarding documentation

## Voice constraints (from BRAND.md)
- Neutral, clinical precision — strip promotional language entirely
- Imperative mood for steps: "Click Save" not "You can click Save"
- No exclamation marks
- Define every term on first use
- Consistent capitalization: follow the Terminology table in BRAND.md

## Document types

### How-to guide
```
Title: How to [accomplish goal]
Applies to: [product version / plan / role]
Time required: ~X minutes

## Overview
[1-2 sentences: what this guide covers and the end state]

## Before you begin
- [Prerequisite 1]
- [Prerequisite 2]

## Steps
1. [Action verb] + [object]. [Expected result or visual cue.]
2. ...

## Result
[What the completed state looks like]

## Next steps
- [Related article link]
- [What to do next]
```

### Troubleshooting article
```
Title: [Error message or symptom] — How to fix it
Applies to: [context]

## Symptoms
- [What the user sees/experiences]

## Cause
[Brief technical explanation — plain language]

## Solution

### Option A: [Most common fix — label it]
1. ...

### Option B: [Alternative if Option A fails]
1. ...

## If the issue persists
[Escalation path: link to contact form, email, or next tier]
```

### FAQ block
```
**Q: [Question exactly as a user would ask it]**
A: [Direct answer in 1-3 sentences. No hedging. Link to full article if needed.]
```

## Quality checks before output
- [ ] Every step is a single action (not compound: "click X and then Y")
- [ ] Terminology matches BRAND.md Terminology table
- [ ] No promotional language or superlatives
- [ ] Screenshots/visuals called out with placeholder if needed: `[Screenshot: X]`
- [ ] Escalation path included for troubleshooting articles
- [ ] Title is scannable and contains the user's goal or error text
