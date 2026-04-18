---
date: 2026-04-17
status: FIXED
severity: MEDIUM
areas: [privacy, context-gating, settings]
---

# Migration 025 (privacy_prefs) not applied in live DB

## Discovery
Hunted for other unapplied migrations by diffing `grep -rhE "\.from\(['\"]"` referenced table names against live `/api/admin/peek` responses. 12 unfamiliar tables probed; `privacy_prefs` was the only miss.

## Impact
Three code paths depend on `privacy_prefs`:
- `src/lib/context/assembler.ts` — reads `allow_claude_context` to gate the entire dynamic context block for Claude API calls.
- `src/lib/intelligence/correlations.ts` (indirect) — reads `allow_correlation_analysis`.
- `src/app/settings/privacy/page.tsx` + `src/components/settings/PrivacySettings.tsx` — reads row to render toggle state.

Each path has a graceful-default-to-true fallback when the row/table is missing, so no user-facing 500. But the settings page won't persist toggles and the privacy gates are moot.

## Applied
```sql
CREATE TABLE IF NOT EXISTS privacy_prefs (
  patient_id text PRIMARY KEY DEFAULT 'lanae',
  allow_claude_context boolean NOT NULL DEFAULT true,
  allow_correlation_analysis boolean NOT NULL DEFAULT true,
  retain_history_beyond_2y boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO privacy_prefs (patient_id) VALUES ('lanae') ON CONFLICT DO NOTHING;
```

## Verification
```
$ curl https://lanaehealth.vercel.app/api/admin/peek?table=privacy_prefs
{"count":1,"sample":[{"patient_id":"lanae","allow_claude_context":true,"allow_correlation_analysis":true,"retain_history_beyond_2y":true,"updated_at":"2026-04-18T01:48:38.327094+00:00"}]}
```

Seed row present, toggles default true (matches pre-migration app behavior). Settings page now persists toggle changes.

## Broader audit outcome
11 other unfamiliar tables probed return 200 from peek: clinical_scale_responses, custom_trackable_entries, custom_trackables, gratitude_entries, hypothesis_evidence, import_history, medication_reminders, mood_entries, sleep_details, user_onboarding, user_preferences. All applied; no further migrations needed from the current `src/lib/migrations/` inventory.
