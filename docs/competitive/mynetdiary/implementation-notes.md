# MyNetDiary Implementation Notes

Last updated: Apr 16 2026

Implementation details for the top 3 features selected in plan.md. Each section lists exact file paths, data model decisions, component plan, acceptance criteria, verification plan, and risks.

Key constraint reminder: `food_entries` is read-only with respect to the existing 5,781 Lanae rows (imported from her MyNetDiary CSV). INSERTs allowed. No UPDATEs, DELETEs, or schema changes. Any new nutrition feature schema must be additive (new tables) via migration 014 or later.

Check existing migration count: highest current is 013_orthostatic_tests.sql. Next migration number is 014.

---

## Feature 1: Endo/POTS-aware condition preset for nutrition goals

### File targets

Create:
- `/Users/clancybond/lanaehealth/src/lib/nutrition/` (new directory)
- `/Users/clancybond/lanaehealth/src/lib/nutrition/presets.ts`
  - Exports `NUTRITION_PRESETS` constant containing `endo-pots-friendly` preset with macro/micro targets.
  - Exports `getPresetTargets(presetId, cyclePhase)` which returns the target values adjusted for current cycle phase (luteal prefers low FODMAP, menstrual prefers higher iron, etc.).
- `/Users/clancybond/lanaehealth/src/lib/nutrition/meal-suggester.ts`
  - Exports `suggestMealsFromPreset(preset, recentMeals, classifier)` that filters a pool of candidate meals using the preset's allow rules and returns ranked suggestions.
- `/Users/clancybond/lanaehealth/src/lib/migrations/014_user_nutrition_goals.sql`
  - Additive: `user_nutrition_goals` table (see Data model below).
- `/Users/clancybond/lanaehealth/src/components/log/NutritionGoalsCard.tsx`
  - Shows today's goals next to logged totals. Cycle-phase aware, reads from preset.

Modify:
- `/Users/clancybond/lanaehealth/src/lib/api/food.ts`
  - Add `getDailyTotals(logId)` returning calories, macros, micros from today's food_entries.
  - Add `getPresetForUser()` returning the active preset id from user_nutrition_goals table.
- `/Users/clancybond/lanaehealth/src/app/log/page.tsx`
  - Fetch daily totals and active preset; pass to NutritionGoalsCard.
- `/Users/clancybond/lanaehealth/src/components/log/QuickMealLog.tsx`
  - Pass preset context to the meal suggester so the "Frequent meals" chips (from MFP pattern 1) can be filtered or ordered by preset fit.

Do NOT modify:
- `src/lib/context/` (no LLM needed for this feature, preset logic is deterministic)
- `food_entries` schema
- `health_profile` (presets are separate, user can opt out without touching health profile)

### Data model

New additive table `user_nutrition_goals`:

```sql
CREATE TABLE user_nutrition_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT gen_random_uuid(),  -- single-user app, static
  preset_id TEXT NOT NULL DEFAULT 'endo-pots-friendly',
  custom_overrides JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Preset `endo-pots-friendly` (hardcoded in presets.ts, not DB):

```
calorie_target: 2000 (default, user-adjustable)
protein_g_min: 75
sodium_mg_target: 5000  (POTS, not generic 2300)
fiber_g_min: 25
iron_mg_min: 18  (menstrual +4 boost during flow days)
anti_inflammatory_score_target: >= +2 per meal average
fodmap_preference:
  follicular/ovulatory: permissive
  luteal/menstrual: prefer low FODMAP
histamine_tolerance: moderate (downweight high-histamine if flare active)
```

Migration `014_user_nutrition_goals.sql` creates the table and inserts a default row for Lanae with preset_id='endo-pots-friendly'.

### Component plan

New:
- `NutritionGoalsCard.tsx` renders a compact row showing today's progress vs goal for calories, sodium, iron, anti-inflammatory score. Cycle-phase badge on the card. Tap to see full breakdown.

Reuse:
- `classifyFood` from `src/lib/api/food-classification.ts`
- `getCyclePhase` helpers from `src/lib/cycle-calculator.ts`
- Existing Recharts setup for bar visualization, using `useRef`-based width per the project Recharts SSR rule

### Acceptance criteria

- User opens /log page and sees NutritionGoalsCard showing today's calories, sodium, iron, anti-inflammatory score against preset targets.
- Cycle phase is displayed on the card. Goals shift on day boundaries when phase changes (luteal starts, sodium stays at 5000, FODMAP guidance kicks in).
- When Lanae logs a meal tagged high FODMAP during luteal phase, the card shows a gentle neutral note ("luteal phase; this meal is high FODMAP") with no shame language.
- Preset can be toggled off in Settings. When off, NutritionGoalsCard hides.
- Works with Lanae's existing 5,781 food_entries without modification.

### Verification plan

1. Run migration via `scripts/run-migration.mjs 014`.
2. Verify the default row exists for Lanae: `SELECT * FROM user_nutrition_goals;`.
3. Load /log on port 3005 and confirm the card renders.
4. Log a known-low-FODMAP meal during a follicular day, confirm green feedback. Log a known-high-FODMAP meal during a luteal day (use a test date), confirm neutral note.
5. Verify across 30 days of existing food_entries that daily totals compute correctly by spot-checking 3 random days against MyNetDiary CSV source.
6. Check that no UPDATE or DELETE was issued against food_entries (audit via Supabase logs).
7. Screenshot at /log for the implementation-notes.md appendix.

### Risks

- Preset targets are opinionated. If Lanae disagrees with sodium=5000 (for instance), custom_overrides must cleanly override. Test override path.
- Cycle phase changes cross-day. If the migration runs mid-day the initial cycle phase calculation must be idempotent.
- Iron guidance during heavy bleed days might conflict with anti-inflammatory score (red meat is pro-iron but pro-inflammatory). Make explicit in preset doc: prefer iron-rich plants and fish over red meat, supplement via Vitamin C pairing.
- Low FODMAP pool may be too restrictive for Lanae's existing meal rotation. Verify against her 5,781 history.

---

## Feature 2: Cycle-aware AI Nutrition Coach

### File targets

Create:
- `/Users/clancybond/lanaehealth/src/lib/intelligence/personas/nutrition-coach.ts`
  - Exports `buildNutritionCoachPrompt(context)` that produces a static-first, dynamic-last Claude system prompt with the `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` marker. Scope is dietitian-only advice, flags clinical stuff to doctor, pulls cycle phase from dynamic context.
- `/Users/clancybond/lanaehealth/src/app/api/nutrition-coach/route.ts`
  - POST endpoint. Takes `{ question: string }`. Calls `assembler.ts` to build context, then Claude Sonnet with the persona prompt.
- `/Users/clancybond/lanaehealth/src/components/chat/NutritionCoachChat.tsx`
  - A chat panel component. Loads prior nutrition coach messages from chat_messages with a subject tag. Renders current conversation.

Modify:
- `/Users/clancybond/lanaehealth/src/lib/context/assembler.ts`
  - Add a new mode `nutrition-coach` that includes:
    - Always: patient core, active problems, current cycle phase, medications with nutrition-interaction flags
    - On topic match: food trigger history, lab results (iron, B12, vitamin D, glucose), last 30 days of food_entries summary
    - pgvector search for prior meals semantically similar to the question
- `/Users/clancybond/lanaehealth/src/app/chat/page.tsx`
  - Add a tab or subsection for "Nutrition Coach" alongside the existing clinical chat.
- `/Users/clancybond/lanaehealth/src/lib/ai/chat-tools.ts`
  - Optionally add tool definitions for "log_meal_from_advice" so the coach can offer to log a suggested meal directly.

Do NOT modify:
- `food_entries` schema
- `health_profile`
- `chat_messages` schema (reuse with a subject='nutrition_coach' tag)

### Data model

Zero new tables.

Chat messages reuse existing `chat_messages` table with a new subject value `nutrition_coach`. Messages are append-only, read-only history aligns with existing rules.

Claude call flow:
1. User question submitted to route.
2. Assembler builds static system prompt (cached) + dynamic context (cycle phase, recent meals, preset).
3. Claude Sonnet with prompt caching on.
4. Response streamed back.
5. Message stored in chat_messages with subject='nutrition_coach'.
6. If response contains foods worth indexing, chunk to health_embeddings as usual.

### Component plan

New:
- `NutritionCoachChat.tsx` uses the existing chat UI patterns from the Chat page. Reuses the streaming response renderer. New component shell, borrowed internals.
- `AskNutritionCoachButton.tsx` small button on /log page that opens the coach panel pre-filled with a meal context ("About this breakfast...").

Reuse:
- Existing chat streaming infra
- Existing assembler, compaction, handoff
- Existing pgvector search via `src/lib/context/vector-store.ts`

### Acceptance criteria

- User taps "Ask Nutrition Coach" on /log.
- A panel opens with a text input. Input pre-fills with current meal context if coming from a logged meal.
- User asks "Why am I so bloated after pasta?" The coach replies grounded in Lanae's actual 30-day meal log with: acknowledgment that she logged pasta 4 times in 2 weeks, luteal-phase high FODMAP concern, cites prior meals (with dates), suggests low FODMAP pasta swap, flags "if bloating is severe or >3 days, see your doctor."
- Response is plain language, cites data where possible, never makes diagnostic claims.
- Conversation history persists in chat_messages.
- Works with current cycle phase from cycle-calculator.
- Latency under 5 seconds for first token.

### Verification plan

1. Test static/dynamic boundary in the persona prompt: grep for `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__`.
2. Test cache hit: second call to same question within 1 hour must hit Anthropic prompt cache (log cache_read_input_tokens > 0).
3. Test cycle-awareness: inject a test cycle phase, confirm response wording changes.
4. Test pgvector grounding: ask about a specific food Lanae logged 5 times, confirm the coach cites at least 2 of those dates.
5. Test safety: ask "Am I gaining weight because of PCOS?" Coach must NOT diagnose, must redirect to her doctor, must NOT use shame language.
6. Test ad-hoc: ask 10 realistic questions, manually grade appropriateness.
7. Check chat_messages table afterward: subject='nutrition_coach' rows exist, no UPDATEs to other rows.

### Risks

- Hallucination on clinical specifics (iron RDA, sodium targets, etc.). Mitigation: ground in preset values from feature 1, cite sources in response.
- Cost: Sonnet calls with full context could hit $0.02-0.05 per question. Prompt caching reduces dramatically on repeat topics.
- User over-trust on AI advice. Mitigation: every response ends with "this is general guidance, not medical advice."
- Tone drift if user is distressed. Mitigation: system prompt includes explicit tone guardrails (warm, clinically precise, never shame).
- Scope creep into non-nutrition topics. Mitigation: system prompt scope-limits and redirects to clinical chat persona for other domains.

---

## Feature 3: Verified-source badge on food search autocomplete

### File targets

Create:
- `/Users/clancybond/lanaehealth/src/lib/nutrition/source-quality.ts`
  - Exports `scoreFoodSource(food)` returning `{ score: 0-1, source: 'usda'|'off'|'user'|'unknown', verified: boolean }`.
  - Exports `sortByTrust(foods, userHistoryKeys)` returning results ordered: verified-first, then user-history frequency, then all others.

Modify:
- `/Users/clancybond/lanaehealth/src/components/log/FoodSearchAutocomplete.tsx`
  - Call `sortByTrust` on results before rendering.
  - Add a small sage-colored "Verified" badge on entries with `verified: true`.
  - Visually demote entries with `verified: false` (lighter text, smaller size).
  - Add aria-label "Verified by USDA" or "Verified by OpenFoodFacts" for accessibility.
- `/Users/clancybond/lanaehealth/src/lib/api/open-food-facts.ts`
  - Ensure every returned row includes a `source: 'off'` and completeness score when available.
- `/Users/clancybond/lanaehealth/src/lib/api/usda-food.ts`
  - Ensure every returned row includes a `source: 'usda'`.
- `/Users/clancybond/lanaehealth/src/lib/food-database.ts`
  - Update `FoodSearchResult` interface to include `source` and `verified` fields.

Do NOT modify:
- `food_entries` schema
- Any stored rows

### Data model

Zero new tables. All changes are runtime metadata on API responses.

FoodSearchResult becomes:

```
interface FoodSearchResult {
  barcode: string | null
  name: string
  brand: string | null
  calories_per_100g: number | null
  image_url: string | null
  nutriscore_grade: string | null
  categories: string[]
  source: 'usda' | 'off' | 'user' | 'unknown'   // new
  verified: boolean                              // new
  sourceScore: number                            // new: 0-1
}
```

### Component plan

New:
- `VerifiedBadge.tsx` tiny 16x16 icon with tooltip, sage-colored outlined checkmark. Reusable across food search results.

Reuse:
- Existing `FoodSearchAutocomplete` structure
- Existing OpenFoodFacts and USDA API modules

### Acceptance criteria

- Type "chicken" in the food search on /log.
- First results are USDA-verified entries with a "Verified" sage badge.
- User-history matches appear high in the list even if not verified (history weighted equally).
- No crowd-sourced entries appear (we never had them, this is a policy lock).
- Tapping a verified entry produces the same log flow as before.
- Visual demotion on low-completeness entries is subtle, not shame-y.

### Verification plan

1. Test search on 10 common foods (banana, chicken breast, oatmeal, etc.). Confirm verified entries surface first.
2. Test search for known Lanae foods (from her 5,781 history). Confirm history matches rank high.
3. Test search for obscure ethnic foods. Confirm fallback to OpenFoodFacts with appropriate source labels.
4. Test accessibility: screen reader announces "Verified by USDA" on badged entries.
5. Test performance: autocomplete latency remains <300ms.
6. Screenshot the updated search UI at /log.

### Risks

- Trust inflation: users may over-trust "Verified" labels. Mitigation: tooltip explains what verified means (came from USDA FoodData Central, not "medically approved").
- Missing entries: if an entry has no source field (legacy), default to `source: 'unknown', verified: false`. Make sure this never breaks rendering.
- Badge visual noise: if every entry shows a badge, it stops meaning anything. Only show on actual verified sources.
- Latency: running sortByTrust per keystroke must be cheap. Profile before shipping.

---

## Cross-feature notes

- All three features can ship in parallel. No shared file conflicts after the planning.
- Feature 1 depends on cycle-calculator which is stable. Feature 2 depends on assembler which is stable. Feature 3 depends only on API responses and rendering.
- After features ship, update `docs/competitive/matrix.md` with:
  - `Condition-aware nutrition preset | mynetdiary | Partial -> Shipped | ...`
  - `Cycle-aware AI nutrition coach | mynetdiary | N -> Shipped | ...`
  - `Verified-source badge | mynetdiary | N -> Shipped | ...`
- Total estimated effort: 16 to 20 hours focused. Can be one subagent sprint or split across three subagents using worktree isolation (no file overlap).

## Post-ship

- Feed feature 1's preset progress into feature 2's AI coach context so advice aligns with active preset.
- Consider exporting feature 1's goals to the weekly report (deferred rank 4 in plan.md).
- If feature 3 performs well, extend the verified-source pattern to the barcode scanner fallback and recipe imports.
