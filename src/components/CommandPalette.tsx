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
 * Data: a static list so first open costs zero network. Lab values
 * and other live data are out of scope for this first cut; a future
 * pass can layer a Supabase search backend behind the same UI.
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
  { id: "patterns", label: "Patterns", hint: "Charts and correlations", href: "/patterns", icon: BarChart3, keywords: ["chart", "trend", "correlation"] },
  { id: "records", label: "Records", hint: "Labs, appointments, imaging", href: "/records", icon: FolderOpen, keywords: ["lab", "appointment", "blood"] },
  { id: "labs", label: "Lab results", hint: "Your latest labs", href: "/records?tab=labs", icon: FolderOpen, keywords: ["ferritin", "vitamin", "thyroid", "cholesterol"] },
  { id: "appts", label: "Appointments", hint: "Upcoming visits", href: "/records?tab=appointments", icon: FolderOpen, keywords: ["doctor", "visit", "schedule"] },
  { id: "doctor", label: "Doctor Mode", hint: "Clinical summary for visits", href: "/doctor", icon: Stethoscope, keywords: ["prep", "visit", "summary"] },
  { id: "chat", label: "Ask AI", hint: "Question your own data", href: "/chat", icon: MessageSquare, keywords: ["research", "ai", "question"] },
  { id: "imaging", label: "Imaging", hint: "MRI, CT, X-Ray, EKG", href: "/imaging", icon: Monitor, keywords: ["radiology", "scan", "mri", "ekg"] },
  { id: "timeline", label: "Timeline", hint: "Medical history", href: "/timeline", icon: Clock, keywords: ["history", "event", "diagnosis"] },
  { id: "intelligence", label: "Intelligence", hint: "What the AI knows", href: "/intelligence", icon: Sparkles, keywords: ["ai", "analysis"] },
  { id: "profile", label: "Health Profile", hint: "Diagnoses, meds, history", href: "/profile", icon: User, keywords: ["diagnosis", "medication", "allergy", "family"] },
  { id: "settings", label: "Settings", hint: "Devices, data, modules", href: "/settings", icon: SettingsIcon, keywords: ["oura", "whoop", "connect", "export"] },
  { id: "import", label: "Import from myAH", hint: "Adventist Health portal", href: "/import/myah", icon: Upload, keywords: ["myah", "adventist", "portal"] },
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

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: Cmd/Ctrl+K toggles, Escape closes.
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the input the moment the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo(() => {
    return COMMANDS.map((cmd) => ({ cmd, score: scoreCommand(cmd, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.cmd);
  }, [query]);

  // Keep activeIdx inside bounds as the result set changes.
  useEffect(() => {
    if (activeIdx >= results.length) setActiveIdx(0);
  }, [results.length, activeIdx]);

  function handleSelect(cmd: Command) {
    setOpen(false);
    router.push(cmd.href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = results[activeIdx];
      if (cmd) handleSelect(cmd);
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
          {results.length === 0 ? (
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
            results.map((cmd, i) => {
              const Icon = cmd.icon;
              const active = i === activeIdx;
              return (
                <li
                  key={cmd.id}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => handleSelect(cmd)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    background: active ? "var(--accent-sage-muted)" : "transparent",
                    transition:
                      "background var(--duration-instant) var(--ease-standard)",
                  }}
                >
                  <Icon
                    size={18}
                    strokeWidth={active ? 2.25 : 2}
                    style={{
                      color: active ? "var(--accent-sage)" : "var(--text-secondary)",
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: active ? 600 : 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {cmd.label}
                    </span>
                    {cmd.hint && (
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-muted)",
                          lineHeight: 1.4,
                        }}
                      >
                        {cmd.hint}
                      </span>
                    )}
                  </span>
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
                      }}
                    >
                      ENTER
                    </kbd>
                  )}
                </li>
              );
            })
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
