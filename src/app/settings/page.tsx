// ARCHIVED: This legacy route is now redirected to /v2/settings via next.config.ts.
// Kept in source for fast revert. To revive: remove the redirect in next.config.ts.
// Cutover landed: 2026-04-25 (legacy → v2 unified merge).

import { createServiceClient } from "@/lib/supabase";
import { SettingsClient } from "@/components/settings/SettingsClient";
import MedicationReminders from "@/components/settings/MedicationReminders";
import type { MedicationReminder } from "@/lib/types";

// Live data check for Oura tokens
export const dynamic = "force-dynamic";

interface OuraTokenInfo {
  connected: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
}

export default async function SettingsPage() {
  const sb = createServiceClient();

  // Fetch Oura connection + medication reminders in parallel
  const [tokenResult, remindersResult] = await Promise.all([
    sb
      .from("oura_tokens")
      .select("expires_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("medication_reminders")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  const ouraInfo: OuraTokenInfo = {
    connected: !!tokenResult.data,
    expiresAt: tokenResult.data?.expires_at ?? null,
    updatedAt: tokenResult.data?.updated_at ?? null,
  };

  const reminders = (remindersResult.data || []) as MedicationReminder[];

  return (
    <div
      className="px-4 pt-6 pb-safe route-desktop-wide"
      style={{ maxWidth: 640, margin: "0 auto" }}
    >
      <h1 className="page-title">Settings</h1>
      <p className="mt-1 mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
        Connections, data, and app info
      </p>

      <SettingsClient oura={ouraInfo} />

      {/* Medication Reminders Section */}
      <div className="mt-6">
        <MedicationReminders initialReminders={reminders} />
      </div>

      {/* CSV Export is available at /api/export?format=csv; the SettingsClient Data Export section handles JSON */}
    </div>
  );
}
