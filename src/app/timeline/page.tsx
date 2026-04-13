import { supabase } from "@/lib/supabase";
import type { MedicalTimelineEvent } from "@/lib/types";
import { TimelineClient } from "@/components/timeline/TimelineClient";

export default async function TimelinePage() {
  const { data, error } = await supabase
    .from("medical_timeline")
    .select("*")
    .order("event_date", { ascending: false });

  const events = (data || []) as MedicalTimelineEvent[];

  return (
    <div className="px-4 pt-6 pb-safe">
      <h1
        className="text-2xl font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Timeline
      </h1>
      <p
        className="mt-1 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        Your complete medical history at a glance
      </p>

      <TimelineClient events={events} />
    </div>
  );
}
