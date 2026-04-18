/**
 * Stale / pending test detection.
 *
 * Scans medical_timeline for event_type='test' entries whose title or
 * description indicates the test was ordered but never resulted, then
 * cross-references lab_results to confirm no matching result landed.
 *
 * Why: the Challenger persona repeatedly flags that labs ordered weeks
 * ago (tryptase, C1 esterase inhibitor, etc.) block diagnostic criteria
 * evaluation when they quietly never come back. Surface them in the
 * brief so the doctor (or patient) can chase the lab.
 *
 * This is deterministic; no LLM call. Runs in the same parallel-fetch
 * pass as the other doctor-brief analytics.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface StaleTest {
  testName: string;          // best-effort extracted test name
  orderedOn: string;         // ISO date the order event was logged
  daysPending: number;       // age in days from ordered_on to today
  source: string;            // free-text reference for the doctor
  orderedBy: string | null;  // "Dr. Kuo" etc. when parseable
  timelineEventId: string;   // row ID for citation
  severity: "urgent" | "overdue" | "watch";  // urgent >= 30d, overdue 14-29d, watch 7-13d
}

interface TimelineTestRow {
  id: string;
  event_date: string;
  title: string;
  description: string | null;
}

interface LabRow {
  test_name: string;
  date: string;
  value: number | null;
}

const ORDER_THRESHOLD_DAYS = 7; // minimum age before we consider a pending test "watch-worthy"
const PENDING_KEYWORDS = [
  "pending",
  "in-progress",
  "in progress",
  "not yet resulted",
  "awaiting",
  "awaited",
  "result pending",
  "result awaited",
];

function containsPendingSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return PENDING_KEYWORDS.some((k) => lower.includes(k));
}

/** Pull a sensible test name out of the event title/description. Examples:
 *   "Tryptase test ordered..." -> "Tryptase"
 *   "C1 Esterase Inhibitor pending" -> "C1 Esterase Inhibitor"
 *   "TSH drawn, result pending" -> "TSH"
 *
 * Falls back to the first sentence when no capitalized run matches.
 */
function extractTestName(title: string, description: string | null): string {
  // Strip common prefixes/suffixes
  const firstClause =
    title.split(/[.:;(]/, 1)[0]
      .replace(/\btest(ing)?\b/i, "")
      .replace(/\bordered\b/i, "")
      .replace(/\b(by|from)\b.*$/i, "")
      .trim();
  if (firstClause.length > 0 && firstClause.length < 80) return firstClause;

  const desc = description ?? "";
  const match = desc.match(/([A-Z][A-Za-z0-9\- ]{2,40})\s+(pending|in-progress|not yet)/i);
  if (match) return match[1].trim();

  return title.slice(0, 80);
}

/** Parse "ordered by Dr. X" or "Dr. X" from free text. */
function extractOrderer(title: string, description: string | null): string | null {
  const haystack = `${title} ${description ?? ""}`;
  const m = haystack.match(/(?:ordered by|by)\s+(Dr\.?\s+[A-Z][A-Za-z\-]+(?:\s+[A-Z]\.?\s*[A-Za-z\-]*)?)/);
  return m ? m[1].trim() : null;
}

function daysBetween(iso: string): number {
  const then = new Date(iso + "T00:00:00").getTime();
  return Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
}

function severityFor(days: number): StaleTest["severity"] {
  if (days >= 30) return "urgent";
  if (days >= 14) return "overdue";
  return "watch";
}

/** Best-effort match between an order's test_name and a resulted lab. */
function resultExistsFor(testName: string, orderDate: string, labs: LabRow[]): boolean {
  const needle = testName.toLowerCase().trim();
  if (!needle) return false;
  for (const lab of labs) {
    if (lab.date < orderDate) continue;
    const haystack = lab.test_name.toLowerCase();
    // Require at least a sentence-level match: needle appears as substring of lab test_name
    if (haystack.includes(needle) || needle.includes(haystack)) return true;
  }
  return false;
}

export async function computeStaleTests(
  sb: SupabaseClient,
): Promise<StaleTest[]> {
  try {
    const [timelineResult, labResult] = await Promise.all([
      sb
        .from("medical_timeline")
        .select("id, event_date, title, description")
        .eq("event_type", "test")
        .order("event_date", { ascending: false })
        .limit(50),
      sb
        .from("lab_results")
        .select("test_name, date, value")
        .order("date", { ascending: false })
        .limit(200),
    ]);

    const rows = (timelineResult.data ?? []) as TimelineTestRow[];
    const labs = (labResult.data ?? []) as LabRow[];

    const candidates: StaleTest[] = [];

    for (const row of rows) {
      const combined = `${row.title} ${row.description ?? ""}`;
      if (!containsPendingSignal(combined)) continue;

      const age = daysBetween(row.event_date);
      if (age < ORDER_THRESHOLD_DAYS) continue;

      const testName = extractTestName(row.title, row.description);
      if (resultExistsFor(testName, row.event_date, labs)) continue;

      candidates.push({
        testName,
        orderedOn: row.event_date,
        daysPending: age,
        source: row.title.length > 120 ? row.title.slice(0, 117) + "..." : row.title,
        orderedBy: extractOrderer(row.title, row.description),
        timelineEventId: row.id,
        severity: severityFor(age),
      });
    }

    // Also detect pending tests mentioned inside OTHER event descriptions.
    // e.g. "C1 Esterase Inhibitor pending" buried in a ferritin event.
    // Pattern: "<test-name> pending" where test-name is 2-4 capitalized words.
    for (const row of rows) {
      const desc = row.description ?? "";
      const inlineMatches = desc.matchAll(
        /([A-Z][A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,3})\s+(pending|in[- ]progress|not yet resulted|awaited)/g,
      );
      for (const m of inlineMatches) {
        const testName = m[1].trim();
        if (testName.toLowerCase() === "result") continue; // "result pending" is already captured
        // Avoid adding when the event's primary title was already captured above
        if (candidates.some((c) => c.testName.toLowerCase() === testName.toLowerCase())) continue;
        const age = daysBetween(row.event_date);
        if (age < ORDER_THRESHOLD_DAYS) continue;
        if (resultExistsFor(testName, row.event_date, labs)) continue;

        candidates.push({
          testName,
          orderedOn: row.event_date,
          daysPending: age,
          source: `Mentioned in "${row.title.slice(0, 80)}${row.title.length > 80 ? "..." : ""}"`,
          orderedBy: extractOrderer(row.title, row.description),
          timelineEventId: row.id,
          severity: severityFor(age),
        });
      }
    }

    // Sort by severity (urgent first) then daysPending descending.
    const sevRank: Record<StaleTest["severity"], number> = { urgent: 0, overdue: 1, watch: 2 };
    candidates.sort((a, b) => {
      if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity];
      return b.daysPending - a.daysPending;
    });

    return candidates.slice(0, 8);
  } catch {
    return [];
  }
}
