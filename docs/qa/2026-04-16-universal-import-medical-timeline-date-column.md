---
date: 2026-04-16
agent: R5
area: mutations
status: FLAGGED
severity: HIGH
verification_method: static-analysis
---

# `/api/import/universal` writes non-existent `medical_timeline.date` column

## One-sentence finding
Four branches of the confirm-phase writer use `date:` instead of `event_date:` when inserting into `medical_timeline`, which will either 500 or silently miss the real date column (echoing the Session 1 bug fix log that established the column is `event_date`).

## Expected
All writers to `medical_timeline` should use `event_date`, matching `/api/timeline` POST and the Session 1 column-rename fix that hit three other files.

## Actual
`src/app/api/import/universal/route.ts` contains four insert blocks using `date`:

- line 142-149 (case `medication`): `.insert({ date: record.date, event_type: 'medication_change', ... })`
- line 207-214 (case `immunization`): `.insert({ date: record.date, event_type: 'test', ... })`
- line 221-229 (case `procedure`): `.insert({ date: record.date, event_type: 'test', ... })`
- line 267-274 (default): `.insert({ date: record.date, event_type: 'test', ... })`

By contrast, `/api/timeline/route.ts` POST (line 89) correctly uses `event_date`. The Session 1 report (`2026-04-16-medical-timeline-column-name.md`) confirms the column name is `event_date`.

The `/api/import/myah` path also has an inline `medical_timeline` insert at line 431-437 that correctly uses `event_date`.

## Verification evidence
Static read of route.ts. Compared to final-report.md fix log.

## Recommended action
- FIX: rename `date:` to `event_date:` in all four insert blocks above. Add a `source` column check -- the patch inserts `source: \`import_${record.source.format}\`` but the target table may not have a `source` column (verify in schema).

Related finding candidates for follow-up:
- Check whether the test suite covers the universal confirm path with each `record.type`. If no test, add one per case.
