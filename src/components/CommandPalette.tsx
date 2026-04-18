"use client";

/**
 * Global command palette.
 *
 * Keyboard-first navigation over every route and a curated set of
 * quick-actions. Cmd/Ctrl+K opens it, Escape closes it, arrow keys
 * scroll the list, Enter fires.
 *
 * Design choices (per 2026-findings.md §1 Linear, §3 Raycast):
 *   - Translucent backdrop (blur + saturate) instead of flat black
 *   - Results prefix-match on label, case-insensitive
 *   - Keyboard-only focus ring (sage 2px offset 2px) inherits from
 *     global focus-visible so we don't duplicate styles
 *   - No icons pulled from a new library; Lucide entries only since
 *     BottomNav already imports them (keeps bundle lean)
 *
 * Live data: a debounced GET /api/search runs at >= 2 chars with a
 * 150ms window (Raycast cadence). Static routes always render first;
 * live record hits appear under a separate "Your data" section so
 * exact label matches like "labs" never get pushed below a record.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  BarChart3,
  Plus,
  FolderOpen,
  Sparkles,
  Stethoscope,
  MessageSquare,
  Monitor,
  Clock,
  User,
  Settings as SettingsIcon,
  Upload,
  Search,
  X,
  Activity,
  Calendar,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
}

const COMMANDS: Command[] = [
  { id: "today", label: "Today", hint: "Home", href: "/", icon: Home, keywords: ["home", "dashboard"] },
  { id: "log", label: "Log your check-in", hint: "Morning or evening", href: "/log", icon: Plus, keywords: ["pain", "mood", "symptom", "track"] },
  { id: "calories", label: "Calories", hint: "MyNetDiary-style dashboard", href: "/calories", icon: Plus, keywords: ["food", "calorie", "meal", "nutrition", "macros"] },
  { id: "calories-food", label: "Food log table", hint: "Dense meal-log view", href: "/calories/food", icon: FolderOpen, keywords: ["meal", "breakfast", "lunch", "dinner", "snack"] },
  { id: "calories-search", label: "Search foods", hint: "USDA food database", href: "/calories/search", icon: Search, keywords: ["usda", "food", "search", "lookup"] },
  { id: "calories-photo", label: "Snap a meal", hint: "AI photo identification", href: "/calories/photo", icon: Plus, keywords: ["camera", "photo", "ai", "vision"] },
  { id: "calories-plan", label: "Nutrition plan", hint: "Edit calorie + macro goals", href: "/calories/plan", icon: SettingsIcon, keywords: ["goal", "target", "macro"] },
  { id: "calories-analysis", label: "Daily diet analysis", hint: "POTS/endo/migraine-aware insights", href: "/calories/analysis", icon: Sparkles, keywords: ["analysis", "diet", "sodium", "pots"] },
  { id: "weight", label: "Weigh-in", hint: "Log weight + trend chart", href: "/calories/health/weight", icon: Activity, keywords: ["weight", "scale", "kg", "lb"] },
  { id: "cycle", label: "Cycle today", hint: "Fertile window + BBT", href: "/cycle", icon: Calendar, keywords: ["period", "ovulation", "bbt", "fertile"] },
  { id: "hormones", label: "Hormone log", hint: "Estrogen, progesterone, etc", href: "/topics/cycle/hormones", icon: Activity, keywords: ["estrogen", "progesterone", "testosterone", "tsh", "lh", "fsh"] },
  { id: "labs-trends", label: "Lab trends", hint: "Abnormal flags + sparklines", href: "/labs", icon: Activity, keywords: ["lab", "trend", "abnormal", "flag"] },
  { id: "orthostatic", label: "Orthostatic", hint: "POTS diagnostic progress", href: "/topics/orthostatic", icon: Activity, keywords: ["pots", "standing", "orthostatic", "tilt"] },
  { id: "orthostatic-new", label: "Log orthostatic test", hint: "Resting + standing HR at 1/3/5/10 min", href: "/topics/orthostatic/new", icon: Plus, keywords: ["pots", "log", "test", "standing", "tilt"] },
  { id: "migraine", label: "Migraine", hint: "Attack frequency + triggers", href: "/topics/migraine", icon: Activity, keywords: ["migraine", "headache", "ichd"] },
  { id: "migraine-new", label: "Log migraine attack", hint: "Severity, zone, aura, triggers, meds", href: "/topics/migraine/new", icon: Plus, keywords: ["migraine", "log", "attack", "headache"] },
  { id: "emergency", label: "Emergency card", hint: "Wallet-size for EMS/ER", href: "/emergency", icon: AlertCircle, keywords: ["emergency", "wallet", "ems", "er"] },
  { id: "patterns", label: "Patterns", hint: "Charts and correlations", href: "/patterns", icon: BarChart3, keywords: ["chart", "trend", "correlation"] },
  { id: "records", label: "Records", hint: "Labs, appointments, imaging", href: "/records", icon: FolderOpen, keywords: ["lab", "appointment", "blood"] },
  { id: "labs", label: "Lab results", hint: "Your latest labs", href: "/records?tab=labs", icon: FolderOpen, keywords: ["ferritin", "vitamin", "thyroid", "cholesterol"] },
  { id: "appts", label: "Appointments", hint: "Upcoming visits", href: "/records?tab=appointments", icon: FolderOpen, keywords: ["doctor", "visit", "schedule"] },
  { id: "doctor", label: "Doctor Mode", hint: "Clinical summary for visits", href: "/doctor", icon: Stethoscope, keywords: ["prep", "visit", "summary"] },
  { id: "chat", label: "Ask Lanae", hint: "Question your own data", href: "/chat", icon: MessageSquare, keywords: ["research", "ai", "question", "chat"] },
  { id: "imaging", label: "Imaging", hint: "MRI, CT, X-Ray, EKG", href: "/imaging", icon: Monitor, keywords: ["radiology", "scan", "mri", "ekg"] },
  { id: "timeline", label: "Timeline", hint: "Medical history", href: "/timeline", icon: Clock, keywords: ["history", "event", "diagnosis"] },
  { id: "intelligence", label: "Intelligence", hint: "What the AI knows", href: "/intelligence", icon: Sparkles, keywords: ["ai", "analysis"] },
  { id: "profile", label: "Health Profile", hint: "Diagnoses, meds, history", href: "/profile", icon: User, keywords: ["diagnosis", "medication", "allergy", "family"] },
  { id: "settings", label: "Settings", hint: "Devices, data, modules", href: "/settings", icon: SettingsIcon, keywords: ["oura", "whoop", "connect", "export"] },
  { id: "import", label: "Import from myAH", hint: "Adventist Health portal", href: "/import/myah", icon: Upload, keywords: ["myah", "adventist", "portal"] },
  { id: "kbd", label: "Keyboard shortcuts", hint: "Cheatsheet for power users", href: "/help/keyboard", icon: SettingsIcon, keywords: ["help", "shortcut", "key", "cheatsheet", "?"] },
  { id: "all", label: "Site index", hint: "Every page, organized", href: "/all", icon: FolderOpen, keywords: ["index", "sitemap", "routes", "map"] },
  { id: "sleep", label: "Sleep", hint: "30-day Oura sleep trend + last night", href: "/sleep", icon: Activity, keywords: ["sleep", "oura", "hours", "rem", "deep"] },
  { id: "activity", label: "Activity", hint: "Steps + active calories, POTS-paced", href: "/activity", icon: Activity, keywords: ["exercise", "steps", "walk", "activity", "movement"] },
];

/**
 * Score how well a command matches the query. Rewards prefix matches
 * on label more than keyword matches. Zero means "no match".
 */
function scoreCommand(cmd: Command, q: string): number {
  if (!q) return 1;
  const needle = q.toLowerCase().trim();
  if (!needle) return 1;
  const label = cmd.label.toLowerCase();
  const hint = (cmd.hint || "").toLowerCase();
  if (label.startsWith(needle)) return 100;
  if (label.includes(needle)) return 50;
  if (hint.includes(needle)) return 25;
  for (const k of cmd.keywords || []) {
    if (k.toLowerCase().includes(needle)) return 10;
  }
  return 0;
}

interface LiveResults {
  labs: Array<{ id: string; test_name: string; value: number | null; unit: string | null; flag: string | null; date: string }>;
  problems: Array<{ id: string; problem: string; status: string | null; severity: string | null }>;
  appointments: Array<{ id: string; title: string | null; provider: string | null; date: string | null }>;
  imaging: Array<{ id: string; modality: string | null; body_part: string | null; study_date: string | null }>;
}

const EMPTY_LIVE: LiveResults = { labs: [], problems: [], appointments: [], imaging: [] };

type PaletteSelectable =
  | { kind: "command"; cmd: Command }
  | { kind: "lab"; row: LiveResults["labs"][number] }
  | { kind: "problem"; row: LiveResults["problems"][number] }
  | { kind: "appointment"; row: LiveResults["appointments"][number] }
  | { kind: "imaging"; row: LiveResults["imaging"][number] };

function formatLabDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SectionHeader({ label }: { label: string }) {
  return (
    <li
      role="presentation"
      style={{
        padding: "10px 12px 4px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      {label}
    </li>
  );
}

function PaletteRow({
  active,
  icon: Icon,
  label,
  hint,
  trailing,
  onSelect,
  onHover,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  hint?: string;
  trailing?: string;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <li
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        background: active ? "var(--accent-sage-muted)" : "transparent",
        transition: "background var(--duration-instant) var(--ease-standard)",
      }}
    >
      <Icon
        size={18}
        strokeWidth={active ? 2.25 : 2}
        style={{ color: active ? "var(--accent-sage)" : "var(--text-secondary)", flexShrink: 0 }}
        aria-hidden
      />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: active ? 600 : 500,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.4 }}>
            {hint}
          </span>
        )}
      </span>
      {trailing && (
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {trailing}
        </span>
      )}
      {active && (
        <kbd
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            background: "var(--bg-elevated)",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono, monospace)",
            flexShrink: 0,
          }}
        >
          ENTER
        </kbd>
      )}
    </li>
  );
}

function PaletteResults({
  selectable,
  activeIdx,
  setActiveIdx,
  onSelect,
  loading,
  hasStaticResults,
  hasLiveResults,
}: {
  selectable: PaletteSelectable[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  onSelect: (item: PaletteSelectable) => void;
  loading: boolean;
  hasStaticResults: boolean;
  hasLiveResults: boolean;
}) {
  const nodes: React.ReactNode[] = [];
  let lastKind: PaletteSelectable["kind"] | null = null;
  let dataHeaderRendered = false;

  selectable.forEach((item, i) => {
    if (item.kind === "command" && lastKind === null && hasStaticResults) {
      nodes.push(<SectionHeader key="h-routes" label="Go to" />);
    }
    if (item.kind !== "command" && !dataHeaderRendered) {
      nodes.push(<SectionHeader key="h-data" label="Your data" />);
      dataHeaderRendered = true;
    }
    const active = i === activeIdx;
    const onHover = () => setActiveIdx(i);
    const onClick = () => onSelect(item);
    if (item.kind === "command") {
      nodes.push(
        <PaletteRow
          key={`c-${item.cmd.id}`}
          active={active}
          icon={item.cmd.icon}
          label={item.cmd.label}
          hint={item.cmd.hint}
          onSelect={onClick}
          onHover={onHover}
        />
      );
    } else if (item.kind === "lab") {
      const value = item.row.value !== null ? `${item.row.value}${item.row.unit ? ` ${item.row.unit}` : ""}` : "";
      const flag = item.row.flag && item.row.flag !== "normal" ? ` (${item.row.flag})` : "";
      nodes.push(
        <PaletteRow
          key={`l-${item.row.id}`}
          active={active}
          icon={Activity}
          label={item.row.test_name}
          hint={`Lab result${value ? ` · ${value}${flag}` : ""}`}
          trailing={formatLabDate(item.row.date)}
          onSelect={onClick}
          onHover={onHover}
        />
      );
    } else if (item.kind === "problem") {
      const meta = [item.row.severity, item.row.status].filter(Boolean).join(" · ");
      nodes.push(
        <PaletteRow
          key={`p-${item.row.id}`}
          active={active}
          icon={AlertCircle}
          label={item.row.problem}
          hint={meta ? `Active problem · ${meta}` : "Active problem"}
          onSelect={onClick}
          onHover={onHover}
        />
      );
    } else if (item.kind === "appointment") {
      nodes.push(
        <PaletteRow
          key={`a-${item.row.id}`}
          active={active}
          icon={Calendar}
          label={item.row.title || item.row.provider || "Appointment"}
          hint={item.row.provider && item.row.title ? item.row.provider : "Appointment"}
          trailing={item.row.date ? formatLabDate(item.row.date) : undefined}
          onSelect={onClick}
          onHover={onHover}
        />
      );
    } else if (item.kind === "imaging") {
      const label = [item.row.modality, item.row.body_part].filter(Boolean).join(" · ") || "Imaging study";
      nodes.push(
        <PaletteRow
          key={`i-${item.row.id}`}
          active={active}
          icon={Monitor}
          label={label}
          hint="Imaging study"
          trailing={item.row.study_date ? formatLabDate(item.row.study_date) : undefined}
          onSelect={onClick}
          onHover={onHover}
        />
      );
    }
    lastKind = item.kind;
  });

  if (loading && !hasLiveResults) {
    nodes.push(
      <li
        key="loading"
        role="presentation"
        style={{
          padding: "10px 12px",
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span className="shimmer-bar" style={{ height: 6, width: 80, borderRadius: 3 }} />
        Searching your records
      </li>
    );
  }

  return <>{nodes}</>;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [live, setLive] = useState<LiveResults>(EMPTY_LIVE);
  const [liveLoading, setLiveLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Global keyboard shortcut: Cmd/Ctrl+K toggles, Escape closes.
  // Also listen for a "lh:open-palette" custom DOM event so non-keyboard
  // surfaces (mobile More menu, etc.) can open the palette without
  // needing to know how it works.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("lh:open-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lh:open-palette", onOpenEvent);
    };
  }, [open]);

  // Focus the input the moment the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setLive(EMPTY_LIVE);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const staticResults = useMemo(() => {
    return COMMANDS.map((cmd) => ({ cmd, score: scoreCommand(cmd, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.cmd);
  }, [query]);

  // Debounced live search. 150ms matches Raycast cadence; below that
  // it feels twitchy, above it feels laggy. Min 2 chars so a single
  // keystroke does not fire a network call.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setLive(EMPTY_LIVE);
      setLiveLoading(false);
      return;
    }
    setLiveLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`search ${res.status}`);
        const json = (await res.json()) as LiveResults;
        setLive({
          labs: json.labs || [],
          problems: json.problems || [],
          appointments: json.appointments || [],
          imaging: json.imaging || [],
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setLive(EMPTY_LIVE);
      } finally {
        setLiveLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  // Flat list of selectable items, in render order. Static commands
  // first so an exact label match always wins keyboard focus.
  const selectable: PaletteSelectable[] = useMemo(() => {
    const items: PaletteSelectable[] = staticResults.map((cmd) => ({ kind: "command" as const, cmd }));
    live.labs.forEach((row) => items.push({ kind: "lab", row }));
    live.problems.forEach((row) => items.push({ kind: "problem", row }));
    live.appointments.forEach((row) => items.push({ kind: "appointment", row }));
    live.imaging.forEach((row) => items.push({ kind: "imaging", row }));
    return items;
  }, [staticResults, live]);

  // Keep activeIdx inside bounds as the result set changes.
  useEffect(() => {
    if (activeIdx >= selectable.length) setActiveIdx(0);
  }, [selectable.length, activeIdx]);

  function handleSelectItem(item: PaletteSelectable) {
    setOpen(false);
    if (item.kind === "command") {
      router.push(item.cmd.href);
    } else if (item.kind === "lab") {
      router.push(`/records?tab=labs&focus=${encodeURIComponent(item.row.id)}`);
    } else if (item.kind === "problem") {
      router.push("/profile");
    } else if (item.kind === "appointment") {
      router.push("/records?tab=appointments");
    } else if (item.kind === "imaging") {
      router.push("/imaging");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(selectable.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = selectable[activeIdx];
      if (item) handleSelectItem(item);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick search"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(26, 26, 46, 0.42)",
        backdropFilter: "saturate(140%) blur(6px)",
        WebkitBackdropFilter: "saturate(140%) blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        paddingLeft: 16,
        paddingRight: 16,
        animation: "fade-scale-in var(--duration-base) var(--ease-ios)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: "rgba(255, 255, 255, 0.96)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-4)",
            borderBottom: "1px solid var(--border-light)",
          }}
        >
          <Search
            size={18}
            strokeWidth={2}
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a route or ask your data"
            aria-label="Search commands"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: "var(--text-lg)",
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono, monospace)",
              flexShrink: 0,
            }}
          >
            ESC
          </kbd>
        </label>

        <ul
          role="listbox"
          aria-label="Matching commands"
          style={{
            listStyle: "none",
            margin: 0,
            padding: "var(--space-2)",
            maxHeight: "56vh",
            overflowY: "auto",
          }}
        >
          {selectable.length === 0 && !liveLoading ? (
            <li
              style={{
                padding: "var(--space-6) var(--space-4)",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: "var(--text-sm)",
              }}
            >
              Nothing matches that. Try a route name or a keyword like
              &ldquo;ferritin&rdquo; or &ldquo;Oura&rdquo;.
            </li>
          ) : (
            <PaletteResults
              selectable={selectable}
              activeIdx={activeIdx}
              setActiveIdx={setActiveIdx}
              onSelect={handleSelectItem}
              loading={liveLoading}
              hasStaticResults={staticResults.length > 0}
              hasLiveResults={live.labs.length + live.problems.length + live.appointments.length + live.imaging.length > 0}
            />
          )}
        </ul>

        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderTop: "1px solid var(--border-light)",
            display: "flex",
            gap: "var(--space-3)",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <kbd
              style={{
                padding: "1px 5px",
                borderRadius: 3,
                background: "var(--bg-elevated)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              ↑
            </kbd>
            <kbd
              style={{
                padding: "1px 5px",
                borderRadius: 3,
                background: "var(--bg-elevated)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              ↓
            </kbd>
            to move
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="press-feedback"
            aria-label="Close quick search"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
            }}
          >
            <X size={12} /> close
          </button>
        </div>
      </div>
    </div>
  );
}
