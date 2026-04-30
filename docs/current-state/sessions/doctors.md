# Current state: Doctor mode (diagnostic analysis output)

**Recording:** `docs/current-state/recordings/2026-04-29-app-tour.mp4`
**Frames:** `docs/current-state/frames/2026-04-29-app-tour/frame_0057.png` through `frame_0113.png`. This is the longest stretch in the recording (~57 frames, more than half) because the user scrolled through a long-form AI-generated diagnostic document.

## What is on screen today

- **Header.** "Your Diagnostic Hypothesis Tracker / Last updated: 2026-04-16 / Data reliability: MODERATE for static problems, LOW for dynamic trending."
- **Caveat block.** "IMPORTANT: Data Limitations First / Before reviewing scores, note that all dynamic data streams are currently at 0% for the recent window, no Oura biometrics, no daily symptom logs, no food diary, no cycle tracking. All confidence scores are based on static records (lab results, encounter notes, imaging). This is a meaningful limitation."
- **6 Active Hypotheses.** Each has a numbered card with name, score (`100/100`), category (`ESTABLISHED`, `PROBABLE`), supporting evidence list, contradicting evidence list, and (sometimes) challenger flags. Examples seen:
  1. Immune Dysregulation / Inflammatory Substrate (100/100, ESTABLISHED) - hs-CRP 3.2 / 5 mg/L, CT head bilateral maxillary sinusitis
  2. POTS / Autonomic Dysfunction (61/100, PROBABLE) - standing pulse 106 vs resting 70 (+36 bpm), syncope events, ED visits, contradictions noted (no tilt table, no Holter)
  3. Hypothyroidism thread - TSH 1.88 -> 5.1 trajectory, free T4/T3 not run on April 9, contributing thread for heavy periods, fatigue, bradycardia, cholesterol elevation
  4. Diet / Structural Iron Finding
  5. GI Story / Gut symptoms - chronic IBD vs functional, Accutane history, alternating constipation 5 yrs, fecal calprotectin order, three priority lab actions (ferritin/iron infusion, GI imaging, allergist follow-up)
  6. Ehlers-Danlos / hEDS suspected, MRI brain at foramen magnum, family heart history (great-grandmother MI, grandfather quadruple bypass at 46)
- **Action priorities.** A "Current Priority Order" list with `Action |` columns: Buy Thorne L-Glutamine, Message PCP about P5P and ALT, Find SIBO test result, Raise bowel symptoms with OB/GYN.
- **Wixela mouth-rinse confirm.** The very last visible content (frame 0113) is "The One Thing I Want You To Confirm: Ask your allergist or PCP to confirm the mouth rinse instruction for Wixela if nobody mentioned it. ... Same Sequence at Night | 1 Nasal antihistamine spray | 2 Wixela inhaler | 3 Rinse mouth with water, spit it out | 4 Brush teeth."
- **Affordances at the bottom of the scroll.** Buttons "Hypotheses", "Next actions", and what looks like a "Show this?" link, plus a teal/green chat-style assistant bubble repeating user-style follow-up questions ("Do you have a list of all the things she's been deficient in...", "Was I supposed to rinse my mouth after each Wixela dose?").

## What this is structurally

- A long-form rendered Markdown document, not a structured data table. Lab values and family history are inline prose with embedded scores. The same content lives in `medical_narrative` / `medical_timeline` / `active_problems` / `correlation_results` tables (see CLAUDE.md "Database / New tables").
- The AI assistant bubbles at the end suggest this surface includes an inline chat to ask follow-up questions about the analysis. That is distinct from the home "Ask AI" sheet (see `chat.md`), even if the underlying Claude API plumbing is shared via the Context Assembler.

## Routes that own this surface

- `/v2/doctor`
- `/v2/doctor/*`

A Doctor session is locked to these routes per `docs/sessions/04-doctor.md` (if present) and the README.

## Architectural context

- This output is generated through the three-layer Context Assembler (`src/lib/context/assembler.ts`). Static identity + rules FIRST, then dynamic permanent core, summaries, retrieval, handoff.
- Markdown rendering is the dominant layout primitive. The rendering component must handle scores, tables, and inline emoji indicators (red circle, warning triangle, green check).
- The "Data Limitations First" prelude is a self-distrust principle (CLAUDE.md "Memory is HINTS, not GROUND TRUTH"). Preserve this surface on any redesign; do not silently hide it to look cleaner.

## Known gaps in this recording

- No editing / regenerate flow.
- No "drill into hypothesis" detail page.
- No printable doctor summary export.
- No source-linking from a hypothesis claim back to the underlying record (lab, imaging, encounter note).
