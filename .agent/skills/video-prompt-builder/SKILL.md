---
name: video-prompt-builder
description: Generate detailed, shot-by-shot AI video prompts for Seedance 2.0 from a creative brief. Use this skill whenever the user wants to create a video prompt, write a shot list, plan a video sequence, describe a video concept for AI generation, or mentions Seedance. Also trigger when the user describes a scene, ad concept, brand film, product video, or any visual sequence they want turned into structured prompts — even if they don't explicitly say "video prompt." Trigger on phrases like "write me a video prompt", "Seedance prompt", "shot list", "plan a video", "video concept", "create a sequence", "brand film prompt", "ad prompt", or any time the user describes what they want to happen in a video and needs it translated into generation-ready prompts.
---

# Video Prompt Builder for Seedance 2.0

Build cinematic, shot-by-shot video prompts from a creative brief. Every output follows a structured effects breakdown format designed to give Seedance 2.0 maximum detail on camera work, effects, transitions, pacing, and energy arc.

## How this skill works

### Stage 1 — Vision & Genre

Collect the user's one-sentence concept and identify their genre. Present these options if they haven't specified one:

- **Athletic / Sport** — kinetic energy, physical performance, speed
- **Brand Film** — product or identity, emotional tone, aspirational
- **Music Video** — rhythm-driven, expressive, stylised
- **Narrative / Cinematic** — story arc, character, environment
- **Abstract / Experimental** — concept-led, non-literal, mood-first
- **Documentary / Observational** — naturalistic, textural, real-world

Also note any reference materials (films, ads, directors, visual styles) the user mentions.

### Stage 2 — Quick Mode

If the user already has a clear concept AND a genre AND references, offer the fast path:

> "It looks like you have a clear vision and strong references. I can move directly to prompt construction — or we can develop the narrative first. Which do you prefer?"

If they choose fast path, skip to Stage 4. Otherwise continue.

### Stage 3 — Narrative Development (Attack & Deconstruct)

Build a basic scene version of the concept first — the literal, straightforward version. Then ask the user:

> "Here's the basic version: [one sentence]. What's the conflict, surprise, or unexpected element that makes this distinctly yours?"

Use their answer to push the concept beyond the obvious. The goal is to find the thing that makes this video memorable, not just competent.

### Stage 4 — Visual & Technical Enhancement

Layer in cinematographic and technical specifications aligned with the chosen genre:
- Camera movement style (handheld vs. locked-off vs. drone)
- Lighting conditions and colour grade direction
- Pacing instinct (rapid cuts vs. long holds vs. mixed)
- Any practical constraints (single shot, no talent, product-only, etc.)

### Stage 5 — Prompt Construction

1. Read the reference file at `references/effects-breakdown-reference.txt` to calibrate detail level.
2. Generate the full four-section output (shot-by-shot timeline, effects inventory, density map, energy arc).
3. Append a **Final Production Brief** — a compact 30-100 word summary containing: the generation prompt, referenced assets, and directorial guidance. This is the copy-paste-ready version for direct input into Seedance 2.0.

---

## Input expectations

The user's brief can include any combination of:
- Subject/talent description (who or what is on screen)
- Setting/environment
- Mood, tone, energy level
- Brand or product context
- Specific effects or camera moves they want
- Duration target
- Reference to existing ads, films, or visual styles
- Colour palette or grade preferences

If the brief is too vague with no genre or concept (e.g. "make something cool"), ask one focused clarifying question before proceeding. Don't over-interrogate — work with what you're given and make creative decisions where the user hasn't specified.

## Output structure

ALWAYS output ALL FIVE sections in this exact order. Never skip a section.

### Section 1: SHOT-BY-SHOT EFFECTS TIMELINE

This is the core of the prompt. Each shot gets its own block structured like this:

```
SHOT [N] ([timestamp]) — [Shot Name / Description]
• EFFECT: [Primary effect name] + [secondary effects if stacked]
• [Detailed description of what's happening visually]
• [Camera behaviour — angle, movement, lens if relevant]
• [Speed/timing information]
• [How this shot connects to the next — transition type]
```

Guidelines for writing shots:
- Each shot should be 1-4 seconds unless the brief calls for longer holds
- Name effects precisely: "speed ramp (deceleration)" not just "speed ramp"; "digital zoom (scale-in)" not just "zoom"
- Describe stacked effects explicitly — if 3 things happen at once, list all 3
- Include transition logic: how does this shot EXIT and how does the next shot ENTER?
- Use language Seedance 2.0 can interpret: describe the visual result, not the editing software technique. For example, say "the frame scales inward rapidly" rather than "apply a keyframed scale effect in After Effects"
- Note the most impactful or signature shot with a callout like "This is the SIGNATURE VISUAL EFFECT"
- Be specific about speed percentages when using slow-motion (e.g. "approximately 20-25% speed")
- Describe motion blur, light behaviour, and atmospheric effects where relevant

### Section 2: MASTER EFFECTS INVENTORY

A numbered list of every distinct effect used across the full prompt, with:
- Effect name
- How many times it's used (e.g. "used 3x")
- Which shots it appears in
- A one-line description of its role in the edit

This section helps the user (and the generator) see the full palette of techniques at a glance. Group similar effects together. Typical categories include: speed manipulation, camera movement, digital effects, transitions, compositing, optical effects.

### Section 3: EFFECTS DENSITY MAP

Break the timeline into segments (roughly 3-6 second chunks) and rate each as:
- **HIGH DENSITY** — 4+ effects stacked or rapid-fire
- **MEDIUM DENSITY** — 2-3 effects
- **LOW DENSITY** — 1 effect or clean/simple footage

Format:
```
[timestamp range] = [DENSITY LEVEL] ([brief list of effects] — [count] effects in [duration])
```

### Section 4: ENERGY ARC

Describe the overall energy structure of the video as a narrative arc. The reference uses a three-act model:
- **Act 1**: Opening energy — how the video grabs attention
- **Act 2**: Middle section — how it develops and what the signature moments are
- **Act 3**: Resolution — how the energy resolves and lands

Adapt the number of acts to suit the video's length and structure. A 5-second clip might only need two beats; a 30-second brand film might need four.

### Section 5: FINAL PRODUCTION BRIEF

A compact 30-100 word block ready for direct input into Seedance 2.0. Include:
- The generation prompt (what to generate, in plain imperative language)
- Referenced assets (any specific visual references, styles, or source material)
- Directorial guidance (tone, energy, the one thing that must land)

Format:
```
PROMPT: [generation-ready description]
REFERENCES: [visual references, styles, or assets]
DIRECTION: [the single most important creative instruction]
```

This is the copy-paste-ready deliverable. Keep it tight — Seedance performs better with precise, economical language than exhaustive description.

## Creative principles

These principles should guide every prompt you write:

1. **Contrast drives impact.** Alternate high-density and low-density moments. A slow-motion shot after a speed ramp hits harder than two speed ramps back-to-back.
2. **Signature moments matter.** Every video should have at least one "hero" effect — something visually distinctive that makes it memorable. Call it out explicitly.
3. **Transitions are shots.** Don't treat transitions as throwaway connectors. A whip pan, a bloom flash, a motion blur smear — these are creative moments, not just cuts.
4. **Specificity over vagueness.** "The frame rotates clockwise by approximately 15-20°" is better than "the camera tilts." "Approximately 20-25% speed" is better than "slow motion."
5. **Energy must resolve.** No matter how intense the opening, the video needs to land. The final moments should feel intentional, not like the effects budget ran out.

## Tone and style

- Write in a direct, technical tone — like a director's shot notes, not a marketing brief
- Use bullet points within each shot block for clarity
- Be concise but complete — every detail should earn its place
- No hype language, no "stunning" or "breathtaking" — describe what happens and let the visuals speak

## Duration calibration

Adjust the number of shots and effects density to match the target duration:
- **5-10 seconds**: 4-7 shots, lean and punchy, 1 signature effect
- **10-20 seconds**: 8-14 shots, room for contrast and build, 1-2 signature effects
- **20-30 seconds**: 12-20 shots, full three-act arc, 2-3 signature effects
- **30+ seconds**: Scale accordingly, but maintain density contrast — don't fill every second with effects

If the user doesn't specify a duration, default to 15-20 seconds (a sweet spot for AI video generation).

## Example workflow

**User says:** "I want a dramatic brand film for a trail running shoe. Mountain setting, golden hour, single runner. Make it feel epic but not over-the-top. About 15 seconds."

**You do:**
1. Identify genre (Brand Film) — no interview needed, brief is clear → Quick Mode
2. Apply Attack & Deconstruct: basic version = "runner at golden hour on a mountain trail." Ask: what's the unexpected element? Make a creative decision if the user doesn't specify (e.g. the runner stops, not to rest, but to look back at the city below — scale contrast as the signature beat)
3. Read `references/effects-breakdown-reference.txt` to calibrate detail level
4. Generate all five sections: shot-by-shot timeline (8-12 shots), master effects inventory, density map, energy arc, and Final Production Brief
5. Present in plain text in chat
