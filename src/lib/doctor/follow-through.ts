/**
 * Post-Visit Follow-Through Tracker
 *
 * Looks at past appointments with captured action_items, then decides
 * which items are overdue based on either follow_up_date OR patterns
 * in the action_items text like "retest X in 6 weeks".
 *
 * Surfaces a list the user sees on the home banner and the doctor brief.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface FollowThroughItem {
  appointmentId: string;
  appointmentDate: string;
  specialty: string | null;
  doctorName: string | null;
  item: string;                 // the specific action-item line
  dueDate: string;              // ISO date
  daysOverdue: number;          // negative = not yet due
  kind: "explicit_date" | "parsed_phrase";
}

interface AppointmentRow {
  id: string;
  date: string;
  specialty: string | null;
  doctor_name: string | null;
  action_items: string | null;
  follow_up_date: string | null;
}

/** Parse strings like "in 6 weeks", "within 4-6 weeks", "in 2 months" into days. */
function parseDurationToDays(text: string): number | null {
  const weekMatch = text.match(/(?:in|within)\s+(\d+)(?:\s*[-–to]\s*\d+)?\s+week/i);
  if (weekMatch) return Number(weekMatch[1]) * 7;

  const monthMatch = text.match(/(?:in|within)\s+(\d+)(?:\s*[-–to]\s*\d+)?\s+month/i);
  if (monthMatch) return Number(monthMatch[1]) * 30;

  const dayMatch = text.match(/(?:in|within)\s+(\d+)(?:\s*[-–to]\s*\d+)?\s+day/i);
  if (dayMatch) return Number(dayMatch[1]);

  return null;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(aIso: string, bIso: string): number {
  const ms = new Date(aIso + "T00:00:00").getTime() - new Date(bIso + "T00:00:00").getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export async function computeFollowThrough(
  sb: SupabaseClient
): Promise<FollowThroughItem[]> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("appointments")
    .select("id, date, specialty, doctor_name, action_items, follow_up_date")
    .lt("date", today)
    .order("date", { ascending: false })
    .limit(30);

  if (error || !data) return [];

  const rows = data as AppointmentRow[];
  const items: FollowThroughItem[] = [];

  for (const appt of rows) {
    // 1. Explicit follow_up_date applies to the whole appointment's action plan
    if (appt.follow_up_date) {
      const daysOverdue = diffDays(today, appt.follow_up_date);
      items.push({
        appointmentId: appt.id,
        appointmentDate: appt.date,
        specialty: appt.specialty,
        doctorName: appt.doctor_name,
        item: appt.action_items ?? "Follow-up",
        dueDate: appt.follow_up_date,
        daysOverdue,
        kind: "explicit_date",
      });
    }

    // 2. Parse each line of action_items for "in N weeks/months" phrases
    if (appt.action_items) {
      const lines = appt.action_items
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      for (const line of lines) {
        const days = parseDurationToDays(line);
        if (days === null) continue;
        const dueDate = addDays(appt.date, days);
        const daysOverdue = diffDays(today, dueDate);

        // Avoid duplicating the explicit_date item if same due date
        if (appt.follow_up_date === dueDate) continue;

        items.push({
          appointmentId: appt.id,
          appointmentDate: appt.date,
          specialty: appt.specialty,
          doctorName: appt.doctor_name,
          item: line.replace(/^[-*]\s*/, ""),  // strip leading bullet
          dueDate,
          daysOverdue,
          kind: "parsed_phrase",
        });
      }
    }
  }

  // Sort: overdue first (largest daysOverdue), then approaching due
  items.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return items;
}
