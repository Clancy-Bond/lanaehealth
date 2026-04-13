import { createServiceClient } from "@/lib/supabase";
import { SettingsClient } from "@/components/settings/SettingsClient";

// Live data check for Oura tokens
export const dynamic = "force-dynamic";

interface OuraTokenInfo {
  connected: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
}

export default async function SettingsPage() {
  const sb = createServiceClient();

  // Check Oura connection status
  const { data: tokenRow } = await sb
    .from("oura_tokens")
    .select("expires_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ouraInfo: OuraTokenInfo = {
    connected: !!tokenRow,
    expiresAt: tokenRow?.expires_at ?? null,
    updatedAt: tokenRow?.updated_at ?? null,
  };

  return (
    <div className="px-4 pt-6 pb-safe" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1
        className="text-2xl font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Settings
      </h1>
      <p className="mt-1 mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
        Connections, data, and app info
      </p>

      <SettingsClient oura={ouraInfo} />
    </div>
  );
}
