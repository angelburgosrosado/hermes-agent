---
name: content-ops
description: Generate consistent support docs, promotional copy, product descriptions, emails, and social content — all anchored to a single brand manifest (BRAND.md) so every generation is uniform in voice, terminology, and messaging.
---

# Content Ops

Generates consistent content across all formats by anchoring every generation
to a single source of truth: `BRAND.md`.

## The uniformity guarantee

Content drifts when each generation re-interprets voice, terminology, and
messaging from scratch. This skill prevents drift by:

1. **Always reading `BRAND.md` first** — before writing a single word
2. **Routing to a sub-skill** — each content type has explicit structure rules
3. **Enforcing quality checks** — every sub-skill has a pre-output checklist

Update `BRAND.md` once → every future generation inherits the change.

## When to use

Use this skill whenever you are generating:

| Content type | Sub-skill |
|-------------|-----------|
| How-to guides, troubleshooting, FAQs | `sub-skills/support-docs.md` |
| Ad copy, landing pages, flyers, one-pagers | `sub-skills/promotional.md` |
| Product pages, feature descriptions, spec sheets | `sub-skills/product-descriptions.md` |
| Email sequences, announcements, nurture | `sub-skills/email-copy.md` |
| LinkedIn, Instagram, X/Twitter, Facebook posts | `sub-skills/social-media.md` |

For full ad campaign strategy (audience, funnel, budget), use the `ads` skill
instead — it has platform-specific campaign architecture. Use this skill for
the copy execution within that strategy.

## Required setup

**Before generating any content for the first time:**

1. Open `BRAND.md` in this directory
2. Fill out every section — especially:
   - Voice rules (always/never)
   - Terminology table (prevents off-brand word choices)
   - Primary Message and Supporting Messages (anchors every headline)
   - Proof points (prevents invented stats)
   - Compliance section (legal guardrails)
3. Save and commit `BRAND.md` — treat it as a controlled document

Incomplete brand manifests produce incomplete content uniformity.

## Execution protocol

When asked to generate content using this skill:

### Step 1 — Classify the request
Identify which content type is being requested. If unclear, ask:
- "Is this for support/help center, marketing/promotional, product page, email, or social?"
- "Which channel or platform?"

### Step 2 — Read BRAND.md
Read the full `BRAND.md` before writing. Extract:
- Relevant voice rules for this content type
- Applicable terminology
- Proof points to draw from
- Channel-specific constraints from the Channels table
- Any compliance requirements

### Step 3 — Load the sub-skill
Read the appropriate sub-skill file and apply its template and quality checklist.

### Step 4 — Generate content
Produce the content using the sub-skill template structure.
Flag any gaps with `[NEEDS INPUT: reason]` rather than inventing details.

### Step 5 — Run quality checks
Before outputting, run through the sub-skill's quality checklist.
Do not skip checks. Do not output content that fails a check without flagging it.

### Step 6 — Output in standard format

Always structure the final response with these sections:

1. **Summary** — content type, channel, goal in 1-2 sentences
2. **Brand anchors used** — which Primary Message, proof points, and voice rules were applied
3. **Content** — the deliverable, in fenced blocks with content type labeled
4. **Gaps / flags** — any `[NEEDS INPUT]` items, missing proof, or compliance items to resolve
5. **Variants** — if multiple versions are useful (e.g., A/B subject lines), list them here

## Maintaining uniformity over time

### When a brand decision changes
1. Update `BRAND.md` — the one file
2. Do NOT patch individual content pieces — regenerate from the manifest

### When content conflicts arise
If generated content feels "off brand," the fix is almost always in `BRAND.md`:
- Add a new "never do" voice rule
- Add the correct term to the Terminology table
- Sharpen the Primary Message

### When generating a content series
State the series goal and all pieces upfront so they are generated with
shared context — not one-by-one with fresh context each time. This prevents
the most common source of drift: each generation starting cold.

## Related skills

- `ads` — full campaign strategy (audience, funnel, budget, creative briefs)
- `ads-copy` — ad copy variations with A/B frameworks
- `ads-landing` — landing page audit and optimization
- `annuity-life-insurance-sales` — insurance-specific sales language and workflow
