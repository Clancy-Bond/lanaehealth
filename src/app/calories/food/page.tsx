/**
 * Calories &raquo; Food table view
 *
 * Mirrors MyNetDiary's meals.do: dense table with column headers
 * (Food / amount / Calories / Carbs / Protein / Total Fat / Fiber /
 * Sodium / Calcium) and 4 expandable meal sections (BREAKFAST, LUNCH,
 * DINNER, SNACKS). Each section has an "Add" button that links into
 * the existing /log flow (which already uses USDA FoodData Central,
 * same backbone as MyNetDiary), plus inline totals.
 *
 * The bottom summary row mirrors MFN's daily totals with per-macro
 * "under target" callouts.
 *
 * Server component, single Supabase fetch.
 */

import { createServiceClient } from '@/lib/supabase';
import { format, addDays, startOfDay } from 'date-fns';
import { CaloriesSubNav } from '@/components/calories/SubNav';
import { CalorieApple } from '@/components/calories/CalorieApple';
import { gradeFood, gradeColor } from '@/lib/calories/food-grade';

export const dynamic = 'force-dynamic';

// Targets match /calories/page.tsx and MyNetDiary's defaults for Lanae.
const CALORIE_TARGET = 1761;
const MACRO_TARGETS = {
  carbs: 198,
  protein: 88,
  fat: 68,
  fiber: 25,
  sodium: 2300,
  calcium: 1200,
  satFat: 20,
};

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'BREAKFAST',
  lunch: 'LUNCH',
  dinner: 'DINNER',
  snack: 'SNACKS',
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

function parseDateParam(raw: string | undefined): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (!raw) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today;
  return raw;
}

function m(entries: FoodEntryRow[]): {
  fat: number;
  carbs: number;
  protein: number;
  fiber: number;
  sodium: number;
  calcium: number;
  satFat: number;
  transFat: number;
} {
  const totals = { fat: 0, carbs: 0, protein: 0, fiber: 0, sodium: 0, calcium: 0, satFat: 0, transFat: 0 };
  for (const e of entries) {
    if (!e.macros) continue;
    totals.fat += Number(e.macros.fat ?? 0) || 0;
    totals.carbs += Number(e.macros.carbs ?? 0) || 0;
    totals.protein += Number(e.macros.protein ?? 0) || 0;
    totals.fiber += Number(e.macros.fiber ?? 0) || 0;
    totals.sodium += Number(e.macros.sodium ?? 0) || 0;
    totals.calcium += Number(e.macros.calcium ?? 0) || 0;
    totals.satFat += Number(e.macros.satFat ?? e.macros.saturated_fat ?? 0) || 0;
    totals.transFat += Number(e.macros.transFat ?? e.macros.trans_fat ?? 0) || 0;
  }
  return totals;
}

function cal(entries: FoodEntryRow[]): number {
  return entries.reduce((acc, e) => acc + (e.calories ?? 0), 0);
}

export default async function CaloriesFoodView({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = createServiceClient();
  const params = await searchParams;
  const viewDate = parseDateParam(params.date);
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const isToday = viewDate === todayISO;
  const viewDateObj = startOfDay(new Date(viewDate + 'T00:00:00'));

  const { data: log } = await supabase
    .from('daily_logs')
    .select('id, date')
    .eq('date', viewDate)
    .maybeSingle();

  const logId = (log as { id: string } | null)?.id ?? null;

  const { data: foodRows } = logId
    ? await supabase
        .from('food_entries')
        .select(
          'id, log_id, meal_type, food_items, calories, macros, flagged_triggers, logged_at',
        )
        .eq('log_id', logId)
        .order('logged_at', { ascending: true })
    : { data: [] };

  const entries = (((foodRows ?? []) as unknown) as FoodEntryRow[]);

  const buckets: Record<MealType, FoodEntryRow[]> = {
    breakfast: [], lunch: [], dinner: [], snack: [],
  };
  for (const e of entries) {
    const mt = (e.meal_type ?? 'snack').toLowerCase() as MealType;
    if (mt in buckets) buckets[mt].push(e);
    else buckets.snack.push(e);
  }

  const totalCals = cal(entries);
  const totals = m(entries);
  const remaining = Math.max(0, CALORIE_TARGET - totalCals);
  const overTarget = totalCals > CALORIE_TARGET;

  const carbsCals = totals.carbs * 4;
  const proteinCals = totals.protein * 4;
  const fatCals = totals.fat * 9;
  const totalMacroCals = Math.max(1, carbsCals + proteinCals + fatCals);
  const carbsPct = Math.round((carbsCals / totalMacroCals) * 100);
  const proteinPct = Math.round((proteinCals / totalMacroCals) * 100);
  const fatPct = Math.round((fatCals / totalMacroCals) * 100);

  const prev = format(addDays(viewDateObj, -1), 'yyyy-MM-dd');
  const next = format(addDays(viewDateObj, 1), 'yyyy-MM-dd');
  const dateLabel = isToday ? 'Today' : format(viewDateObj, 'EEE MMM d');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '16px',
        maxWidth: 1100,
        margin: '0 auto',
        paddingBottom: 96,
      }}
    >
      {/* Top: breadcrumb + sub-nav + date nav + totals header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <a
          href="/calories"
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
          Calories
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href={`/calories/food?date=${prev}`}
            className="press-feedback"
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{dateLabel}</span>
          <a
            href={`/calories/food?date=${next}`}
            className="press-feedback"
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Calorie Budget{' '}
            <span className="tabular" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              {CALORIE_TARGET}
            </span>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            Eaten{' '}
            <span className="tabular" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              {Math.round(totalCals)}
            </span>
          </span>
          <span style={{ color: overTarget ? 'var(--accent-blush)' : 'var(--accent-sage)' }}>
            {overTarget ? 'Over' : 'Left'}{' '}
            <span className="tabular" style={{ fontWeight: 700 }}>
              {Math.round(overTarget ? totalCals - CALORIE_TARGET : remaining)}
            </span>
          </span>
        </div>
      </div>

      {/* Sub-nav tab row (Dashboard | Food | Analysis) */}
      <CaloriesSubNav current="food" />

      {/* Table */}
      <div
        style={{
          overflowX: 'auto',
          borderRadius: 14,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            minWidth: 880,
          }}
        >
          <thead>
            <tr
              style={{
                background: 'var(--accent-sage-muted)',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <th style={thStyle('left')}>Consumed food, amount</th>
              <th style={thStyle('right')}>Calories</th>
              <th style={thStyle('right')}>Carbs g</th>
              <th style={thStyle('right')}>Protein g</th>
              <th style={thStyle('right')}>Total Fat g</th>
              <th style={thStyle('center')}>Fd. Grade</th>
              <th style={thStyle('right')}>Sat Fat g</th>
              <th style={thStyle('right')}>Trans Fat g</th>
              <th style={thStyle('right')}>Fiber g</th>
              <th style={thStyle('right')}>Sodium mg</th>
              <th style={thStyle('right')}>Calcium mg</th>
            </tr>
          </thead>
          <tbody>
            {MEAL_ORDER.map((mt) => {
              const items = buckets[mt];
              const mealCalories = cal(items);
              const mealMacros = m(items);
              return (
                <MealSection
                  key={mt}
                  meal={mt}
                  label={MEAL_LABEL[mt]}
                  items={items}
                  mealCalories={mealCalories}
                  macros={mealMacros}
                  viewDate={viewDate}
                />
              );
            })}
            {/* Daily totals row */}
            <tr
              style={{
                background: 'var(--accent-sage-muted)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <td style={tdStyle('left', true)}>Daily totals</td>
              <td style={tdStyle('right', true)}>{Math.round(totalCals)}</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.carbs)}</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.protein)}</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.fat)}</td>
              <td style={tdStyle('center', true)}>&mdash;</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.satFat)}</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.transFat)}</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.fiber)}</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.sodium)}</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.calcium)}</td>
            </tr>
            <tr
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              <td style={tdStyle('left')}>Left vs target</td>
              <td style={tdStyle('right')}>{Math.round(Math.max(0, CALORIE_TARGET - totalCals))}</td>
              <td style={tdStyle('right')}>{Math.round(Math.max(0, MACRO_TARGETS.carbs - totals.carbs))}</td>
              <td style={tdStyle('right')}>{Math.round(Math.max(0, MACRO_TARGETS.protein - totals.protein))}</td>
              <td style={tdStyle('right')}>{Math.round(Math.max(0, MACRO_TARGETS.fat - totals.fat))}</td>
              <td style={tdStyle('center')}>&mdash;</td>
              <td style={tdStyle('right')}>&mdash;</td>
              <td style={tdStyle('right')}>&mdash;</td>
              <td style={tdStyle('right')}>{Math.round(Math.max(0, MACRO_TARGETS.fiber - totals.fiber))}</td>
              <td style={tdStyle('right')}>{Math.round(Math.max(0, MACRO_TARGETS.sodium - totals.sodium))}</td>
              <td style={tdStyle('right')}>{Math.round(Math.max(0, MACRO_TARGETS.calcium - totals.calcium))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Macro summary bars (mirrors MFN's under-target callouts) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <MacroSummary label="Carbs" pct={carbsPct} grams={totals.carbs} target={MACRO_TARGETS.carbs} color="var(--accent-sage)" />
        <MacroSummary label="Protein" pct={proteinPct} grams={totals.protein} target={MACRO_TARGETS.protein} color="var(--phase-ovulatory)" />
        <MacroSummary label="Fat" pct={fatPct} grams={totals.fat} target={MACRO_TARGETS.fat} color="var(--phase-luteal)" />
      </div>

      {/* Apple ring at the bottom (mirrors MyNetDiary Food tab) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 260px) 1fr',
          gap: 14,
          alignItems: 'center',
        }}
        className="food-apple-row"
      >
        <CalorieApple
          eaten={totalCals}
          target={CALORIE_TARGET}
          remaining={remaining}
          overTarget={overTarget}
        />
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Ring reads
          </span>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            {overTarget
              ? `Over target by ${Math.round(totalCals - CALORIE_TARGET)} cals. Macro mix is ${carbsPct}% carbs, ${proteinPct}% protein, ${fatPct}% fat.`
              : `${Math.round(remaining)} cals left. Macro mix so far is ${carbsPct}% carbs, ${proteinPct}% protein, ${fatPct}% fat.`}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Sage ring = under budget. Blush ring = over. Budget and macro targets come from your plan at{' '}
            <a href="/calories/plan" style={{ color: 'var(--accent-sage)', fontWeight: 600, textDecoration: 'none' }}>
              Calories &rsaquo; Plan
            </a>
            .
          </p>
        </div>
        <style>{`
          @media (max-width: 600px) {
            .food-apple-row {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>

      {/* CTA */}
      <a
        href="/log"
        className="press-feedback"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)',
          color: 'var(--text-inverse)',
          textDecoration: 'none',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>Add food (USDA search)</span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </a>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components + helpers
// ────────────────────────────────────────────────────────────────────

function MealSection({
  meal,
  label,
  items,
  mealCalories,
  macros,
  viewDate,
}: {
  meal: MealType;
  label: string;
  items: FoodEntryRow[];
  mealCalories: number;
  macros: ReturnType<typeof m>;
  viewDate: string;
}) {
  return (
    <>
      {/* Section header row */}
      <tr
        style={{
          background: 'var(--bg-primary)',
          borderTop: '2px solid var(--border-light)',
        }}
      >
        <td
          colSpan={11}
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: 'var(--text-primary)',
              }}
            >
              {label}
            </span>
            <a
              href={`/calories/search?view=search&meal=${meal}`}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--accent-sage)',
                textDecoration: 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              + Add
            </a>
            {items.length > 0 && (
              <span
                className="tabular"
                style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}
              >
                {Math.round(mealCalories)} cal &middot; {items.length} item{items.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </td>
      </tr>
      {/* Empty state */}
      {items.length === 0 && (
        <tr>
          <td
            colSpan={11}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            No items logged. Tap <strong>Add</strong> to search.
          </td>
        </tr>
      )}
      {/* Item rows */}
      {items.map((e) => {
        const itemGrade = gradeFood({
          calories: e.calories,
          protein: Number(e.macros?.protein ?? 0),
          fat: Number(e.macros?.fat ?? 0),
          carbs: Number(e.macros?.carbs ?? 0),
          fiber: Number(e.macros?.fiber ?? 0),
          sugar: Number(e.macros?.sugar ?? 0),
          sodium: Number(e.macros?.sodium ?? 0),
          satFat: Number(e.macros?.satFat ?? e.macros?.saturated_fat ?? 0),
          transFat: Number(e.macros?.transFat ?? e.macros?.trans_fat ?? 0),
          description: e.food_items,
        });
        return (
        <tr key={e.id} style={{ borderTop: '1px solid var(--border-light)' }}>
          <td style={tdStyle('left')}>{e.food_items ?? '\u2014'}</td>
          <td style={tdStyle('right')}>{Math.round(e.calories ?? 0)}</td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.carbs ?? 0))}</td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.protein ?? 0))}</td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.fat ?? 0))}</td>
          <td style={tdStyle('center')}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: 5,
                background: gradeColor(itemGrade.grade),
                color: 'var(--text-inverse)',
                fontSize: 11,
                fontWeight: 800,
              }}
              title={`Food grade ${itemGrade.grade} (score ${itemGrade.score}/100)`}
            >
              {itemGrade.grade}
            </span>
          </td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.satFat ?? e.macros?.saturated_fat ?? 0))}</td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.transFat ?? e.macros?.trans_fat ?? 0))}</td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.fiber ?? 0))}</td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.sodium ?? 0))}</td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.calcium ?? 0))}</td>
        </tr>
        );
      })}
      {/* Meal subtotal */}
      {items.length > 0 && (
        <tr
          style={{
            borderTop: '1px solid var(--border-light)',
            background: 'var(--bg-primary)',
            fontWeight: 600,
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          <td style={tdStyle('left')}>&nbsp;&nbsp;Subtotal</td>
          <td style={tdStyle('right')}>{Math.round(mealCalories)}</td>
          <td style={tdStyle('right')}>{Math.round(macros.carbs)}</td>
          <td style={tdStyle('right')}>{Math.round(macros.protein)}</td>
          <td style={tdStyle('right')}>{Math.round(macros.fat)}</td>
          <td style={tdStyle('center')}>&mdash;</td>
          <td style={tdStyle('right')}>{Math.round(macros.satFat)}</td>
          <td style={tdStyle('right')}>{Math.round(macros.transFat)}</td>
          <td style={tdStyle('right')}>{Math.round(macros.fiber)}</td>
          <td style={tdStyle('right')}>{Math.round(macros.sodium)}</td>
          <td style={tdStyle('right')}>{Math.round(macros.calcium)}</td>
        </tr>
      )}
    </>
  );
}

function MacroSummary({
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
  const underPct = Math.max(0, Math.round(((target - grams) / target) * 100));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          fontSize: 11,
        }}
      >
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>
          <span className="tabular" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {pct}%
          </span>{' '}
          cals,{' '}
          <span className="tabular">{underPct}%</span> under
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
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
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
        <span className="tabular" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {Math.round(grams)}g
        </span>{' '}
        &middot; left <span className="tabular">{Math.round(left)}g</span>
      </div>
    </div>
  );
}

function thStyle(align: 'left' | 'right' | 'center'): React.CSSProperties {
  return {
    padding: '10px 12px',
    textAlign: align,
    borderBottom: '1px solid var(--border-light)',
    whiteSpace: 'nowrap',
  };
}

function tdStyle(
  align: 'left' | 'right' | 'center',
  bold = false,
): React.CSSProperties {
  return {
    padding: '8px 12px',
    textAlign: align,
    fontWeight: bold ? 700 : 400,
    whiteSpace: 'nowrap',
  };
}
