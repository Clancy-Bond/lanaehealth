# 2026 Design Findings: What Makes Apps Genuinely Delightful

**Compiled:** 2026-04-16
**Purpose:** Concrete, code-able design vocabulary for LanaeHealth extracted from eight best-in-class apps. Specific numbers, not vibes.

## Why this doc exists

LanaeHealth already has a usable foundation: Warm Modern palette, iOS-style type scale, multi-layer warm-tinted shadows, focus-visible states, reduced-motion support, pill system. What it lacks is a **unified motion vocabulary, empty-state voice, loading language, and celebration tone** — the small details that make an app feel alive to a user who opens it every day. This doc captures what to steal from the best.

---

## 1. Linear (linear.app)

### Spacing scale
Linear uses a strict **4-point grid**: 4, 8, 12, 16, 24, 32, 48, 64. Nothing in between. This is enforceable with a single CSS scale. They treat 24px as the "section inner" default and 48px as "section separator".

### Typography
- Display: Inter at 26-32px, weight 600, letter-spacing -0.02em
- Body: 14px, weight 400, line-height 1.5
- Meta: 12px, weight 500, uppercase with letter-spacing 0.04em

### Motion curves
Linear's signature easing is `cubic-bezier(0.4, 0, 0.2, 1)` (Material standard) for most transitions, but they use `cubic-bezier(0.32, 0.72, 0, 1)` (iOS-like) for modal and sheet entrances. Duration: **150ms for state changes, 200ms for enter, 160ms for exit**.

### Shadows
Linear uses **two** shadows only:
- `0 1px 2px rgba(0,0,0,0.04)` for resting cards
- `0 1px 2px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.08)` for elevated/hovered

### Empty states
Linear's "Inbox zero" state says **"You're all caught up"** with an illustration, not "No notifications." It reframes empty as accomplishment. For unfulfilled states: **"Nothing here yet. Create your first issue."** — action is baked into the message.

### Command-K pattern
Press `cmd+K` anywhere, a translucent palette slides in with `backdrop-filter: blur(20px)` and `background: rgba(17, 17, 19, 0.85)`. The input is the focus. Results are ranked. **Steal this for a global search in LanaeHealth.**

### What to borrow
- Strict 4pt grid (we already have Tailwind's, but we should audit uses)
- Two-shadow rule
- "You're all caught up" reframing for empty states
- Command-K-style global search for "when did I last feel this way?"

---

## 2. Things 3 (Cultured Code)

### Design philosophy
Things 3 is the canonical example of **restraint**. No dashboards. No graphs. No badges. The app is essentially four screens with one job each: today, upcoming, anytime, someday. Every element is optional until the user explicitly adds it.

### Typography
- Uses SF Pro Rounded for headers at 28px, weight 700
- Body 15px, weight 400, line-height 1.35
- Relies on **weight** for hierarchy, not size

### Microinteractions
The legendary "Magic Plus" button:
- 56x56 circle with a plus icon
- On drag, it magnetically snaps to locations in the list
- Creates a new task exactly where dropped
- Drop animation: `cubic-bezier(0.34, 1.56, 0.64, 1)` — a slight overshoot

The checkmark:
- No confetti, no sound. Just a short `scale` from 0 to 1.1 to 1, 180ms
- Row fades to 50% opacity, then slides to "completed" section over 300ms
- Undo toast appears bottom-center for 4 seconds

### Color
Things 3 uses one accent color (user-pickable, default blue #4B8AFF). Everything else is grays and black. **The accent appears in less than 5% of pixels on screen.** This is the lesson: restrict accent.

### Empty states
"Nothing to do. Feel free to take the rest of the day off." Written like a friend.

### What to borrow
- Quiet check-pop celebration, not confetti (we already have `check-pop` keyframe — use it)
- Weight-based hierarchy for Lanae's daily log
- Undo toast for 4s after destructive actions
- Empty states that suggest rest, not productivity

---

## 3. Raycast (raycast.com)

### Motion timing
Raycast's core animation tokens:
- `--raycast-transition-fast: 100ms`
- `--raycast-transition-base: 150ms`
- `--raycast-transition-slow: 200ms`
- Default curve: `cubic-bezier(0.4, 0, 0.2, 1)`

### Focus rings
2px ring at `rgba(255,255,255,0.4)` on dark mode, with 4px offset. Never a harsh blue outline. **Our sage focus ring (2px solid sage, 2px offset) is already in the right family.**

### Keyboard-first feedback
Every hover state also appears on keyboard focus. The selected row has:
- Background `rgba(255,255,255,0.06)` (or `rgba(0,0,0,0.04)` in light)
- Left border accent 2px solid brand
- No transform (unlike hover, which lifts 1-2px)

### Loading
Raycast shows a **shimmer at the top 1px of the results area** during load. No spinner. No skeleton. Just a thin moving gradient. Subtle, non-alarming.

### Microcopy
Command-line influenced but never jargony. "Quit" not "Log out". "Find" not "Search". "Clip" not "Copy to clipboard".

### What to borrow
- 1px top-edge shimmer for fetching states (much less anxious than spinners)
- Keyboard-equivalent hover states
- Three-token transition scale (100/150/200ms)

---

## 4. Arc (The Browser Company)

### Shadow layering
Arc uses **stacked sheet** shadows for its command bar and sidebar:
```
0 0 0 1px rgba(0,0,0,0.04),
0 2px 4px rgba(0,0,0,0.04),
0 12px 32px rgba(0,0,0,0.12)
```
This creates a "card floating above card" feel. Our `--shadow-md` and `--shadow-lg` already approximate this.

### Translucency
Arc's sidebar is `background: rgba(251, 248, 243, 0.72)` (warm cream) with `backdrop-filter: saturate(180%) blur(24px)`. **LanaeHealth's nav-glass already does this at blur(20px), saturate(180%). Nearly identical.**

### Card animation
On click, an Arc space card does a subtle:
1. `scale: 0.98` for 80ms (press down)
2. `scale: 1` with spring back 180ms
Total interaction feels physical without being gimmicky.

### Color restraint
Arc uses **exactly three accent colors** on screen at once: the active space color, a neutral, and a semantic (usually success green). They treat color as a scarce resource.

### What to borrow
- Press-down scale (0.98 → 1) on cards (`tap-feedback` keyframe in our CSS already does this at scale 0.95; consider softening to 0.97)
- Scarce-color rule: never more than 3 accents in a single viewport

---

## 5. Oura Ring

### Health UX (most relevant to Lanae)
Oura is a study in **not shaming low scores**. Their choices:

**Low-recovery day (score < 60):**
- Background stays cream-white, never red
- Header: "Pay Attention" (neutral, not "Bad Day")
- Body: "Your body is asking for rest. Consider a lower-intensity day."
- Zero emoji, zero alarm icons
- Recommendations section slides up with gentle actions (hydrate, stretch, rest)

**High-recovery day:**
- Subtle green ring, slightly brighter background tint (not overwhelming)
- "Optimal" or "Good" without exclamation
- No celebration animation. Score just appears.

### Progressive disclosure
Oura's home screen shows ONE number prominently (today's score). Tapping reveals sub-scores. Tapping again reveals trends. Tapping again reveals raw data. **Four levels of depth, only one visible at a time.**

### Color for data
They use:
- Green (#7DD3A7) for "optimal"
- Yellow-gold (#F4C430) for "pay attention"  
- No red. Ever. Lowest state is orange (#E89C5A) labeled "Pay attention"

### Typography for numbers
Big numbers use **variable font weight interpolation** — subtle and typographically special. On an 82 score, "82" is rendered at 72px weight 300. Contrast with body at 15px weight 500.

### What to borrow
- **No red for low data.** Our `--pain-severe: #EF4444` is red. For CHART backgrounds on pain, use it sparingly. Never as a page background.
- Language: "Pay attention" not "Warning"
- One prominent number per screen, progressive disclosure on tap
- Gentle color mapping (green/yellow/orange, no red for chronic symptoms)

---

## 6. Strava

### Celebration tone
Strava celebrates effort, not just results. Small runs get **"Nice work."** Long ones get **"You crushed it."** Personal records get **"🏆 New PR"** with confetti.

**For LanaeHealth, we want "Nice work" energy, not "You crushed it."** Lanae is not trying to beat yesterday. She's trying to get through today.

### Color language
Strava's signature orange #FC4C02 is reserved for ONE thing per screen: the primary call-to-action. Everything else is grayscale. **This is the discipline we need to apply to sage.**

### Motion on save
When you save an activity, the flow is:
1. Button fills left-to-right with accent (300ms, ease-out)
2. Checkmark fades in inside the button (100ms)
3. Page transitions after 400ms total
No modal. No toast. No "Success!" text. The button itself tells the story.

### What to borrow
- Fill-on-save button animation (we have progress-fill keyframe; repurpose)
- Reserve sage for ONE primary action per screen
- Effort-based microcopy: "Logged" not "Saved successfully!"

---

## 7. Notion Calendar (formerly Cron)

### Density management
Notion Calendar crams dense info without feeling busy. Techniques:
- Event blocks use **weight 500** at 12px (instead of heavier weight 600)
- Colors use `rgba(brand, 0.12)` as background, full brand as left-border accent
- Hover reveals details via a side panel, not a modal (less disruptive)

### Time markers
The current time line is **1px solid red-orange (#F76D3C) with a 4x4 circle on the left edge.** Subtle but present. The red doesn't alarm because it's only 1px.

### Typography
They use numerical tabular figures everywhere. `font-variant-numeric: tabular-nums`. This keeps times aligned. **Add this globally for LanaeHealth data views.**

### Keyboard shortcuts
Notion Calendar teaches shortcuts through a translucent cheat sheet accessible via `?`. Shows 8-10 shortcuts, never more. Fades away on any keypress.

### What to borrow
- `font-variant-numeric: tabular-nums` globally for any data screen
- 1px timeline markers (for /timeline route)
- Keyboard cheat sheet on `?` (low-priority, but delightful)

---

## 8. Airbnb

### Warmth
Airbnb's entire design hinges on **warmth without being cloying**. Key choices:
- Photography is always people or places, never products
- Copy speaks in second person: "Your next stay" not "Upcoming trips"
- Rounded everything (12-16px radius), no sharp corners

### Micro-typography
- Body copy 16px (not 15) for reading comfort
- Headings 22px (not 24) — slightly smaller than expected, warmer feeling
- Line-height 1.45 across the board (tighter than our 1.5 default)

### Empty states with illustrations
When a list is empty, Airbnb shows a small line-illustration (60x60) with 1px stroke. The illustrations are **never celebratory or sad**. They're neutral scenes: a suitcase, a bed, a map pin. It's just presence.

### Skeleton loading
Airbnb's skeletons are the shape and position of the content that will load. Every width is realistic (not uniform rectangles). The pulse is **slow: 1.5s cycle, opacity 0.4 → 0.7 → 0.4**. Never a shimmer gradient.

### What to borrow
- "Your" language in UI ("Your labs", "Your timeline")
- Slow-pulse skeletons with realistic shapes (we have `skeleton-pulse` at 2s; shorten to 1.5s)
- 60x60 line illustrations for empty states (I'll use lucide's minimal-stroke icons at 48-64px with 30% opacity and sage tint)

---

## Synthesis: LanaeHealth's delight vocabulary

After studying the eight apps, here are the **12 patterns we're committing to** for this pass:

### 1. Motion tokens (add to globals.css)
```css
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-ios: cubic-bezier(0.32, 0.72, 0, 1);

--duration-instant: 100ms;
--duration-fast: 150ms;
--duration-base: 200ms;
--duration-slow: 300ms;
```

### 2. Spacing tokens (expose Tailwind 4-pt grid as CSS vars)
```css
--space-1: 4px;  --space-2: 8px;
--space-3: 12px; --space-4: 16px;
--space-6: 24px; --space-8: 32px;
--space-12: 48px; --space-16: 64px;
```

### 3. Loading language
- Replace every spinner with one of:
  - **Shimmer bar** (1px, top of container, gradient moves left-to-right over 1.5s) for inline loads
  - **Slow-pulse skeleton** (1.5s cycle, 0.4 ↔ 0.7 opacity) for block content
  - **Fill-on-save button** (accent fills left-to-right 300ms) for form submits

### 4. Empty-state voice
- Template: **"[State as accomplishment OR suggestion]. [Next action]."**
- Examples:
  - "Nothing logged today. Tap the green button to start."
  - "All caught up on labs. New ones appear here."
  - "Your timeline is waiting for its first event."
- Never use "No data" or "Empty."

### 5. Microcopy rules
- "Saving" not "Saving..."
- "Something broke on my end. Try again?" not "Error: Request failed"
- "One moment, pulling your data" not "Loading..."
- "Logged" not "Saved successfully!"
- "Your" for possession ("Your labs", "Your chart")
- Never exclamation points except for celebrations

### 6. Celebration tone
- Silent scale-pop checkmarks (180ms, 0 → 1.1 → 1) for logged actions
- No confetti, no sound, no modals for routine saves
- Reserve stronger feedback for **milestones**: first log of the day, streak continuation (7 days, 30 days)

### 7. Color discipline (Scarce Accent Rule)
- **Sage**: primary action ONE per screen (primary button, active nav)
- **Blush**: accent for cycle/phase/feeling nuance only
- **Pain colors**: only inside the pain chart/heatmap context, never as a page background
- Everything else: grayscale on cream

### 8. Shadow rule (two resting, one elevated)
- `--shadow-sm` for cards at rest (already defined, keep)
- `--shadow-md` for hover/active cards
- `--shadow-lg` for modals/overlays/command palette
- No "medium" shadow in default state. It reads as noisy.

### 9. Tabular numerics
Add `font-variant-numeric: tabular-nums` to all data views (labs, logs, metrics).

### 10. Progressive disclosure (Oura principle)
- Each route should answer **one prominent question** above the fold
- Supporting info is tap/scroll reveal
- Raw data is 3 taps deep, never the first thing Lanae sees

### 11. Chronic-illness-aware language
- Never "Bad day" / "You didn't log" / "Missed your goal"
- Instead: "Quiet day", "Come back when ready", "No goals here, just noticing"
- Progress is acknowledged, not demanded

### 12. Command-K global search
- Add a floating keyboard shortcut `cmd+K` (mobile: long-press logo) that opens a translucent search
- Searches across labs, symptoms, notes, imaging studies
- Keyboard-first but mobile-tappable

---

## Next step
Apply this vocabulary in Phase 2 on `/` (home) and `/log`, establish consistency, then sweep the other 10 routes.
