---
date: 2026-04-16
agent: R4
area: claude-grounding
status: FAIL
severity: MEDIUM
verification_method: static-analysis
---

# Dizziness topic detection misses neuro and cardiovascular summaries

## One-sentence finding
A user query containing "dizziness" or "dizzy" matches no topic other than the baseline `last_90_days`, so Claude never receives the POTS / presyncope / orthostatic micro-summaries that would be most relevant.

## Expected
"Dizziness" is a POTS and presyncope signal. Expected matches:
- `cv_orthostatic` (Orthostatic Vital Signs)
- `neuro_presyncope` (Presyncope and Syncope Episodes)

## Actual
`src/lib/context/summary-prompts.ts`:
- `cv_orthostatic.keywords` = `['standing', 'orthostatic', 'pots', 'tilt', 'positional']` -- no dizziness
- `neuro_presyncope.keywords` = `['presyncope', 'syncope', 'faint', 'blackout', 'vision']` -- no dizziness

`detectRelevantTopics("dizziness")` returns only `['last_90_days']`.

This is finding #4 from Session 1's final report, confirmed here by static inspection:
> `topicDetection.dizziness_has_neuro: false`
> `topicDetection.dizziness_has_cv: false`

## Verification evidence
```bash
$ grep -rn "dizz" src/lib/context/
(no matches)
```

Call chain:
- `assembler.ts:213` `detectRelevantTopics(userQuery).slice(0, MAX_SUMMARIES_DEFAULT)`
- `summary-engine.ts:317-338` iterates SUMMARY_TOPICS looking for keyword includes.
- No keyword list contains "dizz".

## Recommended action
FIX: add keywords to both topics. Diff:

```diff
 cv_orthostatic: {
   name: 'Orthostatic Vital Signs',
   maxTokens: 800,
   dataSources: ['oura_daily', 'daily_logs', 'symptoms'],
-  keywords: ['standing', 'orthostatic', 'pots', 'tilt', 'positional'],
+  keywords: ['standing', 'orthostatic', 'pots', 'tilt', 'positional', 'dizzy', 'dizziness', 'lightheaded', 'lightheadedness'],
 },
```

```diff
 neuro_presyncope: {
   name: 'Presyncope and Syncope Episodes',
   maxTokens: 800,
   dataSources: ['symptoms', 'daily_logs'],
-  keywords: ['presyncope', 'syncope', 'faint', 'blackout', 'vision'],
+  keywords: ['presyncope', 'syncope', 'faint', 'blackout', 'vision', 'dizzy', 'dizziness', 'lightheaded'],
 },
```

Add test: assert `detectRelevantTopics('I feel dizzy')` returns a set that contains at least `cv_orthostatic` and `neuro_presyncope`. Also wire the `/api/context/test` dizziness cases to PASS after the change.
