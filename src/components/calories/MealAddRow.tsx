"use client";

/**
 * MFN-parity inline "add food" row per meal section.
 *
 * Replicates the editable ✏️ add row MyNetDiary shows under each
 * meal header (BREAKFAST ^ LOG). Focusing the input reveals a
 * horizontal link bar (SAME / RECENT / QUICK / SEARCH / CREATE /
 * MY FOODS) and a suggestions dropdown that lists USDA matches.
 *
 * Server-routed actions:
 * - SEARCH  → /calories/search?view=search&meal=X&q=<typed>
 * - SAME    → (future) /calories/food/same?meal=X
 * - RECENT  → /calories/search?view=recent&meal=X
 * - QUICK   → (future) modal to log calories quickly
 * - CREATE  → /calories/custom-foods/new?meal=X
 * - MYFOODS → /calories/search?view=custom&meal=X
 *
 * Suggestions use the existing USDA search proxy (/api/food/search).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";

interface Suggestion {
  fdcId: number;
  description: string;
  brandName: string | null;
  dataType: string;
  calories: number | null;
}

export function MealAddRow({ meal }: { meal: Meal }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Dismiss dropdown on outside click.
  useEffect(() => {
    if (!focused) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [focused]);

  // Fetch suggestions with a small debounce.
  const scheduleFetch = useCallback((q: string) => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/food/search?q=${encodeURIComponent(trimmed)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data?.results) ? data.results : []);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    scheduleFetch(v);
  };

  const searchHref = `/calories/search?view=search&meal=${meal}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid var(--border-light)",
        background: "var(--bg-primary)",
      }}
    >
      <span aria-hidden style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1 }}>
        {"\u270E"}
      </span>
      <input
        type="text"
        value={query}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        placeholder={
          focused
            ? "Please enter food name, brand or restaurant name"
            : "add"
        }
        aria-label={`Add food to ${meal}`}
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 13,
          color: "var(--text-primary)",
        }}
      />

      {/* Horizontal link bar (only when focused, mirrors MFN exactly) */}
      {focused && (
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <Link href={`/calories/search?view=recent&meal=${meal}`} style={linkStyle}>Same</Link>
          <Link href={`/calories/search?view=recent&meal=${meal}`} style={linkStyle}>Recent</Link>
          <Link href={`/log?meal=${meal}`} style={linkStyle}>Quick</Link>
          <Link href={searchHref} style={linkStyle}>Search</Link>
          <Link href={`/calories/custom-foods/new?meal=${meal}`} style={linkStyle}>Create</Link>
          <Link href={`/calories/search?view=custom&meal=${meal}`} style={linkStyle}>My Foods</Link>
        </div>
      )}

      {/* Suggestions dropdown */}
      {focused && query.trim().length >= 2 && (
        <div
          role="listbox"
          aria-label="Food suggestions"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 30,
            marginTop: 4,
            maxHeight: 360,
            overflowY: "auto",
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: 10,
            boxShadow: "var(--shadow-md)",
          }}
        >
          {loading && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-muted)" }}>
              Searching USDA…
            </div>
          )}
          {!loading && suggestions.length === 0 && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-muted)" }}>
              No matches. Try a more general name.
            </div>
          )}
          {!loading &&
            suggestions.map((s) => (
              <Link
                key={s.fdcId}
                href={`/calories/food/${s.fdcId}?meal=${meal}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 14px",
                  textDecoration: "none",
                  color: "var(--text-primary)",
                  borderTop: "1px solid var(--border-light)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.description}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {s.brandName ? `${s.brandName} · ` : ""}
                    {s.dataType}
                  </div>
                </div>
                {typeof s.calories === "number" && Number.isFinite(s.calories) && s.calories > 0 ? (
                  <span
                    className="tabular"
                    style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-sage)" }}
                  >
                    {s.calories}
                    <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 2, fontWeight: 600 }}>
                      cals
                    </span>
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                    Open &rsaquo;
                  </span>
                )}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  color: "var(--accent-sage)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
