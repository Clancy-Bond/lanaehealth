"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Activity,
  RefreshCw,
  Unlink,
  Upload,
  Download,
  FileText,
  Heart,
  Apple,
  Salad,
  Info,
  Brain,
  Check,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface OuraInfo {
  connected: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
}

interface SettingsClientProps {
  oura: OuraInfo;
}

// ── Section card wrapper ─────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "1rem",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
        padding: 16,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 32,
            height: 32,
            background: "var(--accent-sage-muted)",
          }}
        >
          <Icon size={16} />
        </div>
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

// ── File Upload Card ─────────────────────────────────────────────────

function ImportCard({
  icon: Icon,
  title,
  description,
  accept,
  onFileSelect,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  accept: string;
  onFileSelect?: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
    // Reset input so same file can be selected again
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <label
      className="flex items-start gap-3 rounded-xl p-3 cursor-pointer"
      style={{
        background: "var(--bg-elevated)",
        border: "1px dashed var(--border)",
        minHeight: 44,
      }}
    >
      <div
        className="flex items-center justify-center rounded-lg shrink-0 mt-0.5"
        style={{
          width: 36,
          height: 36,
          background: "var(--accent-sage-muted)",
        }}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
        >
          {description}
        </p>
      </div>
      <div
        className="flex items-center justify-center shrink-0"
        style={{ color: "var(--accent-sage)", minHeight: 44, minWidth: 44 }}
      >
        <Upload size={18} />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </label>
  );
}

// ── Oura Ring Section ────────────────────────────────────────────────

function OuraSection({ oura }: { oura: OuraInfo }) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleDisconnect() {
    if (!confirm("Disconnect your Oura Ring? You can reconnect anytime.")) {
      return;
    }
    setDisconnecting(true);
    try {
      await fetch("/api/oura/disconnect", { method: "POST" });
      window.location.reload();
    } catch {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/oura/sync", { method: "POST" });
      setSyncing(false);
    } catch {
      setSyncing(false);
    }
  }

  // Format the last sync date
  const lastSync = oura.updatedAt
    ? new Date(oura.updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  if (!oura.connected) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--text-muted)" }}
          />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Not connected
          </span>
        </div>
        <p
          className="text-xs mb-3"
          style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
        >
          Connect your Oura Ring to import sleep, HRV, heart rate, and
          readiness data automatically.
        </p>
        <a
          href="/api/oura/authorize"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            minHeight: 44,
            textDecoration: "none",
          }}
        >
          <Activity size={16} />
          Connect Oura Ring
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--accent-sage)" }}
        />
        <span className="text-sm font-medium" style={{ color: "var(--accent-sage)" }}>
          Connected
        </span>
      </div>
      {lastSync && (
        <p
          className="text-xs mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          Last synced: {lastSync}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            minHeight: 44,
            opacity: syncing ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            minHeight: 44,
            opacity: disconnecting ? 0.6 : 1,
          }}
        >
          <Unlink size={14} />
          Disconnect
        </button>
      </div>
    </div>
  );
}

// ── AI Knowledge Section ────────────────────────────────────────────

interface DreamResult {
  startedAt: string;
  completedAt: string;
  summariesRegenerated: string[];
  summariesSkipped: string[];
  newDataCounts: Record<string, number>;
  vectorRecordsSynced: number;
  errors: string[];
}

function AIKnowledgeSection() {
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<DreamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/context/dream", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data: DreamResult = await res.json();
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div>
      <p
        className="text-xs mb-3"
        style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
      >
        Refresh the AI's understanding of your health data. This regenerates
        all clinical summaries and indexes recent data for smarter
        conversations.
      </p>

      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-2 text-sm font-medium px-4 rounded-lg touch-target"
        style={{
          background: "var(--accent-sage)",
          color: "var(--text-inverse)",
          minHeight: 44,
          opacity: refreshing ? 0.6 : 1,
        }}
      >
        <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        {refreshing ? "Refreshing..." : "Refresh Now"}
      </button>

      {refreshing && (
        <p
          className="text-xs mt-3"
          style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
        >
          This may take a few minutes while the AI re-reads your health data
          and rebuilds its knowledge base.
        </p>
      )}

      {result && (
        <div
          className="mt-3 rounded-lg p-3"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Check size={14} style={{ color: "var(--accent-sage)" }} />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--accent-sage)" }}
            >
              Refresh Complete
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {result.summariesRegenerated.length} summaries regenerated,{" "}
              {result.summariesSkipped.length} already fresh
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {result.vectorRecordsSynced} records indexed in knowledge base
            </p>
            {result.errors.length > 0 && (
              <p className="text-xs" style={{ color: "var(--text-error, #e55)" }}>
                {result.errors.length} error(s) during refresh
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p
          className="text-xs mt-3"
          style={{ color: "var(--text-error, #e55)", lineHeight: 1.4 }}
        >
          Refresh failed: {error}
        </p>
      )}
    </div>
  );
}

// ── Main SettingsClient ──────────────────────────────────────────────

export function SettingsClient({ oura }: SettingsClientProps) {
  function handleFileSelect(source: string) {
    return (_file: File) => {
      // Placeholder: actual import logic will be wired up later
      alert(
        `${source} import selected. This feature is coming soon.`
      );
    };
  }

  async function handleExportAll() {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lanaehealth-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export data. Please try again.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Oura Ring Connection */}
      <SectionCard icon={Activity} title="Oura Ring">
        <OuraSection oura={oura} />
      </SectionCard>

      {/* Data Import */}
      <SectionCard icon={Upload} title="Data Import">
        <div className="space-y-2">
          <ImportCard
            icon={Heart}
            title="Natural Cycles"
            description="Import cycle tracking data from a CSV export"
            accept=".csv"
            onFileSelect={handleFileSelect("Natural Cycles")}
          />
          <ImportCard
            icon={Salad}
            title="MyNetDiary"
            description="Import nutrition and food diary data from CSV"
            accept=".csv"
            onFileSelect={handleFileSelect("MyNetDiary")}
          />
          <ImportCard
            icon={Apple}
            title="Apple Health"
            description="Import health records from Apple Health XML export"
            accept=".xml,.zip"
            onFileSelect={handleFileSelect("Apple Health")}
          />
        </div>
      </SectionCard>

      {/* Data Export */}
      <SectionCard icon={Download} title="Data Export">
        <div className="space-y-3">
          <div>
            <p
              className="text-xs mb-2"
              style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
            >
              Download all your health data as a JSON file for backup or
              portability.
            </p>
            <button
              onClick={handleExportAll}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 rounded-lg touch-target"
              style={{
                background: "var(--accent-sage)",
                color: "var(--text-inverse)",
                minHeight: 44,
              }}
            >
              <Download size={16} />
              Export All Data
            </button>
          </div>
          <div
            className="pt-3"
            style={{ borderTop: "1px solid var(--border-light)" }}
          >
            <p
              className="text-xs mb-2"
              style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
            >
              Generate a clinical summary PDF for your doctor visits.
            </p>
            <Link
              href="/doctor"
              className="inline-flex items-center gap-2 text-sm font-medium px-4 rounded-lg touch-target"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--accent-sage)",
                minHeight: 44,
                textDecoration: "none",
              }}
            >
              <FileText size={16} />
              Generate Clinical Report
            </Link>
          </div>
        </div>
      </SectionCard>

      {/* AI Knowledge Base */}
      <SectionCard icon={Brain} title="AI Knowledge Base">
        <AIKnowledgeSection />
      </SectionCard>

      {/* About */}
      <SectionCard icon={Info} title="About">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              App Name
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              LanaeHealth
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Version
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              1.0.0
            </span>
          </div>
          <p
            className="text-xs pt-2"
            style={{
              color: "var(--text-muted)",
              lineHeight: 1.5,
              borderTop: "1px solid var(--border-light)",
            }}
          >
            Your complete health story, ready for every doctor.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
