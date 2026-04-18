---
date: 2026-04-17
status: FIXED
severity: MEDIUM
areas: [migrations, share-links, symptom-tagging, prn-polling]
---

# Three more unapplied migrations: 018, 019, 022

## Discovery
After all Session 2 QA work shipped, peeking the tables the parallel session's code expected surfaced 500s:

```bash
curl https://lanaehealth.vercel.app/api/admin/peek?table=symptom_conditions   # 500 "schema cache"
curl https://lanaehealth.vercel.app/api/admin/peek?table=share_tokens         # 500 "schema cache"
curl https://lanaehealth.vercel.app/api/admin/peek?table=prn_dose_events      # 500 "schema cache"
```

Same pattern as 014-021: SQL committed to `src/lib/migrations/` but never applied against live Supabase. Zero destructive ops across all three, all `IF NOT EXISTS` guarded.

## Applied (via Chrome + Supabase SQL editor)

- `symptom_conditions` (migration 018): junction table tagging `symptoms` rows with `active_problems`. Powers the specialist toggle in `/doctor` so an OB/GYN sees pelvic-tagged symptoms while cardiology sees POTS-tagged.
- `share_tokens` (migration 019): backs the Care Card public share-link feature with time-limited, optionally one-time tokens.
- `prn_dose_events` (migration 022): Wave 2e PRN post-dose efficacy polling. Tri-state response (helped / no_change / worse) with NULL meaning "ignored", per the non-shaming voice rule in CLAUDE.md.

## Verification
All three now return 200 from `peek`:
```
symptom_conditions         200  {"count":0,"sample":[]}
share_tokens               200  {"count":0,"sample":[]}
prn_dose_events            200  {"count":0,"sample":[]}
```

## Also in this session
- `tests/fixtures/imports/apple-health-sample.xml` and `oura-sleep-sample.json` added. Completes the W3.6 importer-fixture set (MyNetDiary + NaturalCycles + Apple Health + Oura).
- `npm run check:voice` passes clean on all 206 files.
