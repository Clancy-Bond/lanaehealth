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
import { MealOverflow } from '@/components/calories/MealOverflow';
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

// GAP #7: URL-state-driven collapsible meal sections. MyNetDiary lets
// you collapse any meal to just its header; we mirror that with a
// `?collapsed=breakfast,lunch` URL param so the state is bookmarkable
// and survives without client JS. Each meal header renders a chevron
// link that toggles its meal in/out of the collapsed list.
function parseCollapsedParam(raw: string | undefined): Set<MealType> {
  const out = new Set<MealType>();
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const t = part.trim().toLowerCase();
    if (t === 'breakfast' || t === 'lunch' || t === 'dinner' || t === 'snack') {
      out.add(t);
    }
  }
  return out;
}

function toggleCollapseHref(
  date: string,
  collapsed: Set<MealType>,
  toggling: MealType,
): string {
  const next = new Set(collapsed);
  if (next.has(toggling)) next.delete(toggling);
  else next.add(toggling);
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (next.size > 0) params.set('collapsed', [...next].join(','));
  const qs = params.toString();
  return qs ? `/calories/food?${qs}#${toggling}` : `/calories/food#${toggling}`;
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
  searchParams: Promise<{ date?: string; collapsed?: string }>;
}) {
  const supabase = createServiceClient();
  const params = await searchParams;
  const viewDate = parseDateParam(params.date);
  const collapsed = parseCollapsedParam(params.collapsed);
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

      {/* Sub-nav tab row (Dashboard | Food | Analysis) + settings gear (GAP #12) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <CaloriesSubNav current="food" />
        <a
          href="/calories/plan"
          aria-label="Food tab settings (edit calorie + macro targets)"
          title="Edit calorie + macro targets"
          className="press-feedback"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M10 6.667v6.666M6.667 10h6.666M10 2.5l1.333 2 2.334.333-1.667 1.834.334 2.333L10 8L7.666 9l.334-2.333L6.333 4.833L8.667 4.5z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0"
            />
            <circle cx="10" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M10 2.5v2.2M10 15.3v2.2M17.5 10h-2.2M4.7 10H2.5M15.3 4.7l-1.56 1.56M6.26 13.74L4.7 15.3M15.3 15.3l-1.56-1.56M6.26 6.26L4.7 4.7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span>Settings</span>
        </a>
      </div>

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
              <th style={thStyle('right')}>Total Fat g</th>
              <th style={thStyle('right')}>Carbs g</th>
              <th style={thStyle('right')}>Protein g</th>
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
              const isCollapsed = collapsed.has(mt);
              return (
                <MealSection
                  key={mt}
                  meal={mt}
                  label={MEAL_LABEL[mt]}
                  items={items}
                  mealCalories={mealCalories}
                  macros={mealMacros}
                  viewDate={viewDate}
                  isCollapsed={isCollapsed}
                  toggleHref={toggleCollapseHref(viewDate, collapsed, mt)}
                />
              );
            })}
            {/* Daily totals row (MFN merges "left vs target" into a
                smaller grey sub-line under each total, not a second row). */}
            <tr
              style={{
                background: 'var(--accent-sage-muted)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <td style={tdStyle('left', true)}>Daily totals</td>
              <DailyTotalCell total={totalCals} left={Math.max(0, CALORIE_TARGET - totalCals)} />
              <DailyTotalCell total={totals.fat} left={Math.max(0, MACRO_TARGETS.fat - totals.fat)} />
              <DailyTotalCell total={totals.carbs} left={Math.max(0, MACRO_TARGETS.carbs - totals.carbs)} />
              <DailyTotalCell total={totals.protein} left={Math.max(0, MACRO_TARGETS.protein - totals.protein)} />
              <td style={tdStyle('center', true)}>&mdash;</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.satFat)}</td>
              <td style={tdStyle('right', true)}>{Math.round(totals.transFat)}</td>
              <DailyTotalCell total={totals.fiber} left={Math.max(0, MACRO_TARGETS.fiber - totals.fiber)} />
              <DailyTotalCell total={totals.sodium} left={Math.max(0, MACRO_TARGETS.sodium - totals.sodium)} />
              <DailyTotalCell total={totals.calcium} left={Math.max(0, MACRO_TARGETS.calcium - totals.calcium)} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bottom hero (MFN parity): 3-column layout — macro bars LEFT,
          apple ring CENTER, per-column remaining stats RIGHT. */}
      <div
        className="food-bottom-hero"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 220px minmax(0, 1.3fr)',
          gap: 14,
          alignItems: 'center',
          padding: '14px 16px',
          borderRadius: 14,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Left: macro bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MacroBarRow label="Fat" pct={fatPct} grams={totals.fat} target={MACRO_TARGETS.fat} color="var(--phase-luteal)" />
          <MacroBarRow label="Carbs" pct={carbsPct} grams={totals.carbs} target={MACRO_TARGETS.carbs} color="var(--accent-sage)" />
          <MacroBarRow label="Protein" pct={proteinPct} grams={totals.protein} target={MACRO_TARGETS.protein} color="var(--phase-ovulatory)" />
        </div>
        {/* Center: apple ring */}
        <CalorieApple
          eaten={totalCals}
          target={CALORIE_TARGET}
          remaining={remaining}
          overTarget={overTarget}
        />
        {/* Right: per-nutrient "left vs target" */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
            gap: 6,
          }}
        >
          <NutrientRemaining label="Total Fat" value={Math.max(0, MACRO_TARGETS.fat - totals.fat)} target={MACRO_TARGETS.fat} />
          <NutrientRemaining label="Carbs" value={Math.max(0, MACRO_TARGETS.carbs - totals.carbs)} target={MACRO_TARGETS.carbs} />
          <NutrientRemaining label="Protein" value={Math.max(0, MACRO_TARGETS.protein - totals.protein)} target={MACRO_TARGETS.protein} />
          <NutrientRemaining label="Fiber" value={Math.max(0, MACRO_TARGETS.fiber - totals.fiber)} target={MACRO_TARGETS.fiber} />
          <NutrientRemaining label="Sodium" value={Math.max(0, MACRO_TARGETS.sodium - totals.sodium)} target={MACRO_TARGETS.sodium} />
          <NutrientRemaining label="Calcium" value={Math.max(0, MACRO_TARGETS.calcium - totals.calcium)} target={MACRO_TARGETS.calcium} />
        </div>
        <style>{`
          @media (max-width: 900px) {
            .food-bottom-hero {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
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
  isCollapsed,
  toggleHref,
}: {
  meal: MealType;
  label: string;
  items: FoodEntryRow[];
  mealCalories: number;
  macros: ReturnType<typeof m>;
  viewDate: string;
  isCollapsed: boolean;
  toggleHref: string;
}) {
  return (
    <>
      {/* Section header row */}
      <tr
        id={meal}
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
              alignItems: 'center',
              gap: 12,
            }}
          >
            <a
              href={toggleHref}
              aria-label={isCollapsed ? `Expand ${label.toLowerCase()} section` : `Collapse ${label.toLowerCase()} section`}
              aria-expanded={!isCollapsed}
              className="press-feedback"
              style={{
                width: 24,
                height: 24,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                background: 'transparent',
                textDecoration: 'none',
                fontSize: 12,
                transition: 'transform 120ms ease',
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
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
          <MealOverflow date={viewDate} meal={meal} hasItems={items.length > 0} />
        </td>
      </tr>
      {/* Collapsed: skip items + subtotal. Header carries the totals. */}
      {isCollapsed && null}
      {/* Empty state */}
      {!isCollapsed && items.length === 0 && (
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
      {!isCollapsed && items.map((e) => {
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
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.fat ?? 0))}</td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.carbs ?? 0))}</td>
          <td style={tdStyle('right')}>{Math.round(Number(e.macros?.protein ?? 0))}</td>
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
      {!isCollapsed && items.length > 0 && (
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
          <td style={tdStyle('right')}>{Math.round(macros.fat)}</td>
          <td style={tdStyle('right')}>{Math.round(macros.carbs)}</td>
          <td style={tdStyle('right')}>{Math.round(macros.protein)}</td>
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

// MFN Food tab: horizontal macro bar with inline "% cals, % under"
// annotation — the layout on the left side of the bottom hero.
function MacroBarRow({
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
  const ratio = target > 0 ? Math.min(1, grams / target) : 0;
  const underPct = target > 0 ? Math.max(0, Math.round(((target - grams) / target) * 100)) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          <span className="tabular" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pct}%</span>
          {' cals, '}
          <span className="tabular">{underPct}%</span> under
        </span>
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
    </div>
  );
}

// MFN Food tab: small per-nutrient remaining tile, right side of hero.
function NutrientRemaining({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span className="tabular" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
        {Math.round(value)}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
        left {Math.round(target)}
      </span>
    </div>
  );
}

// MFN-style totals cell: big number on top, muted "left N" under.
function DailyTotalCell({ total, left }: { total: number; left: number }) {
  return (
    <td style={tdStyle('right', true)}>
      <div>{Math.round(total)}</div>
      <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>
        left {Math.round(left)}
      </div>
    </td>
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
