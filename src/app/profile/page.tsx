import { createServiceClient } from "@/lib/supabase";
import { ProfileClient } from "@/components/profile/ProfileClient";

// Live data from health_profile
export const dynamic = "force-dynamic";

interface HealthProfileRow {
  section: string;
  content: unknown;
}

interface NarrativeRow {
  id: string;
  section_title: string;
  content: string;
  section_order: number;
  updated_at: string;
}

export default async function ProfilePage() {
  const sb = createServiceClient();

  // Fetch health_profile and medical_narrative in parallel
  const [profileResult, narrativeResult] = await Promise.all([
    sb.from("health_profile").select("section, content"),
    sb
      .from("medical_narrative")
      .select("id, section_title, content, section_order, updated_at")
      .order("section_order", { ascending: true }),
  ]);

  // Build a section map from health_profile rows
  const profileSections: Record<string, unknown> = {};
  const rows = (profileResult.data ?? []) as HealthProfileRow[];
  for (const row of rows) {
    profileSections[row.section] = row.content;
  }

  const narrativeRows = (narrativeResult.data ?? []) as NarrativeRow[];

  return (
    <div className="px-4 pt-6 pb-safe" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1
        className="text-2xl font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Health Profile
      </h1>
      <p className="mt-1 mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
        Your complete medical profile, editable anytime
      </p>

      <ProfileClient
        profileSections={profileSections}
        narrativeRows={narrativeRows}
      />
    </div>
  );
}
