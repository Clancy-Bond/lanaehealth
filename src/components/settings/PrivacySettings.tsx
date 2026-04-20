"use client";

import { useState, useCallback } from "react";
import { Shield, Brain, GitBranch, Archive, Check, AlertCircle, Download } from "lucide-react";
import type { PrivacyPrefs } from "@/lib/api/privacy-prefs";

interface Props {
  initial: PrivacyPrefs;
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

type DownloadState =
  | { status: "idle" }
  | { status: "downloading" }
  | { status: "error"; message: string };

/**
 * /settings/privacy client component. Three independent toggles backed
 * by the privacy_prefs row in Supabase, plus a full-ZIP export button.
 *
 * Auth: `Authorization: Bearer <APP_AUTH_TOKEN>` on every mutating
 * call. The admin token input is a stopgap until Track A's login UI
 * ships; once a valid session cookie exists the token input can stay
 * empty (the cookie satisfies requireAuth). The download previously
 * used `<a href=?token=>` — that leaked the token into browser
 * history, referer, and Vercel access logs (D-008). Replaced with
 * `fetch()` + blob URL so the token only ever rides the request
 * header.
 */
export function PrivacySettings({ initial }: Props) {
  const [prefs, setPrefs] = useState<PrivacyPrefs>(initial);
  const [adminToken, setAdminToken] = useState<string>("");
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [download, setDownload] = useState<DownloadState>({ status: "idle" });

  function authHeaders(): HeadersInit {
    // With a valid session cookie the header can be omitted; requireAuth
    // accepts either. Until the login UI ships the token input is the
    // fallback, so send it if present.
    return adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
  }

  const patch = useCallback(
    async (update: Partial<PrivacyPrefs>) => {
      setSave({ status: "saving" });
      try {
        const res = await fetch("/api/privacy-prefs", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify(update),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const next = (await res.json()) as PrivacyPrefs;
        setPrefs(next);
        setSave({ status: "saved" });
        setTimeout(() => setSave({ status: "idle" }), 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : "save failed";
        setSave({ status: "error", message });
      }
    },
    [adminToken],
  );

  const downloadFullExport = useCallback(async () => {
    setDownload({ status: "downloading" });
    try {
      const res = await fetch("/api/export/full", {
        method: "GET",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        const today = new Date().toISOString().slice(0, 10);
        a.download = `lanaehealth-full-${today}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        URL.revokeObjectURL(url);
      }
      setDownload({ status: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "download failed";
      setDownload({ status: "error", message });
    }
  }, [adminToken]);

  const toggles: Array<{
    key: keyof Pick<
      PrivacyPrefs,
      "allow_claude_context" | "allow_correlation_analysis" | "retain_history_beyond_2y"
    >;
    title: string;
    description: string;
    icon: React.ComponentType<{ size?: number }>;
  }> = [
    {
      key: "allow_claude_context",
      title: "Let Claude see my health data",
      description:
        "When on, the AI assistant reads your permanent health profile, recent summaries, and relevant records before every reply. When off, the assistant only receives its static instructions; it cannot recall anything about you until you share it in the chat.",
      icon: Brain,
    },
    {
      key: "allow_correlation_analysis",
      title: "Run background correlations on my data",
      description:
        "The correlation engine looks for patterns between symptoms, food, sleep, cycle phase, and weather. Turning this off pauses new correlation runs; previous results stay in place until you also delete them.",
      icon: GitBranch,
    },
    {
      key: "retain_history_beyond_2y",
      title: "Keep history older than 2 years",
      description:
        "When off, a future retention sweep will remove daily logs, symptoms, and similar records older than 24 months. Labs, imaging, and the medical timeline are never swept.",
      icon: Archive,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "1rem",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          padding: 16,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Shield size={18} />
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Admin token
          </h2>
        </div>
        <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
          LanaeHealth does not have user login yet. To change a privacy
          toggle or run a full export, paste the admin token configured
          in your server environment.
        </p>
        <input
          type="password"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          placeholder="PRIVACY_ADMIN_TOKEN / EXPORT_ADMIN_TOKEN"
          className="w-full"
          style={{
            padding: "8px 10px",
            borderRadius: "0.5rem",
            border: "1px solid var(--border-light)",
            background: "var(--bg-input, #fff)",
            fontSize: 14,
          }}
        />
      </div>

      {toggles.map(({ key, title, description, icon: Icon }) => {
        const value = prefs[key];
        return (
          <div
            key={key}
            style={{
              background: "var(--bg-card)",
              borderRadius: "1rem",
              border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-sm)",
              padding: 16,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {title}
                  </h3>
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => patch({ [key]: !value } as Partial<PrivacyPrefs>)}
                aria-pressed={value}
                aria-label={title}
                style={{
                  minWidth: 52,
                  height: 28,
                  borderRadius: 14,
                  background: value ? "var(--accent-sage, #6B9080)" : "#ccc",
                  border: "none",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 160ms",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: value ? 26 : 2,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 160ms",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </div>
        );
      })}

      {save.status === "saved" && (
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--accent-sage, #6B9080)" }}
        >
          <Check size={16} /> Saved.
        </div>
      )}
      {save.status === "error" && (
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: "#b04040" }}
        >
          <AlertCircle size={16} /> {save.message}
        </div>
      )}

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "1rem",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          padding: 16,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Download size={18} />
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Full ZIP export
          </h2>
        </div>
        <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
          Every tracked table as CSV / JSON, plus a README explaining the
          schema. Requires a valid session or admin token. The token is
          sent only in the Authorization header; it never appears in
          the URL, browser history, or access logs.
        </p>
        <button
          type="button"
          onClick={downloadFullExport}
          disabled={download.status === "downloading"}
          className="inline-flex items-center gap-2 text-sm font-medium"
          style={{
            padding: "8px 14px",
            borderRadius: "0.5rem",
            background: "var(--accent-sage, #6B9080)",
            color: "#fff",
            border: "none",
            cursor: download.status === "downloading" ? "wait" : "pointer",
            opacity: download.status === "downloading" ? 0.6 : 1,
          }}
        >
          <Download size={14} />
          {download.status === "downloading" ? "Preparing ZIP..." : "Download ZIP"}
        </button>
        {download.status === "error" && (
          <p className="text-sm mt-2" style={{ color: "#b04040" }}>
            <AlertCircle size={14} /> {download.message}
          </p>
        )}
      </div>
    </div>
  );
}
