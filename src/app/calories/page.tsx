/**
 * Nutrition Dashboard (MyNetDiary-style)
 *
 * Rebuild of the original topic explainer into a MyNetDiary-equivalent
 * daily dashboard, at Clancy's direction on 2026-04-17. Matches the
 * structure Lanae already uses in MyNetDiary:
 *
 *   [week-day strip navigator]
 *   [central calorie budget ring + side stats (exercise, water, steps,
 *    breakfast, lunch, dinner, snacks)]
 *   [macro bars: carbs / protein / fat with % of cals and grams left]
 *   [daily analysis prompt]
 *   [weight plan card, if weight data available]
 *   [7-day calorie trend]
 *   [trigger foods]
 *   [explainer + citations + CTA]
 *
 * Data:
 *   - Meals + calories + macros: food_entries joined via daily_logs.id
 *   - Exercise calories, steps: placeholder (Oura activity not yet piped
 *     in; tiles render with "--" and a "coming soon" hint until
 *     migration 028 adds daily_activity surface)
 *   - Water, Notes: placeholder (future water_intake table)
 *   - Weight: placeholder (future weight_entries table)
 *
 * URL param: ?date=YYYY-MM-DD to view past days. Default is today.
 *
 * Not diagnostic. Daily-use dashboard for calorie and macro tracking.
 */

import { createServiceClient } from '@/lib/supabase';
import { format, addDays, startOfDay } from 'date-fns';
import { TopicCycleBanner } from '@/components/topics/TopicCycleBanner';
import { ResearchCitations } from '@/components/topics/ResearchCitations';
import { CaloriesSubNav } from '@/components/calories/SubNav';
import { WeightPlanCard } from '@/components/calories/WeightPlanCard';
import { QuickLogFab } from '@/components/calories/QuickLogFab';
import { TipsCard } from '@/components/calories/TipsCard';
import { CalorieApple } from '@/components/calories/CalorieApple';
import { loadNutritionGoals } from '@/lib/calories/goals';
import { loadWaterLog, glassesForDate } from '@/lib/calories/water';
import { loadWeightLog, kgToLb, latestEntry } from '@/lib/calories/weight';
import { loadActivityForDate } from '@/lib/calories/activity';

export const dynamic = 'force-dynamic';

// Goal values come from health_profile.nutrition_goals via
// loadNutritionGoals(). Fallbacks match MyNetDiary's defaults for Lanae.

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

interface FoodEntryRow {
  id: string;
  log_id: string;
  meal_type: string | null;
  food_items: string | null;
  calories: number | null;
  macros: Record<string, number> | null;
  flagged_triggers: string[] | null;
  logged_at: string;
}

interface DailyLogLite {
  id: string;
  date: string;
  notes: string | null;
}

function parseDateParam(raw: string | undefined): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (!raw) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today;
  return raw;
}

function sumMacros(entries: FoodEntryRow[]): {
  fat: number;
  carbs: number;
  protein: number;
  fiber: number;
  sodium: number;
} {
  const totals = { fat: 0, carbs: 0, protein: 0, fiber: 0, sodium: 0 };
  for (const e of entries) {
    if (!e.macros) continue;
    totals.fat += Number(e.macros.fat ?? 0) || 0;
    totals.carbs += Number(e.macros.carbs ?? 0) || 0;
    totals.protein += Number(e.macros.protein ?? 0) || 0;
    totals.fiber += Number(e.macros.fiber ?? 0) || 0;
    totals.sodium += Number(e.macros.sodium ?? 0) || 0;
  }
  return totals;
}

function bucketMeals(entries: FoodEntryRow[]): Record<MealType, FoodEntryRow[]> {
  const buckets: Record<MealType, FoodEntryRow[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const e of entries) {
    const mt = (e.meal_type ?? 'snack').toLowerCase() as MealType;
    if (mt in buckets) buckets[mt].push(e);
    else buckets.snack.push(e);
  }
  return buckets;
}

function mealCalories(entries: FoodEntryRow[]): number {
  return entries.reduce((acc, e) => acc + (e.calories ?? 0), 0);
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

export default async function NutritionTopic({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = createServiceClient();
  const params = await searchParams;
  const viewDate = parseDateParam(params.date);
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const isToday = viewDate === todayISO;

  // Build the 10-day strip centered on viewDate (7 days back, 2 forward)
  // to mirror MyNetDiary's week-strip. Parsing with T00 so we respect
  // the user's local timezone reading, not UTC.
  const viewDateObj = startOfDay(new Date(viewDate + 'T00:00:00'));
  // Match MyNetDiary's month-wide strip. 30 days back, today, 2 forward.
  const weekStripDates: Date[] = [];
  for (let i = -27; i <= 2; i++) {
    weekStripDates.push(addDays(viewDateObj, i));
  }

  // 7-day window for the trend chart.
  const sevenAgoISO = format(addDays(viewDateObj, -6), 'yyyy-MM-dd');

  // Nutrition goals from health_profile.section='nutrition_goals'.
  // Falls back to MFN defaults when not yet set.
  const [goals, waterLog, weightLog, activity] = await Promise.all([
    loadNutritionGoals(),
    loadWaterLog(),
    loadWeightLog(),
    loadActivityForDate(viewDate),
  ]);
  const calorieTarget = goals.calorieTarget;
  const macroTargets = {
    carbs: goals.macros.carbsG,
    protein: goals.macros.proteinG,
    fat: goals.macros.fatG,
  };
  const glassesToday = glassesForDate(waterLog, viewDate);
  const latestWeight = latestEntry(weightLog);

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('id, date, notes')
    .gte('date', sevenAgoISO)
    .lte('date', viewDate)
    .order('date', { ascending: true });

  const dailyLogs = (((logs ?? []) as unknown) as DailyLogLite[]);
  const viewLog = dailyLogs.find((l) => l.date === viewDate) ?? null;

  const logIds = dailyLogs.map((l) => l.id);
  const { data: foodRows } =
    logIds.length > 0
      ? await supabase
          .from('food_entries')
          .select(
            'id, log_id, meal_type, food_items, calories, macros, flagged_triggers, logged_at',
          )
          .in('log_id', logIds)
      : { data: [] };

  const entries = (((foodRows ?? []) as unknown) as FoodEntryRow[]);

  const logIdToDate = new Map(dailyLogs.map((l) => [l.id, l.date]));
  const entriesByDate = new Map<string, FoodEntryRow[]>();
  const caloriesByDate = new Map<string, number>();
  for (const e of entries) {
    const d = logIdToDate.get(e.log_id) ?? null;
    if (!d) continue;
    const bucket = entriesByDate.get(d) ?? [];
    bucket.push(e);
    entriesByDate.set(d, bucket);
    caloriesByDate.set(d, (caloriesByDate.get(d) ?? 0) + (e.calories ?? 0));
  }

  const viewEntries = entriesByDate.get(viewDate) ?? [];
  const viewCalories = caloriesByDate.get(viewDate) ?? 0;
  const viewMacros = sumMacros(viewEntries);
  const meals = bucketMeals(viewEntries);

  const remaining = Math.max(0, calorieTarget - viewCalories);
  const overTarget = viewCalories > calorieTarget;

  // Macro calorie contribution (carbs 4, protein 4, fat 9).
  const carbsCals = viewMacros.carbs * 4;
  const proteinCals = viewMacros.protein * 4;
  const fatCals = viewMacros.fat * 9;
  const totalMacroCals = Math.max(1, carbsCals + proteinCals + fatCals);
  const carbsPct = Math.round((carbsCals / totalMacroCals) * 100);
  const proteinPct = Math.round((proteinCals / totalMacroCals) * 100);
  const fatPct = Math.round((fatCals / totalMacroCals) * 100);

  const triggerCount = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.flagged_triggers ?? []) {
      triggerCount.set(t, (triggerCount.get(t) ?? 0) + 1);
    }
  }
  const topTriggers = [...triggerCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '16px',
        maxWidth: 880,
        margin: '0 auto',
        paddingBottom: 96,
      }}
    >
      {/* Breadcrumb + cycle banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <a
          href="/"
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 5L7.5 10L12.5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Home
        </a>
        <TopicCycleBanner />
      </div>

      {/* Hero + sub-nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
          Calories
        </h1>
        <CaloriesSubNav current="dashboard" />
      </div>

      {/* Date nav: "< Today / Fri Apr 17 >" + week strip */}
      <DateNav viewDate={viewDate} todayISO={todayISO} />
      <WeekStrip
        dates={weekStripDates}
        viewDate={viewDate}
        caloriesByDate={caloriesByDate}
      />

      {/* Central calorie budget widget (apple-inspired). Side stats in
          a 2-col layout that collapses to stacked on mobile. */}
      <DashboardGrid
        glasses={glassesToday}
        steps={activity.steps}
        activeCalories={activity.activeCalories}
        weightLb={latestWeight ? kgToLb(latestWeight.kg) : null}
        viewDate={viewDate}
        viewCalories={viewCalories}
        target={calorieTarget}
        remaining={remaining}
        overTarget={overTarget}
        meals={meals}
        notes={viewLog?.notes ?? null}
      />

      {/* Macro bars */}
      <MacroBars
        carbs={viewMacros.carbs}
        protein={viewMacros.protein}
        fat={viewMacros.fat}
        fiber={viewMacros.fiber}
        sodium={viewMacros.sodium}
        carbsPct={carbsPct}
        proteinPct={proteinPct}
        fatPct={fatPct}
        targets={macroTargets}
      />

      {/* Daily analysis prompt (mirrors MyNetDiary "log > 400 cal" card) */}
      {isToday && (
        <DailyAnalysisPrompt
          viewCalories={viewCalories}
          entriesLogged={viewEntries.length}
        />
      )}

      {/* Weight Plan card (MFN parity GAP #1) - current weight +
          trajectory chart + weigh-in/plan/chart action row. */}
      <WeightPlanCard log={weightLog} goals={goals} />

      {/* Tips card (MFN parity GAP #2) - rotating condition-aware
          advice, deterministic by date so it doesn't flicker on
          reload. */}
      <TipsCard date={viewDate} />

      {/* 7-day calorie trend */}
      <WeekCalorieChart
        entries={dailyLogs.map((l) => ({
          date: l.date,
          calories: caloriesByDate.get(l.date) ?? 0,
        }))}
        target={calorieTarget}
      />

      {/* Trigger foods */}
      {topTriggers.length > 0 && (
        <TriggerFoods triggers={topTriggers} />
      )}

      {/* CTA */}
      <a
        href="/log"
        className="press-feedback"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)',
          color: 'var(--text-inverse)',
          textDecoration: 'none',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Log a meal</span>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path
            d="M7.5 5L12.5 10L7.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>

      {/* Explainer */}
      <ExplainerCard />

      {/* Citations */}
      <ResearchCitations
        citations={[
          {
            label:
              'USDA FoodData Central: canonical source for food and nutrient data',
            url: 'https://fdc.nal.usda.gov/',
            source: 'USDA',
          },
          {
            label:
              'POTS sodium recommendations: 3000-10000 mg/day for volume expansion',
            url: 'https://www.dysautonomiainternational.org/page.php?ID=44',
            source: 'Dysautonomia International',
          },
          {
            label:
              'Common dietary migraine triggers (aged cheese, cured meats, MSG, alcohol)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/29858819/',
            source: 'PubMed 29858819',
          },
        ]}
      />

      {/* QuickLogFab - floating "+" with 6-item menu (MFN parity GAP #13) */}
      <QuickLogFab />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Components
// ────────────────────────────────────────────────────────────────────

function DateNav({ viewDate, todayISO }: { viewDate: string; todayISO: string }) {
  const d = new Date(viewDate + 'T00:00:00');
  const prev = format(addDays(d, -1), 'yyyy-MM-dd');
  const next = format(addDays(d, 1), 'yyyy-MM-dd');
  const isToday = viewDate === todayISO;
  const label = isToday ? 'Today' : format(d, 'EEE MMM d');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderRadius: 12,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <a
        href={`/calories?date=${prev}`}
        className="press-feedback"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            d="M12.5 5L7.5 10L12.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </a>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
      <a
        href={`/calories?date=${next}`}
        className="press-feedback"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            d="M7.5 5L12.5 10L7.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </a>
    </div>
  );
}

function WeekStrip({
  dates,
  viewDate,
  caloriesByDate,
}: {
  dates: Date[];
  viewDate: string;
  caloriesByDate: Map<string, number>;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${dates.length}, 1fr)`,
        gap: 4,
      }}
    >
      {dates.map((d) => {
        const iso = format(d, 'yyyy-MM-dd');
        const isViewed = iso === viewDate;
        const cal = caloriesByDate.get(iso) ?? 0;
        return (
          <a
            key={iso}
            href={`/calories?date=${iso}`}
            className="press-feedback"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 2px',
              borderRadius: 10,
              background: isViewed ? 'var(--accent-sage)' : 'var(--bg-card)',
              color: isViewed ? 'var(--text-inverse)' : 'var(--text-primary)',
              textDecoration: 'none',
              border: '1px solid',
              borderColor: isViewed
                ? 'var(--accent-sage)'
                : 'var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                opacity: 0.8,
              }}
            >
              {format(d, 'EEE')}
            </span>
            <span
              className="tabular"
              style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}
            >
              {format(d, 'd')}
            </span>
            {cal > 0 && (
              <span
                className="tabular"
                style={{
                  fontSize: 9,
                  color: isViewed ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontWeight: 600,
                  opacity: 0.9,
                }}
              >
                {Math.round(cal)}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}

function DashboardGrid({
  viewCalories,
  target,
  remaining,
  overTarget,
  meals,
  notes,
  glasses,
  steps,
  activeCalories,
  weightLb,
  viewDate,
}: {
  viewCalories: number;
  target: number;
  remaining: number;
  overTarget: boolean;
  meals: Record<MealType, FoodEntryRow[]>;
  notes: string | null;
  glasses: number;
  steps: number | null;
  activeCalories: number | null;
  weightLb: number | null;
  viewDate: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr)',
        gap: 10,
        alignItems: 'stretch',
      }}
    >
      {/* Left stats column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SideStatLink
          href={`/calories/health/weight`}
          label="Weight"
          value={weightLb !== null ? weightLb.toFixed(1) : '\u2014'}
          unit={weightLb !== null ? 'lb' : ''}
          hint={weightLb !== null ? 'tap to chart' : 'tap to weigh-in'}
        />
        <SideStat
          label="Exercise"
          value={activeCalories !== null ? Math.round(activeCalories).toString() : '\u2014'}
          unit={activeCalories !== null ? 'cal' : ''}
          hint={activeCalories !== null ? 'Oura active cal' : 'awaiting Oura sync'}
        />
        <SideStat
          label="Steps"
          value={steps !== null ? steps.toLocaleString() : '\u2014'}
          unit=""
          hint={steps !== null ? 'today from Oura' : 'awaiting Oura sync'}
        />
        <WaterStat glasses={glasses} date={viewDate} />
        <SideStat
          label="Notes"
          value={notes ? '1' : '\u2014'}
          unit={notes ? 'note' : ''}
          hint={notes ? notes.slice(0, 40) : 'no note yet'}
        />
      </div>

      {/* Central calorie apple */}
      <CalorieApple
        eaten={viewCalories}
        target={target}
        remaining={remaining}
        overTarget={overTarget}
      />

      {/* Right meal buckets column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MEAL_ORDER.map((m) => (
          <MealBucket
            key={m}
            label={MEAL_LABEL[m]}
            calories={mealCalories(meals[m])}
            itemCount={meals[m].length}
          />
        ))}
      </div>
    </div>
  );
}

function SideStatLink({
  href,
  label,
  value,
  unit,
  hint,
}: {
  href: string;
  label: string;
  value: string | number;
  unit: string;
  hint?: string;
}) {
  return (
    <a
      href={href}
      className="press-feedback"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        minHeight: 56,
        justifyContent: 'center',
        textDecoration: 'none',
        color: 'var(--text-primary)',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700 }}>
        <span className="tabular">{value}</span>
        {unit && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              marginLeft: 3,
              fontWeight: 600,
            }}
          >
            {unit}
          </span>
        )}
      </span>
      {hint && (
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {hint}
        </span>
      )}
    </a>
  );
}

function WaterStat({ glasses, date }: { glasses: number; date: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        minHeight: 56,
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        Water
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <form action="/api/water/log" method="post" style={{ display: 'inline' }}>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="delta" value="-1" />
          <input type="hidden" name="returnTo" value={`/calories?date=${date}`} />
          <button
            type="submit"
            aria-label="Remove a glass"
            disabled={glasses <= 0}
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: '1px solid var(--border-light)',
              background: 'var(--bg-primary)',
              fontSize: 13,
              fontWeight: 700,
              color: glasses <= 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: glasses <= 0 ? 'default' : 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            &minus;
          </button>
        </form>
        <span style={{ fontSize: 13, fontWeight: 700 }} className="tabular">
          {glasses}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
          gl
        </span>
        <form action="/api/water/log" method="post" style={{ display: 'inline' }}>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="delta" value="1" />
          <input type="hidden" name="returnTo" value={`/calories?date=${date}`} />
          <button
            type="submit"
            aria-label="Add a glass"
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: '1px solid var(--accent-sage)',
              background: 'var(--accent-sage)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-inverse)',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            +
          </button>
        </form>
      </div>
    </div>
  );
}

function SideStat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string | number;
  unit: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        minHeight: 56,
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700 }}>
        <span className="tabular">{value}</span>
        {unit && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              marginLeft: 3,
              fontWeight: 600,
            }}
          >
            {unit}
          </span>
        )}
      </span>
      {hint && (
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function MealBucket({
  label,
  calories,
  itemCount,
}: {
  label: string;
  calories: number;
  itemCount: number;
}) {
  const empty = calories === 0;
  return (
    <a
      href={`/log#${label.toLowerCase()}`}
      className="press-feedback"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 10px',
        borderRadius: 10,
        background: empty ? 'var(--bg-card)' : 'var(--accent-sage-muted)',
        border: '1px solid',
        borderColor: empty ? 'var(--border-light)' : 'var(--accent-sage)',
        boxShadow: 'var(--shadow-sm)',
        textDecoration: 'none',
        color: 'var(--text-primary)',
        minHeight: 56,
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700 }}>
        <span className="tabular">{Math.round(calories)}</span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginLeft: 3,
            fontWeight: 600,
          }}
        >
          cal
        </span>
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
        {itemCount === 0
          ? 'tap + to add'
          : `${itemCount} item${itemCount === 1 ? '' : 's'}`}
      </span>
    </a>
  );
}


function MacroBars({
  carbs,
  protein,
  fat,
  fiber,
  sodium,
  carbsPct,
  proteinPct,
  fatPct,
  targets,
}: {
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  sodium: number;
  carbsPct: number;
  proteinPct: number;
  fatPct: number;
  targets: { carbs: number; protein: number; fat: number };
}) {
  const macroTargets = targets;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 16px',
        borderRadius: 14,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <MacroRow
        label="Carbs"
        pct={carbsPct}
        grams={carbs}
        target={macroTargets.carbs}
        color="var(--accent-sage)"
      />
      <MacroRow
        label="Protein"
        pct={proteinPct}
        grams={protein}
        target={macroTargets.protein}
        color="var(--phase-ovulatory)"
      />
      <MacroRow
        label="Fat"
        pct={fatPct}
        grams={fat}
        target={macroTargets.fat}
        color="var(--phase-luteal)"
      />
      {(fiber > 0 || sodium > 0) && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            paddingTop: 8,
            borderTop: '1px solid var(--border-light)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span>
            Fiber <span className="tabular" style={{ color: 'var(--text-primary)' }}>{Math.round(fiber)}g</span>
          </span>
          <span>
            Sodium{' '}
            <span className="tabular" style={{ color: 'var(--text-primary)' }}>
              {Math.round(sodium)}mg
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function MacroRow({
  label,
  pct,
  grams,
  target,
  color,
}: {
  label: string;
  pct: number;
  grams: number;
  target: number;
  color: string;
}) {
  const ratio = Math.min(1, grams / target);
  const left = Math.max(0, target - grams);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          <span className="tabular" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {pct}%
          </span>{' '}
          cals &middot;{' '}
          <span className="tabular">left {Math.round(left)}g</span>
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'var(--border-light)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: '100%',
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function DailyAnalysisPrompt({
  viewCalories,
  entriesLogged,
}: {
  viewCalories: number;
  entriesLogged: number;
}) {
  const ready = viewCalories >= 400;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span style={{ fontSize: 20 }} aria-hidden>
        {ready ? '\u{1F52C}' : '\u{1F4DD}'}
      </span>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
        {ready ? (
          <>
            <strong>Daily analysis ready.</strong> You&rsquo;ve logged{' '}
            <span className="tabular">{entriesLogged}</span> items totaling{' '}
            <span className="tabular">{Math.round(viewCalories)}</span> calories.
            Full correlation vs. symptoms on the Patterns page.
          </>
        ) : (
          <>
            Log more than 400 calories today to unlock the daily analysis
            (macro balance, symptom correlation, diet tips).
          </>
        )}
      </div>
      {ready && (
        <a
          href="/patterns"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent-sage)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Daily analysis &rarr;
        </a>
      )}
    </div>
  );
}

function WeekCalorieChart({
  entries,
  target,
}: {
  entries: Array<{ date: string; calories: number }>;
  target: number;
}) {
  if (entries.length === 0) return null;
  const max = Math.max(target, ...entries.map((e) => e.calories));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 16px',
        borderRadius: 14,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        7-day calorie trend
      </span>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {entries.map((e) => {
          const heightPct = max > 0 ? (e.calories / max) * 100 : 0;
          const over = e.calories > target;
          return (
            <div
              key={e.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  height: `${heightPct}%`,
                  width: '100%',
                  borderRadius: '4px 4px 0 0',
                  background: over
                    ? 'var(--accent-blush-light)'
                    : e.calories === 0
                      ? 'var(--border-light)'
                      : 'var(--accent-sage)',
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                {format(new Date(e.date + 'T00:00:00'), 'EEE')}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Sage = under target ({target} cal). Blush = over.
      </div>
    </div>
  );
}

function TriggerFoods({ triggers }: { triggers: Array<[string, number]> }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 16px',
        borderRadius: 14,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Flagged triggers this week
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {triggers.map(([trigger, count]) => (
          <span
            key={trigger}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--accent-blush-muted)',
              color: 'var(--text-primary)',
            }}
          >
            {trigger}
            <span
              className="tabular"
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {count}x
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ExplainerCard() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 16px',
        borderRadius: 14,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Why this matters for chronic illness
      </span>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>POTS sodium</strong> &middot; Many POTS patients need
          3000-10000 mg sodium per day (vs the typical 1500-2300 mg guideline).
          Under-salt can worsen orthostatic symptoms. Watch the Sodium row on
          macro summaries.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Migraine triggers</strong> &middot; Common dietary triggers
          include aged cheese, cured meats, MSG, chocolate, and alcohol. The
          Log flags them automatically when detected.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Fiber + gut health</strong> &middot; Endometriosis and IBS
          overlap heavily. Fiber under 20g/day is associated with more severe
          GI symptoms in cycling women.
        </p>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Food database is USDA FoodData Central (same source MyNetDiary
          runs on). All foods, nutrients, and calorie values come from USDA.
        </p>
      </div>
    </div>
  );
}
