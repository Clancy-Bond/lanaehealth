import { getPrivacyPrefs } from "@/lib/api/privacy-prefs";
import { PrivacySettings } from "@/components/settings/PrivacySettings";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * /settings/privacy
 *
 * Three-toggle privacy panel plus full ZIP export trigger. The row is
 * loaded server-side from privacy_prefs (migration 025). The three
 * toggles are:
 *   - allow_claude_context       (hard gates the context assembler)
 *   - allow_correlation_analysis
 *   - retain_history_beyond_2y
 *
 * See Wave 2e F10 brief. Voice is neutral, not adherence-framed.
 */
export default async function PrivacyPage() {
  const prefs = await getPrivacyPrefs();

  return (
    <div
      className="px-4 pt-6 pb-safe route-desktop-wide"
      style={{ maxWidth: 640, margin: "0 auto" }}
    >
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm mb-3"
        style={{ color: "var(--text-secondary)" }}
      >
        <ChevronLeft size={14} /> Back to Settings
      </Link>

      <h1 className="page-title">Privacy</h1>
      <p className="mt-1 mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
        Control what LanaeHealth shares with the AI assistant and how
        long your records stay. Every toggle is reversible; nothing here
        deletes data immediately.
      </p>

      <PrivacySettings initial={prefs} />
    </div>
  );
}
