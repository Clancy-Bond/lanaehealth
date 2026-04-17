# /settings — Design Audit

**Route:** `/settings`
**Files:** `src/app/settings/page.tsx`, `src/components/settings/{SettingsClient,IntegrationHub,ModuleCustomizer,ImportHistory,MedicationReminders}.tsx`
**Date:** 2026-04-17

## Purpose

The control room for LanaeHealth. This route must answer "what is connected, what can I bring in, and what's turned on?" It bundles Oura status, 8 device integrations, universal + app-specific file imports, the myAH portal hand-off, data export, feature toggles, AI knowledge base maintenance, and medication reminders. Dense by nature. The route should feel organized and calm, not like an airplane cockpit of green buttons.

## First impression (all 3 breakpoints)

- **375 (mobile):** Single cream column with 9 section cards stacked. The "Connected Apps & Devices" list shows 8 rows, each with a sage-filled green "Connect" button on the right. Feels like a row of identical buttons begging to be pressed. Customize Features toggles look permanently "on" (sage-bordered with filled circle check on every row). Multiple sage-filled primary buttons in the same viewport: Sync Now (Oura), Connect × 8 (devices), Import Records (myAH), Export All Data, Refresh Now, Add Reminder. Scarce Accent Rule catastrophically violated.
- **768 (tablet):** Same centered column. Lots of wasted horizontal space on each flank. Empty cream on either side.
- **1440 (desktop):** Same 640px column stranded in a 1440 viewport. Empty flanks. Forbidden by §13 of the contract.

## Visual hierarchy

- Single `h1.page-title` correct.
- Below that, 9 identical SectionCard wrappers with the same 32px sage-muted icon, same font, same padding. No weight difference across sections so the eye cannot tell that "Connected Apps" is likely the top task versus "About" which is informational.
- Inside Connected Apps, 8 device rows all carry identical visual weight. There is no "try Apple Health first" nudge, no sort-by-popular, no visual separation between "medical" and "wearable" categories.
- The toggle checkmarks in Customize Features render with a sage fill + sage border whether the module is enabled or not (both states render the check SVG), so the toggle visually does not work; user cannot tell enabled from disabled at a glance.

## Clarity of purpose

Decent at the card-title level (each section explains what it is), but poor at the action level: sage saturates the whole screen and there is no obvious "start here" primary task. Lanae has to read all nine sections to decide.

## Consistency violations

1. **Scarce Accent Rule (§3) — heaviest violation on any route.** Single viewport (mobile first screen) contains: Sync Now (sage), 2 visible Connect buttons (sage), and offscreen 6 more Connect + Import Records + Export + Refresh + Add Reminder. Must demote non-primary sage buttons to neutral, reserve sage for a single primary action per section or per viewport.
2. **Inline shadow formulas** are not present here; SectionCard uses `var(--shadow-sm)`. IntegrationHub and ModuleCustomizer have no custom shadows. `MedicationReminders.tsx` has `boxShadow: '0 1px 3px rgba(0,0,0,0.15)'` on the toggle knob (line 449). Violates §8.
3. **Raw hex colors**. `IntegrationHub.tsx` uses raw `#E8F5E9`, `#2E7D32`, `#E3F2FD`, `#1565C0`, `#FFEBEE`, `#C62828`, `#FFF3E0`, `#E65100` for status pills. MedicationReminders uses `#FFF3E0`, `#FFE082`, `#E65100`, `#F57F17`, `#C85C5C`. Violates §7.
4. **Spinners everywhere (§11).** `IntegrationHub` syncing state renders `<div animate-spin rounded-full border>`; `ModuleCustomizer` initial load is the same; `ImportHistory` initial load is the same; SettingsClient has `<Loader2 animate-spin>` in ImportStatusBadge and buttons. Forbidden. Must become shimmer-bar/skeleton/fill-on-save.
5. **"..." ellipses forbidden (§5).** Found: "Uploading and processing..." (ImportStatusBadge L115), "Syncing..." (IntegrationHub L253, STATUS_COLORS L40), "Indexing..." (SettingsClient L688), "Refreshing..." (L668), "Syncing..." in Oura (L395), "Saving..." in MedicationReminders (L696). Must all become the verb alone or warm phrase.
6. **`Not Connected` status label.** Violates §4 tone ("Not Connected" is neutral-flat). Recommend "Ready to connect" or softer phrasing since the status text repeats next to every device.
7. **Toggle UI never changes.** `ModuleCustomizer` renders the checkmark `<svg>` only when `isEnabled`, but bg is `var(--accent-sage-muted)` and the circle bg is `var(--accent-sage)` already; the problem is that the fresh fetch from `/api/preferences` appears to return all modules enabled, so visually every row looks on. The toggle logic is correct but the default state of the app shows everything enabled so it reads as "all always on." Solution: make disabled state visually distinct enough that when Lanae does toggle one off, the visual change is obvious (grey-filled circle, no sage border, gray label).
8. **No tabular nums (§9)** on any numeric value: "Last synced: Apr 15, 2026, 4:12 PM", "1,186 Indexed records", "1.0.0 Version", dates on reminders, times on reminders. All should get `className="tabular"`.
9. **Desktop layout (§13).** 640px centered mobile column stranded in 1440 viewport. Forbidden. Need `.route-desktop-wide` at ~820px as the contract suggests (dense settings list; split-pane is overkill since most sections read sequentially).
10. **Empty state on integrations (no devices yet).** The current copy is only a small "Oura Ring is managed separately above. More integrations coming soon." Missing warm empty-state framing when zero are connected. Should add a softer header sentence.
11. **Press-feedback missing** on every tappable card/row (integration rows, import rows, reminder rows, module toggle rows).
12. **Import status "Upload failed" / "Import failed"** micro-copy: bare and cold. §5 says: "Something broke on my end. Try again?"
13. **`Reconnect Needed` orange pill** in IntegrationHub uses raw `#FFF3E0`/`#E65100`. Should use a token-based amber, not raw.
14. **Sync Now button on Oura uses sage-filled** — OK per section 1 rule, but once other sage buttons are demoted it will be the one primary per viewport.
15. **Generate Clinical Report** button uses `background: var(--bg-elevated); color: var(--accent-sage)`. Readable but sits next to Export All Data (sage-filled). Keep the neutral-with-sage-text pattern but add a border to make it visible on cream.
16. **`+ Add another time` button in MedicationReminders** has no hover/focus styling because it is a bare transparent button with sage text. Needs focus-visible treatment (global rule will paint an outline, so acceptable by §10-d).
17. **Universal Import** wrapped component (not in my lane) provides the dropzone; my lane can only style the container. The outer SectionCard is fine but there's no visible drag indicator guidance ("Drop files here" is inside UniversalImport, which I cannot modify). I can add surrounding container behavior where appropriate.

## Delight factor

**3/10.** Dense, green-saturated, and every row looks pushable. Toggling a module fires but the toggle appearance doesn't change enough to confirm. Spinners spin during sync. No celebration on a successful import (it just says "Imported X records"). The route feels like a database admin panel, not a calming companion.

## Interactive states inventory

- **Oura Sync Now / Disconnect:** Rest ok; no Hover lift, no Press scale, Disabled exists (opacity 0.6), Loading currently uses `animate-spin` (violates §11), Focus relies on global.
- **Integration Connect:** Rest ok (8 identical sage); no Hover, no Press, no Loading indicator, no Disabled, Focus global.
- **Integration Sync (when connected):** Rest ok; no Hover; Loading currently text "Syncing..." (violates §5, §11).
- **Integration Disconnect × button:** Rest ok; no Hover; no Press; unclear icon (raw × character).
- **ImportCard rows:** Rest ok; no Hover; `cursor: pointer` yes; no Press scale; Loading is `Loader2 animate-spin` (violates §11).
- **UniversalImport dropzone:** Not my lane.
- **myAH Import Records:** Rest ok; no Hover; no Press; no Loading; no Disabled.
- **Export All Data:** same.
- **Generate Clinical Report:** same.
- **Customize Features rows (ModuleCustomizer):** Rest + Pressed bg change via state; `transition-all` on tailwind; no Hover lift; Focus global; no Press scale.
- **AI Knowledge Refresh Now / Index All History:** Rest ok; no Hover; Loading uses spinner (violates §11).
- **Add Reminder:** Rest ok; no Hover; no Press; no Loading indicator.
- **Reminder cards:** Rest ok; no Hover; no Press; edit button and toggle present; toggle has transition but no focus.

## Empty states inventory

- **No integrations connected yet:** Missing warm message. Currently shows the full 8 disconnected rows with sage "Connect" on each. Should frame them with a lead-in: "No devices connected yet. Start with Oura Ring above, or pick one below."
- **No imports yet:** `ImportHistory` shows `"No imports yet. Drop a file above to get started."` — close to the template, acceptable as-is but can tighten to match §4.
- **No reminders yet:** MedicationReminders has no explicit empty-state message; the button alone invites action. Good enough, but can add a soft hint below the button when `reminders.length === 0`: "No reminders yet. Tap Add Reminder when you're ready."
- **Knowledge base initial sync loading:** Currently shows nothing while sync status fetches; once loaded shows the stats. Should use shimmer skeleton for the stat rows.
- **Customize Features loading:** Currently renders a spinning ring. Should be shimmer/skeleton rows.

## Microcopy audit

| String | Where | Fix |
| --- | --- | --- |
| "Uploading and processing..." | SettingsClient ImportStatusBadge L115 | "Uploading your file" |
| "Syncing..." | Oura L395; IntegrationHub L253; STATUS_COLORS L40 | "Syncing" |
| "Indexing..." | SettingsClient L688 | "Indexing" |
| "Refreshing..." | SettingsClient L668 | "Refreshing" |
| "Saving..." | MedicationReminders L696 | "Saving" |
| "Exporting..." | SettingsClient L989 | "Exporting" |
| "Import failed" / "Export failed" / "Sync failed..." | several | "Something broke on my end. Try again?" |
| "Not Connected" status pill | IntegrationHub L41 | "Ready to connect" |
| "Reconnect Needed" | IntegrationHub L43 | "Reconnect needed" (lowercased, softer amber) |
| "Oura Ring is managed separately above. More integrations coming soon." | IntegrationHub L293 | "Oura Ring lives in the section above. More devices land here as they're added." |
| "This may take a few minutes while the AI re-reads your health data..." | SettingsClient L699 | "One moment, the AI is re-reading your health data and rebuilding its knowledge base. Could take a few minutes." |
| "Download all your health data as a JSON file for backup or portability." | SettingsClient L970 | keep |
| "Generate a clinical summary PDF for your doctor visits." | SettingsClient L1000 | keep |
| "Your complete health story, ready for every doctor." | SettingsClient L1068 | keep |
| "Reminder configurations are saved. Push notifications will be available in a future update." | MedicationReminders L755 | keep |
| "Enable Notifications" headline | MedicationReminders L289 | "Turn on reminders" |
| "No imports yet. Drop a file above to get started." | ImportHistory L54 | "No imports here yet. Drop a file above to start." |

## Fix plan

### Blockers (ship-stoppers)

- **B1. Scarce Accent Rule.** Demote all 8 IntegrationHub Connect buttons to neutral outline buttons. Add a small sage checkmark badge on rows that are connected. Keep sage only on a small set per viewport (Add Reminder as the final CTA, Import Records for myAH as the big hero, Sync Now on Oura).
- **B2. Desktop layout.** Wrap the page root in `.route-desktop-wide` at >=1024px so the column widens to 820px instead of stranded 640px.
- **B3. Remove all spinners.** Replace `Loader2 animate-spin` / bordered-spin divs with shimmer-bars on containers and "Syncing" / "Uploading your file" text on buttons. Apply to: OuraSection sync, AIKnowledgeSection refresh + index, ImportCard, ImportHistory load, ModuleCustomizer load, IntegrationHub syncing state, export button.
- **B4. Toggle clarity.** ModuleCustomizer disabled state must be visually obvious: swap bg to `var(--bg-elevated)`, remove sage border, mute label color, empty circle without check.

### High

- **H1. Microcopy.** "..." elimination across all files. Error strings to warm template.
- **H2. Tabular nums.** Add `className="tabular"` to: last synced timestamps, dates, record counts, version number, app name text-run (keep text, just class the spans), reminder times, reminder days.
- **H3. Empty states.** Warm lead-in for zero-connected integrations. Apply `.empty-state` where appropriate (zero imports, zero reminders are short enough to skip the full block but a hint line is fine).
- **H4. Interactive states.** Add `press-feedback` class to every tappable card and button (integration rows, module rows, reminder rows, ImportCard, myAH Import Records, Export, Refresh, Index All, Add Reminder). Add hover lift via inline on-hover `boxShadow` fallback or rely on `transition-all` class. Since we should prefer tokens, use an on-hover bg-shift within card styles.
- **H5. Raw hex to tokens.** Replace `#E8F5E9`/`#2E7D32` (connected) with `var(--accent-sage-muted)` + `var(--accent-sage)`. Replace `#FFEBEE`/`#C62828` (error) with muted red-tinted token (or fall back to cream + text-secondary for a softer read). Replace `#FFF3E0`/`#E65100` (amber) with a consistent amber using `rgba(244, 196, 48, 0.12)` bg and `rgb(180, 130, 40)` text or similar; keep it gentle.
- **H6. Boxshadow on toggle knob.** Replace `boxShadow: '0 1px 3px rgba(0,0,0,0.15)'` with `var(--shadow-sm)`.

### Medium

- **M1. Group integrations visually.** Optionally cluster the 8 devices into categories (Wearables / CGM / Scale / Medical) with small subheaders, but only if it doesn't bloat the component. If not adding subheaders, keep as-is but stable.
- **M2. Generate Clinical Report border.** Add `1px solid var(--border-light)` so the neutral button is visible against the card.
- **M3. UniversalImport container.** Wrap with a container that visually cues drag state with a soft sage-tinted outline on hover-of-section-card. (Cannot modify UniversalImport itself.)
- **M4. ImportCard hover/drag.** Although ImportCard is a `<label>` wrapping an `<input type="file">`, we can style it so hover lifts slightly and the dashed border becomes sage on hover.
- **M5. AI Knowledge stat table.** Mark value cells with `.tabular` and align right in a grid.

### Polish

- **P1. Press-feedback animation** on every button and card.
- **P2. Shimmer-bar** at the top of containers during sync/load instead of Loader2.
- **P3. Sage checkmark badge** for connected integrations (small 18px circle with tick) instead of the green text "Connected" pill if we want to go cleaner, but the contract mentions either pattern is acceptable.

## Deferred (outside my lane)

- `UniversalImport` component (in `src/components/import/`) — dropzone hover/drag visuals live there. I can only style the enclosing SectionCard.
- Global CSS additions (any) — forbidden by §17.
- `globals.css` shadow tokens and motion curves already exist; I am reusing them.
- `LoadingSpinner.tsx` used by `loading.tsx`. That file is outside settings so I will replace it with skeleton markup local to `/settings` instead of editing the shared component. Actually per the constraint the skeleton lives in `src/app/settings/loading.tsx` which is in my lane; I can replace the spinner with a skeleton there directly.
