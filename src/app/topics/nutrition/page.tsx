/**
 * Nutrition Topic Page
 *
 * Fourth anchor in the /topics/* family. Pulls from food_entries and
 * daily_logs to show today's calorie total, 7-day trend, macro
 * breakdown, and trigger-food patterns.
 *
 * Default calorie target = 1800 for Lanae (24F, baseline).
 * Config-ready but hardcoded for MVP. Future: pull from health_profile.
 *
 * Not diagnostic. Educational + tracking. Complements MyNetDiary-style
 * food logging on /log.
 */

import { createServiceClient } from '@/lib/supabase';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const CALORIE_TARGET = 1800;

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

export default async function NutritionTopic() {
  const supabase = createServiceClient();
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const sevenAgo = format(new Date(now.getTime() - 7 * 86400000), 'yyyy-MM-dd');

  // Fetch last 7 days of daily_logs to join against food_entries.
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('id, date')
    .gte('date', sevenAgo)
    .lte('date', today)
    .order('date', { ascending: true });

  const dailyLogs = (((logs ?? []) as unknown) as DailyLogLite[]);
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

  // Index entries by log_id -> date
  const logIdToDate = new Map(dailyLogs.map((l) => [l.id, l.date]));

  // Per-day calorie totals.
  const caloriesByDate = new Map<string, number>();
  const entriesByDate = new Map<string, FoodEntryRow[]>();
  for (const e of entries) {
    const d = logIdToDate.get(e.log_id) ?? null;
    if (!d) continue;
    caloriesByDate.set(d, (caloriesByDate.get(d) ?? 0) + (e.calories ?? 0));
    const bucket = entriesByDate.get(d) ?? [];
    bucket.push(e);
    entriesByDate.set(d, bucket);
  }

  const todayEntries = entriesByDate.get(today) ?? [];
  const todayCalories = caloriesByDate.get(today) ?? 0;
  const todayMacros = sumMacros(todayEntries);

  const remaining = Math.max(0, CALORIE_TARGET - todayCalories);
  const overTarget = todayCalories > CALORIE_TARGET;
  const ratio = Math.min(1, todayCalories / CALORIE_TARGET);

  // Trigger-food count over last 7 days.
  const triggerCount = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.flagged_triggers ?? []) {
      triggerCount.set(t, (triggerCount.get(t) ?? 0) + 1);
    }
  }
  const topTriggers = [...triggerCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '16px',
        maxWidth: 720,
        margin: '0 auto',
        paddingBottom: 96,
      }}
    >
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

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Topic
        </span>
        <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
          Nutrition
        </h1>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          Calories today, how your week is tracking, and which foods have
          been flagged as triggers. Food search and logging are on the Log
          page, backed by USDA FoodData Central (the same database
          MyNetDiary uses).
        </p>
      </div>

      {/* Today calorie ring */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '16px 18px',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
          border: '1px solid var(--border-light)',
          borderLeftWidth: 3,
          borderLeftStyle: 'solid',
          borderLeftColor: overTarget
            ? 'var(--accent-blush-light)'
            : 'var(--accent-sage)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
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
            Today\u2019s calories
          </span>
          <span className="tabular" style={{ fontSize: 22, fontWeight: 700 }}>
            {Math.round(todayCalories)} / {CALORIE_TARGET}
          </span>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: 'var(--border-light)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round(ratio * 100)}%`,
              height: '100%',
              background: overTarget
                ? 'var(--accent-blush-light)'
                : 'var(--accent-sage)',
            }}
          />
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          {overTarget
            ? `Over target by ${Math.round(todayCalories - CALORIE_TARGET)} cal.`
            : todayCalories === 0
              ? 'No meals logged yet today.'
              : `${Math.round(remaining)} cal remaining before target.`}
        </p>
      </div>

      {/* Macros grid */}
      {todayEntries.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
          }}
        >
          <MacroTile label="Fat" value={todayMacros.fat} unit="g" />
          <MacroTile label="Carbs" value={todayMacros.carbs} unit="g" />
          <MacroTile label="Protein" value={todayMacros.protein} unit="g" />
          <MacroTile label="Fiber" value={todayMacros.fiber} unit="g" />
          <MacroTile label="Sodium" value={todayMacros.sodium} unit="mg" />
        </div>
      )}

      {/* 7-day calorie trend */}
      <WeekCalorieChart
        entries={dailyLogs.map((l) => ({
          date: l.date,
          calories: caloriesByDate.get(l.date) ?? 0,
        }))}
      />

      {/* Trigger foods */}
      {topTriggers.length > 0 && (
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
            {topTriggers.map(([trigger, count]) => (
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
      )}

      {/* Explainer */}
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
            5000+ mg sodium per day (vs the typical 1500-2300 mg guideline).
            Under-salt can worsen orthostatic symptoms. Track the Sodium tile.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Migraine triggers</strong> &middot; Common dietary
            triggers include aged cheese, cured meats, MSG, chocolate, and
            alcohol. The Log flags them automatically when detected.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Fiber + gut health</strong> &middot; Endometriosis and
            IBS overlap heavily. Fiber under 20g/day is associated with more
            severe GI symptoms in cycling women.
          </p>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Calorie target (1800) is a placeholder until your health profile
            resolves your exact TDEE. Override in Settings.
          </p>
        </div>
      </div>

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
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function MacroTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
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
      <span style={{ fontSize: 13, fontWeight: 600 }}>
        <span className="tabular">{Math.round(value)}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 3 }}>
          {unit}
        </span>
      </span>
    </div>
  );
}

function WeekCalorieChart({
  entries,
}: {
  entries: Array<{ date: string; calories: number }>;
}) {
  if (entries.length === 0) {
    return null;
  }
  const max = Math.max(CALORIE_TARGET, ...entries.map((e) => e.calories));

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
          const over = e.calories > CALORIE_TARGET;
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
        Sage = under target ({CALORIE_TARGET} cal). Blush = over.
      </div>
    </div>
  );
}
