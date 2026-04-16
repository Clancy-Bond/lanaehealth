# LanaeHealth Clinical Intelligence Engine

## Design Document
**Date:** 2026-04-15
**Status:** Approved for implementation
**Scope:** Complete redesign of the AI chat and context engine

---

## 1. Problem Statement

The current chat system assembles context per-query (90-day summaries, keyword-matched topics, vector search) but has no persistent understanding of Lanae's health. It cannot:
- Maintain evolving diagnostic hypotheses across conversations
- Find connections between body systems (cardiovascular + endocrine + GI)
- Distinguish strong evidence from weak evidence
- Prevent anchoring bias on a suspected diagnosis
- Assess research quality when citing medical literature
- Track data completeness or reliability

The goal: build a system that knows every bit of her data, reasons objectively across all body systems, evolves its understanding as new data arrives, and helps prepare for doctor visits with the most probable hypotheses and next steps.

---

## 2. Research Validation

This design was validated against 30+ systems across Western and Chinese AI research.

### Key Systems Studied

| System | Institution | Key Finding for Our Design |
|--------|------------|---------------------------|
| MAI-DxO | Microsoft Research | 5 clinical personas, 85.5% accuracy on NEJM cases. Validates multi-persona approach. |
| MidasMed | Academic | Formal Bayesian networks, 93% accuracy. LLMs should not estimate probabilities. |
| MemoRAG | Renmin University / CAS | Global memory guides retrieval. Knowledge base should direct searches. |
| MemoryBank | AAAI 2024 | Ebbinghaus forgetting curve for time-decay weighting. Recent data matters more. |
| DeepSeekMoE | DeepSeek AI | Fine-grained expert segmentation. More small summaries > fewer large ones. |
| WiMedKG | Chinese researchers | Knowledge graph with quality axioms. Deterministic medical criteria rules. |
| Ping An AskBob | Ping An Health | 5-database + KG, 90% accuracy on 85 diseases. Structured knowledge required. |
| Precina Health | Memgraph/Qdrant | Graph + vector hybrid, 49/50 patients improved. Connections between data points matter. |
| Optimization Paradox | Stanford | Inter-persona communication matters MORE than individual persona quality. |
| Ada Health | Ada Health | Information-theoretic question selection. What test reduces uncertainty most? |
| FunctionalMind | John Snow Labs | Functional medicine RAG over 30M+ PubMed articles. Research breadth matters. |
| IFM Matrix | Institute for Functional Medicine | 7 biological system nodes + ATM framework. No AI implementation exists. |
| Representation Before Retrieval | medRxiv 2026 | RAG increased hallucination 8.7x. Structured artifacts reduced errors to 8.4%. |

### Key Research Findings

1. **RAG alone is dangerous for medical data** - 43.6% hallucination rate vs 5% baseline (medRxiv 2026)
2. **Structured artifacts outperform RAG** - Pre-compiled representations reduce unsupported claims to 8.4%
3. **LLMs cannot do real Bayesian math** - Probability estimates off by 20-40% from formal computation
4. **Inter-agent communication > individual agent quality** - Stanford Optimization Paradox paper
5. **Every production medical AI system uses structured knowledge** - Not one relies on RAG alone
6. **Wiki-style knowledge bases outperform RAG below 100K tokens** - Karpathy LLM Wiki pattern

---

## 3. Architecture Overview

### Two-Phase System

**Phase 1: Background Clinical Analysis** (runs when new data arrives)
- 6 clinical personas analyze ALL data from different perspectives
- Each persona has independent database access (prevents echo chamber)
- Formalized handoff protocol between personas
- Outputs written to Knowledge Base in Supabase

**Phase 2: Real-time Chat** (per conversation)
- Reads from pre-computed Knowledge Base
- Has raw data tools for verification
- Anti-anchoring system prompt
- Tiered response modes (Quick/Standard/Deep/Doctor Prep)

### System Diagram

```
DATA LAYER
  Raw data (Supabase) --> Data Validation Layer --> Validated Data
    |                         |
    |                    Range checks, anomaly detection,
    |                    completeness scoring, reliability weighting
    |
KNOWLEDGE LAYER (pre-computed, stored in clinical_knowledge_base table)
    |
    +-- Patient Chronicle (full timeline birth to present)
    +-- 30-40 Micro-Summaries (fine-grained per DeepSeekMoE)
    +-- IFM Matrix Mapping (7 system nodes + ATM timeline)
    +-- Medical Criteria Rules (deterministic quality axioms)
    +-- Hypothesis Tracker (formal evidence scoring)
    +-- Cross-System Connections (unifying hypothesis search)
    +-- Research Context (literature with quality grades A-F)
    +-- Data Completeness Report
    +-- Next Best Actions (uncertainty-reducing recommendations)
    +-- Conversation Insights (accumulated across sessions)
    +-- Doctor Visit Briefs (per-appointment, auto-updating)
    |
ANALYSIS LAYER (6 personas, background)
    |
    +-- Clinical Analyst (IFM mapping, patterns)
    +-- Hypothesis Doctor (evidence collection + scoring)
    +-- Challenger (anti-anchoring, contradiction finding)
    +-- Research Librarian (literature + quality assessment)
    +-- Next Best Action (information-theoretic test selection)
    +-- Synthesizer (contradiction resolution, KB writing)
    |
RETRIEVAL LAYER
    |
    +-- Knowledge Base guides retrieval (MemoRAG pattern)
    +-- Hybrid dense+sparse search
    +-- pgvector with embeddings
    +-- Full-text fallback
    |
CHAT LAYER
    |
    +-- Loads relevant KB documents per query
    +-- Confidence CATEGORIES not percentages
    +-- Always presents challenger view
    +-- Flags data quality limitations
    +-- Tiered: Quick / Standard / Deep / Doctor Prep
```

---

## 4. Data Validation Layer

Runs BEFORE any persona analysis or knowledge base update.

### Range Checks
- Heart rate: 30-220 bpm (flag outside range)
- HRV: 5-300 ms
- Body temperature: 95-104 F
- Pain scale: 0-10
- SpO2: 80-100%

### Anomaly Detection
- Sudden jumps: if value changes >3 standard deviations from 30-day rolling mean, flag as suspicious
- Data entry errors: pain 0 -> 10 -> 0 in consecutive days
- Physiologically impossible: HR 0 with other vitals present

### Completeness Scoring
Track per data source, per 30-day window:
- daily_logs: % of days with entries
- oura_daily: % of days with data
- food_entries: % of days with entries
- lab_results: date of most recent

### Reliability Tiers

| Source | Reliability | Weight |
|--------|-----------|--------|
| Lab results (clinical) | High | 1.0 |
| Imaging reports | High | 1.0 |
| Medical records | High | 1.0 |
| Oura HR (trends) | Medium | 0.7 |
| Oura HRV (trends) | Medium | 0.7 |
| Oura temperature | Medium-Low | 0.5 |
| Daily symptom logs | Medium | 0.6 |
| Food diary | Low-Medium | 0.5 |

### Time-Decay Weighting (Ebbinghaus Curve)
```
time_decay = max(0.3, e^(-0.01 * days_old))
```
- Recent data (~0 days): weight 1.0
- 30 days old: weight ~0.74
- 90 days old: weight ~0.41
- 1 year old: weight 0.30 (floor)
- Exception: "anchored" findings always weight 1.0
  (e.g., positive TPO antibodies, confirmed diagnoses, surgical history)

---

## 5. Knowledge Base Structure

### Database Schema

```sql
CREATE TABLE clinical_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(100) UNIQUE NOT NULL,
  document_type VARCHAR(30) NOT NULL,
  -- types: chronicle, micro_summary, ifm_review, hypothesis,
  --        connection, research, completeness, next_action,
  --        conversation, doctor_brief, criteria_rules
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by VARCHAR(50), -- which persona wrote it
  metadata JSONB DEFAULT '{}',
  covers_date_start DATE,
  covers_date_end DATE,
  token_count INTEGER,
  is_stale BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_kb_type ON clinical_knowledge_base(document_type);
CREATE INDEX idx_kb_stale ON clinical_knowledge_base(is_stale);
```

### Document Inventory

**Patient Chronicle** (1 document)
- Complete health timeline, birth to present
- Every significant event with dates
- Organized chronologically
- Updated when new significant events occur

**Micro-Summaries** (30-40 documents)
Breaking the current 12 summaries into finer-grained topics:

Cardiovascular system (5):
- Resting heart rate trends and baselines
- Orthostatic vital signs and standing tests
- HRV patterns by cycle phase and time
- Palpitation and tachycardia episodes
- Exercise tolerance and activity patterns

Endocrine system (4):
- Thyroid function trajectory (TSH, T4, TPO)
- Cycle patterns (length, flow, ovulation)
- Hormonal symptom correlation
- Temperature and metabolic patterns

Neurological (3):
- Presyncope and syncope episodes
- Headache patterns and triggers
- Cognitive symptoms (brain fog, concentration)

GI/Digestive (3):
- Food trigger patterns
- Bowel and digestive symptoms
- Nausea and bloating patterns

Metabolic/Labs (3):
- Complete blood count trends
- Iron/ferritin trajectory
- Lipid panel and cholesterol

Reproductive (3):
- Menstrual flow and regularity
- Fertility markers and ovulation
- Endometriosis symptom tracking

Sleep and Recovery (3):
- Sleep quality and duration trends
- Readiness and recovery patterns
- Stress and activity balance

Medications and Supplements (2):
- Current regimen and adherence
- Observed effects and interactions

Imaging (1):
- All imaging studies and findings

General/Lifestyle (3):
- Weight and body composition trends
- Activity and exercise patterns
- Environmental and seasonal patterns

**IFM Matrix Mapping** (1 document)
Organized by the 7 IFM nodes:
1. Transport (cardiovascular/lymphatic)
2. Communication (endocrine/neurotransmitters)
3. Assimilation (digestion/absorption)
4. Defense and Repair (immune/inflammation)
5. Energy (mitochondrial function)
6. Structural Integrity (musculoskeletal)
7. Biotransformation (detox/metabolism)

Plus ATM Framework:
- Antecedents (genetic, developmental)
- Triggers (what initiated symptoms)
- Mediators (what perpetuates symptoms)

**Medical Criteria Rules** (1 document)
Deterministic rules, not LLM-generated:
```
IF standing_hr_delta > 30 bpm THEN pots_screen = positive
IF tsh > 4.0 AND tpo_ab > 35 THEN autoimmune_thyroiditis = valid_hypothesis
IF cholesterol > 200 AND ldl > 130 THEN hyperlipidemia = confirmed
IF ferritin < 30 THEN iron_deficiency = probable
```

**Hypothesis Tracker** (1 document)
Per hypothesis:
- Name and description
- Evidence score (computed, not LLM-estimated)
- Direction (rising/stable/falling)
- Supporting evidence (with source, reliability, time-decay weight)
- Contradicting evidence (same format)
- What would change it (testable predictions)
- Alternative explanations
- Challenger notes
- Last re-evaluated date

**Cross-System Connections** (1 document)
- How IFM nodes interact for this patient
- Unifying hypothesis search results
- Multi-system symptom clusters

**Research Context** (1 document)
Per study cited:
- Study type (RCT/Cohort/Case/Review)
- Sample size
- Journal and impact factor
- Evidence grade (A-F)
- Applicability to patient
- Conflicts of interest
- Replication status

**Data Completeness Report** (1 document)
- Per-source completeness percentages
- Data gaps and their impact on analysis
- Recommendations for improving data quality

**Next Best Actions** (1 document)
- Ranked by uncertainty reduction potential
- What test/data would most change the hypothesis landscape
- Specific to upcoming appointments

**Conversation Insights** (1 document)
- Key learnings accumulated across all chat sessions
- Questions the patient has asked
- Concerns expressed
- Decisions made

**Doctor Visit Briefs** (1 per upcoming appointment)
- Pre-built, auto-updated as new data arrives
- Specialist-specific data selection
- Questions derived from hypothesis probabilities
- Research citations for recommended tests

---

## 6. Clinical Persona System

### Trigger Conditions

| Trigger | Analysis Mode | Personas Used |
|---------|--------------|---------------|
| New lab results | Full | All 6 |
| New imaging study | Full | All 6 |
| Weekly Oura batch | Standard | Analyst + Hypothesis Doctor + Challenger |
| Daily log entry | Incremental | Analyst only (update micro-summaries) |
| User requests re-analysis | Full | All 6 |
| 7 days since last full analysis | Maintenance | All 6 |
| Before doctor appointment | Doctor Prep | All 6 + brief generation |

### Persona 1: Clinical Analyst

**Role:** Review ALL data, find patterns, map to IFM Matrix

**Input:**
- Independent database access to all tables
- Current Knowledge Base documents (for delta detection)
- Data Validation Layer output (reliability scores, completeness)

**Output:**
- Updated micro-summaries (only stale or affected ones)
- Updated IFM Matrix mapping
- Updated data completeness report

**Protocol:**
```
FINDINGS: [specific data-backed observations with dates]
DATA_QUALITY: [completeness and reliability for this analysis]
DELTA: [what changed since last analysis]
HANDOFF: "Hypothesis Doctor should evaluate: [specific findings]"
```

### Persona 2: Hypothesis Doctor

**Role:** Collect evidence for/against each hypothesis, update evidence scores

**Input:**
- Independent database access
- Clinical Analyst's findings (as context, not ground truth)
- Current Hypothesis Tracker
- Medical Criteria Rules

**Output:**
- Updated Hypothesis Tracker
- New hypotheses if evidence warrants
- Retired hypotheses if evidence contradicts

**Evidence Collection Protocol:**
```typescript
interface EvidenceItem {
  finding: string;
  source: string; // table + date
  source_reliability: number; // 0.5-1.0
  time_decay: number; // Ebbinghaus weight
  supports_hypotheses: string[];
  contradicts_hypotheses: string[];
  clinical_weight: number; // pre-defined per finding type
  fdr_corrected: boolean; // for correlation-based evidence
  meets_criteria_rule: boolean; // deterministic check
}
```

**Scoring Formula:**
```
hypothesis_score = sum(
  supporting_evidence.map(e => 
    e.clinical_weight * e.source_reliability * e.time_decay * (e.fdr_corrected ? 1.0 : 0.5)
  )
) - sum(
  contradicting_evidence.map(e => 
    e.clinical_weight * e.source_reliability * e.time_decay * (e.fdr_corrected ? 1.0 : 0.5)
  )
)

// Normalize to 0-100 scale
// Criteria rule matches get automatic bonus
```

**Confidence Categories (NOT percentages):**

| Score | Category | Display |
|-------|----------|---------|
| 80+ | ESTABLISHED | Strong evidence from multiple reliable sources |
| 60-79 | PROBABLE | Good evidence, some questions remain |
| 40-59 | POSSIBLE | Moderate evidence, needs more data |
| 20-39 | SPECULATIVE | Weak evidence or low-reliability data |
| <20 | INSUFFICIENT | Cannot assess with available data |

**Protocol:**
```
HYPOTHESES_UPDATED: [list with old -> new scores]
EVIDENCE_ADDED: [new evidence items with full metadata]
UNIFYING_SEARCH: "Condition X could explain [list of symptoms across systems]"
HANDOFF: "Challenger should attack: [top hypothesis] because [specific concern]"
```

### Persona 3: Challenger

**Role:** Prevent anchoring bias, find contradictions, attack leading hypotheses

**Input:**
- Independent database access (MUST verify claims from other personas)
- Hypothesis Doctor's output
- Historical hypothesis scores (detect stagnation)

**Output:**
- Challenger notes appended to Hypothesis Tracker
- Stagnation alerts (hypothesis unchanged >30 days)
- Echo chamber flags (personas reinforcing without new evidence)
- Alternative explanation suggestions

**Specific Instructions:**
1. Take the #1 hypothesis and ask: "What if this is WRONG?"
2. Search for data that contradicts the leading hypothesis
3. Check if evidence is being double-counted across hypotheses
4. Look for diagnoses NOT currently tracked that could explain the data
5. Verify that each persona's claims are backed by raw data (query DB directly)
6. Flag if any hypothesis rests on non-FDR-corrected correlations
7. Check if data quality issues (low completeness, low reliability) artificially inflate confidence

**Protocol:**
```
CHALLENGES: [specific attacks on each hypothesis with data citations]
STAGNATION: [hypotheses unchanged >30 days]
ECHO_CHECK: [findings that multiple personas agreed on without independent verification]
MISSING: [conditions not being tracked that could explain the data]
HANDOFF: "Research Librarian should investigate: [specific questions]"
```

### Persona 4: Research Librarian

**Role:** Find and evaluate medical literature relevant to current hypotheses

**Input:**
- Independent database access (to understand patient specifics)
- Hypothesis Tracker (to know what to search for)
- Challenger's notes (to search for contradicting evidence)

**Output:**
- Updated Research Context document
- Study quality cards for each cited paper
- Literature-based evidence items for hypothesis scoring

**Study Quality Card:**
```markdown
## [Study Title]
- Type: RCT | Cohort | Case-control | Case series | Review | Meta-analysis
- Sample size: n=X
- Journal: [name], Impact Factor: [X]
- Published: [year]
- Evidence grade: A (strong RCT) | B (good cohort) | C (case series) | 
                  D (expert opinion/review) | F (weak/retracted)
- Replication: Replicated by [X] | Not replicated | Not tested
- Applicability: Population matches patient? (age, sex, comorbidities)
- Conflicts: Industry funding? Author COI?
- Key finding: [one sentence]
- Relevance: Supports/contradicts [hypothesis] because [reason]
```

**Protocol:**
```
LITERATURE_FOUND: [studies with quality cards]
HYPOTHESIS_IMPACT: [how literature changes evidence for/against each hypothesis]
GUIDELINE_ALERTS: [clinical guidelines recommending specific tests/treatments]
HANDOFF: "Next Best Action should consider: [tests recommended by literature]"
```

### Persona 5: Next Best Action

**Role:** Determine what single piece of new information would most reduce diagnostic uncertainty

**Input:**
- Hypothesis Tracker (current scores and uncertainties)
- Research Librarian's guideline alerts
- Upcoming appointments (from appointments table)
- Data Completeness Report

**Output:**
- Ranked list of uncertainty-reducing actions
- Updated Doctor Visit Briefs
- Data collection recommendations

**Ranking Criteria:**
For each potential action (test, measurement, lifestyle change):
```
uncertainty_reduction = 
  max_possible_hypothesis_score_change * 
  probability_of_informative_result * 
  (1 / cost_or_difficulty)
```

**Protocol:**
```
ACTIONS_RANKED: [list with expected impact on hypothesis landscape]
APPOINTMENT_PREP: [specific recommendations for each upcoming visit]
DATA_GAPS: [what the patient could log/measure to improve analysis]
HANDOFF: "Synthesizer should finalize KB with these priorities"
```

### Persona 6: Synthesizer

**Role:** Integrate all persona outputs, resolve contradictions, write final Knowledge Base

**Input:**
- All 5 persona outputs
- Current Knowledge Base (for delta updates)

**Actions:**
1. Check for contradictions between persona findings
2. Resolve contradictions by checking raw data
3. Update all Knowledge Base documents
4. Increment document versions
5. Flag urgent findings for immediate user notification
6. Generate/update Doctor Visit Briefs

**Protocol:**
```
CONTRADICTIONS_FOUND: [list with resolution]
KB_UPDATED: [list of documents updated with change summaries]
URGENT: [findings requiring immediate attention]
STALE_CLEARED: [documents marked no longer stale]
```

---

## 7. Chat Integration

### System Prompt (Revised)

```
You are LanaeHealth's clinical reasoning assistant. You help identify
patterns, track hypotheses, and prepare for medical advocacy.

OBJECTIVITY RULES:
- Present ALL active hypotheses with their current confidence categories
- NEVER state a diagnosis as likely without presenting alternatives
- When new data arrives, explicitly state what it does to each hypothesis
- Cite specific data points with dates for every claim
- Distinguish: ESTABLISHED (confirmed) vs PROBABLE vs POSSIBLE vs 
  SPECULATIVE vs INSUFFICIENT DATA
- Flag when confidence rests on low-reliability data sources

ANTI-ANCHORING:
- If a hypothesis has been stable for >30 days without new evidence, 
  state: "This hypothesis hasn't been challenged recently"
- Always present the Challenger's view alongside the main hypothesis
- Search for the unifying diagnosis that explains the most symptoms

RESEARCH AWARENESS:
- Cite relevant literature with evidence grades
- Flag when studies have low sample sizes or weak methodology
- Note when clinical guidelines recommend specific actions

DATA HONESTY:
- State data completeness limitations that affect the analysis
- Note when findings come from low-reliability sources (e.g., food diary)
- Do not present wearable data with the same certainty as lab results

SELF-DISTRUST PRINCIPLE:
Memory is HINTS, not GROUND TRUTH. Before acting on any recalled information,
verify against the Knowledge Base and raw data.
```

### Tiered Response Modes

| Mode | Trigger | KB Documents Loaded | Personas Used | Cost |
|------|---------|-------------------|---------------|------|
| Quick | Simple data lookup | Permanent core only | None | ~$0.02 |
| Standard | Most questions | Core + relevant micro-summaries + hypothesis tracker | None (reads from KB) | ~$0.05 |
| Deep | Complex analysis questions | Core + all relevant KB docs + research context | None (reads from KB) | ~$0.10 |
| Doctor Prep | Before appointments | All KB docs + doctor brief + research | Triggers background re-analysis first | ~$1.50 |

### Knowledge Base-Guided Retrieval (MemoRAG Pattern)

When a query comes in:
1. First check the Knowledge Base for relevant documents
2. KB documents inform which data domains to search
3. Vector/text retrieval pulls specific evidence
4. Chat combines KB understanding + retrieved evidence

```
User: "Why am I so tired?"

Step 1 - KB check:
  - Hypothesis Tracker mentions fatigue in Hashimoto's (PROBABLE) evidence
  - IFM Matrix shows Energy node has declining readiness scores
  - Micro-summary: Iron/ferritin shows declining trajectory
  - Micro-summary: Sleep quality shows fragmented sleep

Step 2 - Guided retrieval:
  - Search oura_daily for sleep and readiness trends (last 90 days)
  - Search lab_results for ferritin, TSH, CBC
  - Search daily_logs for fatigue scores and pattern

Step 3 - Response combines KB understanding with specific data points
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Data Validation + KB Schema)
- Create clinical_knowledge_base table in Supabase
- Build Data Validation Layer (range checks, anomaly detection, completeness scoring)
- Build reliability and time-decay weighting functions
- Migrate existing 12 summaries to new micro-summary format

### Phase 2: Core Personas (Analyst + Hypothesis Doctor + Challenger)
- Build persona execution framework (independent DB access, handoff protocol)
- Implement Clinical Analyst (pattern detection, IFM mapping)
- Implement Hypothesis Doctor (evidence collection, formal scoring)
- Implement Challenger (anti-anchoring, contradiction finding)
- Build Hypothesis Tracker with evidence scoring system

### Phase 3: Evidence Scoring System
- Define clinical weights for each finding type
- Implement deterministic scoring formula
- Build Medical Criteria Rules document
- Create confidence category mapping
- Validate scoring against known clinical outcomes

### Phase 4: Remaining Personas (Research Librarian + Next Best Action + Synthesizer)
- Implement Research Librarian (PubMed search, quality cards)
- Implement Next Best Action (uncertainty reduction ranking)
- Implement Synthesizer (contradiction resolution, KB writing)
- Build Doctor Visit Brief generation

### Phase 5: Chat Integration
- Rewrite system prompt with anti-anchoring instructions
- Implement tiered response modes
- Build KB-guided retrieval (MemoRAG pattern)
- Integrate Knowledge Base into context assembler
- Update chat UI to show confidence categories and challenger views

### Phase 6: Optimization
- Break summaries into 30-40 micro-summaries
- Enable pgvector embeddings (text-embedding-3-small)
- Implement hybrid dense+sparse retrieval
- Add time-decay to retrieval scoring
- Performance tuning and cost optimization

---

## 9. Validation Plan

### Internal Validation
- Compare hypothesis scores against confirmed diagnoses over time
- Track whether challenger catches real anchoring events
- Measure data completeness improvement after recommendations
- Monitor evidence scoring calibration (do PROBABLE hypotheses confirm more often than SPECULATIVE?)

### Clinical Validation
- Compare system recommendations with actual doctor recommendations
- Track which Next Best Actions led to diagnostic resolution
- Review Doctor Visit Briefs with physicians for accuracy
- Measure time from hypothesis generation to clinical confirmation

### Safety Checks
- Ensure no diagnosis is ever stated as fact (only categories)
- Verify challenger runs on every analysis cycle
- Monitor for echo chamber patterns between personas
- Audit research citations for quality grade accuracy

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| LLM hallucination in persona output | Each persona verifies against raw DB data independently |
| Echo chamber between personas | Challenger has independent DB access and explicit anti-echo instructions |
| False precision in scoring | Use categories (PROBABLE) not percentages (68.3%) |
| Anchoring on wrong hypothesis | Challenger + stagnation detection + unifying hypothesis search |
| Bad research cited | Study quality cards with evidence grades A-F |
| Missing data creates blind spots | Data Completeness Report + explicit gap flagging |
| Cost overrun from background analysis | Tiered trigger conditions (not every data point triggers full analysis) |
| Stale knowledge base | 7-day maximum staleness + trigger on significant new data |
| Patient anxiety from too many hypotheses | Confidence categories + clear uncertainty communication |

---

## 11. Research Citations

### Western Research
- "Representation Before Retrieval" (medRxiv 2026) - Structured artifacts > RAG for medical safety
- MAI-DxO (Microsoft, arxiv 2506.22405) - Multi-persona diagnostic reasoning, 85.5% accuracy
- MidasMed (PMC9355422) - Formal Bayesian networks, 93% accuracy
- Precina Health (Memgraph case study) - Graph + vector hybrid, real patient outcomes
- Optimization Paradox (Stanford, arxiv 2506.06574) - Inter-agent communication > individual quality
- Ada Health - Information-theoretic question selection
- ClinicalAgents (arxiv 2603.26182) - Dual-memory architecture
- Karpathy LLM Wiki - Wiki outperforms RAG below 100K tokens
- IFM Matrix (ifm.org) - 7-node biological system framework
- Human-AI Collective Diagnosis (PNAS 2025) - Hybrid outperforms either alone

### Chinese Research
- MemoRAG (Renmin/CAS, TheWebConf 2025) - Global memory guides retrieval
- MemoryBank (AAAI 2024) - Ebbinghaus forgetting curve for memory weighting
- DeepSeekMoE (ACL 2024) - Fine-grained expert segmentation
- DeepSeek-V2 (arxiv 2405.04434) - Multi-head latent attention for context compression
- DeepSeek-R1 Medical (arxiv 2505.00025) - 92.1% on USMLE with distilled model
- WiMedKG (Information Processing and Management 2025) - Quality-controlled medical KG
- Ping An AskBob - 5-database + KG, 800M patients, 90% accuracy
- Huawei Pangu Med - Pre-train + KG + SFT, 87.7% accuracy
- DAMO PANDA (Nature Medicine) - 92.9% sensitivity, FDA breakthrough
- BAAI bge-m3 - Hybrid dense+sparse multilingual embeddings

### Failure Case Studies
- IBM Watson for Oncology ($4B+ loss) - Top-down approach disconnected from real data
- Babylon Health (collapsed 2023) - Overpromised, under-validated
- Epic Sepsis Tool - 85% claimed vs 33% validated sensitivity
- CDSS Alert Fatigue - 95% of alerts clinically inconsequential

---

## 12. Gap Analysis Summary

20 gaps identified across 7 categories (6 critical, 7 high, 5 medium, 2 low).

### Critical Gaps Addressed in This Design
1. LLM probability estimation unreliable -> Formal evidence scoring system
2. Multiple comparisons problem -> FDR-corrected correlations only
3. Wearable data noise -> Reliability tiers and weighting
4. No data validation -> Validation layer with anomaly detection
5. Echo chamber risk -> Independent DB access per persona
6. Missing data blind spots -> Completeness tracking and flagging

### Infrastructure Gaps (Separate from This Design)
- No authentication on API routes (Gap 1)
- Zero test coverage (Gap 18)
- No rate limiting (Gap 5)
- No schema validation (Gap 9)
- Embeddings disabled (Gap 12)
These should be addressed in parallel with or before this implementation.
