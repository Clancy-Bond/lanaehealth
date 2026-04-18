"use client";

/**
 * InfoTip
 *
 * A small "i" icon that opens a popover explaining what something is and
 * why it matters. Used inline next to lab values, biometrics, clinical
 * concepts, and app features so Lanae never has to guess what a term
 * means or whether a number is good.
 *
 * Behavior:
 *   - Desktop: hover OR keyboard focus opens. Click pins it open.
 *   - Mobile: tap toggles open. Tap outside closes.
 *   - Esc closes. Tab keeps you on the trigger after closing.
 *
 * Content: Looked up from src/lib/explainers/dictionary.ts by term slug,
 * OR passed inline via props. Inline wins so unique one-off explanations
 * don't have to round-trip through the dictionary.
 *
 * Visual:
 *   - 14px outlined sage circle with 'i'. Demure on purpose; the data
 *     should always be the protagonist, the icon is the offer.
 *   - Popover: 280-320px wide, white card, soft shadow, blush left rule
 *     to identify the popover style without competing with sage CTAs.
 *   - "What it is" -> "Why it matters for you" -> optional "Yours" -> "Learn more" link.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { getExplainer, type ExplainerEntry } from "@/lib/explainers/dictionary";

interface InfoTipProps {
  /** Slug to look up in the explainer dictionary. */
  term?: string;
  /** Inline override; wins over `term`. */
  what?: string;
  matters?: string;
  yours?: string;
  /** Tip placement. Default 'auto' picks the side with most space. */
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  /** Extra a11y label. Defaults to "Learn about <term-or-what>". */
  ariaLabel?: string;
}

export function InfoTip({
  term,
  what: whatProp,
  matters: mattersProp,
  yours: yoursProp,
  placement = "auto",
  ariaLabel,
}: InfoTipProps) {
  const dictEntry: ExplainerEntry | undefined = term ? getExplainer(term) : undefined;
  const what = whatProp ?? dictEntry?.what;
  const matters = mattersProp ?? dictEntry?.matters;
  const yours = yoursProp ?? dictEntry?.yours;
  const more = dictEntry?.more;

  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  // Esc closes; click outside closes when pinned. Hook must run before
  // any conditional return so React's hook order stays stable across renders.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        setPinned(false);
        triggerRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (!pinned) return;
      const t = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(t) &&
        triggerRef.current && !triggerRef.current.contains(t)
      ) {
        setOpen(false);
        setPinned(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, pinned]);

  // If term has no entry and no inline content, render nothing rather
  // than show an empty popover.
  if (!what && !matters) return null;

  function handleHoverEnter() {
    if (!pinned) setOpen(true);
  }
  function handleHoverLeave() {
    if (!pinned) setOpen(false);
  }
  function handleClick(e: React.MouseEvent) {
    // The InfoTip is often nested inside larger clickable surfaces
    // (cards, links). Without this, tapping the tip would also trigger
    // the parent navigation, which is never what the user wants.
    e.preventDefault();
    e.stopPropagation();
    setOpen((o) => !o || !pinned);
    setPinned((p) => (open ? !p : true));
  }
  function handleFocus() {
    if (!pinned) setOpen(true);
  }
  function handleBlur(e: React.FocusEvent) {
    if (pinned) return;
    const next = e.relatedTarget as Node | null;
    if (next && popoverRef.current?.contains(next)) return;
    setOpen(false);
  }

  const label = ariaLabel || `Learn about ${term || "this"}`;

  // Popover sizing & positioning. We keep CSS-only positioning for
  // simplicity; placement: auto means "below the trigger, right-aligned
  // to the right edge". Components that need precise placement can
  // pass `placement` explicitly.
  const positionStyle: React.CSSProperties = (() => {
    switch (placement) {
      case "top":
        return { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
      case "bottom":
        return { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" };
      case "left":
        return { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" };
      case "right":
        return { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" };
      default:
        return { top: "calc(100% + 6px)", right: 0 };
    }
  })();

  return (
    <span
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}
      onMouseEnter={handleHoverEnter}
      onMouseLeave={handleHoverLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1.25px solid var(--accent-sage)",
          background: open ? "var(--accent-sage-muted)" : "transparent",
          color: "var(--accent-sage)",
          padding: 0,
          margin: "0 4px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background var(--duration-instant, 80ms) var(--ease-standard, ease)",
        }}
      >
        <Info size={10} strokeWidth={2.5} aria-hidden />
      </button>

      {open && (
        <div
          ref={popoverRef}
          id={tipId}
          role="tooltip"
          style={{
            position: "absolute",
            ...positionStyle,
            zIndex: 90,
            width: "min(320px, calc(100vw - 32px))",
            background: "var(--bg-card, #ffffff)",
            border: "1px solid var(--border-light)",
            borderLeft: "3px solid var(--accent-blush)",
            borderRadius: "var(--radius-md, 12px)",
            boxShadow: "var(--shadow-lg)",
            padding: "var(--space-4, 16px)",
            fontSize: "var(--text-sm, 14px)",
            color: "var(--text-primary)",
            lineHeight: 1.55,
            textAlign: "left",
            animation: "fade-scale-in var(--duration-base, 160ms) var(--ease-ios, ease)",
          }}
        >
          {pinned && (
            <button
              type="button"
              onClick={() => { setOpen(false); setPinned(false); }}
              aria-label="Close explanation"
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: 4,
                lineHeight: 0,
              }}
            >
              <X size={14} />
            </button>
          )}

          {term && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              {term}
            </div>
          )}

          {what && (
            <div style={{ marginBottom: matters || yours ? 10 : 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-secondary)" }}>What it is</div>
              <div>{what}</div>
            </div>
          )}

          {matters && (
            <div style={{ marginBottom: yours ? 10 : 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-secondary)" }}>Why it matters for you</div>
              <div>{matters}</div>
            </div>
          )}

          {yours && (
            <div
              style={{
                marginTop: 4,
                padding: "8px 10px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-sm, 8px)",
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2, color: "var(--text-secondary)" }}>Yours</div>
              <div>{yours}</div>
            </div>
          )}

          {more && (
            <a
              href={more.href}
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 13,
                color: "var(--accent-sage)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {more.label} ›
            </a>
          )}
        </div>
      )}
    </span>
  );
}
