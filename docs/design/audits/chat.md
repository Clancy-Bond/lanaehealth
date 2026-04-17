# /chat Audit — AI Research

## Purpose
Single conversational surface where Lanae can ask open-ended questions about her own health data and receive grounded answers from the Clinical Intelligence Engine. Doubles as a doctor-visit prep assistant.

## First impression
Mobile (375): clean, scrolly message column, input at bottom, tool pills directly above input. Feels like any chat app, but tool pills are all sage-tinted which pulls the eye away from the send button (violation of Scarce Accent). Tablet (768): same layout at 640px max, unchanged. Desktop (1440): mobile-sized column floats in a sea of white; no deliberate layout choice. Trash-can clear button reads as unlabeled red affordance on hover.

## Visual hierarchy
Current order of attention: message bubbles, then sage tool-pill block, then send button, then header. Should be: answer body, then input/send, then supporting pills as neutral context. Sage saturation on pills wins the eye over the primary action (send). Send arrow should be the single sage element in the lower chrome.

## Clarity of purpose
Header reads "AI Research" — correct, matches product vocabulary. Empty state asks "Ask me anything about your health data" with a sparkles icon and starter cards, which is good. Inline hint "Searching your health data..." under loading dots uses forbidden ellipsis. Placeholder "Ask about your health data..." uses Unicode ellipsis. Both are §5 violations.

## Consistency violations
- Placeholder: trailing `...` (ascii in source; appears as ellipsis visually). §5 forbidden.
- "Searching your health data..." loading label: trailing `...`. §5 forbidden.
- Error fallback: "Sorry, something went wrong: X. Please try again." uses colon + capitalized period pattern; acceptable, but brief copy rule says prefer "Something broke on my end. Try again?" (§5).
- Tool-used pills: every pill uses `--accent-sage-muted` bg + sage text. Violates Scarce Accent (§3). Neutral `.pill` base with sage only for actively filtered/selected.
- Clear button: no focus outline beyond global, no press-feedback, hover swaps to `--pain-severe` red (forbidden as interactive chrome; red is reserved for 1–2px accent stripes only per §7).
- Inline shadows: `boxShadow: "var(--shadow-sm)"` used on message bubbles — OK (token). `boxShadow = "var(--shadow-md)"` on starter cards — OK. No raw formulas found.
- No `className="tabular"` or `data-numeric` on any UI-rendered numeric (dot-animation pulses use no numbers; message bodies are AI-generated, out of scope).
- Loading indicator: 3-dot pulse is acceptable per spec ("animated 3-dot pulse" is explicitly allowed by the route brief). No spinner, no `<Spinner />`.
- Desktop: no `.route-desktop-wide`; fixed `maxWidth: 640` leaves huge empty flanks on ≥1024 — §13 violation.

## Delight factor
**5/10.** Competent chat UI, but the AI-Research identity is muted by an over-green pill block. The empty state is warm. No micro-moments (no celebration on copy, no shimmer for fetching, no tabular nums on message meta). Fix tool-pill color, tighten placeholder, widen desktop, and the score moves to 7.

## Interactive states inventory
| Element | Rest | Hover | Active | Focus | Loading | Disabled |
| --- | --- | --- | --- | --- | --- | --- |
| Send arrow | sage circle | none | none | global | color swap only | gray bg + `cursor:default` (close enough; missing 0.5 opacity) |
| Clear button | muted icon+text | red tint (bad) | none | global | n/a | n/a |
| Starter cards | cream bg | sage border + shadow-sm | none | global | n/a | n/a |
| Doctor-prep card | sage-muted bg + sage border | translateY + shadow-md | none | global | n/a | n/a |
| Tool pill | sage-muted | none | none | global | n/a | n/a |
| Copy button | border + muted text | sage border + sage text | none | global | copied=sage swap | n/a |

Missing: press-feedback scale on every interactive card; disabled opacity on send; custom hover discipline on clear (should not go red).

## Empty states inventory
Only one: pre-first-message screen with Sparkles + "Ask me anything about your health data" + 5 starter buttons + Doctor Prep card. Acceptable per §4 template. Good copy. No "No data" strings present.

## Microcopy audit
| Location | Old | New |
| --- | --- | --- |
| placeholder | `Ask about your health data...` | `Ask about your health data` |
| loading label | `Searching your health data...` | `Pulling your data` |
| error | `Sorry, something went wrong: X. Please try again.` | `Something broke on my end. Try again?` |
| empty title | `Ask me anything about your health data` | `Ask anything about your health data` (tighter) — **keep as is per spec example** |
| clear button title | `Clear conversation` | `Clear conversation` (keep) |
| copy button title | `Copy to clipboard` | `Copy to clipboard` (keep) |
| copy state | `Copied` | `Copied` (keep) |

## Fix plan

### Blockers
1. Placeholder `...` → remove.
2. "Searching your health data..." → "Pulling your data".
3. Tool pills all-sage → neutral `.pill` style; sage stays reserved for active send button.
4. Clear button hover → red. Replace with muted-to-primary text shift, no red.

### High
5. Desktop ≥1024 layout: add `.route-desktop-wide` or equivalent; still single column but feels deliberate.
6. Error string rewrite.
7. Interactive states: add `press-feedback` to starter cards, doctor-prep, clear, copy, send.
8. Send-button disabled state needs 0.5 opacity.

### Medium
9. Doctor-prep card uses filled sage icon background AND sage border — same scarce-accent risk as tool pills when combined with send. Keep sage-muted bg + sage border + smaller sage icon background; this is ok because it's the primary hero CTA pre-conversation.
10. `tabular` class on any timestamp surface if exposed (none currently in DOM for chat; deferred).

### Polish
11. Add `.shimmer-bar` as 1px top edge of loading assistant bubble (in addition to 3-dot pulse).
12. Ensure `title`/`aria-label` coverage on all icon buttons.
