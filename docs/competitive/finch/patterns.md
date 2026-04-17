# Finch: Patterns

Observed UX patterns extracted from Finch usage. Ranked by Lanae impact (1-5 stars) per the rubric in `design-decisions.md` section 8. Patterns that conflict with our rules (e.g., shame-based streaks) are not included.

---

## Pattern 1: Non-Shaming Continuity ("Pet mood, not pet death")

### What it is
Finch's bird has a mood indicator that fluctuates based on recent user activity. If the user is inactive, the bird gets sleepy or sad, but never dies, never resets progress, never "breaks." Long-running progress (stones, rainbow fragments, accessories) accumulates permanently. A gap is visually a rest period, not a red X or broken chain.

### Why it works
Chronic illness users self-identify shame as the reason they abandon habit apps. A streak of 42 breaking on day 43 because of a flare is re-traumatizing. Finch's model turns gaps into neutral or mildly somber signals that resolve instantly when the user returns. The pet's persistence (always there, always recognized the user) is a relational anchor, not a performance metric.

### Trade-offs
- Users who LIKE streak pressure (often neurotypical fitness trackers) may find the mechanic too soft.
- The gentle mood indicator can be ignored entirely, potentially reducing engagement for certain user types.
- Pet-based framing is a strong aesthetic choice, not everyone resonates with it.

### Adaptability to LanaeHealth
HIGH. We do not have a pet, but we can implement the core mechanic: replace any consecutive-day tracking with cumulative-effort tracking. A "You have logged 47 days this month" framing celebrates density without punishing gaps. Our MorningCheckIn and EveningCheckIn components can display a soft persistent indicator (sage-tinted, not red) that says "Welcome back" rather than "Streak broken."

### Lanae impact: 5/5

---

## Pattern 2: Energy-Adaptive Goal Scaling

### What it is
When the user opens Finch on low-energy days, the app asks a brief "How are you feeling?" and offers to scale goals for the day. Example: usual goal of "3 glasses of water + 10 min walk + journal entry" becomes "1 glass of water + 30 seconds of stretching." Scaling is always an offer framed positively. Users can also manually declare a "Rest Day" which marks the day as intentionally recovery-focused.

### Why it works
Energy availability in chronic illness fluctuates radically day to day. A static goal list is constantly wrong. Adaptive scaling respects that fluctuation and turns the app into a collaborator rather than a taskmaster. Crucially, the scaling DOWN happens automatically on energy signal; the user does not have to choose between "succeed at tiny" or "fail at normal."

### Trade-offs
- Requires an energy signal input, adding a friction step unless inferred.
- Over-scaling down could reduce intrinsic motivation for users who thrive on challenge.
- Needs calibration: what does "low energy" mean in data terms?

### Adaptability to LanaeHealth
HIGH. We already collect energy data from Oura (readiness, sleep), NC (cycle phase), and direct logging (EnergySlider.tsx). We can infer a daily energy budget from readiness < 60, sleep < 6 hours, or luteal/menstrual phase, and surface a scaled goal list. Existing EndoMode component is a precedent: flare mode collapses UI. Extend this to a graduated scale (Full, Gentle, Minimal) rather than binary flare/normal.

### Lanae impact: 5/5

---

## Pattern 3: Micro-Task Self-Care Library

### What it is
Finch ships with a catalog of "micro-tasks" that take 30 seconds to 2 minutes: drink a glass of water, take 3 breaths, stretch your neck, text someone you love, open a window, step outside for 1 minute. Users can tap one and a brief in-app guided experience runs (e.g., breathing animation). Completion awards a rainbow stone.

### Why it works
Bed-bound days often mean zero traditional productivity. A catalog of 30-second actions creates wins that are realistic at minimum energy. The in-app guided experience removes the cognitive load of "how do I even breathe properly" and turns intention into execution in one tap.

### Trade-offs
- Risk of gamification-for-its-own-sake (stones for "existing")
- Library needs to feel medically relevant, not generic self-help
- Rewards must not feel condescending

### Adaptability to LanaeHealth
HIGH. We already have BreathingExercise.tsx, HydrationRow.tsx, GratitudeQuickInput.tsx as existing micro-actions. A unified "Micro-Care" drawer accessible from the log page, with 8 to 12 curated actions relevant to POTS (hydrate, add salt, elevate legs), endo (heat pad, gentle stretch), and fatigue (rest, dim lights, breathe). Completion increments a non-streak counter.

### Lanae impact: 5/5

---

## Pattern 4: Tree of Life (Celebratory History View)

### What it is
End of each month, Finch renders a visual "Tree of Life" where every completed self-care action becomes a leaf, flower, or fruit on the tree. Bad months still produce trees, just with fewer adornments. Users can scroll back through all past trees as a calm, aesthetic history.

### Why it works
Traditional calendar views with red/green/empty cells are visually judgmental. A tree that grows from actual completed acts turns history into a garden, not a ledger. Chronic illness users report emotional attachment to their trees.

### Trade-offs
- Requires real effort to design well; bad visuals feel patronizing
- Not directly clinically useful (no doctor shows a tree at a visit)
- Additive UI surface with no medical purpose

### Adaptability to LanaeHealth
MEDIUM-HIGH. We already have a Timeline page. A "Year in Care" or "Month in Care" visualization that shows all logged self-care actions as visual elements (sage leaves for hydration, blush petals for meds, etc.) could live on the Home page as a non-clinical emotional anchor. Doctor-facing views stay chart-based.

### Lanae impact: 3/5

---

## Pattern 5: Short-Form Reflection Prompts

### What it is
Once per day Finch prompts a one-line reflection: "What's one thing that went okay today?" The response field is intentionally small (one line of text, not a journal page). Users can skip freely. Responses are saved and surfaceable in history.

### Why it works
Journaling apps fail because their empty text boxes intimidate. A one-line cap makes the task tractable at any energy level. "Went okay" is softer than "Went well" for bad-day usage.

### Trade-offs
- One-liners may be too short for users who want deeper processing
- The prompt library needs variety to avoid staleness
- Storage and retrieval need careful UX so reflections feel cherished, not archived

### Adaptability to LanaeHealth
HIGH. GratitudeCard.tsx already exists. Extend with a rotating prompt library (5 to 10 prompts rotating by cycle phase, recent symptoms, recent wins) and a one-line-cap text input. Save to a gratitudes table (exists) or extend with a reflections schema.

### Lanae impact: 4/5

---

## Pattern 6: Mood Check-In as Four-Tap Flow

### What it is
Finch's mood check-in is: (1) open app, (2) tap "I want to check in", (3) tap one of a small set of mood emojis or sliders, (4) tap a secondary tag (e.g., "tired", "hopeful"). Total interaction: under 8 seconds. No mandatory text. No required context.

### Why it works
On a bad day, anything longer than 8 seconds is unlikely to happen. The four-tap ceiling sets a hard design constraint that keeps the check-in accessible at minimum energy. Rich context can be added by users who want to, but is never required.

### Trade-offs
- Four taps may be too few to capture clinically relevant mood state
- Secondary tag library requires careful curation
- Clinicians want more dimensions than a single emoji

### Adaptability to LanaeHealth
HIGH. Our MoodCard.tsx and MoodQuickRow.tsx are in this territory. Audit the current mood flow for tap count and ensure it hits four or fewer. Secondary tag library should align with our clinical-scales.ts for PHQ-like mapping when users want depth.

### Lanae impact: 5/5

---

## Pattern 7: In-App Micro-Intervention (Breathing, Grounding)

### What it is
When a user logs negative mood or high stress, Finch offers an immediate in-app intervention: guided breathing, a 5-4-3-2-1 grounding exercise, a soothing sound. The intervention runs inside the app, under a minute, with the bird present.

### Why it works
Crisis moments need frictionless coping tools. Redirecting to an external app (Calm, Headspace) loses the user. Finch's in-app delivery catches the moment.

### Trade-offs
- Requires content creation (guided audio, animations)
- Not a replacement for therapy
- Quality bar is high; bad breathing animations feel mocking

### Adaptability to LanaeHealth
HIGH. BreathingExercise.tsx exists. Expand to include a 5-4-3-2-1 grounding flow and a POTS-specific calming protocol (elevate legs, cold water on wrists, slow exhales). Trigger automatically on high-stress log or high-pain log.

### Lanae impact: 4/5

---

## Pattern 8: Gentle Insights ("You've been showing up")

### What it is
Weekly or monthly, Finch surfaces insights framed exclusively positively: "You've been checking in more often this week", "Your mornings have felt calmer lately", "Your garden grew 17 leaves this month." Deficit observations ("You missed 4 mood logs") are intentionally absent.

### Why it works
Chronic illness users are acutely aware of their deficits. Apps that restate the obvious are painful. Positive-only framing is not dishonest; it's clinically appropriate for anxiety and depression.

### Trade-offs
- Could miss important clinical patterns (e.g., sudden drop in activity = depression indicator for clinicians)
- Must be balanced with truthful data the user can access elsewhere
- Risks feeling like gaslighting if used cynically

### Adaptability to LanaeHealth
HIGH. Our InsightBanner.tsx is the right surface. Copy framework: lead with positive observation, never a deficit. Clinical patterns (e.g., PHQ-9 flag, POTS tachycardia trend) should surface in the Doctor page with the clinical register; home page stays warm and positive.

### Lanae impact: 4/5

---

## Pattern 9: Rest Day as Positive Action

### What it is
Finch has a "Rest Day" button. Pressing it marks the day as an intentional recovery day. The bird rests happily, the user earns a small reward for listening to their body. This is the inverse of most apps, which would mark the day red.

### Why it works
Rest is medicine for chronic illness. Treating it as an action, not an absence, rewires the user's relationship with gaps. Gives the user linguistic and visual control over "I am not doing nothing, I am recovering."

### Trade-offs
- Could be abused by users who rest every day
- Clinicians may want to see rest-day density as a signal
- Requires an intentional user action, one more step

### Adaptability to LanaeHealth
HIGH. Add a "Rest Day" action to the log page that sets daily_logs.rest_day = true (new column) and short-circuits the check-in expectations for the day. Dashboard and insights treat rest days as expected data, not gaps. The FlareToggle.tsx is a precedent; rest day is its sibling for non-medical low-energy days.

### Lanae impact: 5/5

---

## Pattern 10: Opt-Out Shame Settings

### What it is
Finch lets users disable streaks, notifications, reminders, and social features in settings. The defaults are gentle; the off switch is first-class.

### Why it works
Different users need different pressure. Giving users control over pressure level respects their self-knowledge. Anxiety-prone users disable notifications; motivation-driven users keep them on.

### Trade-offs
- More settings = more complexity
- Default settings matter enormously (gentle by default)
- Risk of settings sprawl

### Adaptability to LanaeHealth
HIGH. Settings page already exists. Add explicit section: "Pressure settings" with toggles for streak display (default off), daily reminder tone (default gentle), goal targets (default user-chosen).

### Lanae impact: 4/5

---

## Summary ranking (for plan.md)

| Pattern | Lanae impact |
|---|---|
| Non-Shaming Continuity | 5 |
| Energy-Adaptive Goal Scaling | 5 |
| Micro-Task Self-Care Library | 5 |
| Four-Tap Mood Check-In | 5 |
| Rest Day as Positive Action | 5 |
| Short-Form Reflection Prompts | 4 |
| Gentle Insights | 4 |
| In-App Micro-Intervention | 4 |
| Opt-Out Shame Settings | 4 |
| Tree of Life History | 3 |
