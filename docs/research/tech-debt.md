# Tech Debt Inventory

Living register of TODO/FIXME comments tied to the source. Each entry
points back to the code so the comment stays close to the line where the
work happens. This file exists so we can scan the open follow-ups in one
place without spelunking through grep.

Voice rules apply: short, kind, explanatory. No em-dashes.

## Open

### `src/lib/doctor/specialist-config.ts:36`
LEARNING MODE CONTRIBUTION: bucketWeights for the PCP / OB-GYN /
Cardiology specialist briefs are best-guess defaults. Adjust as Lanae
sees more visits and learns which buckets each specialist actually
reads first. Override behavior is by design; flagging here so future
sessions know the values are tunable.

### `src/lib/observability/sentry-scrubber.ts:19`
PRODUCTIZATION: scrubber is defense in depth, not a HIPAA control. When
the app opens to additional users, upgrade to a Sentry plan with a
signed BAA or self-host Sentry. Until then the scrubber + Lanae being
sole user is the acceptable-risk posture.

### `src/app/v2/calories/health/heart-rate/_components/HRSparkline.tsx:14`
PRODUCT: consider a two-series chart splitting resting vs. standing
once enough standing points accumulate. Standing delta is the
POTS-load-bearing signal. Single-series today because the context mix
is sparse.

### `src/app/v2/calories/health/blood-pressure/_components/BPSparkline.tsx:12`
PRODUCT: if BP trends settle inside a narrow band and the [50, 200]
window makes movement hard to see, switch to a per-user adaptive
domain (e.g. [median - 30, median + 30], clamped to a clinical safe
range). Fixed window kept for now so screenshots compare across dates.

## Resolved

(None yet. When a TODO ships, move its entry here with the PR/commit
sha.)
