---
date: 2026-04-16
agent: R5
area: mutations
status: FLAGGED
severity: HIGH
verification_method: static-analysis
---

# Mutation-endpoint static audit

Scope: every POST/PUT/DELETE/PATCH under `src/app/api/`. Read-only static analysis. No endpoint was invoked. Auth context: app is single-patient, local-only, so the absence of per-user auth is acceptable per Session 2 contract. The concern is data integrity, validation, and idempotency.

## Totals
- 36 mutation handlers across 33 files
  - POST: 31
  - PUT: 3 (narrative, profile, preferences)
  - PATCH: 1 (appointments/[id])
  - DELETE: 2 (chat/history, push/subscribe)

## Endpoint matrix

| # | Path | Method | Req body (abridged) | Response | DB tables written | Validates? | Guards data loss? | Notes |
|--:|---|---|---|---|---|---|---|---|
| 1 | /api/onboarding | POST | `{conditions, goals, active_sections, custom_trackables_created?, other_condition?}` | `{data}` | user_onboarding (INSERT or UPDATE) | yes, 400 on missing | yes, upsert semantics safe | |
| 2 | /api/transcribe | POST | multipart audio | `{text}` | none | yes | n/a | external OpenAI call |
| 3 | /api/timeline | POST | `{event_date, event_type, title, description?, significance?}` | `{event}` | medical_timeline (INSERT) | yes, enum-checked | add-only | |
| 4 | /api/import/apple-health | POST | multipart xml | `{success, counts, errors}` | nc_imported UPSERT, cycle_entries UPSERT, daily_logs INSERT, food_entries DELETE+INSERT, oura_daily INSERT/UPDATE | basic | **partial** - see H1 | deletes food_entries matching `Daily total:%` then re-inserts; source-merge for oura |
| 5 | /api/import/universal (parse) | POST | multipart or json | `{phase:review,...}` | none | yes 400 | n/a | detection phase only |
| 5b | /api/import/universal (confirm, internal) | POST `action:confirm` | `{records: CanonicalRecord[]}` | `{saved, errors}` | lab_results UPSERT, medical_timeline INSERT, active_problems UPSERT, appointments UPSERT, health_profile UPSERT, medical_narrative INSERT | minimal | **see H2** | writes `medical_timeline` using column `date` but `/api/timeline` POST and Session 1 audit note the column is `event_date`; potential schema mismatch crash or silent write to wrong column |
| 6 | /api/import/natural-cycles | POST | multipart csv | `{success, imported, dateRange}` | nc_imported UPSERT onConflict=date | basic | upsert idempotent | |
| 7 | /api/import/mynetdiary | POST | multipart csv | `{success, imported}` | daily_logs INSERT, food_entries INSERT | basic | **see L1** | no dedupe on food_entries -- repeat runs create duplicate meals |
| 8 | /api/import/myah | POST | multipart pdf OR json `{type,action,rawText?,records?}` | parse/import mix | lab_results INSERT, appointments INSERT, health_profile UPSERT, medical_timeline INSERT, medical_narrative INSERT | basic enum check | **see M1 and H3** | medications path writes `medical_timeline.event_date` column (correct) but overwrites `health_profile.medications.current_medications` via concat without full round-trip check; additional imports can push silent duplicates after the lowercase substring match |
| 9 | /api/sync | POST | none | `{synced, results[]}` | via integrations/hub per-integration | n/a | n/a | fans out to connectors |
| 10 | /api/weather | POST | `{start_date, end_date}` | `{success, inserted, skipped}` | weather_daily UPSERT onConflict=date | yes 400 | upsert idempotent | |
| 11 | /api/narrative/weekly | POST | none | `{content, generatedAt, stale:false}` | medical_narrative UPSERT onConflict=section_title | none | idempotent by section_title | external Claude call |
| 12 | /api/analyze/correlations | POST | none | `{totalTests, passingFDR, topFindings, correlations}` | correlation_results DELETE-all + INSERT chunked | none | **see H4** | blanket delete of every row where `computed_at IS NOT NULL` before insert; if Claude/stat pipeline later errors, previous findings are gone |
| 13 | /api/narrative | PUT | `{section_title, content, section_order}` | `{success}` | medical_narrative UPSERT onConflict=section_title | yes 400 | idempotent | |
| 14 | /api/admin/apply-migration-011 | POST | none, Bearer service key | `{status}` | cycle_entries ALTER via rpc (exec_sql) | auth-gated | **see M2** | uses raw SQL `exec_sql`; migration uses `ADD COLUMN IF NOT EXISTS` so safe, but depends on an rpc that may not exist |
| 15 | /api/chat/history | DELETE | none | `{success}` | **chat_messages DELETE ALL** | none | **see H5** | deletes all rows with `neq id <zero-uuid>`; no confirmation, no archive; single call erases the entire chat history |
| 16 | /api/preferences | PUT | partial prefs | `{success}` | user_preferences (via savePreferences) | no per-field | partial | swaps modules and archetype wholesale; depends on savePreferences internals |
| 17 | /api/food/identify | POST | `{image, mediaType}` | `{foods, mealDescription, totalCalories}` | none | basic | n/a | Claude Vision + USDA lookup, read-only |
| 18 | /api/chat | POST | `{message}` | `{response, toolsUsed}` | chat_messages INSERT (×2) | yes 400 | append-only | |
| 19 | /api/labs | POST | `LabInput` OR `{results[], source?}` | `{success, result(s), count}` | lab_results INSERT, medical_timeline INSERT | basic | **see L2** | no dedupe on `(date, test_name)`; repeat batch creates duplicates |
| 20 | /api/push/send | POST | Bearer CRON_SECRET | `{sent, skipped, failed}` | push_subscriptions UPDATE (last_sent_at or enabled=false) | auth-gated | idempotent by fire-window guard | |
| 21 | /api/imaging | POST | `{study_date, modality, body_part, ...}` | `{study}` | imaging_studies INSERT, medical_timeline INSERT | yes enum | no dedupe | timeline error is swallowed with `console.error` (intentional per comment) |
| 22 | /api/profile | PUT | `{section, content}` | `{success}` | health_profile UPSERT onConflict=section | basic | **see H6** | stringifies `content` before upsert (`JSON.stringify`); but other writers (e.g. import/universal) upsert `content` as a JS object. Mixed jsonb vs string shapes could break downstream readers |
| 23 | /api/labs/scan | POST | `{image, mediaType}` | `{results, count}` | none | yes 400/422 | n/a | OCR only, no DB write |
| 24 | /api/context/dream | POST | none | `{DreamResult}` | context_summaries UPSERT, health_embeddings UPSERT (batch) | none | idempotent by topic key | |
| 25 | /api/intelligence/analyze | POST | `{mode, reason, target_appointment?}` | `{success, personas_run, ...}` | intelligence_kb_documents UPSERT (many), hypothesis_records UPSERT | yes 400 enum | **see M3** | long-running Claude pipeline, no atomic rollback. If later personas fail, earlier writes are persisted with partial state |
| 26 | /api/oura/disconnect | POST | none | `{success}` | oura_tokens DELETE ALL | none | **see H7** | `disconnectOura()` does `.delete().neq('id', zero-uuid)` on `oura_tokens` |
| 27 | /api/intelligence/vitals | POST | `{supineHR, standingHR, supineBP?, standingBP?}` | orthostatic result | vitals_orthostatic INSERT (via saveOrthostaticResult) | basic | add-only | |
| 28 | /api/context/sync | POST | `{full?, start?, end?}` | `{synced, stats}` | health_embeddings UPSERT + sync-pipeline deletes by date before upsert | none | idempotent by content_id, but internally `deleteByDate` removes per-day before re-writing | |
| 29 | /api/context/assemble | POST | `{query, doctorMode?}` | `{systemPrompt, ...}` | none | yes 400 | n/a | read-only |
| 30 | /api/oura/sync | POST | `{start_date?, end_date?}` | `{success, synced_days}` | oura_daily UPSERT onConflict=date | optional | **see H8** | UPSERT without merge: the `raw_json` field is fully replaced. Previous Apple Health merged sub-payloads can be clobbered on next Oura sync |
| 31 | /api/push/subscribe | POST | `{endpoint, keys, morningTime?, eveningTime?, timezone?}` | `{ok, id}` | push_subscriptions UPSERT onConflict=endpoint | yes 400 | idempotent | |
| 32 | /api/push/subscribe | DELETE | `?endpoint=` | `{ok}` | push_subscriptions DELETE by endpoint | yes 400 | scoped DELETE | |
| 33 | /api/integrations/[id]/sync | POST | `{startDate?, endDate?}` | connector result | varies per connector | none | depends on connector | |
| 34 | /api/appointments/[id] | PATCH | `{notes?, action_items?, follow_up_date?}` | `{success}` | appointments UPDATE | yes 400 | field-allowlist | safe partial |
| 35 | /api/integrations/[id]/disconnect | POST | none | `{success}` | integration_tokens DELETE by integration_id | params only | scoped DELETE | message explicitly notes imported data is kept |
| 36 | /api/context/summaries | POST | none | `{message, results}` | context_summaries UPSERT (many) | none | idempotent | |

## HIGH severity concerns

- **H1**: `/api/import/apple-health` does a *delete-then-insert* on `food_entries` matching `food_items ILIKE 'Daily total:%'` (lines 164-169). If another importer ever writes a `Daily total:%` string (for example the mynetdiary importer that uses free-form text), reruns silently delete those rows. The filter is also by `meal_type='snack'` which overlaps with normal snack entries whose text happens to start with "Daily total:". See separate finding.
- **H2**: `/api/import/universal` `handleConfirm` switch case for `medication`, `immunization`, `procedure`, and default writes to `medical_timeline.date` (fields `date`, `event_type`, `title`, `description`, `significance`, `source`). Per Session 1's fix log, the column is `event_date`, not `date`. This will either 500 or silently write to the wrong column. See separate finding.
- **H3**: `/api/import/myah` `importMedications` mutates a jsonb array in `health_profile(section=medications)` using case-insensitive `includes` which is lossy and will merge distinct meds whose names share a substring. The function also does `imported = 0 // rollback count` on failure, but the earlier data was already computed and the DB write was attempted; the count rollback is cosmetic. See separate finding.
- **H4**: `/api/analyze/correlations` deletes every `correlation_results` row with `computed_at IS NOT NULL` before inserting the new run. If the re-insert errors mid-chunk (chunkSize=50), the dashboard is left partially populated or empty. No transaction wrapper. See separate finding.
- **H5**: `/api/chat/history` DELETE wipes the entire `chat_messages` table in one call, with no confirmation, no archive, and no scoping. Single click destroys the conversation corpus that feeds compaction, handoff, and session continuity. See separate finding.
- **H6**: `/api/profile` PUT UPSERTs `content: JSON.stringify(body.content)` into `health_profile`. Other code paths (universal importer, myah importer) write `content` as a JS object. If `health_profile.content` is a `jsonb` column, a double-encoded string is stored instead of structured data; downstream readers (e.g. `(profile?.content as Record<…>)?.items`) will get `undefined`. See separate finding.
- **H7**: `/api/oura/disconnect` calls `disconnectOura()` which issues `.delete().neq('id', zero-uuid)` on `oura_tokens`. This removes *all* Oura tokens with no scope. Acceptable in single-patient mode but worth flagging because the pattern is copy-pasted in several places and has no guard if the schema ever becomes multi-patient.
- **H8**: `/api/oura/sync` UPSERT onConflict=date where the row's `raw_json` is fully replaced on every sync. If `oura_daily` was previously merged with Apple Health data (per `/api/import/apple-health` line 264, `raw_json: { ...existing.raw_json, apple_health: row.raw_json }`), the next Oura sync overwrites the merged envelope. Apple Health imports become invisible. See separate finding.

## MEDIUM severity concerns

- **M1**: `/api/import/myah` silently treats error.code `23505` (unique violation) as `skipped++` for labs, appointments. That is fine, but any other error is pushed to `errors[]` and still returns 200. The client only knows about failures if it inspects the `errors` array. Same pattern in `/api/import/universal` via `errors.push(...)`.
- **M2**: `/api/admin/apply-migration-011` relies on an `exec_sql` RPC that is not guaranteed to exist. When absent, returns SQL text and a dashboard URL to paste manually. This is safe but fragile -- no telemetry of whether the column was actually applied; only a probe select. Acceptable for one-off admin use.
- **M3**: `/api/intelligence/analyze` runs 6 Claude-based personas in sequence, each writing to `intelligence_kb_documents` as it finishes. No transaction; no rollback. A failure halfway through leaves partial documents in the KB, which subsequent reads will treat as current-state.

## LOW severity concerns

- **L1**: `/api/import/mynetdiary` has no dedupe -- repeat uploads of the same CSV produce duplicate `food_entries` rows.
- **L2**: `/api/labs` single-insert path does not check for an existing `(date, test_name)` pair. Duplicate submissions create duplicate lab results. The batch path also just INSERTs without upsert.
- **L3**: `/api/import/apple-health` does `await upsertBiometrics(...)` but never awaits `await supabase.from('cycle_entries').upsert(...)` inside the main loop -- it fires it but does not catch its error into `results.errors`. Errors are silently swallowed.
- **L4**: `/api/food/identify` catches USDA lookup failures with `catch {}` (line 124). A legit error in the fetch will be dropped.

## Data-loss-resistance summary

| Table | Risky endpoints | Kind |
|---|---|---|
| correlation_results | /api/analyze/correlations | blanket DELETE before re-insert |
| chat_messages | /api/chat/history DELETE | wipe all |
| oura_tokens | /api/oura/disconnect | wipe all |
| integration_tokens | /api/integrations/[id]/disconnect | scoped DELETE |
| push_subscriptions | /api/push/subscribe DELETE | scoped DELETE |
| health_embeddings | /api/context/sync (internal deleteByDate) | scoped DELETE-then-INSERT |
| food_entries | /api/import/apple-health | scoped DELETE-then-INSERT for "Daily total:%" snack rows |
| oura_daily | /api/oura/sync | UPSERT overwriting `raw_json` merged content |
| health_profile | /api/profile PUT vs importers | competing shapes (string vs object) can corrupt jsonb content |
| medical_timeline | /api/import/universal handleConfirm | writes non-existent `date` column |

No endpoint issues an unqualified TRUNCATE. All destructive operations are either scoped by filter, or gated by auth (push/send, apply-migration-011).
