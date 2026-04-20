import Link from "next/link";
import { createServiceClient } from "@/lib/supabase";
import { YearInPixels } from "@/components/patterns/YearInPixels";
import { buildPixelDays } from "@/lib/patterns/pixel-data";
import { format, subDays } from "date-fns";
import TriggerCorrelationGrid from "@/components/symptoms/TriggerCorrelationGrid";
import {
  buildCorrelationGrid,
  buildDateRange,
  type CorrelationCell,
} from "@/lib/symptoms/correlation";
import { loadTopTriggers } from "@/lib/symptoms/queries";
import type {
  DailyLog,
  OuraDaily,
  NcImported,
  CycleEntry,
  FoodEntry,
  Symptom,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Symptom patterns · LanaeHealth",
};

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  try {
    const { data } = await run();
    return (data ?? []) as T[];
  } catch {
    return [] as T[];
  }
}

export default async function SymptomPatternsPage() {
  const sb = createServiceClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const yearCutoff = format(subDays(new Date(), 365), "yyyy-MM-dd");
  const windowDays = 28;
  const windowCutoff = format(subDays(new Date(), windowDays - 1), "yyyy-MM-dd");
  const windowCutoffIso = `${windowCutoff}T00:00:00.000Z`;

  const [
    yearDailyLogs,
    yearOura,
    yearCycle,
    yearNc,
    windowDailyLogs,
    windowFood,
    windowSymptoms,
  ] = await Promise.all([
    safeSelect<Pick<DailyLog, "date" | "overall_pain" | "fatigue" | "cycle_phase">>(
      () =>
        sb
          .from("daily_logs")
          .select("date, overall_pain, fatigue, cycle_phase")
          .gte("date", yearCutoff)
          .order("date", { ascending: true })
          .limit(400) as unknown as Promise<{
          data: Pick<DailyLog, "date" | "overall_pain" | "fatigue" | "cycle_phase">[] | null;
        }>,
    ),
    safeSelect<Pick<OuraDaily, "date" | "sleep_score" | "hrv_avg">>(() =>
      sb
        .from("oura_daily")
        .select("date, sleep_score, hrv_avg")
        .gte("date", yearCutoff)
        .order("date", { ascending: true })
        .limit(400) as unknown as Promise<{
        data: Pick<OuraDaily, "date" | "sleep_score" | "hrv_avg">[] | null;
      }>,
    ),
    safeSelect<Pick<CycleEntry, "date" | "flow_level" | "menstruation">>(() =>
      sb
        .from("cycle_entries")
        .select("date, flow_level, menstruation")
        .gte("date", yearCutoff)
        .order("date", { ascending: true })
        .limit(400) as unknown as Promise<{
        data: Pick<CycleEntry, "date" | "flow_level" | "menstruation">[] | null;
      }>,
    ),
    safeSelect<Pick<NcImported, "date" | "menstruation" | "cycle_day">>(() =>
      sb
        .from("nc_imported")
        .select("date, menstruation, cycle_day")
        .gte("date", yearCutoff)
        .order("date", { ascending: true })
        .limit(400) as unknown as Promise<{
        data: Pick<NcImported, "date" | "menstruation" | "cycle_day">[] | null;
      }>,
    ),
    safeSelect<Pick<DailyLog, "id" | "date" | "overall_pain">>(() =>
      sb
        .from("daily_logs")
        .select("id, date, overall_pain")
        .gte("date", windowCutoff)
        .lte("date", today)
        .order("date", { ascending: true }) as unknown as Promise<{
        data: Pick<DailyLog, "id" | "date" | "overall_pain">[] | null;
      }>,
    ),
    safeSelect<Pick<FoodEntry, "logged_at" | "flagged_triggers">>(() =>
      sb
        .from("food_entries")
        .select("logged_at, flagged_triggers")
        .gte("logged_at", windowCutoffIso) as unknown as Promise<{
        data: Pick<FoodEntry, "logged_at" | "flagged_triggers">[] | null;
      }>,
    ),
    safeSelect<Pick<Symptom, "log_id" | "symptom" | "logged_at" | "severity">>(
      () =>
        sb
          .from("symptoms")
          .select("log_id, symptom, logged_at, severity")
          .gte("logged_at", windowCutoffIso) as unknown as Promise<{
          data: Pick<Symptom, "log_id" | "symptom" | "logged_at" | "severity">[] | null;
        }>,
    ),
  ]);

  const topTriggers = await loadTopTriggers(sb, windowDays, 8);

  const pixelDays = buildPixelDays({
    dailyLogs: yearDailyLogs,
    ouraDaily: yearOura,
    cycleEntries: yearCycle,
    ncImported: yearNc,
  });

  const dateRange = buildDateRange(windowDays);
  const logIdToDate = new Map<string, string>();
  for (const l of windowDailyLogs) logIdToDate.set(l.id, l.date);

  const triggersByDate = new Map<string, Set<string>>();
  const bump = (date: string, label: string) => {
    const clean = label.trim().toLowerCase();
    if (!clean) return;
    const set = triggersByDate.get(date) ?? new Set<string>();
    set.add(clean);
    triggersByDate.set(date, set);
  };
  for (const f of windowFood) {
    const d = f.logged_at.slice(0, 10);
    for (const t of f.flagged_triggers ?? []) bump(d, t);
  }

  const symptomsByDate = new Map<string, Set<string>>();
  for (const s of windowSymptoms) {
    const date = logIdToDate.get(s.log_id) ?? s.logged_at.slice(0, 10);
    const set = symptomsByDate.get(date) ?? new Set<string>();
    set.add(s.symptom.toLowerCase());
    symptomsByDate.set(date, set);
  }

  const allCells: CorrelationCell[] = buildCorrelationGrid({
    triggersByDate,
    symptomsByDate,
    dateRange,
  });

  // Keep only the top N triggers and top N symptoms so the grid fits mobile.
  const topTriggerNames = new Set(
    allCells
      .slice()
      .sort((a, b) => b.daysWithTrigger - a.daysWithTrigger)
      .map((c) => c.trigger)
      .slice(0, 6),
  );
  const topSymptomNames = new Set(
    allCells
      .slice()
      .sort((a, b) => b.daysWithBoth - a.daysWithBoth)
      .map((c) => c.symptom)
      .slice(0, 6),
  );
  const visibleCells = allCells.filter(
    (c) => topTriggerNames.has(c.trigger) && topSymptomNames.has(c.symptom),
  );

  const totalDays = dateRange.length;
  const daysWithSomeSymptom = [...symptomsByDate.values()].filter(
    (s) => s.size > 0,
  ).length;
  const daysWithNoSymptom = totalDays - daysWithSomeSymptom;

  return (
    <main
      style={{
        background: "var(--bg-primary)",
        minHeight: "100vh",
        paddingBottom: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          marginInline: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <nav
          aria-label="Breadcrumb"
          style={{
            display: "flex",
            gap: "0.5rem",
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          <Link href="/patterns" style={{ color: "var(--accent-sage)", textDecoration: "none" }}>
            Patterns
          </Link>
          <span>/</span>
          <span>Symptoms</span>
        </nav>
        <header>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "0 0 0.25rem",
            }}
          >
            Symptom patterns
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            Last {windowDays} days: {daysWithSomeSymptom} day
            {daysWithSomeSymptom === 1 ? "" : "s"} with a logged symptom,
            {" "}
            {daysWithNoSymptom} day{daysWithNoSymptom === 1 ? "" : "s"} with none.
            No-symptom days are data too.
          </p>
        </header>

        <section
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "0.75rem",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "var(--text-base)",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Year in pixels
            </h2>
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
              }}
            >
              Cycle phase shown as cell border
            </span>
          </header>
          <YearInPixels days={pixelDays} defaultMetric="pain" />
        </section>

        <TriggerCorrelationGrid cells={visibleCells} windowDays={windowDays} />

        <section
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Ranked triggers
          </h2>
          {topTriggers.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              Not enough trigger logs yet. Flag a trigger on a few food or pain
              entries and the ranking will fill in.
            </p>
          ) : (
            <ol
              style={{
                margin: 0,
                paddingLeft: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
              }}
            >
              {topTriggers.map((t) => (
                <li
                  key={`${t.source}-${t.label}`}
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-primary)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{t.label}</span>
                  <span
                    style={{
                      color: "var(--text-muted)",
                      marginLeft: "0.375rem",
                      fontSize: "var(--text-xs)",
                    }}
                  >
                    {t.linkedSymptomDays} symptom day
                    {t.linkedSymptomDays === 1 ? "" : "s"} of {t.occurrences}{" "}
                    exposure{t.occurrences === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Export
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
            }}
          >
            The full CSV/JSON export at /api/export/full includes every daily_log
            row, not just the ones with symptoms. That means no-symptom days
            round-trip too. Bearable users complained for years about exports
            that silently drop &quot;none&quot; rows; this one does not.
          </p>
        </section>
      </div>
    </main>
  );
}
