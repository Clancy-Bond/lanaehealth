# v2 mobile UI: known issues

Tracker for the priority-ordered set of UX defects spotted in the
2026-04-29 app tour. Items move from "open" to "resolved" with a
pointer to the PR that closes them.

## Resolved

### #1. Horizontal overflow on most screens

Recording evidence: `docs/current-state/recordings/2026-04-29-app-tour.mp4`,
frames 0001 / 0060 / 0095 / 0105 / 0113 (and most other frames).
Symptoms: text clipped on the left and right edges of chat, home,
cycle, doctor, and settings ("ow are you feeling?" instead of "How
are you feeling?", "TS / Autonomic Dysfunction" instead of "POTS /
Autonomic Dysfunction", "ot me saying you have IBD." instead of
"Not me saying you have IBD.").

Resolved by `foundation: fix horizontal overflow across v2`. Audit
at `docs/current-state/audits/00-viewport-fix.md`. Regression
guard at `tests/e2e/viewport.spec.ts`.

### #2. Markdown / hypothesis text too wide for cards

Same recording, especially the doctor analysis hypothesis cards
(POTS card, IBD card, dysautonomia card). Long lab values, PubMed
URLs, and slash-separated medical terms widened cards past their
parents.

Resolved by the same foundation pass: `.v2 { overflow-wrap: anywhere }`
in `src/v2/theme/tokens.css` makes every text container in v2 wrap
at any character when constrained, including hypothesis titles and
markdown URL strings inside `MessageBubble` and `HypothesesCard`.

### #3. iOS rubber-band overscroll bounce

Reported alongside the viewport fix: scrolling past the top or
bottom of any v2 page sprung back with the iOS elastic bounce, and
a swipe-down at the top of a chat conversation would trigger
pull-to-refresh mid-thread.

Resolved by `overscroll-behavior: none` on `html`, `body`
(`src/app/globals.css`) and on the v2 `<main>` scroller
(`src/v2/components/shell/MobileShell.tsx`). The viewport spec
asserts the computed style on both root elements.

## Open

(Section sessions open issues here as they fan out.)
