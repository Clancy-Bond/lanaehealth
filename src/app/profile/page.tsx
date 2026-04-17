import { createServiceClient } from "@/lib/supabase";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { parseProfileContent } from "@/lib/profile/parse-content";

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

  // Build a section map from health_profile rows. Route every content value
  // through parseProfileContent so legacy JSON-stringified rows (pre-W2.6)
  // and raw jsonb objects both land as usable structures for ProfileClient.
  const profileSections: Record<string, unknown> = {};
  const rows = (profileResult.data ?? []) as HealthProfileRow[];
  for (const row of rows) {
    profileSections[row.section] = parseProfileContent(row.content);
  }

  const narrativeRows = (narrativeResult.data ?? []) as NarrativeRow[];

  return (
    <div
      className="profile-page"
      style={{
        paddingLeft: "var(--space-4)",
        paddingRight: "var(--space-4)",
        paddingTop: "var(--space-3)",
        paddingBottom: "var(--space-6)",
      }}
    >
      <ProfilePageHeader />
      <ProfileClient
        profileSections={profileSections}
        narrativeRows={narrativeRows}
      />
    </div>
  );
}

function ProfilePageHeader() {
  return (
    <>
      {/* Mobile/tablet: centered narrow reading column */}
      <div
        className="lg:hidden"
        style={{ maxWidth: 640, margin: "0 auto" }}
      >
        <h1 className="page-title">Health Profile</h1>
        <p
          className="mt-1 mb-4 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Your complete medical profile, editable anytime.
        </p>
      </div>

      {/* Desktop: wider header matching split-pane max */}
      <div
        className="hidden lg:block"
        style={{ maxWidth: 1120, margin: "0 auto" }}
      >
        <h1 className="page-title">Health Profile</h1>
        <p
          className="mt-1 mb-4 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Your complete medical profile, editable anytime.
        </p>
      </div>
    </>
  );
}
