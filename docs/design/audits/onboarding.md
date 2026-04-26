# /onboarding audit

**Purpose:** Welcome Lanae on first run, learn how she wants to use the app, and route her to a tailored setup without draining her energy. First impression, so it must feel warm and low friction.
**Files:** `src/app/onboarding/page.tsx`, `src/components/onboarding/ArchetypeWizard.tsx` (active), `src/components/onboarding/OnboardingWizard.tsx` (legacy, unused by route).

## First impression (375 / 768 / 1440)

- **375:** Leaf icon, headline "Welcome to LanaeHealth", a 3-line subtitle, and a full-width sage "Get Started" button. Tone is mostly right, but the subtitle renders the literal string "--" between two clauses (rendered em dash surrogate) which is forbidden. The button has no press feedback, no hover lift, no focus treatment beyond global. The "N" debug dot bottom-left is floating chrome, not owned by this route.
- **768:** Same centered column at ~max-w-md. The copy flows on three lines. Acres of empty space top and sides. Otherwise identical to 375.
- **1440:** The mobile 640px column is stranded in the center of a 1440px viewport. Hero sits isolated in a sea of cream. §13 violation. The welcome screen has no split or wider reading treatment.

## Visual hierarchy

The welcome screen is clean: leaf, h1, subtitle, single sage CTA. One sage primary, good. But the hierarchy fails at the subtitle because the rendered "--" reads as broken punctuation and distracts from the warm voice. The h1 should also use the shared `.route-hero__title` for consistency with other routes being touched in this pass.

Later steps (archetype, conditions, apps, modules) each show a single sage action at the bottom, with the progress dots above. Dots are static solid circles with no motion hint, which makes multi-step progress feel like a checklist rather than forward travel. Inspired by the brief: slow-pulse the active dot.

## Clarity of purpose

Route exists to answer: "What kind of tracker are you, and what do you want to bring in?" That is mostly communicated. The welcome does its job ("your health, your way"). What it lacks is the sense that this will be short. Adding a low-key "takes about a minute" eyebrow would calm first-run anxiety, but is optional.

## Consistency violations (design-decisions.md)

1. Rendered double hyphen in welcome subtitle `--` at ArchetypeWizard.tsx:135-136 - §15 bans em dashes, and the user brief forbids `--` too. Rewrite with a colon/semicolon split.
2. `'Setting up...'` button label on `ready` step - ArchetypeWizard.tsx:338 - §11 bans trailing ellipses in UI strings, §11 bans spinners, §10 asks for fill-on-save.
3. Desktop ≥1024px layout is a centered 640-ish column with empty flanks - §13 violation. User brief explicitly asks for `.route-desktop-wide` (820px) on welcome for a reading experience.
4. Interactive elements missing press feedback, loading, and explicit hover states - §10. Applies to Get Started, Archetype cards, Condition chips, App chips, Module rows, Continue / Skip buttons, and Start Tracking.
5. Progress dots static (no motion on active) - design-decisions §8/§10 implies delight from motion on the "current" position. User brief: "slow-pulse progress dots, not a segmented bar".
6. Headline `h1` on welcome uses inline sizing, not the shared `.route-hero__title` / `.page-title` contract from §12.
7. Numerics missing `.tabular`: count text in chip buttons (`Continue with 2 apps`), ready-screen module count.
8. The word "features" in "{modules.length} features enabled" is cold; §5 prefers warmth ("tracking tools on your side"). Minor.
9. `'Start Tracking'` verb is fine but lacks feedback during save (ties to violation #2).
10. `'...'` also subtly appears in the saving label; must become fill-on-save.

None of the prohibited red-tinted pills, shame language, or "missed" words appear here. The wizard is the cleanest route in the app; the fixes are polish and first-impression elevation.

## Delight factor: 5/10 - Rationale

The welcome is already pleasant: cream bg, leaf, warm subtitle, one clear CTA. But "--" in the first sentence Lanae reads is a typographic scratch, the desktop treatment is lazy, the progress dots feel like a chore, and the "Setting up..." string is the only place in the app where a spinner-adjacent pattern survives. Fixing those four items brings this to the 8-9 range without over-designing.

## Interactive states inventory

| Element | Rest | Hover | Active | Focus | Loading | Disabled |
| --- | --- | --- | --- | --- | --- | --- |
| Welcome Get Started button | Y | N | N | global | N | N |
| Archetype cards | Y | N (transition only) | N | global | N | N |
| Conditions chips | Y (toggle visual) | N | N | global | N | N |
| Apps chips | Y (toggle visual) | N | N | global | N | N |
| Module rows | Y (toggle visual) | N | N | global | N | N |
| Step Continue / Skip buttons | Y | N | N | global | N | N |
| Ready Start Tracking button | Y | N | N | global | partial (opacity 0.5 + `Setting up...`) | Y (while saving) |

Missing: press feedback everywhere, explicit hover lift/tint on cards + chips, fill-on-save loading on final submit.

## Empty states inventory

The wizard does not render empty states; it renders choice states that are always populated. N/A. Note: if Lanae skips all modules on the module step, we should surface an optional "Symptom tracking is off. Turn on in Settings." nudge in the app outside onboarding. That is cross-route and belongs to Settings/Home; not in scope for this audit.

## Microcopy audit

| Where | Old | New |
| --- | --- | --- |
| Welcome subtitle | `Your health, your data, your way. We adapt to how you want to track -- whether that is everything in one place, or just bringing your existing data together.` | `Your health, your data, your way. We adapt to how you want to track: everything in one place, or just the parts that help.` |
| Ready button loading | `Setting up...` | `Setting up` during fill, then `Start tracking` collapse - implemented as fill-on-save, no trailing dots. |
| Ready body "features enabled" | `${n} features enabled` | `${n} tracking tools on your side` |
| Step "Skip" fallback on conditions | `Skip` | `Skip for now` (warmer, optional) |
| Step "Skip" fallback on apps | `Skip` | `Skip for now` |

## Fix plan

### Blockers
- Rewrite welcome subtitle, remove rendered `--` (ArchetypeWizard.tsx:135-136).
- Replace `'Setting up...'` with fill-on-save button (ArchetypeWizard.tsx:331-339).

### High
- Add `.route-desktop-wide` wrapper to widen reading experience on ≥1024px.
- Use shared `.route-hero__title` / `.page-title` for h1.
- Press feedback on every interactive element (buttons, cards, chips, rows).
- Progress dots: slow-pulse the active dot; static for others.

### Medium
- Hover lift on archetype cards, chip tint on hover.
- Tabular numerics on count text.
- Warmer "tracking tools" phrase on ready screen.
- "Skip" → "Skip for now" on optional steps.

### Polish
- Low-key "takes about a minute" eyebrow on welcome.
- Fill-on-save checkmark motion inside Start Tracking button.
