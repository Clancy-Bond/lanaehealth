# v2 build: session coordination

Phase 0 lays the foundation. Five parallel "section" sessions then fan out, each owning one slice of `/v2/*`. This document is how they stay out of each other's way.

## Best-of-three design philosophy

| Layer | Source | Applies to |
|---|---|---|
| Visual chrome (palette, rings, whitespace, elevation) | **Oura** | Shell, home, navigation, data viz |
| Clarity, pedagogy, voice | **Natural Cycles** | All copy: labels, subtext, onboarding, empty states |
| Per-section UX patterns | Cycle=**NC**, Food=**MFN**, Sleep/readiness=**Oura** | The actual section surfaces |

Where the three conflict, the per-section pattern wins for that section's surface, but the visual chrome and copy voice stay consistent across the app.

## Phase 0 (this session) : foundation

Delivered before any section session begins:

- Tokens at `src/v2/theme/tokens.css`
- 12 primitives at `src/v2/components/primitives/`
- 4 shell components at `src/v2/components/shell/`
- `/v2/*` route stubs (40 total + `/v2/demo`)
- Design system doc at `docs/v2-design-system.md`
- Per-app derived analysis at `docs/reference/{oura,natural-cycles,mynetdiary}/{colors,typography,components,flows}.md`
- Pre-flight refactor of 3 components to remove direct Supabase writes
- CLAUDE.md addendum noting the v2 palette split

## Parallel sessions (5, kicked off after Phase 0 merges)

Each session owns a contiguous slice of `/v2/*` and touches only its files. No session touches Phase 0 artifacts without filing a FOUNDATION-REQUEST.

Suggested split:

1. **Home & Today** : `/v2`, `/v2/today`, `/v2/log`, `/v2/sleep`, `/v2/timeline`, `/v2/patterns/*`
2. **Cycle** : `/v2/cycle`, `/v2/cycle/*`
3. **Food** : `/v2/calories`, `/v2/calories/*`
4. **Doctor & Records** : `/v2/doctor/*`, `/v2/records`, `/v2/labs`, `/v2/imaging`
5. **Topics & Settings** : `/v2/topics/*`, `/v2/import/*`, `/v2/settings`

## Locked files rule

A "locked" file may be consulted but not edited by section sessions. The authoritative list lives in `docs/v2-design-system.md` § "Locked files". It includes:

- `src/lib/**` (every engine directory)
- `src/lib/supabase.ts`, `src/lib/types.ts`
- `src/app/api/**` (unless the change is clearly additive and scoped to the owning section's routes)
- Everything under `src/v2/**` created in Phase 0 (tokens, primitives, shell) : change via FOUNDATION-REQUEST only
- `src/app/v2/layout.tsx` : change via FOUNDATION-REQUEST only
- All files under `src/components/**`, `src/app/**` outside `/v2/`

## FOUNDATION-REQUEST process

When a section session discovers the foundation is missing something (new primitive, new token, shell tweak), it does not add it locally. Instead:

1. Open a small PR to this repo titled `foundation: <what and why>`
2. Describe the need, the specific file(s) it wants to add or change, and 2-3 section surfaces that will consume it
3. The Phase 0 owner reviews, merges, and re-broadcasts the updated `docs/v2-design-system.md`
4. Section sessions pull `main` and resume

A section session that edits Phase 0 files without a FOUNDATION-REQUEST is rejected at code review.

## Coordination rules

- Every section PR links the reference frames it cloned from (by file path).
- Every new copy string must pass the NC voice check: short, kind, explanatory. No em-dashes anywhere per CLAUDE.md.
- Every section includes mobile-first smoke tests at 375pt and 390pt before requesting review.
- Section PRs do not touch another section's route tree. If crossover is necessary, file a FOUNDATION-REQUEST.

## Where to find things

- Tokens and their provenance: `docs/v2-design-system.md` § tokens
- Per-app palette, type, component, flow observations: `docs/reference/{oura,natural-cycles,mynetdiary}/`
- Primitive API reference: `docs/v2-design-system.md` § primitives, with live examples at `/v2/demo`
- Voice and pedagogy patterns: `docs/v2-design-system.md` § voice
