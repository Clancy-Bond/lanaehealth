# LanaeHealth Design Refresh: Before / After Gallery

**Audit date:** 2026-04-16
**Routes covered:** 12 (13 counting the `/import` landing redirect)
**Breakpoints:** 375px (iPhone SE), 768px (iPad), 1440px (Desktop)
**Vocabulary:** [../design-decisions.md](../design-decisions.md)
**Inspiration:** [../2026-findings.md](../2026-findings.md)
**Per-route audits:** [../audits/](../audits/)

## Route index

Each route has its own folder with `before/` and `after/` subfolders containing the 3 breakpoint screenshots.

| Route | Folder | Audit |
| --- | --- | --- |
| `/` (home) | [home/](./home/) | [home.md](../audits/home.md) |
| `/log` | [log/](./log/) | [log.md](../audits/log.md) |
| `/chat` | [chat/](./chat/) | [chat.md](../audits/chat.md) |
| `/doctor` | [doctor/](./doctor/) | [doctor.md](../audits/doctor.md) |
| `/imaging` | [imaging/](./imaging/) | [imaging.md](../audits/imaging.md) |
| `/import`, `/import/myah` | [import/](./import/) | [import.md](../audits/import.md) |
| `/intelligence` | [intelligence/](./intelligence/) | [intelligence.md](../audits/intelligence.md) |
| `/onboarding` | [onboarding/](./onboarding/) | [onboarding.md](../audits/onboarding.md) |
| `/patterns` | [patterns/](./patterns/) | [patterns.md](../audits/patterns.md) |
| `/profile` | [profile/](./profile/) | [profile.md](../audits/profile.md) |
| `/records` | [records/](./records/) | [records.md](../audits/records.md) |
| `/settings` | [settings/](./settings/) | [settings.md](../audits/settings.md) |
| `/timeline` | [timeline/](./timeline/) | [timeline.md](../audits/timeline.md) |

## What changed

### Foundation
- Added motion tokens (5 easing curves, 4 durations)
- Added spacing tokens (4pt grid)
- Added empty-state utility, shimmer bar, skeleton, press-feedback
- Added `.route-hero`, `.route-desktop-wide`, `.route-desktop-split` layout utilities
- Added `.tabular` class for tabular numerics
- Fixed PWA icon 404 (removed missing icon-192/512 refs, added single icon.svg)

### Per-route highlights
Every route received:
- Em dash removal in all copy
- "..." ellipsis elimination from UI strings
- Spinner replacement with shimmer / skeleton / fill-on-save
- Tabular numerics on data values
- Scarce Accent Rule enforced (at most one sage-filled primary per viewport)
- Empty states rewritten per warm template
- Desktop layout that is not just centered mobile (reading width or split pane)
- Press-feedback on every interactive element
- All 6 interactive states documented: resting, hover, active, focus, loading, disabled

### Most dramatic improvements
- **Home:** Desktop split-pane layout; "SEVERE DAY" replaced with "Rough day"; "active problems" renamed to "things we're watching"
- **Imaging:** Single neutral card palette (previously each modality used a different color); real modality filter chips with counts
- **Intelligence:** "RECUMBENT" renamed "Gentle movement"; "INSUFFICIENT" renamed "Needs more data"; double-hyphens removed
- **Settings:** 8 sage-filled Connect buttons demoted to neutral outline; all 6 spinners replaced; toggle states clarified
- **Patterns:** Fixed a React hooks crash that was blocking the route entirely
- **Import:** Fixed the `/import` 404 with a proper landing page
- **Onboarding:** Fill-on-save Get Started button with scale-pop checkmark; desktop wide layout replacing stranded 640px column

## Deferred items
Documented per-route in each audit file. Typical deferrals:
- Command-K global search (cross-route feature, needs separate spec)
- Progressive disclosure on the Patterns page (needs a hero-insight component)
- True print-friendly layout for Doctor mode

## Known follow-ups
- AI-generated chat content still contains em dashes; this is out of our lane per the contract
- Shared `LoadingSpinner.tsx` component is still referenced in a few loading.tsx files; replacing it would require touching globals and was left for the next pass

## Credits
Orchestrated by a main Claude session with parallel implementation subagents applying a shared `design-decisions.md` contract. Total: 1 foundation + 3 implementation waves. All 12 routes audited and refreshed end-to-end.
