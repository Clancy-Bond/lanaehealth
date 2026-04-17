# Import fixtures (W3.6)

Small, realistic, non-PII sample files for every importer. Used by
integration tests so a regression in parsing + dedup is caught in CI.

## Fixtures

| File | Importer | Notes |
|---|---|---|
| `mynetdiary-sample.csv` | `/api/import/mynetdiary` | 3 rows across 2 days. Covers the dedup-by-normalized-key path. |
| `natural-cycles-sample.csv` | `/api/import/natural-cycles` | 5 days including menstruation + spotting rows. |
| `apple-health-sample.xml` | `/api/import/apple-health` | Minimal HKWorkout + HKDailyStepCount + HKHeartRate records. |
| `oura-sleep-sample.json` | `src/lib/integrations/oura` | 2 nights of sleep detail. |

## Usage pattern

Tests import the fixture path from `tests/fixtures/imports/` via
`fs.readFile` and feed it to the importer's parser. The parser should
never call out to the network in tests; mock the HTTP layer.

Rotation policy: fixtures should be updated whenever the upstream
format changes. Each fixture is a synthesized sample, not a real
Lanae export -- no PII inside.
