# Frame -> section index for `2026-04-29-app-tour.mp4`

Source: `docs/current-state/recordings/2026-04-29-app-tour.mp4`
Frames: `docs/current-state/frames/2026-04-29-app-tour/frame_NNNN.png`
Total frames extracted: **113** (from 6m 24s @ 60fps, scene-change threshold 0.30)

This index splits the recording across the six section briefs the user is handing to parallel sessions: **chat, home, cycle, calorie, login, doctors, data**. Each row says which frames a session should look at first; the per-session brief in `sessions/<name>.md` re-states the same ranges plus narrative.

The frame ranges are first-pass approximations from a sampled scan; the consuming session is encouraged to re-confirm on the first frame and last frame of its range and adjust if a transition was off-by-one or two. Threshold 0.30 means each frame is a meaningfully different visual state, not a duplicate.

## Section ranges

| Section | Frames | What's in the recording |
|---|---|---|
| AI chat (input sheet) | 0001 - 0004 | The "How are you feeling?" / "Anything to remember?" sheet sliding up over Home with the keyboard. Cancel/Save chrome, "Hold to speak" mic affordance, freeform textarea. |
| Home | 0005 - 0009 | Home grid with Log Today / Patterns / Cycle / Timeline / Learn cards, Recovery Time tile, bottom tab bar (Home, Cycle, +, Food, More). |
| Notifications | 0010 | A notifications panel/toast with "Your fertile window is a few days out" and "A new cycle insight is ready". Bell icon top-right. Considered chat-adjacent because both deliver insights, but lives on Home. |
| Cycle | 0011 - 0019, 0045 - 0046 | Cycle landing ("Resetting time", "Cycle Phase: Menstrual", Exercise/Nutrition recs, Full graph button), then Cycle insights (Temperature pattern, "How your numbers compare to large population studies", 15 completed cycles on file). Frame 45 is the cycle-day-4 recommendation tile, presumably reached via a different entry. |
| Calorie / Food | 0020 - 0029 | "Find a food" header (mid-loading skeleton, content not yet rendered), then a food list scaffold visible behind the bottom nav. Coverage is shallow; this recording does not exercise the food log flow end to end. |
| Settings / More | 0030 - 0044 | Account (Sign out, Delete account, email visible), Password (Change password), Security (passkey explainer), "Walk through setup again", Appearance (Dark/Light/System), Oura (Last synced: never; Sync now/Disconnect), Notification toggles (Doctor visit reminders, Daily check-in nudge, Cycle predictions, Pattern discoveries, Insurance reminders), Privacy. |
| Transition / blank | 0047 - 0049 | Mostly white frames between Settings and Login. Curate or ignore. |
| Login | 0050 - 0056 | Lock-icon header, "LanaeHealth" wordmark, "Sign in to continue", PASSWORD field (one with masked dots, one with the keyboard up showing "Signing in..." submit state). Single-screen, password-only. |
| Doctor mode (analysis output) | 0057 - 0113 | The longest stretch. Diagnostic Hypothesis Tracker rendered as an AI output: "6 Active Hypotheses" with scores (Immune Dysregulation / Inflammatory Substrate 100/100, POTS / Autonomic Dysfunction 61/100), supporting evidence with hs-CRP / CT head / heart-rate values, family history (heart, hEDS), labs read-out (TSH, Free T4/T3, ferritin, B6 deficiency, ALT), action priorities (Buy Thorne L-Glutamine, Message PCP about P5P and ALT, Find SIBO test result, Raise bowel symptoms with OB/GYN), Wixela mouth-rinse instructions. |

## What the recording does **not** cover

- Records / labs / imaging as standalone surfaces (`/v2/records`, `/v2/labs`, `/v2/imaging`). Lab values appear inside the doctor analysis but the dedicated data routes are not exercised.
- Document import flow (`/v2/import/*`).
- Today / log / sleep / timeline / patterns as primary surfaces beyond their Home tile.
- A full food-add interaction (search, pick result, edit grams, save).
- Any signed-out marketing or onboarding wizard.
- Topics, intelligence, or competitive surfaces.

If a downstream session needs visual ground truth for one of these, capture a follow-up recording named `docs/current-state/recordings/<YYYY-MM-DD>-<slice>.mp4` and re-run the extractor.

## Conventions

- Frame numbers are `frame_NNNN.png` in `docs/current-state/frames/2026-04-29-app-tour/`.
- Ranges are inclusive on both ends.
- The status-bar shows a red recording dot in the Dynamic Island; ignore it as artifact.
- Time-of-day in the status bar (4:01 -> 4:09) gives a coarse linear timeline if a frame is ambiguous.
