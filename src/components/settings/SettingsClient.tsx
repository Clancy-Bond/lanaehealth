"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  AlertCircle,
  Loader2,
  Building2,
  ArrowRight,
} from "lucide-react";
import UniversalImport from "@/components/import/UniversalImport";
import IntegrationHub from "@/components/settings/IntegrationHub";

// -- Types --

interface OuraInfo {
  connected: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
}

interface SettingsClientProps {
  oura: OuraInfo;
}

type ImportStatus = "idle" | "uploading" | "success" | "error";

interface ImportState {
  status: ImportStatus;
  message: string | null;
  detail: string | null;
}

const INITIAL_IMPORT_STATE: ImportState = {
  status: "idle",
  message: null,
  detail: null,
};

// -- Section card wrapper --

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

// -- Status badge for import results --

function ImportStatusBadge({ state }: { state: ImportState }) {
  if (state.status === "idle") return null;

  if (state.status === "uploading") {
    return (
      <div
        className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-lg"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-light)",
        }}
      >
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent-sage)" }} />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Uploading and processing...
        </span>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div
        className="mt-2 px-2 py-1.5 rounded-lg"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-light)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <Check size={14} style={{ color: "var(--accent-sage)" }} />
          <span
            className="text-xs font-medium"
            style={{ color: "var(--accent-sage)" }}
          >
            {state.message}
          </span>
        </div>
        {state.detail && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {state.detail}
          </p>
        )}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded-lg"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-light)",
        }}
      >
        <AlertCircle
          size={14}
          className="shrink-0 mt-0.5"
          style={{ color: "var(--text-error, #e55)" }}
        />
        <span className="text-xs" style={{ color: "var(--text-error, #e55)" }}>
          {state.message || "Import failed"}
        </span>
      </div>
    );
  }

  return null;
}

// -- File Upload Card --

function ImportCard({
  icon: Icon,
  title,
  description,
  accept,
  onFileSelect,
  importState,
  disabled,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  accept: string;
  onFileSelect?: (file: File) => void;
  importState: ImportState;
  disabled?: boolean;
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

  const isUploading = importState.status === "uploading";

  return (
    <div>
      <label
        className="flex items-start gap-3 rounded-xl p-3 cursor-pointer"
        style={{
          background: "var(--bg-elevated)",
          border: "1px dashed var(--border)",
          minHeight: 44,
          opacity: isUploading || disabled ? 0.6 : 1,
          pointerEvents: isUploading || disabled ? "none" : "auto",
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
          {isUploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Upload size={18} />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={isUploading || disabled}
        />
      </label>
      <ImportStatusBadge state={importState} />
    </div>
  );
}

// -- Oura Ring Section --

function OuraSection({ oura }: { oura: OuraInfo }) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

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
    setSyncResult(null);
    setSyncError(null);
    try {
      const now = new Date();
      const endDate = now.toISOString().split("T")[0];
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const res = await fetch("/api/oura/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Sync failed (${res.status})`);
      }
      setSyncResult(
        `Synced ${data.synced_days} days (${startDate} to ${endDate})`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncError(msg);
    } finally {
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
        <span
          className="text-sm font-medium"
          style={{ color: "var(--accent-sage)" }}
        >
          Connected
        </span>
      </div>
      {lastSync && (
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
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

      {syncResult && (
        <div
          className="flex items-center gap-1.5 mt-3 px-2 py-1.5 rounded-lg"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
          }}
        >
          <Check size={14} style={{ color: "var(--accent-sage)" }} />
          <span
            className="text-xs font-medium"
            style={{ color: "var(--accent-sage)" }}
          >
            {syncResult}
          </span>
        </div>
      )}

      {syncError && (
        <div
          className="flex items-center gap-1.5 mt-3 px-2 py-1.5 rounded-lg"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
          }}
        >
          <AlertCircle size={14} style={{ color: "var(--text-error, #e55)" }} />
          <span className="text-xs" style={{ color: "var(--text-error, #e55)" }}>
            {syncError}
          </span>
        </div>
      )}
    </div>
  );
}

// -- AI Knowledge Section --

interface DreamResult {
  startedAt: string;
  completedAt: string;
  summariesRegenerated: string[];
  summariesSkipped: string[];
  newDataCounts: Record<string, number>;
  vectorRecordsSynced: number;
  errors: string[];
}

interface SyncStatus {
  totalRecords: number;
  dateRange: { earliest: string | null; latest: string | null };
  byType: Record<string, number>;
  syncRunning: boolean;
  lastSyncAt: string | null;
  lastSyncRecords: number | null;
}

function AIKnowledgeSection() {
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<DreamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync status state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<{
    synced: number;
  } | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  // Load sync status on mount
  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/context/sync-status");
      if (res.ok) {
        const data: SyncStatus = await res.json();
        setSyncStatus(data);
      }
    } catch {
      // Silently fail - status is informational only
    } finally {
      setSyncStatusLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

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
      // Refresh sync status after dream cycle
      fetchSyncStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleIndexAll() {
    setIndexing(true);
    setIndexResult(null);
    setIndexError(null);

    try {
      const res = await fetch("/api/context/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Indexing failed (${res.status})`);
      }
      const data = await res.json();
      setIndexResult({ synced: data.synced });
      // Refresh sync status after indexing
      fetchSyncStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setIndexError(msg);
    } finally {
      setIndexing(false);
    }
  }

  // Format the last sync time
  const lastSyncFormatted = syncStatus?.lastSyncAt
    ? new Date(syncStatus.lastSyncAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div>
      {/* Sync Status Display */}
      {!syncStatusLoading && syncStatus && (
        <div
          className="rounded-lg p-3 mb-3"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Indexed records
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {syncStatus.totalRecords.toLocaleString()}
              </span>
            </div>
            {syncStatus.dateRange.earliest && syncStatus.dateRange.latest && (
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Date range
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {syncStatus.dateRange.earliest} to{" "}
                  {syncStatus.dateRange.latest}
                </span>
              </div>
            )}
            {Object.keys(syncStatus.byType).length > 0 && (
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Breakdown
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {Object.entries(syncStatus.byType)
                    .map(
                      ([type, count]) =>
                        `${count} ${type.replace("_", " ")}${count !== 1 ? "s" : ""}`
                    )
                    .join(", ")}
                </span>
              </div>
            )}
            {lastSyncFormatted && (
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Last synced
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {lastSyncFormatted}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <p
        className="text-xs mb-3"
        style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
      >
        Refresh the AI's understanding of your health data. This regenerates
        all clinical summaries and indexes recent data for smarter
        conversations.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleRefresh}
          disabled={refreshing || indexing}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            minHeight: 44,
            opacity: refreshing || indexing ? 0.6 : 1,
          }}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh Now"}
        </button>

        <button
          onClick={handleIndexAll}
          disabled={indexing || refreshing}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--accent-sage)",
            border: "1px solid var(--border-light)",
            minHeight: 44,
            opacity: indexing || refreshing ? 0.6 : 1,
          }}
        >
          {indexing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Brain size={16} />
          )}
          {indexing ? "Indexing..." : "Index All History"}
        </button>
      </div>

      {(refreshing || indexing) && (
        <p
          className="text-xs mt-3"
          style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
        >
          {indexing
            ? "Indexing all historical data. This may take several minutes for 3+ years of data."
            : "This may take a few minutes while the AI re-reads your health data and rebuilds its knowledge base."}
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
              <p
                className="text-xs"
                style={{ color: "var(--text-error, #e55)" }}
              >
                {result.errors.length} error(s) during refresh
              </p>
            )}
          </div>
        </div>
      )}

      {indexResult && (
        <div
          className="mt-3 rounded-lg p-3"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Check size={14} style={{ color: "var(--accent-sage)" }} />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--accent-sage)" }}
            >
              Indexing Complete
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {indexResult.synced.toLocaleString()} records indexed across all
            historical data.
          </p>
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

      {indexError && (
        <p
          className="text-xs mt-3"
          style={{ color: "var(--text-error, #e55)", lineHeight: 1.4 }}
        >
          Indexing failed: {indexError}
        </p>
      )}
    </div>
  );
}

// -- Main SettingsClient --

export function SettingsClient({ oura }: SettingsClientProps) {
  const [ncState, setNcState] = useState<ImportState>(INITIAL_IMPORT_STATE);
  const [mndState, setMndState] = useState<ImportState>(INITIAL_IMPORT_STATE);
  const [ahState, setAhState] = useState<ImportState>(INITIAL_IMPORT_STATE);
  const [exporting, setExporting] = useState(false);

  const uploadFile = useCallback(
    async (
      file: File,
      endpoint: string,
      setState: (s: ImportState) => void
    ) => {
      setState({ status: "uploading", message: null, detail: null });

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Import failed (${res.status})`);
        }

        // Build success message based on response shape
        let message = "Import complete";
        let detail: string | null = null;

        if (data.imported !== undefined) {
          message = `Imported ${data.imported} records`;
        } else if (data.records !== undefined) {
          message = `Processed ${data.records.toLocaleString()} records across ${data.daysProcessed} days`;
        }

        if (data.dateRange) {
          detail = `Date range: ${data.dateRange.start} to ${data.dateRange.end}`;
        }

        if (data.totalFoodRowsParsed) {
          detail = `${data.totalFoodRowsParsed} food items parsed. ${detail || ""}`.trim();
        }

        setState({ status: "success", message, detail });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Import failed";
        setState({ status: "error", message: msg, detail: null });
      }
    },
    []
  );

  function handleNcFileSelect(file: File) {
    uploadFile(file, "/api/import/natural-cycles", setNcState);
  }

  function handleMndFileSelect(file: File) {
    uploadFile(file, "/api/import/mynetdiary", setMndState);
  }

  function handleAhFileSelect(file: File) {
    uploadFile(file, "/api/import/apple-health", setAhState);
  }

  async function handleExportAll() {
    setExporting(true);
    try {
      const res = await fetch("/api/export");
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
    } finally {
      setExporting(false);
    }
  }

  const anyUploading =
    ncState.status === "uploading" ||
    mndState.status === "uploading" ||
    ahState.status === "uploading";

  return (
    <div className="space-y-4">
      {/* Oura Ring Connection */}
      <SectionCard icon={Activity} title="Oura Ring">
        <OuraSection oura={oura} />
      </SectionCard>

      {/* Connected Apps & Devices */}
      <SectionCard icon={Activity} title="Connected Apps & Devices">
        <IntegrationHub />
      </SectionCard>

      {/* Universal Import */}
      <SectionCard icon={Upload} title="Universal Import">
        <UniversalImport />
      </SectionCard>

      {/* Legacy Data Import */}
      <SectionCard icon={Upload} title="App-Specific Import">
        <div className="space-y-2">
          <ImportCard
            icon={Heart}
            title="Natural Cycles"
            description="Import cycle tracking data from a CSV export"
            accept=".csv"
            onFileSelect={handleNcFileSelect}
            importState={ncState}
            disabled={anyUploading}
          />
          <ImportCard
            icon={Salad}
            title="MyNetDiary"
            description="Import nutrition and food diary data from CSV"
            accept=".csv"
            onFileSelect={handleMndFileSelect}
            importState={mndState}
            disabled={anyUploading}
          />
          <ImportCard
            icon={Apple}
            title="Apple Health"
            description="Import health records from Apple Health XML export"
            accept=".xml,.zip"
            onFileSelect={handleAhFileSelect}
            importState={ahState}
            disabled={anyUploading}
          />
        </div>
      </SectionCard>

      {/* myAH Portal Import */}
      <SectionCard icon={Building2} title="Adventist Health (myAH)">
        <div>
          <p
            className="text-xs mb-3"
            style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
          >
            Import your medical records from the myAH patient portal, including
            lab results, appointments, medications, and clinical notes.
          </p>
          <Link
            href="/import/myah"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 rounded-lg touch-target"
            style={{
              background: "var(--accent-sage)",
              color: "var(--text-inverse)",
              minHeight: 44,
              textDecoration: "none",
            }}
          >
            <Building2 size={16} />
            Import Records
            <ArrowRight size={14} />
          </Link>
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
              disabled={exporting}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 rounded-lg touch-target"
              style={{
                background: "var(--accent-sage)",
                color: "var(--text-inverse)",
                minHeight: 44,
                opacity: exporting ? 0.6 : 1,
              }}
            >
              {exporting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {exporting ? "Exporting..." : "Export All Data"}
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
            <span
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
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
            <span
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
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
