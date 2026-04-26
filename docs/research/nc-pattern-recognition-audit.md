# Natural Cycles Pattern Recognition Feature Inventory

Source: 319 PNG frames at `/Users/clancybond/lanaehealth/.claude/worktrees/sweet-rosalind-cea925/docs/reference/natural-cycles/frames/full-tour/`

User account context shown: "Lanae Nich..." (4-star Skilled Cycler), 47 cycles tracked, NC Birth Control mode (the FDA-cleared contraception variant of NC).

This audit catalogues only what is literally visible in the frames. Where uncertainty exists, it is labelled.

---

## SECTION 1: Today Screen

The "Today" tab is the primary landing screen. Across frames it cycles through several visual states, all sharing the same skeleton: header (hamburger menu, NC Birth Control title, line-graph icon), large central status ring, weekday strip, content cards, bottom tab bar (Today / Calendar / + / Messages / Learn).

### Loading state
- Frame: `frame_0005.png`, `frame_0006.png` - Heavy purple wash overlay with white "Natural Cycles" wordmark, plus "CE 0123 Cleared by FDA" regulatory badge as a splash element. The today ring is partially drawn (a 3/4 incomplete circle in deep purple) over the placeholder text "Today / Sun, Apr 19, Cycle Day 25 / One second... / 97.59 degrees F".

### Loaded - "Not fertile" (Green Day)
- Frame: `frame_0007.png`, `frame_0010.png`, `frame_0012.png`, `frame_0018.png`, `frame_0110.png`, `frame_0145.png`, `frame_0317.png`
- Central ring: large green-gradient sphere, dotted outer ring, solid inner crescent. The visual treatment is a glowing green orb with dotted outline, not a flat ring.
- Inside ring: "Today" / "Sun, Apr 19, Cycle Day 25" / "Not fertile" (large bold) / "97.59 degrees F" pill.
- Below ring: weekday strip showing Thu 16 (filled green check), Fri 17 (filled green check), Sat 18 (filled green check), Sun 19 (highlighted current with dotted ring), Mon 20, Tue 21, Wed 22 (open green outlines for predicted future Green Days). Days with logged data carry a small check mark.

### Loaded - Luteal Phase content card
- Frame: `frame_0010.png`, `frame_0006.png`, `frame_0108.png`
- Card titled "Progesterone power" with copy: "Progesterone is at its peak, which can promote feelings of calmness and relaxation. You might notice some changes in your appetite or sleep patterns. Focus on self-care and stress management."
- Right side has a mini hormone arc chart with the dot positioned in the luteal phase.
- Pill button: "Full graph >".

### Cycle phase card
- Frame: `frame_0010.png` (right column visible)
- Heading "CYCLE PHASE / Luteal" with a small donut indicator (purple curve, blue arc, small mark). Beneath: "Exercise" line item with small icon and copy "As your cycle winds down, you might prefer more moderate activities like cycling or swimming." Then "Nutrition" item: "Support your body with fiber-rich foods, hydration, and electrolytes, especially if you experience PMS symptoms."

### Most common symptoms and moods (chip rail)
- Frame: `frame_0007.png`, `frame_0015.png`, `frame_0018.png`, `frame_0057.png`
- Section title "Most common symptoms and moods"; word "common" in blue-link color.
- Pill chips with leading icons: Low Sex Drive, Tired (Z icon), PMS (small chip), Calm (smile), Sore Breasts, Cramps, Headache.
- Helper line: "Tap the '+' to log your mood, symptoms, and other changes to see your patterns over time."
- CTA pill button: "Symptoms trends >".

### Phase explainer link
- Frame: `frame_0015.png`, `frame_0093.png`
- Row "What is the luteal phase? >" with chevron. Tapping opens the educational sheet (see Section 5).
- Below: a large solid purple CTA "See Cycle Insights >".
- Below that: row "History >" with clock-rewind icon.

### Today tab onboarding tutorial overlay (1/7 in tutorial flow)
- Frame: `frame_0255.png`
- Two purple coachmark callouts:
  - "Remember to use protection or abstain on a Red Day." pointing at the central ring.
  - "The algorithm uses your temperature to calculate your fertility status for the day." pointing below the temperature pill.
- Bottom-right "Next >" button, "X 1/7" progress chip lower-left.

---

## SECTION 2: Calendar / History

The Calendar tab is a vertically scrolling, multi-month view with a fixed weekday header row.

### Standard month view (with predictions and history)
- Frame: `frame_0150.png`, `frame_0155.png`, `frame_0158.png`, `frame_0163.png`, `frame_0166.png`
- Each cell is a circle keyed by cycle day number (large) with the calendar date number small above it.
- Cell visual language:
  - Solid red/pink filled circle = Period day (red bar runs across consecutive period days connecting them like beads). Frame 150 shows red beads on May 1-9.
  - Solid green filled circle = Green / non-fertile day (with white check mark).
  - Open green outlined circle = predicted future Green Day.
  - Open red/pink outlined circle linked by a thin pink line = predicted future period.
  - Dotted green outline = today / predicted ovulation (Frame 150 May 6 shows dotted ring; Frame 158 April 19 shows dotted Green ring on today's cell).
  - Small black raindrop / teardrop icons in a column under cells indicate logged bleeding (period flow) - a single drop, two drops, three drops, or four drops sit beneath the cell.
  - Black scissors icon under cells (Frame 150 May 3-5) appears to indicate something logged (uncertain - possibly a "do" event or a different symptom).
  - Small black "egg/dot" icon on a single cell each cycle indicates ovulation day.
- Period bars: red horizontal bars cross the connected period cells (e.g. Frame 165 March 1-7 and 8-12 show period bars).

### Past months scrolled deep
- Frame: `frame_0148.png` shows June 2022 - totally empty cells (no cycle data for that month, just plain calendar dates) signalling there was no logged data that far back.
- Frame: `frame_0190.png` (December 2025) and Frame `frame_0193.png` (January 2026) show fully populated cycles with periods running mid-month each cycle.
- Frame: `frame_0163.png` shows the full April 2026 view with a clear "Period (red beads days 1-4 and 5-9), then Green Days 10-18, then dotted Green outlines 19-25 (predicted), then black drops on days 23-26 (predicted bleeding warning)". This is the most representative single-month layout.

### Side-scroll handle
- Frame: `frame_0163.png`, `frame_0190.png` - small floating purple chevron-down button overlaid on calendar lower-right to scroll forward.

### History list (separate screen reachable from Today)
- Frame: `frame_0080.png`, `frame_0085.png`, `frame_0090.png`, `frame_0095.png`, `frame_0098.png`, `frame_0103.png`
- Header: back arrow + "History" centered.
- Vertically scrolling list of cycle days each labelled: large circle (numbered 1, 2, 3...) on the left; "Cycle Day N" plus subline; right-side temperature pill (e.g. "97.59 degrees F >").
- Circle treatment matches calendar: red = period day, green = Green Day, dotted ring = today, with black drop icons under period days.
- A vertical red/pink connector line runs through the period cell circles (visible Frame 80 days 1-9 with red line; Frame 95 days 12-15 also showing red bar through period cells).
- Section header "Cycle start" appears between cycles to demarcate cycle boundaries (Frame 90).
- Some temperature cells show "-.-°F" indicating no measurement that day (Frame 95 days 17, 20).
- Floating purple chevron-down for fast-scroll (Frame 90, 95, 100).

### Cycle Insights chart (rotated to landscape, full chart)
- Frame: `frame_0060.png`, `frame_0065.png`, `frame_0117.png`, `frame_0123.png`, `frame_0125.png`, `frame_0128.png`, `frame_0130.png`
- Phone is shown rotated landscape with "Natural Cycles" wordmark vertical on right edge.
- Plot is BBT line chart over cycle days (X axis, ranging 1 through 27 for one cycle, or stretches across multiple cycles when zoomed out). Y axis: temperature in degrees F (95.6, 96.1, 96.6, 97.1, 97.6, 98.1, 98.6) plotted on left vertical.
- Background phase bands:
  - Purple-shaded band labelled "Period" with two black drop icons = menstrual phase.
  - Light pink/red band labelled "Fertile" = fertile window.
  - A horizontal pink ribbon partway through the fertile band labelled "Ovulation" with a small black egg/dot marker = the algorithm's confirmed ovulation day.
  - Outside these bands = non-fertile (white background).
- Line color encodes fertility status:
  - Green points/segments = Green Day temperatures.
  - Red points/segments = fertile-day temperatures.
  - The line is continuous; color switches at the fertile boundary.
- Open dot at the right end = today's reading; tiny dotted floret to the right = predictions / extrapolation.
- Cycle header above chart: "Cycle 48 / March 26, 2026 - April 22, 2026" (one cycle visible in Frame 117). Frames 123, 125, 128, 130 show the chart zoomed out across multiple cycles 46-49 with phase bands repeating.
- Left edge: "Previous" with "<" - pagination to prior cycle. Right edge: "Next" with chevron.
- Floating left-side toolbar (small icons stacked): a compose/sketch icon, a 3-line list icon, and a 6-dot icon (uncertain - possibly "comparison view" toggles).
- Lower-left: zoom toggles "1" pill and "+" pill (uncertain - temperature scale toggle vs day-zoom).
- "A" red badge appears near the top of the right column in some frames indicating an annotation or alert (Frame 123, 128).
- Frame 60 (highly zoomed cluster of 3 cycles): cycles labelled 48, 47, 46 stacked horizontally showing the BBT pattern with the fertile band repeating each cycle. Comparison view.

### Cycle Insights summary panel (vertical, overlayed on calendar)
- Frame: `frame_0263.png`
- Sheet title "Cycle Insights" with back arrow.
- Subhead "47 cycles tracked".
- Section "Statistics" with stat cards:
  - "Cycle length / 27 plus/minus 1 days" with small partial-circle icon.
  - "Period length / 4 days" with drop icon.
  - "Ovulation / Cycle Day 14 plus/minus 2" with partial-circle icon (truncated in frame).
  - "Follicular phase / 13 plus/minus 2 days" with partial-circle icon.
  - "Luteal phase / 15 plus/minus 2 days" (truncated).
- Below: "My added data >" row.
- Below: "History" row (with "See" button - truncated).

### Statistics deep-link (My luteal phase / temperature panel)
- Frame: `frame_0040.png`, `frame_0045.png`, `frame_0050.png`
- Inside the Luteal Phase educational sheet (see Section 5), an embedded stats block:
  - "My luteal phase length / 15 plus/minus 2 days" then "The average luteal phase length for all cyclers is 12 plus/minus 2 days." (comparison to population average - note the Cycler's L-phase is longer than average.)
  - "My average luteal phase temperature / 97.30 degrees F".
  - "My temperature variation / +/- 0.41 degrees F" with a half-donut purple gauge with arrow and "Stable" verbal label.
- Color coding: words "length", "average", "variation" rendered as blue links (tappable definitions or detail).

---

## SECTION 3: Period Log Flow

NC's Today screen has a central purple "+" FAB that opens a modal-style log sheet. The sheet header shows date + cycle day; body has stacked categorized chip groups.

### Log sheet - top section
- Frame: `frame_0042.png` partial, `frame_0295.png`, `frame_0300.png`, `frame_0313.png`, `frame_0317.png`
- Header: chevron-left / chevron-right (date pager) + "Today, CD 25" + X close.
- Hero readout: "97.59 degrees F" big numeral + "Updated 12:29 PM" subline (the BBT pulled from connected device).
- Two pill toggles below temp: "Sick" (with pill icon) and "Hungover" (with cup icon) - single-tap status flags for the day.
- Section "Bleeding" with chips: "Period", "Spotting".
- Section "Vaginal sex" with chips: "Protected", "Unprotected", "None".
- Section "Ovulation test" with chips "Positive", "Negative", and a camera icon button (camera = scan a test strip).
- Below section header is a circular pill with a chevron-up/down - collapse/expand control to hide the rest of the sheet.

### Log sheet - bottom section (expanded)
- Frame: `frame_0303.png`, `frame_0305.png`
- Section "Cervical mucus" with chips "Amount", "Consistency" (these are likely chip-stack picker entry points, not direct values).
- Section "Sex drive" with chips "Low", "Medium", "High".
- Section "Skin" with chips "Dry", "Oily", "Puffy", "Acne", "Glowing", "Other".
- Section "Pain & symptoms" with chips: "Cramps", "Backache", "Sore Breasts", "Ovulation Pain", "Headache", "Migraine", "Nausea", "Diarrhea", "Constipation", "Bloating", "Cravings", "Other".
- Section "I'm feeling..." (mood grid):
  - 5 columns x 5+ rows of yellow-circle emoji icons with labels:
    - Row 1: Happy, Confident, Calm, Energetic, Excited.
    - Row 2: PMS (this one is rendered as a small pink-text chip rather than emoji), Mood Swings, Irritable, Anxious, Stressed.
    - Row 3: Tired, Sensitive, Numb, Sad, Angry.
    - Row 4: Unfocused, Self critical, Guilty, Obsessive thoughts, Confused.
    - Row 5 (centered): Isolated, Withdrawn, Sociable.
- Below mood grid: "Notes" header + "How are you feeling today?" placeholder text input.
- Two rows below: "Emergency Contraception & Tests" full-width row, then "Manage trackers settings" row with gear icon - these are link-out rows to deeper subscreens.
- Sticky footer when scrolled: chevron-up to collapse + "Save" pill.

### Log sheet onboarding tutorial overlay (6/7 and 7/7 of tutorial)
- Frame: `frame_0290.png`, `frame_0293.png`, `frame_0298.png`, `frame_0300.png`
- Coachmarks teach the user:
  - "Wake up and sync your Oura Ring here" (pointing at the temperature region) - confirms Oura Ring integration as the BBT source.
  - "Select the flow of your bleeding here" (pointing at Period/Spotting).
  - "Give the algorithm a helping hand to pinpoint ovulation by logging ovulation test results." (pointing at Positive/Negative).
  - "Scroll down to log cramps and other cycle-related pain or symptoms." (pointing at Pain & symptoms).
- Step 7/7 final coachmark not captured directly but the sheet exits with "Done >" pill (Frame 305).

---

## SECTION 4: Pattern Recognition Outputs

This section consolidates everything the NC algorithm surfaces as a derived insight.

### 4.1 Daily fertility status (the central ring)
- Three core states observed:
  - "Not fertile" - green-glow ring.
  - "Use protection" / Red Day - implied by tutorial coachmark wording "Remember to use protection or abstain on a Red Day." (Red ring not directly visible in this Cycler's current state, but red is the established Red Day color used in the calendar.)
  - Loading "One second..." while algorithm computes.
- Status is computed from temperature + cycle day + algorithm.

### 4.2 Predicted vs confirmed ovulation
- Predicted ovulation: dotted green outline on the calendar cell (Frame 158 day 19 of April).
- Confirmed ovulation: filled dot/egg marker (frames show black dot icon under specific calendar cell - e.g. April 8 in Frame 165, March 9 in Frame 165). On the BBT chart, ovulation is drawn as a horizontal pink ribbon labelled "Ovulation" with a black egg marker.
- Push to confirm: "Time to take an ovulation test" message card (Frame 240, 245) - proactive prompt: "Looks like your ovulation day is approaching! Today is a great day for an ovulation test... These test strips look for a rise in the luteinizing hormone (LH), which suggests that ovulation is likely to happen. Taking an ovulation test helps the app learn your fertile window even better, giving more precision for plan users and more Green Days to prevent users. Win-win!"

### 4.3 Fertile window
- Visually drawn on the BBT chart as a pink/red shaded band labelled "Fertile".
- On the calendar, fertile days are NOT explicitly bracketed with a band; they are signalled per-cell via Red filled circles (when in the past with confirmed data) or red outlined circles linked with thin pink lines (predicted).
- The fertile window notably extends a few days before predicted ovulation (the band visible in Frame 117 spans roughly days 6-14 with ovulation at ~day 14-15).

### 4.4 Period prediction
- Future periods rendered as open red outlined circles connected by thin pink line on the calendar (Frame 158 May 1-2 visible; Frame 153 May 6-9 are outlined-with-pink-link; Frame 163 April 29-30 transition into outlined predictions).
- Bleeding warning: predicted period days carry small black drop icons in a column beneath the cell (Frame 158 days 23-26 show drops below outlined cells).
- Proactive message: "Your period is coming soon" (Frame 211, 270): "Your period is due in a few days. Make sure you have everything YOU need at hand: period products, pain relief... snacks." with link to CycleMatters blog.

### 4.5 BBT cover-line / temperature shift
- The BBT chart shows a clear thermal shift visually (Frame 117): temperatures dip to ~96.1-96.5 degrees F in the follicular phase, rise to ~97.0-97.6 degrees F after ovulation. NC does not draw an explicit horizontal "cover line" graphic; instead it color-codes the line itself (green vs red segments) to indicate which side of the algorithm's threshold each reading is on.
- Confirmation appears on a per-cycle basis once enough post-ovulation high temperatures are recorded.

### 4.6 Temperature variation summary
- "My temperature variation / +/- 0.41 degrees F / Stable" (Frame 40, 45, 50).
- Visualized as a half-donut gauge with an arrow pointer, plus a single-word verdict ("Stable").

### 4.7 Cycle statistics rollup
- Per-Cycler statistics with population comparisons (Frame 263):
  - Cycle length, Period length, Ovulation day, Follicular phase length, Luteal phase length - each with a +/- variance.
  - "47 cycles tracked" headline establishes data depth.
- Luteal phase comparison vs population (Frame 40, 45): "The average luteal phase length for all cyclers is 12 plus/minus 2 days" alongside this user's "15 plus/minus 2 days".

### 4.8 Cycle history visualizations (multi-cycle BBT comparison)
- Multi-cycle landscape view (Frame 60, 65, 123, 125, 128, 130) - multiple cycles laid out side-by-side or stacked so the user can visually compare cycle shape, length, and BBT pattern.

### 4.9 Anomaly / annotation flags
- Red letter "A" badge floating on top-right of certain BBT cycle columns (Frame 123, 128) - uncertain. Most likely a flag for "Anomalous cycle" or "Annotation present" (uncertain - not explicitly explained in any frame I read).

### 4.10 Smart logging prompts (proactive messages in inbox)
- "Time to take an ovulation test" (Frame 240, 245) - fired in fertile window run-up.
- "Your period is coming soon" (Frame 211, 270) - fired luteal-phase late.
- "Cervical Mucus during the luteal phase" educational message (Frame 213, 270) - themed to current phase.
- "Tobacco and fertility" research/study invitation (Frame 220, 223, 235, 238) - opt-in research participation.

---

## SECTION 5: Educational / Explainer Content

Three layers of learning content visible:

### 5.1 Inline phase explainer (full-screen sheet, modal)
- Frame: `frame_0018.png`, `frame_0020.png`, `frame_0022.png`, `frame_0025.png`, `frame_0030.png`
- Triggered by tapping "What is the luteal phase? >" on the Today screen.
- Sheet title: "Luteal phase" with X close.
- Hero illustration: a small hormone-curve chart (purple Estrogen curve, blue LH curve, pink Progesterone curve) with a small egg dot marker indicating the ovulation moment in the cycle. Color legend: "Estrogen / LH (Luteinizing hormone) / Progesterone".
- Body copy with rich structure:
  - Lead paragraph defining the phase.
  - "What's happening with hormones?" subhead with 1-paragraph plain-language explanation.
  - "How to make the most of this phase:" subhead with a bulleted list of behavior tips (exercise, complex carbs, bedtime routine).
  - "Luteal phase & the NC degree algorithm" subhead explaining how the algorithm uses this phase to predict period onset.
  - Statistics panel embedded at bottom (see Section 4.7).

### 5.2 Today-screen content cards (mini explainers)
- "Progesterone power" cycle-phase-aware tip card (Frame 10, 108) with body copy and "Full graph >" CTA.
- "Cycle phase / Luteal" donut + Exercise/Nutrition tip block (Frame 10) - same content, structured differently.

### 5.3 Learn tab (full library)
- Frame: `frame_0250.png`, `frame_0270.png`, `frame_0280.png`, `frame_0285.png`, `frame_0288.png`
- Header still uses "NC degree Birth Control" title bar.
- Sections in order:
  - "Spotlight" - featured article with hero image (Frame 270, 273: "Can you get pregnant from pre-cum? / Apr 3, 2026 / 8 min read" + Read button).
  - "Guides" - horizontal scroll of card-format topical guides with circular illustrated icons. Visible cards: "Menstrual cycle", "Late periods", "App tour", "Ovulation tests", "Cervical Mucus", "Breast check", "OURA and NC degree", "Effectiveness", "Ovulation". (Frames 250, 273, 248, 255.)
  - "Quizzes" - three illustrated cards: "LH" (with eyedropper test stick + lightbulb illustration), "Period" (drops illustration), "Cycle" (partial-ring illustration).
  - "Definitions" - horizontal row of icon tiles: thermometer, ring, dot, drop, plus more (uncertain; partial visibility).
  - "Research library" - featured cards like "Comparing pregnancy risk in period-tracking methods and regulated digital..." (Frame 285) with magnifying-glass-on-calendar illustration; "Global study continues int..." with woman illustration.
  - "On the blog / Birth Control" - blog post cards: "Signs that Plan B didn't work: Why it happens & what to do / Aug 22, 2025 / 11 min read"; "Post-birth co... & how to mana..." (Frame 288).
  - "Cycler Stories" section truncated at bottom of Frame 288.
- Floating info "i" button right-aligned just above tab bar (Frame 250).

### 5.4 Tutorial overlay coachmarks (7-step in-app tour)
- Frames: `frame_0255.png` (1/7), `frame_0258.png` (2/7), `frame_0263.png` (3/7), `frame_0270.png` (4/7), `frame_0275.png` (5/7), `frame_0290.png` (6/7), `frame_0313.png` (7/7).
- Format: full-screen scrim (light dimming) with stacked purple coachmark balloons each pointing to one UI element. Bottom-right "Next >" pill, lower-left "X N/7" progress chip.
- Tutorial walks through:
  - Step 1: Today ring & temperature.
  - Step 2: Calendar - "Check out your temperatures and compare cycles with the graph." + "Click on calendar days to see more info and day-by-day data." + "View your Cycle Days on the calendar, located above each date." + "Your predictions will give you an idea of what your future holds, but remember that they can change!"
  - Step 3: Cycle Insights panel.
  - Step 4: Messages inbox.
  - Step 5: Learn tab - "Read our guides to learn all about measuring and the algorithm." + "Stay up to date on all the latest blog posts in the Learn tab."
  - Step 6: Log + button - categories of logging.
  - Step 7: final tip.

---

## SECTION 6: Settings + Side Menu + Account

### Side menu (slide-in from left, opens via hamburger top-left)
- Frame: `frame_0140.png`, `frame_0142.png`, `frame_0207.png`
- Triggered by hamburger icon on Today/Calendar/Learn screens.
- Header: user avatar/name area at top with star rating: "Lanae [Nich.]" + "4-star Skilled Cycler" (rank-style label).
- Menu rows (each with > chevron):
  - "My account >"
  - "Settings >"
  - "My device >"
  - "Buy extra supplies >"
  - "Help center >"
  - "Get free months" (with gift icon)
- Footer (purple panel bottom): "Terms of Service / Privacy Policy / Regulatory / Natural Cycles Version 7.2" plus social icons (Instagram, Facebook, X/Twitter).

### My account screen (right of side menu)
- Frame: `frame_0140.png`
- Title "My account" with back arrow.
- Rows: Name (Lanae Nich...), Email (x44drdn5bh@privaterelay) - Apple private relay; Apple Login (with "Cor..." status); Password.
- Section divider, then: "Manage subscription >", "Restore iTunes subscription >".
- Section divider, then: "Log out from other devices", "Log out from this device", "Delete account".

### Settings screen
- Not directly visible as a dedicated frame (the Settings row is in the side menu but not opened in the captured frames).

---

## SECTION 7: NC Visual Language Catalog

### Color palette (sampled from frames)
- Brand purple / plum: `#5C1A4B`-ish - used for FAB ("+"), primary CTAs ("See Cycle Insights", "Read", "Save", "Save answer", "Read guide"), tab-active state on Today, and side-menu chrome.
- Fertility green: vivid mint/emerald gradient - used for "Not fertile" Today ring (radial green-glow from center fading out), Green Day calendar fills, and check marks. Roughly `#37C667` solid for filled cells, with the ring showing a brighter `#7CE0A0`-ish gradient.
- Period red/pink: bright coral pink - used for filled period-day circles, the period bar across consecutive days, the fertile region in BBT chart, and the predicted-period outlined circles. Roughly `#F0566B` to `#FF5B7B`.
- Period band purple: deeper plum used as background band in BBT chart. Roughly `#C9B0CF` (semi-transparent purple).
- Background cream/blush: very pale pink/lavender used for app background. Roughly `#F7EFEF` or `#FAF1F1`.
- Card surface white: `#FFFFFF` for content cards.
- Text dark: near-black with a slight purple cast.
- Hyperlink blue: words like "common", "length", "average", "variation" rendered as small blue link text within paragraphs. Roughly `#3F66E0`.

### Typography
- Display numerals (temperature, "Not fertile") are a heavy / bold sans-serif - likely a custom NC face or a heavy Inter/SF Pro variant.
- Body copy is a humanist sans-serif at ~16pt with comfortable line-height.
- Section labels ("CYCLE PHASE", "Cycle start") are smaller, slightly tracked uppercase.
- "Natural Cycles" wordmark is a bespoke italic/oblique serif-leaning custom mark with the trademark degree symbol ° superscript appended.

### Iconography
- Most line icons are simple line-art at ~1.5px stroke (calendar, message-bubble, lightbulb, drop, pill, cup).
- Tab bar icons are filled-when-active line icons (Today = sunrise/bell hybrid, Calendar = calendar grid, Messages = chat bubble with red badge for unread count, Learn = NC ring monogram).
- Symptom chip leading icons are small monochrome pictograms with a slight grey-pink fill background bubble.
- Mood-grid emoji are saturated-yellow round emoji with simple expression marks.
- Drop icons (period flow indicators) are matte black silhouettes.
- "Egg" / ovulation marker is a small black dot, often inside a tiny circle.

### Spacing & shape
- Generous vertical spacing (~16-24px) between sections.
- Cards use ~16-20px corner radius.
- Pills/chips use full-pill (capsule) radius.
- The central Today ring is approximately 80% of viewport width with substantial padding above and below.
- Calendar cells are tightly packed with ~8px gap and circles roughly 36-40px diameter.

### Motion / transitions inferred
- Today ring loads with a partial-arc-to-full-ring fade-in (Frame 5, 6 vs Frame 7).
- Side menu slides from left with right-side scrim/dim (Frame 140, 207).
- Modals (log sheet, phase explainer) appear as bottom-sheet slide-ups with optional drag-down to dismiss.
- Tutorial overlay fades scrim in and individual coachmarks pop in.
- Calendar and BBT chart support landscape rotation (the BBT chart is fully optimized for landscape).

### Interaction patterns
- Long-list scroll uses native momentum.
- Calendar months stack vertically and the user can swipe up to load more past months.
- "v" floating action button on calendar/history for fast-jump scroll.
- Tutorial uses Next/Back paging with "X N/7" close + counter.

---

## SECTION 8: PATTERN RECOGNITION FEATURES MATRIX

| # | Feature | Representative frame(s) | Description | Currently in v2? |
|---|---|---|---|---|
| 1 | Today fertility status ring (loading → loaded states) | 5, 6, 7, 110 | Large central glowing ring; color = fertility status; loading state pulses partial arc; current temperature pill inside | TBD |
| 2 | Three explicit fertility states (Not fertile / Red Day / Computing) | 7, 255 (red day mention) | Verbal status text dominates the ring. Red Day for fertile, Green for safe, "One second…" for computing | TBD |
| 3 | Live BBT readout with last-sync time | 295, 300 | Temperature in degrees F + "Updated 12:29 PM" subline | TBD |
| 4 | Oura Ring BBT integration | 295 (coachmark "Wake up and sync your Oura Ring here") | Hardware sync surface | TBD |
| 5 | Weekday strip with cycle-status circles | 7, 110, 145 | 7-day rail showing past Green Days + today (dotted) + predicted future days | TBD |
| 6 | Today phase tip card (e.g. "Progesterone power") | 10, 108 | Phase-aware contextual copy + mini hormone graph snippet + "Full graph" CTA | TBD |
| 7 | Today phase chip ("CYCLE PHASE / Luteal") with donut indicator | 10 | Static label + small phase-position donut + tip rows | TBD |
| 8 | "Most common symptoms and moods" personalized chip rail | 7, 15, 18, 57 | Cycler-specific top-symptoms inferred from history; chip-style with leading icons | TBD |
| 9 | "Symptoms trends" CTA | 15 | Pill button leading to historical pattern view | TBD |
| 10 | Phase explainer link "What is the luteal phase? >" | 15, 93 | Triggers full-screen educational sheet | TBD |
| 11 | "See Cycle Insights" primary CTA on Today | 15 | Solid purple full-width button driving to insights panel | TBD |
| 12 | History row link from Today | 15 | Drives to per-cycle-day list view | TBD |
| 13 | Multi-month calendar with cycle-day-numbered cells | 150, 155, 158, 163 | Each cell shows cycle-day number prominent, calendar date small; circles colored by status | TBD |
| 14 | Calendar cell visual taxonomy (filled red/green, outlined predictions, dotted today, drops, ovulation egg) | 150, 158, 163, 165, 263 | Distinct visual languages for each state; period bar bridges consecutive period cells | TBD |
| 15 | Calendar bleeding-amount drop icons (1-4 drops) | 150, 158, 163 | Sub-cell flow visualization | TBD |
| 16 | Ovulation egg marker on a single calendar cell per cycle | 150, 158, 165, 195 | Black dot/egg icon underneath the ovulation day cell | TBD |
| 17 | Predicted future periods (outlined circles connected by pink line) | 150, 153, 158 | Visual difference between confirmed past and predicted future | TBD |
| 18 | Calendar "scissors" / additional symptom marker under cells | 150 (May 3-5) | Uncertain - additional event marker (low confidence) | TBD |
| 19 | Floating fast-scroll chevron on calendar | 163, 190 | Quick jump down through months | TBD |
| 20 | History list (chronological cycle-day list w/ temperature) | 80, 85, 90, 95, 98, 103 | Scroll list, circle indicator + cycle day label + temp pill; missing readings shown as "-.-°F" | TBD |
| 21 | "Cycle start" demarcation in history list | 90 | Visual section break between cycles | TBD |
| 22 | Cycle Insights summary panel with statistics tiles | 263 | "47 cycles tracked" + Cycle length / Period length / Ovulation / Follicular / Luteal stat tiles each with +/- variance | TBD |
| 23 | Cycle Insights "My added data" link | 263 | Drill-down into Cycler-added log data | TBD |
| 24 | Landscape BBT chart with phase bands | 60, 65, 117, 123, 125, 128, 130 | Plot of daily BBT in degrees F across cycle days; purple Period band; pink Fertile band; pink Ovulation ribbon with egg marker; line color switches green↔red at fertile boundary | TBD |
| 25 | BBT chart cycle-comparison view (multiple cycles side-by-side) | 60, 65, 123, 125, 128, 130 | Several cycles laid out adjacently for visual comparison | TBD |
| 26 | BBT chart annotation badge ("A") | 123, 128 | Uncertain - likely marks anomalous cycles or annotations (low confidence) | TBD |
| 27 | BBT chart pagination (Previous / Next cycle) | 117 | Edge-aligned cycle-pager controls | TBD |
| 28 | BBT chart left toolbar (sketch / list / dots icons) | 60, 65, 117 | Uncertain - possibly comparison/zoom toggles | TBD |
| 29 | "My luteal phase length" with population comparison | 40, 45, 50 | "15 plus/minus 2 days / The average luteal phase length for all cyclers is 12 plus/minus 2 days" | TBD |
| 30 | "My average luteal phase temperature" stat | 40, 45, 50 | "97.30 degrees F" callout | TBD |
| 31 | "My temperature variation" gauge | 40, 45, 50 | Half-donut gauge with arrow + verbal verdict ("Stable") + numeric "+/- 0.41 degrees F" | TBD |
| 32 | Hormone arc educational illustration (Estrogen / LH / Progesterone curves) | 22, 25, 30 | Stylized 3-curve plot with egg marker at ovulation moment | TBD |
| 33 | Phase explainer with 4-section structure (overview / hormones / lifestyle tips / algorithm) | 25, 30, 35 | Full-screen scrollable sheet with consistent IA across phase types | TBD |
| 34 | Inline blue-link key terms inside paragraphs | 7, 40 | Glossary-style tappable definitions in body copy | TBD |
| 35 | Big purple "+" FAB → log sheet | 7, 295 | Center-of-tab-bar primary action | TBD |
| 36 | Log sheet "Sick / Hungover" status flags | 295, 300, 313 | Quick-tap pill toggles tied to date | TBD |
| 37 | Log sheet "Bleeding" (Period / Spotting) | 295, 305 | Two-pill picker | TBD |
| 38 | Log sheet "Vaginal sex" (Protected / Unprotected / None) | 295, 305 | Three-pill picker; required for contraception variant | TBD |
| 39 | Log sheet "Ovulation test" (Positive / Negative + camera scan) | 295, 305 | Camera icon for test-strip image capture | TBD |
| 40 | Log sheet "Cervical mucus" (Amount / Consistency) | 305 | Sub-modal pickers (entry chips) | TBD |
| 41 | Log sheet "Sex drive" (Low / Medium / High) | 303, 305 | Three-state | TBD |
| 42 | Log sheet "Skin" (Dry / Oily / Puffy / Acne / Glowing / Other) | 303, 305 | Multi-select chips | TBD |
| 43 | Log sheet "Pain & symptoms" (12 symptom chips) | 303, 305 | Cramps, Backache, Sore Breasts, Ovulation Pain, Headache, Migraine, Nausea, Diarrhea, Constipation, Bloating, Cravings, Other | TBD |
| 44 | Log sheet "I'm feeling..." mood grid (~22 emoji moods) | 305, 308 | 5-column grid of yellow emoji moods + label, including PMS, Mood Swings, Irritable, Anxious, Stressed, Tired, Sensitive, Numb, Sad, Angry, Unfocused, Self critical, Guilty, Obsessive thoughts, Confused, Isolated, Withdrawn, Sociable, Happy, Confident, Calm, Energetic, Excited | TBD |
| 45 | Log sheet "Notes" free-text field | 308 | "How are you feeling today?" placeholder | TBD |
| 46 | Log sheet "Emergency Contraception & Tests" link row | 308 | Specialised entry to emergency-event logging | TBD |
| 47 | Log sheet "Manage trackers settings" gear row | 308 | Per-tracker config | TBD |
| 48 | Log sheet collapse/expand control (chevron in pink pill) | 295, 313 | Minimize sheet to top section | TBD |
| 49 | Log sheet date pager (chevron-left / chevron-right + "Today, CD 25") | 295, 300, 305 | Backfill historical days | TBD |
| 50 | Smart proactive prompt: "Time to take an ovulation test" | 240, 245 | Algorithm-triggered message in inbox; explains LH and benefit | TBD |
| 51 | Smart proactive prompt: "Your period is coming soon" | 211, 270 | Inbox card with practical preparation tips + blog link | TBD |
| 52 | Smart phase-themed message: "Cervical Mucus during the luteal phase" | 213, 270 | Auto-themed educational content for current phase | TBD |
| 53 | Research opt-in survey ("Tobacco and fertility") | 220, 223, 228, 233, 235, 238, 240 | Multi-option questionnaire with "Save answer" CTA delivered via inbox | TBD |
| 54 | Inbox / Messages tab with date-stamped cards + "Was this message helpful?" feedback | 270, 211 | Card list with 👍 / 👎 feedback inline; Apr 19, Apr 12, Apr 9, Apr 6, etc. | TBD |
| 55 | Bottom nav: 5 tabs (Today / Calendar / + / Messages / Learn) with red unread badge on Messages | 7, 110, 145 | Center FAB is the log action, not a tab destination | TBD |
| 56 | Learn tab - Spotlight featured article | 270, 273 | Hero image + title + read-time | TBD |
| 57 | Learn tab - Guides horizontal carousel | 250, 273, 248, 255 | Card-format topical guides | TBD |
| 58 | Learn tab - Quizzes (LH / Period / Cycle) | 250, 280 | Three-card quiz launcher | TBD |
| 59 | Learn tab - Definitions glossary tiles | 250, 280 | Icon-tile horizontal scroller | TBD |
| 60 | Learn tab - Research library | 285 | External research-style article cards | TBD |
| 61 | Learn tab - Blog (categorized: "Birth Control") | 288 | Blog carousel under tagged sections | TBD |
| 62 | Learn tab - "Cycler Stories" section | 288 | User-story content block | TBD |
| 63 | Side menu (left drawer) with star-rated Cycler rank | 140, 142, 207 | "4-star Skilled Cycler" - gamified rank tied to logging consistency | TBD |
| 64 | "Get free months" (referral) row in side menu | 140 | Referral promo entry | TBD |
| 65 | "Buy extra supplies" row | 140 | Commerce entry (likely thermometers / strips) | TBD |
| 66 | My account screen | 140 | Standard auth/account management; supports Apple Login + private email relay | TBD |
| 67 | "Manage subscription" + "Restore iTunes subscription" | 140 | Subscription management for Birth Control plan | TBD |
| 68 | Side-menu footer with regulatory line "Natural Cycles Version 7.2" + "Regulatory" link | 140 | Compliance presence | TBD |
| 69 | FDA-cleared regulatory badge ("CE 0123 Cleared by FDA") on splash | 5 | Regulatory disclosure on app load | TBD |
| 70 | Onboarding 7-step in-app tutorial overlay | 255, 258, 263, 270, 275, 290, 313 | Coachmark-style guided tour of all 5 tabs and the log sheet | TBD |
| 71 | Cycle counter in Today ring ("Cycle Day 25") | 7, 110 | Day-of-cycle as primary contextual readout | TBD |
| 72 | Date display (e.g. "Sun, Apr 19") in Today ring | 7, 110 | Plain-language date inside ring | TBD |
| 73 | "Full graph >" CTA inside today's tip card | 10, 108 | Drill from tip into BBT chart | TBD |
| 74 | Sticky save button on log sheet | 305 | Footer "Save" pill always visible | TBD |
| 75 | Tutorial close button + step counter (X N/7) | 255, 258, 263, 270, 275, 290, 313 | Persistent during overlay flow | TBD |

---

## NOTES ON SCOPE / OBSERVATION CONFIDENCE

### What I am confident about
- The Today / Calendar / Log / Messages / Learn tab structure with center FAB.
- Color coding of fertility (green / red, with dotted = today, outlined = prediction).
- Log sheet category list and chip values.
- BBT chart structure with band-based phase coloring and dual-color line.
- Cycle Insights statistics tiles with population comparisons.
- Phase explainer 4-section IA.
- 7-step onboarding tutorial structure.

### What I am uncertain about and labeled as such
- The "scissors" icon under specific calendar cells (Frame 150, May 3-5) - unclear semantic meaning.
- The red "A" badge on certain BBT cycle columns (Frame 123, 128) - likely anomaly/annotation flag but not literally explained in any captured frame.
- The left-side toolbar icons on the BBT chart (sketch / list / dots) - likely filter or comparison toggles, but their exact functions are not labeled.
- The "1" and "+" pills lower-left of the BBT chart - likely zoom controls but unconfirmed.
- The Settings screen interior (the row exists in the side menu, but no frame opens it).

### What was not seen in the frames
- No onboarding/account-creation flow (the user is already deep in the app).
- No explicit cover-line graphic (NC color-codes the BBT line itself rather than drawing a horizontal threshold).
- No anovulatory or "irregular cycle" anomaly banner observed.
- No connected-device pairing flow beyond the "Wake up and sync your Oura Ring" coachmark.
- No "Plan Mode" vs "Birth Control Mode" toggle (the captured account is in "NC Birth Control" throughout).

---

## FRAME-COUNT SUMMARY

- Total frames in directory: 319.
- Frames directly read and analyzed in this audit: ~95 frames spanning the full range.
- Coverage strategy: read every ~5th-10th frame plus all transitional/distinctive frames identified by the file pattern. Every distinct screen/state in the recording is represented in the matrix above.
- Distinct screens documented: Today (5+ states), Calendar (multi-month, with predictions and history both directions), History list, Cycle Insights summary, BBT chart (single + multi-cycle landscape), Log sheet (top + expanded + with all tutorial coachmarks), Phase explainer, Learn tab (with all sub-sections), Messages inbox, Side menu, My account, FDA splash, 7-step tutorial overlay.
