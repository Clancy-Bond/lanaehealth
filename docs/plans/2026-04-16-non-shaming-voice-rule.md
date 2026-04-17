# Non-Shaming Voice Rule (LanaeHealth)

**Status:** Draft. Merges into CLAUDE.md once approved as standing rule.

**Why this exists:** Chronic illness apps that use streaks, shame language, and compliance framing make bad days worse. Bearable, Finch, and Flaredown reviews consistently cite this as a top-three pain point. LanaeHealth's patient (Lanae: POTS, endo, chronic fatigue) will have bad days where she cannot log. The app must reward when she does, stay neutral when she doesn't, and NEVER shame.

---

## The Rule (what goes in CLAUDE.md)

> **Non-shaming voice.** LanaeHealth never uses streak mechanics, guilt framing, compliance language, or comparison-to-self shame. A missed day is not a failure. Rest is not regression. The app reports facts and celebrates presence, never absence.

---

## Banned Patterns

Every UI string, notification, toast, email, and API error message is subject to these rules. No exceptions.

### Banned words and phrases

- "streak" (any use: "5 day streak", "broken streak", "keep your streak going")
- "missed" as subject ("you missed 3 days")
- "fell behind", "slipped", "off-track"
- "back on track" (implies Lanae was somehow off, not neutral)
- "failed", "failure" in any user-facing copy
- "consistency score", "adherence score" shown to user (metric may exist internally for clinicians, but NOT surfaced to Lanae)
- "goal not met", "goal missed", "incomplete"
- "you should have", "you forgot to", "don't forget"
- "broken chain" (Seinfeld productivity trope)
- Red X marks on calendar days for no-log
- "haven't logged in X days" as a hero message
- Any emoji that conveys disappointment (frowny faces, cry faces)
- "light/moderate/heavy" applied to LOGGING (not to symptoms themselves)
- Percentage-of-days-logged shown as a score

### Banned visual patterns

- Progress rings that fill only on full-log days
- Calendar heatmaps that show no-log days as a different color than low-data days (indistinguishable)
- "Perfect week" / "Perfect month" badges
- Leaderboards against past self or average user
- Any gamification that penalizes pause

---

## Approved Patterns

### Voice

- "Today you logged..." (fact, no judgment)
- "Rest day noted" (when the rest day feature is used)
- "Last log was Tuesday" (fact, no judgment)
- "You checked in 4 times this week" (positive presence count, never "only 4 of 7")
- "No data available for this window" (neutral, not "missing")
- "Come back when you're up for it" on empty states
- Celebrate WHEN Lanae logs, stay silent when she doesn't

### Notifications

- Gentle reminders are OK, but:
  - Opt-in, not default
  - Quiet hours: no reminders 9pm-9am
  - No reminder if Lanae logged in the last 18 hours
  - Reminder copy: "Quick check-in? 30 seconds." (offer, not demand)
  - No streak-anchored reminders ("don't break your streak!")

### Empty states

- On the Log page empty state: "Log whatever feels easy today. Even one thing helps."
- On Patterns page with sparse data: "More data will sharpen these patterns. No pressure."
- On Intelligence page low-signal: "Not enough data yet to say with confidence." (uncertainty, not shame)

### Scaling with energy

- Energy-Adaptive Goal Scaling (Finch-inspired, Wave 2 feature): Minimal / Gentle / Full modes. These modes SCALE DOWN expectations on low-energy days without framing them as reduced.
- Rest Day Action: An explicit "I'm resting today" button. Pressing it is a POSITIVE log, not a null log. Analysis pipeline treats rest days as expected data, not gaps.

---

## Clinical Nuance

Clinicians looking at Lanae's data DO need adherence metrics. Those can exist internally, but:

- Any clinician-facing report that includes adherence framing must be LABELED as such, and shown via /doctor page only.
- The log page, patterns page, intelligence page, home page NEVER show Lanae an adherence percentage.
- If a doctor asks "how consistent has your tracking been?", the doctor report can say "Logged 4 of 7 days last week." That factual framing is acceptable in a clinical context. It is NOT acceptable in Lanae's daily UI.

---

## Edge Cases

1. **Medication adherence:** Lanae has PRN (as-needed) and scheduled meds. Missed scheduled meds are medically significant and must be surfaced. Framing: "Blood pressure med not logged in 2 days." Neutral fact, with a CTA to log retroactively. Not "you forgot." Not "you missed." Not a shame frame.

2. **Dangerous threshold alerts:** If vitals cross a medically dangerous threshold (standing pulse > 140 sustained, temp > 103, etc.), the alert is URGENT not shame. "Contact your doctor" framing. This is the one exception where the app demands action.

3. **Cycle tracking:** Late period reminders are OFF by default. When enabled, they are informational ("Period is 3 days later than predicted. Irregular cycles are common.") Never "concerning" or fertility-pressuring.

4. **Log gaps longer than 7 days:** Show gentle re-engagement: "Welcome back. No catch-up required." Not "Where have you been?" Not "Time to get back on track."

5. **Daily reminder fatigue:** After 3 consecutive unopened reminders, pause them automatically. Do not send a "we miss you" email. Just go quiet.

---

## Implementation: Copy Audit Procedure

The post-Wave-1 copy audit subagent will:

1. Grep the entire codebase for banned words/phrases:
   - `streak|missed|forgot|failed|off.track|slipped|behind|chain broken|perfect.*week|perfect.*month|consistency.*score|adherence.*score`
   - `goal.*(not.met|missed|incomplete)`
   - Hero copy on pages that shows percentage-of-days

2. For each hit, check if it's:
   - User-facing string (banned, must be rewritten)
   - Internal variable name (OK, but flag if misleading)
   - Clinical report copy in /doctor (allowed per Clinical Nuance section)
   - Test fixture (low priority)

3. Rewrite user-facing violations per approved patterns.

4. Add a CLAUDE.md rule:
   ```
   **Non-shaming voice:** No streak mechanics, no guilt framing, no
   compliance language, no comparison-to-self shame. Rest is not
   regression. See docs/plans/2026-04-16-non-shaming-voice-rule.md
   for the full rule set and banned-word list.
   ```

5. Add a lightweight lint (or check script) that greps for banned words in src/app/ and src/components/ and fails build if found. Pragma for clinical report copy.

6. Commit as: `refactor: non-shaming voice rule + copy audit`.

---

## What I Want Lanae's Input On

This is a UX rule that shapes every future feature. Lanae should sanity-check:

1. The banned-word list: any I'm being too strict about? Any missing?
2. The clinical nuance section: OK to allow adherence framing in doctor reports?
3. The dangerous threshold exception: is "Contact your doctor" the right escalation, or should it be "Call 911" for specific thresholds?
4. The reminder fatigue rule: 3 consecutive unopened = auto-pause. Right number?
5. The medication adherence edge case: how hard should LanaeHealth push when scheduled meds are not logged? Neutral fact + CTA, or stronger?

These are design choices that matter more than my default answers. Flagged for her review when she picks up the Wave 1 review.
