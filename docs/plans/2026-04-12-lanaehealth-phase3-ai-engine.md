# LanaeHealth Phase 3: AI Engine Upgrades

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the AI analysis engine with proper statistical methods (Spearman, Mann-Whitney, FDR correction), enhanced flare prediction, a fully context-aware AI chat, and background summary regeneration (dream cycle).

**Architecture:** Build a new `correlation-engine.ts` with rigorous statistics. Upgrade the existing `flare-model.ts`. Wire the AI chat through the Context Assembler so every conversation starts fully informed. Add a scheduled dream cycle for summary freshness.

**Tech Stack:** TypeScript (pure math - no ML libraries needed at this data scale), Claude API, Supabase

---

## Task 1: Correlation Engine

Create `src/lib/ai/correlation-engine.ts` with proper statistical methods:

- Spearman rank correlation (proper for ordinal pain data 0-10)
- Mann-Whitney U test for factor-effect analysis ("pain is significantly different on gluten days vs non-gluten days")
- Benjamini-Hochberg FDR correction across all tests
- Effect size computation (Cohen's d, risk ratios) with plain English descriptions
- Cycle-phase stratification on all analyses
- Minimum 20 paired observations per correlation
- Cross-validation with temporal split (first 70% train, last 30% validate)

Store results in correlation_results table. Each result has: factor_a, factor_b, correlation_type, coefficient, p_value, effect_size, effect_description (plain English), confidence_level, sample_size, lag_days, cycle_phase, passed_fdr.

Create API route POST /api/analyze/correlations that runs the full correlation pipeline.

Commit: "feat: add statistical correlation engine with Spearman, Mann-Whitney, and FDR correction"

---

## Task 2: Enhanced Flare Prediction

Upgrade `src/lib/ai/flare-model.ts`:

- Extend lag analysis from 1-3 days to -7 to +7 days
- Add event-triggered averaging (average biometric signature in the week before each flare)
- Add cycle-phase stratification to all precursor pattern detection
- Bump minimum sample size from 10 to 20
- Add Granger causality testing (does HRV predict pain beyond what pain's own history predicts?)
- Output flare risk as a probability with contributing factors in plain English

Create API route GET /api/analyze/flare-risk that returns current risk assessment.

Commit: "feat: upgrade flare prediction with extended lag analysis and Granger causality"

---

## Task 3: AI Chat with Context Engine

Build the chat page at /chat with full Context Assembler integration:

- Create API route POST /api/chat that uses getFullSystemPrompt() from the Context Assembler
- The static system prompt + dynamic patient context + relevant summaries + retrieval results all injected automatically
- Tool use loop (max 20 iterations) with 10+ tools: search_daily_logs, search_symptoms, get_lab_results, get_oura_biometrics, get_cycle_data, search_food_entries, get_correlations (NEW), predict_flare_risk (NEW), get_analysis_findings, get_health_profile
- Session handoff written automatically when conversation ends
- Chat UI: message list, input bar, tool badges, suggested starter questions
- Copy existing chat tools from src/lib/ai/chat-tools.ts but ADD the new correlation and flare tools

Commit: "feat: add AI chat with full context engine integration and tool use"

---

## Task 4: Dream Cycle (Background Summary Regeneration)

Create a scheduled API route that regenerates all Layer 2 summaries:

- POST /api/context/dream - triggers the dream cycle
- Phase 1 Orient: Read existing summaries, check staleness
- Phase 2 Gather: Query new data since last dream
- Phase 3 Consolidate: Regenerate all 12 summaries via Claude
- Phase 4 Prune: Clean up, update timestamps
- Can be triggered manually from Settings page or via a cron schedule
- Add a "Refresh AI Summaries" button to the Settings page

Commit: "feat: add dream cycle for background summary regeneration"

---

## Verification

- [ ] Correlation engine produces results stored in correlation_results table
- [ ] Flare prediction returns risk assessment with contributing factors
- [ ] AI chat starts every conversation with full patient context
- [ ] Chat can query all data sources via tools
- [ ] Dream cycle regenerates all 12 summaries
- [ ] Patterns page shows correlation results from the engine
- [ ] Doctor mode shows correlation findings
