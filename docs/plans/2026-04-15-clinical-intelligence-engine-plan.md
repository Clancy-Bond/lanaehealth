# Clinical Intelligence Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 3-layer context engine with a 6-persona clinical intelligence system that maintains evolving hypotheses, prevents anchoring bias, and reasons across all body systems using formal evidence scoring.

**Architecture:** Background clinical analysis (6 personas with independent DB access) writes to a Knowledge Base in Supabase. Real-time chat reads from the KB + raw data tools. Formal evidence scoring replaces LLM probability estimates. IFM Matrix organizes cross-system connections. See `docs/plans/2026-04-15-clinical-intelligence-engine-design.md` for full design.

**Tech Stack:** Next.js 16, TypeScript, Supabase (PostgreSQL + pgvector), Claude Sonnet 4.6 API, Zod validation, Vitest for testing

---

## Phase 1: Foundation (DB Schema + Data Validation + Types)

Builds the data layer everything else depends on: the `clinical_knowledge_base` table, TypeScript types, data validation functions, evidence scoring primitives, and KB CRUD operations.

---

### Task 1: Add Vitest and Zod to Project

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/smoke.test.ts`

**Step 1: Install dependencies**

Run:
```bash
cd /Users/clancybond/lanaehealth && npm install --save zod && npm install --save-dev vitest @vitest/coverage-v8
```

**Step 2: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

**Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Write smoke test**

Create `src/lib/__tests__/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('smoke test', () => {
  it('vitest is configured correctly', () => {
    expect(1 + 1).toBe(2)
  })
})
```

**Step 5: Run test to verify setup**

Run: `cd /Users/clancybond/lanaehealth && npm test`
Expected: 1 test passes

**Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/__tests__/smoke.test.ts
git commit -m "chore: add vitest and zod for testing and validation"
```

---

### Task 2: Create clinical_knowledge_base Migration

**Files:**
- Create: `src/lib/migrations/003-clinical-knowledge-base.sql`
- Create: `src/lib/migrations/run-003-clinical-kb.mjs`

**Step 1: Write the migration SQL**

Create `src/lib/migrations/003-clinical-knowledge-base.sql`:
```sql
-- Clinical Intelligence Engine: Knowledge Base table
-- Stores pre-computed clinical analysis documents written by the 6 persona system

CREATE TABLE IF NOT EXISTS clinical_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(100) UNIQUE NOT NULL,
  document_type VARCHAR(30) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  covers_date_start DATE,
  covers_date_end DATE,
  token_count INTEGER,
  is_stale BOOLEAN DEFAULT FALSE
);

-- Fast lookups by type and staleness
CREATE INDEX IF NOT EXISTS idx_kb_document_id ON clinical_knowledge_base(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_type ON clinical_knowledge_base(document_type);
CREATE INDEX IF NOT EXISTS idx_kb_stale ON clinical_knowledge_base(is_stale) WHERE is_stale = TRUE;
CREATE INDEX IF NOT EXISTS idx_kb_generated ON clinical_knowledge_base(generated_at DESC);

-- Evidence items table: structured evidence for hypothesis scoring
CREATE TABLE IF NOT EXISTS hypothesis_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_id VARCHAR(100) NOT NULL,
  finding TEXT NOT NULL,
  source_table VARCHAR(50) NOT NULL,
  source_date DATE,
  source_reliability REAL NOT NULL DEFAULT 1.0,
  supports BOOLEAN NOT NULL,
  clinical_weight REAL NOT NULL DEFAULT 1.0,
  fdr_corrected BOOLEAN DEFAULT FALSE,
  meets_criteria_rule BOOLEAN DEFAULT FALSE,
  is_anchored BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_hypothesis ON hypothesis_evidence(hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source ON hypothesis_evidence(source_table, source_date);

-- Data validation flags: suspicious entries flagged for review
CREATE TABLE IF NOT EXISTS data_validation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table VARCHAR(50) NOT NULL,
  source_id UUID,
  source_date DATE,
  flag_type VARCHAR(30) NOT NULL,
  field_name VARCHAR(50),
  original_value TEXT,
  expected_range TEXT,
  severity VARCHAR(20) DEFAULT 'warning',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flags_unresolved ON data_validation_flags(resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_flags_source ON data_validation_flags(source_table, source_date);

COMMENT ON TABLE clinical_knowledge_base IS 'Pre-computed clinical analysis documents from the 6-persona intelligence engine';
COMMENT ON TABLE hypothesis_evidence IS 'Structured evidence items used for deterministic hypothesis scoring';
COMMENT ON TABLE data_validation_flags IS 'Flagged data entries that need user review (anomalies, range violations)';
```

**Step 2: Create the migration runner**

Create `src/lib/migrations/run-003-clinical-kb.mjs`:
```javascript
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const sql = readFileSync(join(__dirname, '003-clinical-knowledge-base.sql'), 'utf-8')
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    console.log(`Running: ${statement.substring(0, 60)}...`)
    const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
    if (error) {
      // Try direct query if rpc not available
      const { error: directError } = await supabase.from('_migrations').select('*').limit(0)
      if (directError) {
        console.error('Error:', error.message)
        console.log('You may need to run this SQL directly in the Supabase SQL editor.')
      }
    }
  }
  console.log('Migration 003 complete.')
}

run().catch(console.error)
```

**Step 3: Run migration against Supabase**

Run the SQL directly in Supabase SQL editor (safest for production data).
Verify tables exist:
```bash
cd /Users/clancybond/lanaehealth && node -e "
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('clinical_knowledge_base').select('id').limit(0).then(r => console.log('KB table:', r.error ? 'MISSING' : 'OK'));
s.from('hypothesis_evidence').select('id').limit(0).then(r => console.log('Evidence table:', r.error ? 'MISSING' : 'OK'));
s.from('data_validation_flags').select('id').limit(0).then(r => console.log('Flags table:', r.error ? 'MISSING' : 'OK'));
"
```

**Step 4: Commit**

```bash
git add src/lib/migrations/003-clinical-knowledge-base.sql src/lib/migrations/run-003-clinical-kb.mjs
git commit -m "feat: add clinical_knowledge_base, hypothesis_evidence, and data_validation_flags tables"
```

---

### Task 3: Create TypeScript Types for the Intelligence Engine

**Files:**
- Create: `src/lib/intelligence/types.ts`
- Test: `src/lib/__tests__/intelligence-types.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/intelligence-types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  type EvidenceItem,
  type HypothesisRecord,
  type KBDocument,
  type DataReliability,
  type ConfidenceCategory,
  DATA_RELIABILITY,
  computeTimeDecay,
  getConfidenceCategory,
  computeHypothesisScore,
} from '../intelligence/types'

describe('intelligence types', () => {
  describe('computeTimeDecay', () => {
    it('returns ~1.0 for today', () => {
      const decay = computeTimeDecay(0)
      expect(decay).toBeCloseTo(1.0, 1)
    })

    it('returns ~0.74 for 30 days old', () => {
      const decay = computeTimeDecay(30)
      expect(decay).toBeCloseTo(0.74, 1)
    })

    it('returns floor of 0.3 for very old data', () => {
      const decay = computeTimeDecay(365)
      expect(decay).toBe(0.3)
    })

    it('returns 1.0 for anchored findings regardless of age', () => {
      const decay = computeTimeDecay(365, true)
      expect(decay).toBe(1.0)
    })
  })

  describe('getConfidenceCategory', () => {
    it('returns ESTABLISHED for scores >= 80', () => {
      expect(getConfidenceCategory(85)).toBe('ESTABLISHED')
    })

    it('returns PROBABLE for 60-79', () => {
      expect(getConfidenceCategory(65)).toBe('PROBABLE')
    })

    it('returns POSSIBLE for 40-59', () => {
      expect(getConfidenceCategory(45)).toBe('POSSIBLE')
    })

    it('returns SPECULATIVE for 20-39', () => {
      expect(getConfidenceCategory(25)).toBe('SPECULATIVE')
    })

    it('returns INSUFFICIENT for < 20', () => {
      expect(getConfidenceCategory(10)).toBe('INSUFFICIENT')
    })
  })

  describe('computeHypothesisScore', () => {
    it('scores higher with more supporting evidence', () => {
      const supporting: EvidenceItem[] = [
        { finding: 'TSH 6.2', source_table: 'lab_results', source_date: new Date().toISOString().split('T')[0], source_reliability: 1.0, supports: true, clinical_weight: 3.0, fdr_corrected: false, meets_criteria_rule: true, is_anchored: false },
        { finding: 'Fatigue worsening', source_table: 'daily_logs', source_date: new Date().toISOString().split('T')[0], source_reliability: 0.6, supports: true, clinical_weight: 1.5, fdr_corrected: false, meets_criteria_rule: false, is_anchored: false },
      ]
      const contradicting: EvidenceItem[] = []
      const score = computeHypothesisScore(supporting, contradicting)
      expect(score).toBeGreaterThan(50)
    })

    it('reduces score with contradicting evidence', () => {
      const supporting: EvidenceItem[] = [
        { finding: 'TSH 6.2', source_table: 'lab_results', source_date: new Date().toISOString().split('T')[0], source_reliability: 1.0, supports: true, clinical_weight: 3.0, fdr_corrected: false, meets_criteria_rule: true, is_anchored: false },
      ]
      const contradicting: EvidenceItem[] = [
        { finding: 'No goiter on exam', source_table: 'medical_timeline', source_date: new Date().toISOString().split('T')[0], source_reliability: 1.0, supports: false, clinical_weight: 2.0, fdr_corrected: false, meets_criteria_rule: false, is_anchored: false },
      ]
      const scoreWith = computeHypothesisScore(supporting, contradicting)
      const scoreWithout = computeHypothesisScore(supporting, [])
      expect(scoreWith).toBeLessThan(scoreWithout)
    })

    it('applies FDR penalty to non-corrected correlations', () => {
      const fdrCorrected: EvidenceItem[] = [
        { finding: 'Correlation A', source_table: 'correlation_results', source_date: '2026-01-01', source_reliability: 0.7, supports: true, clinical_weight: 2.0, fdr_corrected: true, meets_criteria_rule: false, is_anchored: false },
      ]
      const notCorrected: EvidenceItem[] = [
        { finding: 'Correlation B', source_table: 'correlation_results', source_date: '2026-01-01', source_reliability: 0.7, supports: true, clinical_weight: 2.0, fdr_corrected: false, meets_criteria_rule: false, is_anchored: false },
      ]
      const scoreFdr = computeHypothesisScore(fdrCorrected, [])
      const scoreNoFdr = computeHypothesisScore(notCorrected, [])
      expect(scoreFdr).toBeGreaterThan(scoreNoFdr)
    })
  })

  describe('DATA_RELIABILITY', () => {
    it('lab_results has highest reliability', () => {
      expect(DATA_RELIABILITY.lab_results).toBe(1.0)
    })

    it('food_entries has lower reliability', () => {
      expect(DATA_RELIABILITY.food_entries).toBeLessThan(DATA_RELIABILITY.lab_results)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/clancybond/lanaehealth && npx vitest run src/lib/__tests__/intelligence-types.test.ts`
Expected: FAIL - module not found

**Step 3: Write the types and scoring functions**

Create `src/lib/intelligence/types.ts`:
```typescript
/**
 * Clinical Intelligence Engine - Core Types and Scoring Functions
 *
 * Types for the Knowledge Base, Hypothesis Tracking, Evidence Scoring,
 * and Data Validation systems. Scoring uses deterministic math,
 * NOT LLM-generated probabilities.
 */

// ── Data Reliability ──────────────────────────────────────────────

export const DATA_RELIABILITY: Record<string, number> = {
  lab_results: 1.0,
  imaging_studies: 1.0,
  medical_timeline: 1.0,
  health_profile: 1.0,
  oura_daily: 0.7,
  daily_logs: 0.6,
  symptoms: 0.6,
  cycle_entries: 0.6,
  nc_imported: 0.6,
  food_entries: 0.5,
  correlation_results: 0.8,
} as const

export type DataReliability = typeof DATA_RELIABILITY

// ── Time Decay (Ebbinghaus Curve) ─────────────────────────────────

const TIME_DECAY_RATE = 0.01
const TIME_DECAY_FLOOR = 0.3

/**
 * Compute time-decay weight for a data point.
 * Recent data weighs ~1.0, old data decays to a floor of 0.3.
 * Anchored findings (e.g., confirmed diagnoses) always return 1.0.
 */
export function computeTimeDecay(daysOld: number, isAnchored = false): number {
  if (isAnchored) return 1.0
  return Math.max(TIME_DECAY_FLOOR, Math.exp(-TIME_DECAY_RATE * daysOld))
}

// ── Confidence Categories ─────────────────────────────────────────

export type ConfidenceCategory =
  | 'ESTABLISHED'
  | 'PROBABLE'
  | 'POSSIBLE'
  | 'SPECULATIVE'
  | 'INSUFFICIENT'

export function getConfidenceCategory(score: number): ConfidenceCategory {
  if (score >= 80) return 'ESTABLISHED'
  if (score >= 60) return 'PROBABLE'
  if (score >= 40) return 'POSSIBLE'
  if (score >= 20) return 'SPECULATIVE'
  return 'INSUFFICIENT'
}

// ── Evidence Item ─────────────────────────────────────────────────

export interface EvidenceItem {
  finding: string
  source_table: string
  source_date: string           // YYYY-MM-DD
  source_reliability: number    // 0.0 - 1.0
  supports: boolean             // true = supports hypothesis, false = contradicts
  clinical_weight: number       // pre-defined per finding type
  fdr_corrected: boolean        // for correlation-based evidence
  meets_criteria_rule: boolean  // deterministic medical criteria match
  is_anchored: boolean          // never decays (e.g., confirmed diagnosis)
}

// ── Hypothesis Scoring ────────────────────────────────────────────

const FDR_PENALTY = 0.5       // non-FDR-corrected correlations get half weight
const CRITERIA_BONUS = 1.5    // evidence matching deterministic criteria gets 1.5x

/**
 * Compute a hypothesis score from evidence items.
 * Uses deterministic math: weighted sum of supporting minus contradicting evidence.
 * Normalized to 0-100 scale.
 *
 * Formula per evidence item:
 *   weight = clinical_weight * source_reliability * time_decay
 *          * (fdr_corrected ? 1.0 : FDR_PENALTY)
 *          * (meets_criteria_rule ? CRITERIA_BONUS : 1.0)
 */
export function computeHypothesisScore(
  supporting: EvidenceItem[],
  contradicting: EvidenceItem[],
): number {
  const today = new Date()

  function itemWeight(e: EvidenceItem): number {
    const daysOld = Math.max(0, Math.floor(
      (today.getTime() - new Date(e.source_date).getTime()) / (1000 * 60 * 60 * 24)
    ))
    const decay = computeTimeDecay(daysOld, e.is_anchored)
    const fdrFactor = e.fdr_corrected ? 1.0 : FDR_PENALTY
    const criteriaFactor = e.meets_criteria_rule ? CRITERIA_BONUS : 1.0
    return e.clinical_weight * e.source_reliability * decay * fdrFactor * criteriaFactor
  }

  const supportSum = supporting.reduce((sum, e) => sum + itemWeight(e), 0)
  const contradictSum = contradicting.reduce((sum, e) => sum + itemWeight(e), 0)

  // Raw score: supporting minus contradicting
  const raw = supportSum - contradictSum

  // Normalize to 0-100 using sigmoid-like scaling
  // At raw=0 -> 50, positive raw -> higher, negative raw -> lower
  const maxPossible = Math.max(supportSum + contradictSum, 1) // prevent division by zero
  const normalized = 50 + (raw / maxPossible) * 50

  return Math.max(0, Math.min(100, Math.round(normalized)))
}

// ── Knowledge Base Document ───────────────────────────────────────

export type KBDocumentType =
  | 'chronicle'
  | 'micro_summary'
  | 'ifm_review'
  | 'hypothesis'
  | 'connection'
  | 'research'
  | 'completeness'
  | 'next_action'
  | 'conversation'
  | 'doctor_brief'
  | 'criteria_rules'

export interface KBDocument {
  id?: string
  document_id: string
  document_type: KBDocumentType
  title: string
  content: string
  version: number
  generated_at: string
  generated_by: string | null
  metadata: Record<string, unknown>
  covers_date_start: string | null
  covers_date_end: string | null
  token_count: number | null
  is_stale: boolean
}

// ── Hypothesis Record ─────────────────────────────────────────────

export interface HypothesisRecord {
  hypothesis_id: string
  name: string
  description: string
  score: number
  confidence: ConfidenceCategory
  direction: 'rising' | 'stable' | 'falling'
  systems_affected: string[]   // IFM node names
  supporting_evidence: EvidenceItem[]
  contradicting_evidence: EvidenceItem[]
  challenger_notes: string
  last_evaluated: string
  what_would_change: string[]
  alternative_explanations: string[]
}

// ── Data Validation ───────────────────────────────────────────────

export type FlagType = 'out_of_range' | 'sudden_jump' | 'impossible_value' | 'missing_data'

export interface ValidationFlag {
  source_table: string
  source_id?: string
  source_date: string
  flag_type: FlagType
  field_name: string
  original_value: string
  expected_range: string
  severity: 'warning' | 'error'
}

// ── IFM Matrix Nodes ──────────────────────────────────────────────

export const IFM_NODES = [
  'transport',           // cardiovascular, lymphatic
  'communication',       // endocrine, neurotransmitters
  'assimilation',        // digestion, absorption, GI
  'defense_and_repair',  // immune, inflammation
  'energy',              // mitochondrial, metabolic
  'structural_integrity', // musculoskeletal, membranes
  'biotransformation',   // detox, liver metabolism
] as const

export type IFMNode = typeof IFM_NODES[number]

// ── Persona Handoff Protocol ──────────────────────────────────────

export interface PersonaHandoff {
  persona: string
  findings: string[]
  data_quality: string
  delta: string
  handoff_message: string
}

// ── Analysis Trigger ──────────────────────────────────────────────

export type AnalysisMode = 'incremental' | 'standard' | 'full' | 'doctor_prep'

export interface AnalysisTrigger {
  mode: AnalysisMode
  reason: string
  new_data_tables?: string[]
  target_appointment?: string
}

// ── Chat Tier ─────────────────────────────────────────────────────

export type ChatTier = 'quick' | 'standard' | 'deep' | 'doctor_prep'
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/clancybond/lanaehealth && npx vitest run src/lib/__tests__/intelligence-types.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/intelligence/types.ts src/lib/__tests__/intelligence-types.test.ts
git commit -m "feat: add core types and evidence scoring for clinical intelligence engine"
```

---

### Task 4: Build Data Validation Layer

**Files:**
- Create: `src/lib/intelligence/data-validation.ts`
- Test: `src/lib/__tests__/data-validation.test.ts`

**Step 1: Write failing tests**

Create `src/lib/__tests__/data-validation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  validateHeartRate,
  validateHRV,
  validateTemperature,
  validatePainScore,
  detectSuddenJump,
  computeCompleteness,
  type ValidationResult,
} from '../intelligence/data-validation'

describe('data validation', () => {
  describe('validateHeartRate', () => {
    it('accepts normal HR', () => {
      expect(validateHeartRate(72).valid).toBe(true)
    })
    it('flags HR too low', () => {
      const result = validateHeartRate(20)
      expect(result.valid).toBe(false)
      expect(result.flag?.flag_type).toBe('out_of_range')
    })
    it('flags HR too high', () => {
      const result = validateHeartRate(250)
      expect(result.valid).toBe(false)
    })
    it('flags HR of 0 as impossible', () => {
      const result = validateHeartRate(0)
      expect(result.valid).toBe(false)
      expect(result.flag?.flag_type).toBe('impossible_value')
    })
  })

  describe('validatePainScore', () => {
    it('accepts 0-10', () => {
      expect(validatePainScore(5).valid).toBe(true)
    })
    it('flags negative', () => {
      expect(validatePainScore(-1).valid).toBe(false)
    })
    it('flags > 10', () => {
      expect(validatePainScore(11).valid).toBe(false)
    })
  })

  describe('detectSuddenJump', () => {
    it('detects a sudden jump in values', () => {
      const values = [50, 52, 48, 51, 50, 120] // last value is a jump
      const result = detectSuddenJump(values, 3)
      expect(result.isJump).toBe(true)
    })
    it('does not flag gradual changes', () => {
      const values = [50, 52, 55, 58, 61, 65]
      const result = detectSuddenJump(values, 3)
      expect(result.isJump).toBe(false)
    })
  })

  describe('computeCompleteness', () => {
    it('returns 100% when all days have data', () => {
      const result = computeCompleteness(30, 30)
      expect(result).toBe(100)
    })
    it('returns 50% when half days have data', () => {
      const result = computeCompleteness(15, 30)
      expect(result).toBe(50)
    })
    it('returns 0% when no data', () => {
      const result = computeCompleteness(0, 30)
      expect(result).toBe(0)
    })
  })
})
```

**Step 2: Run to verify fail**

Run: `cd /Users/clancybond/lanaehealth && npx vitest run src/lib/__tests__/data-validation.test.ts`
Expected: FAIL

**Step 3: Implement data validation**

Create `src/lib/intelligence/data-validation.ts`:
```typescript
/**
 * Data Validation Layer
 *
 * Validates incoming health data for range violations, anomalies,
 * and physiologically impossible values. Runs BEFORE any persona
 * analysis to ensure the intelligence engine reasons over clean data.
 */

import type { ValidationFlag, FlagType } from './types'

// ── Validation Result ─────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  flag?: ValidationFlag
}

// ── Range Definitions ─────────────────────────────────────────────

const RANGES = {
  heart_rate:     { min: 30, max: 220, impossible_min: 0 },
  hrv:            { min: 5,  max: 300, impossible_min: 0 },
  body_temp_f:    { min: 95, max: 104, impossible_min: 80 },
  spo2:           { min: 80, max: 100, impossible_min: 0 },
  pain:           { min: 0,  max: 10 },
  fatigue:        { min: 0,  max: 10 },
  sleep_hours:    { min: 0,  max: 24 },
  readiness:      { min: 0,  max: 100 },
} as const

// ── Range Validators ──────────────────────────────────────────────

function validateRange(
  value: number,
  field: string,
  range: { min: number; max: number; impossible_min?: number },
  sourceTable = 'unknown',
  sourceDate = '',
): ValidationResult {
  if (range.impossible_min !== undefined && value <= range.impossible_min) {
    return {
      valid: false,
      flag: {
        source_table: sourceTable,
        source_date: sourceDate,
        flag_type: 'impossible_value',
        field_name: field,
        original_value: String(value),
        expected_range: `${range.min}-${range.max}`,
        severity: 'error',
      },
    }
  }
  if (value < range.min || value > range.max) {
    return {
      valid: false,
      flag: {
        source_table: sourceTable,
        source_date: sourceDate,
        flag_type: 'out_of_range',
        field_name: field,
        original_value: String(value),
        expected_range: `${range.min}-${range.max}`,
        severity: 'warning',
      },
    }
  }
  return { valid: true }
}

export function validateHeartRate(value: number, sourceTable = 'oura_daily', sourceDate = ''): ValidationResult {
  return validateRange(value, 'heart_rate', RANGES.heart_rate, sourceTable, sourceDate)
}

export function validateHRV(value: number, sourceTable = 'oura_daily', sourceDate = ''): ValidationResult {
  return validateRange(value, 'hrv', RANGES.hrv, sourceTable, sourceDate)
}

export function validateTemperature(value: number, sourceTable = 'oura_daily', sourceDate = ''): ValidationResult {
  return validateRange(value, 'body_temp', RANGES.body_temp_f, sourceTable, sourceDate)
}

export function validatePainScore(value: number, sourceTable = 'daily_logs', sourceDate = ''): ValidationResult {
  return validateRange(value, 'pain_score', RANGES.pain, sourceTable, sourceDate)
}

export function validateSpO2(value: number, sourceTable = 'oura_daily', sourceDate = ''): ValidationResult {
  return validateRange(value, 'spo2', RANGES.spo2, sourceTable, sourceDate)
}

// ── Anomaly Detection ─────────────────────────────────────────────

interface JumpResult {
  isJump: boolean
  standardDeviations?: number
}

/**
 * Detect sudden jumps in a time series.
 * A jump is when the last value is > `threshold` standard deviations
 * from the rolling mean of previous values.
 */
export function detectSuddenJump(
  values: number[],
  threshold = 3,
): JumpResult {
  if (values.length < 3) return { isJump: false }

  const previous = values.slice(0, -1)
  const latest = values[values.length - 1]

  const mean = previous.reduce((a, b) => a + b, 0) / previous.length
  const variance = previous.reduce((sum, v) => sum + (v - mean) ** 2, 0) / previous.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) {
    // All previous values identical; any change is notable but not necessarily a jump
    return { isJump: latest !== mean, standardDeviations: latest !== mean ? Infinity : 0 }
  }

  const deviations = Math.abs(latest - mean) / stdDev
  return {
    isJump: deviations > threshold,
    standardDeviations: Math.round(deviations * 100) / 100,
  }
}

// ── Completeness Scoring ──────────────────────────────────────────

/**
 * Compute data completeness as a percentage.
 * @param daysWithData - number of days that have at least one entry
 * @param totalDays - total days in the evaluation window
 */
export function computeCompleteness(daysWithData: number, totalDays: number): number {
  if (totalDays <= 0) return 0
  return Math.round((daysWithData / totalDays) * 100)
}
```

**Step 4: Run tests**

Run: `cd /Users/clancybond/lanaehealth && npx vitest run src/lib/__tests__/data-validation.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/intelligence/data-validation.ts src/lib/__tests__/data-validation.test.ts
git commit -m "feat: add data validation layer with range checks, anomaly detection, completeness scoring"
```

---

### Task 5: Build Knowledge Base CRUD Operations

**Files:**
- Create: `src/lib/intelligence/knowledge-base.ts`
- Test: `src/lib/__tests__/knowledge-base.test.ts` (unit tests for token estimation and document formatting, integration tests require DB)

**Step 1: Write failing test**

Create `src/lib/__tests__/knowledge-base.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { estimateTokens, formatKBDocumentForContext } from '../intelligence/knowledge-base'

describe('knowledge base utilities', () => {
  describe('estimateTokens', () => {
    it('estimates tokens from text length', () => {
      const text = 'Hello world, this is a test string for token estimation.'
      const tokens = estimateTokens(text)
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(text.length) // tokens < chars
    })
  })

  describe('formatKBDocumentForContext', () => {
    it('formats a document with header and content', () => {
      const formatted = formatKBDocumentForContext({
        document_id: 'test_doc',
        document_type: 'micro_summary',
        title: 'Test Summary',
        content: 'This is the content.',
        version: 1,
        generated_at: '2026-04-15T00:00:00Z',
        generated_by: 'clinical_analyst',
        metadata: {},
        covers_date_start: null,
        covers_date_end: null,
        token_count: 10,
        is_stale: false,
      })
      expect(formatted).toContain('Test Summary')
      expect(formatted).toContain('This is the content.')
    })

    it('adds STALE warning for stale documents', () => {
      const formatted = formatKBDocumentForContext({
        document_id: 'test_doc',
        document_type: 'hypothesis',
        title: 'Stale Doc',
        content: 'Old content.',
        version: 1,
        generated_at: '2026-01-01T00:00:00Z',
        generated_by: 'hypothesis_doctor',
        metadata: {},
        covers_date_start: null,
        covers_date_end: null,
        token_count: 5,
        is_stale: true,
      })
      expect(formatted).toContain('STALE')
    })
  })
})
```

**Step 2: Run to verify fail**

Run: `cd /Users/clancybond/lanaehealth && npx vitest run src/lib/__tests__/knowledge-base.test.ts`
Expected: FAIL

**Step 3: Implement KB operations**

Create `src/lib/intelligence/knowledge-base.ts`:
```typescript
/**
 * Knowledge Base CRUD Operations
 *
 * Read, write, update, and query the clinical_knowledge_base table.
 * Provides formatted output for context injection into Claude calls.
 */

import { createServiceClient } from '@/lib/supabase'
import type { KBDocument, KBDocumentType } from './types'

// ── Token Estimation ──────────────────────────────────────────────

/** Estimate token count from text. ~4 chars per token for English. */
export function estimateTokens(text: string): number {
  return Math.round(text.length / 4)
}

// ── Format for Context ────────────────────────────────────────────

/** Format a KB document for injection into a Claude system prompt. */
export function formatKBDocumentForContext(doc: KBDocument): string {
  const staleWarning = doc.is_stale ? ' [STALE - may not reflect latest data]' : ''
  const dateRange = doc.covers_date_start && doc.covers_date_end
    ? ` (${doc.covers_date_start} to ${doc.covers_date_end})`
    : ''

  return `### ${doc.title}${staleWarning}${dateRange}\n${doc.content}`
}

// ── Database Operations ───────────────────────────────────────────

/** Get a single KB document by its document_id. */
export async function getKBDocument(documentId: string): Promise<KBDocument | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('clinical_knowledge_base')
    .select('*')
    .eq('document_id', documentId)
    .single()

  if (error || !data) return null
  return data as KBDocument
}

/** Get all KB documents of a given type. */
export async function getKBDocumentsByType(type: KBDocumentType): Promise<KBDocument[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('clinical_knowledge_base')
    .select('*')
    .eq('document_type', type)
    .order('generated_at', { ascending: false })

  if (error || !data) return []
  return data as KBDocument[]
}

/** Get all non-stale KB documents, optionally filtered by type. */
export async function getActiveKBDocuments(type?: KBDocumentType): Promise<KBDocument[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('clinical_knowledge_base')
    .select('*')
    .eq('is_stale', false)
    .order('document_type')

  if (type) {
    query = query.eq('document_type', type)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data as KBDocument[]
}

/**
 * Upsert a KB document. If document_id exists, updates content and
 * increments version. Otherwise creates a new document.
 */
export async function upsertKBDocument(doc: Omit<KBDocument, 'id'>): Promise<void> {
  const supabase = createServiceClient()
  const tokenCount = estimateTokens(doc.content)

  // Check if document exists
  const { data: existing } = await supabase
    .from('clinical_knowledge_base')
    .select('version')
    .eq('document_id', doc.document_id)
    .single()

  if (existing) {
    // Update: increment version, update content
    await supabase
      .from('clinical_knowledge_base')
      .update({
        content: doc.content,
        title: doc.title,
        version: (existing.version || 0) + 1,
        generated_at: new Date().toISOString(),
        generated_by: doc.generated_by,
        metadata: doc.metadata,
        covers_date_start: doc.covers_date_start,
        covers_date_end: doc.covers_date_end,
        token_count: tokenCount,
        is_stale: false,
      })
      .eq('document_id', doc.document_id)
  } else {
    // Insert new
    await supabase
      .from('clinical_knowledge_base')
      .insert({
        document_id: doc.document_id,
        document_type: doc.document_type,
        title: doc.title,
        content: doc.content,
        version: 1,
        generated_at: new Date().toISOString(),
        generated_by: doc.generated_by,
        metadata: doc.metadata || {},
        covers_date_start: doc.covers_date_start,
        covers_date_end: doc.covers_date_end,
        token_count: tokenCount,
        is_stale: false,
      })
  }
}

/** Mark a document as stale (needs re-generation). */
export async function markStale(documentId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('clinical_knowledge_base')
    .update({ is_stale: true })
    .eq('document_id', documentId)
}

/** Mark all documents of a given type as stale. */
export async function markTypeStale(type: KBDocumentType): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('clinical_knowledge_base')
    .update({ is_stale: true })
    .eq('document_type', type)
}

/** Get all stale documents that need regeneration. */
export async function getStaleDocuments(): Promise<KBDocument[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('clinical_knowledge_base')
    .select('*')
    .eq('is_stale', true)

  if (error || !data) return []
  return data as KBDocument[]
}

/**
 * Load KB documents relevant to a user query for context injection.
 * Returns formatted text and total token count.
 *
 * Loading priority:
 * 1. hypothesis tracker (always)
 * 2. topic-matched micro_summaries
 * 3. cross-system connections
 * 4. research context
 * 5. conversation insights
 * 6. doctor briefs (if appointment within 14 days)
 */
export async function loadRelevantKBContext(
  _query: string,
  maxTokens = 15_000,
): Promise<{ text: string; tokenCount: number; documentsLoaded: string[] }> {
  const docs = await getActiveKBDocuments()
  const documentsLoaded: string[] = []
  let totalTokens = 0
  const sections: string[] = []

  // Sort by priority: hypothesis first, then micro_summaries, etc.
  const priority: KBDocumentType[] = [
    'hypothesis',
    'criteria_rules',
    'micro_summary',
    'connection',
    'ifm_review',
    'research',
    'completeness',
    'next_action',
    'conversation',
    'doctor_brief',
    'chronicle',
  ]

  const sorted = docs.sort((a, b) => {
    const aIdx = priority.indexOf(a.document_type)
    const bIdx = priority.indexOf(b.document_type)
    return aIdx - bIdx
  })

  for (const doc of sorted) {
    const docTokens = doc.token_count || estimateTokens(doc.content)
    if (totalTokens + docTokens > maxTokens) break

    sections.push(formatKBDocumentForContext(doc))
    documentsLoaded.push(doc.document_id)
    totalTokens += docTokens
  }

  return {
    text: sections.join('\n\n'),
    tokenCount: totalTokens,
    documentsLoaded,
  }
}
```

**Step 4: Run tests**

Run: `cd /Users/clancybond/lanaehealth && npx vitest run src/lib/__tests__/knowledge-base.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/intelligence/knowledge-base.ts src/lib/__tests__/knowledge-base.test.ts
git commit -m "feat: add knowledge base CRUD operations with context loading and priority sorting"
```

---

## Phase 2: Core Personas (Analyst + Hypothesis Doctor + Challenger)

> **Note:** Each task below follows the same TDD pattern: write failing test, implement, verify, commit. Detailed code will be written during execution based on the patterns established in Phase 1.

### Task 6: Build Persona Execution Framework

**Files:**
- Create: `src/lib/intelligence/persona-runner.ts`
- Test: `src/lib/__tests__/persona-runner.test.ts`

Build the framework that runs personas in sequence with:
- Independent Supabase client per persona
- Structured handoff protocol (FINDINGS / DATA_QUALITY / DELTA / HANDOFF)
- Parsing of persona output into structured sections
- Error handling (if one persona fails, others still run)

### Task 7: Build Clinical Analyst Persona

**Files:**
- Create: `src/lib/intelligence/personas/clinical-analyst.ts`
- Test: `src/lib/__tests__/personas/clinical-analyst.test.ts`

The analyst:
- Queries ALL data tables independently (daily_logs, oura_daily, lab_results, food_entries, cycle_entries, nc_imported, symptoms, correlation_results)
- Generates/updates micro-summaries (currently 12, eventually 30-40)
- Maps findings to IFM Matrix nodes
- Generates data completeness report
- Outputs structured handoff for Hypothesis Doctor

### Task 8: Build Hypothesis Doctor Persona

**Files:**
- Create: `src/lib/intelligence/personas/hypothesis-doctor.ts`
- Test: `src/lib/__tests__/personas/hypothesis-doctor.test.ts`

The hypothesis doctor:
- Reads Clinical Analyst handoff + queries DB independently
- Collects evidence items (structured `EvidenceItem` records)
- Saves evidence to `hypothesis_evidence` table
- Computes scores using `computeHypothesisScore()` (deterministic, not LLM)
- Writes/updates Hypothesis Tracker KB document
- Performs unifying hypothesis search across IFM nodes
- Outputs structured handoff for Challenger

### Task 9: Build Challenger Persona

**Files:**
- Create: `src/lib/intelligence/personas/challenger.ts`
- Test: `src/lib/__tests__/personas/challenger.test.ts`

The challenger:
- Reads Hypothesis Doctor output + queries DB independently (MUST verify claims)
- Attacks the #1 hypothesis: "What if this is WRONG?"
- Checks for stagnation (hypothesis unchanged >30 days)
- Checks for echo chamber (analysts and doctor agreed without independent evidence)
- Checks for double-counted evidence across hypotheses
- Searches for diagnoses NOT currently tracked
- Flags non-FDR-corrected correlations supporting key hypotheses
- Appends challenger notes to Hypothesis Tracker
- Outputs structured handoff for Research Librarian

### Task 10: Build Background Analysis API Route

**Files:**
- Create: `src/app/api/intelligence/analyze/route.ts`
- Modify: `src/lib/intelligence/persona-runner.ts` (wire up personas)

API route that:
- Accepts `{ mode: 'incremental' | 'standard' | 'full' | 'doctor_prep', reason: string }`
- Runs personas in sequence based on mode
- Returns analysis summary with KB documents updated
- Has rate limiting (max 1 full analysis per hour)

**Commit after each task above.**

---

## Phase 3: Remaining Personas + Doctor Briefs

### Task 11: Build Research Librarian Persona

**Files:**
- Create: `src/lib/intelligence/personas/research-librarian.ts`

Searches PubMed via existing `search_pubmed` tool, evaluates study quality with structured quality cards, updates Research Context KB document.

### Task 12: Build Next Best Action Persona

**Files:**
- Create: `src/lib/intelligence/personas/next-best-action.ts`

Ranks actions by uncertainty reduction potential, generates Doctor Visit Briefs for upcoming appointments.

### Task 13: Build Synthesizer Persona

**Files:**
- Create: `src/lib/intelligence/personas/synthesizer.ts`

Integrates all persona outputs, resolves contradictions by checking raw data, writes final KB updates, flags urgent findings.

**Commit after each.**

---

## Phase 4: Chat Integration

### Task 14: Rewrite Chat System Prompt

**Files:**
- Modify: `src/lib/context/assembler.ts`
- Modify: `src/lib/ai/chat-system-prompt.ts` (if exists, otherwise modify assembler)

Replace current system prompt with anti-anchoring, objectivity rules, confidence categories, and data honesty instructions from the design doc.

### Task 15: Build KB-Guided Context Assembler

**Files:**
- Modify: `src/lib/context/assembler.ts`

Update `getFullSystemPrompt()` to:
1. Load permanent core (keep existing Layer 1)
2. Load KB documents via `loadRelevantKBContext()` (replaces Layer 2 summaries)
3. Use KB to guide Layer 3 retrieval (MemoRAG pattern)
4. Implement tiered modes (quick/standard/deep/doctor_prep)

### Task 16: Add New Chat Tools

**Files:**
- Modify: `src/lib/ai/chat-tools.ts`

Add tools:
- `get_hypothesis_status` - returns current hypothesis tracker
- `get_cross_system_patterns` - returns connections document
- `get_next_actions` - returns next best actions

### Task 17: Update Chat UI for Confidence Categories

**Files:**
- Modify: `src/app/chat/page.tsx`

Display confidence categories (ESTABLISHED/PROBABLE/POSSIBLE/etc.) with appropriate color coding. Show challenger view alongside main hypothesis.

**Commit after each.**

---

## Phase 5: Optimization

### Task 18: Break Into Micro-Summaries

Expand current 12 summaries into 30-40 fine-grained micro-summaries following the DeepSeekMoE pattern.

### Task 19: Enable pgvector Embeddings

Implement `generateEmbedding()` in `vector-store.ts` with OpenAI `text-embedding-3-small`. Run backfill over existing 1,182 narrative chunks.

### Task 20: Add Analysis Triggers

Auto-trigger background analysis when significant new data arrives (new lab results, weekly Oura batch, etc.) via the sync pipeline.

**Commit after each.**

---

## Testing Strategy

- **Unit tests:** Types, scoring functions, validation, token estimation (Tasks 1-5)
- **Integration tests:** KB CRUD, persona DB queries (require test DB or mocks)
- **Persona output tests:** Verify handoff protocol formatting
- **End-to-end:** Run full analysis, verify KB documents created, verify chat reads them

## Key Dependencies

- Phase 2 depends on Phase 1 (types, DB schema, KB operations)
- Phase 3 depends on Phase 2 (persona framework, handoff protocol)
- Phase 4 depends on Phase 2 (KB must have content to load)
- Phase 5 is independent optimization
