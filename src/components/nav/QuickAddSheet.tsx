"use client";

/**
 * Global quick-add sheet.
 *
 * The Plus button in the bottom nav opens this sheet instead of navigating
 * to /log. Six primary actions cover the most common daily entries for a
 * POTS/endo/migraine patient: symptom, headache attack, stand test,
 * medication, meal, photo/document. Each deep-links to the existing
 * route that already knows how to handle that kind of entry; this
 * component adds zero new write paths.
 *
 * Interaction model (per the Headache timer pattern elsewhere in the app):
 *   - Tap the sheet overlay or drag the handle down to dismiss.
 *   - Escape also closes.
 *   - Sheet slides up from the bottom nav with a 220ms ease.
 *
 * Visual: cream card on a darkened overlay, sage handle, two rows of
 * three action tiles. Each tile shows an icon, a short label, and a
 * single-line hint. Follows the existing warm-modern palette used across
 * BottomNav and QuickLogSheet.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  Zap,
  ArrowUpFromLine,
  Pill,
  Utensils,
  Camera,
  type LucideIcon,
} from "lucide-react";

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
}

interface Action {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
}

const ACTIONS: Action[] = [
  {
    id: "symptom",
    label: "Symptom",
    hint: "Log a new symptom",
    href: "/log#symptoms",
    icon: Activity,
  },
  {
    id: "headache",
    label: "Headache",
    hint: "Start a timed attack",
    href: "/log#headache",
    icon: Zap,
  },
  {
    id: "stand-test",
    label: "Stand test",
    hint: "Orthostatic protocol",
    href: "/log/orthostatic",
    icon: ArrowUpFromLine,
  },
  {
    id: "medication",
    label: "Medication",
    hint: "Record a dose",
    href: "/log#medications",
    icon: Pill,
  },
  {
    id: "meal",
    label: "Meal",
    hint: "Search USDA foods",
    href: "/log#food",
    icon: Utensils,
  },
  {
    id: "photo",
    label: "Photo / doc",
    hint: "Labs, scans, notes",
    href: "/records",
    icon: Camera,
  },
];

export function QuickAddSheet({ open, onClose }: QuickAddSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimateIn(true)),
      );
    } else {
      setAnimateIn(false);
      const t = setTimeout(() => setVisible(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const delta = e.changedTouches[0].clientY - dragStartY.current;
      if (sheetRef.current) sheetRef.current.style.transform = "";
      dragStartY.current = null;
      if (delta > 80) onClose();
    },
    [onClose],
  );

  if (!visible) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 55,
          background: "rgba(30, 30, 36, 0.38)",
          opacity: animateIn ? 1 : 0,
          transition: "opacity 220ms ease",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick add"
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 56,
          background: "var(--bg-card)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow: "0 -16px 48px -12px rgba(0,0,0,0.25)",
          transform: animateIn ? "translateY(0)" : "translateY(100%)",
          transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          paddingBottom: "calc(16px + var(--safe-bottom))",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 6px",
          }}
        >
          <span
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: "var(--accent-sage-muted)",
            }}
          />
        </div>

        <div
          style={{
            padding: "0 16px 4px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Quick add
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            padding: "12px 16px 8px",
          }}
        >
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.id}
                href={action.href}
                onClick={onClose}
                className="press-feedback"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "14px 12px",
                  borderRadius: 14,
                  background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
                  border: "1px solid var(--border-light)",
                  boxShadow: "var(--shadow-sm)",
                  textDecoration: "none",
                  color: "var(--text-primary)",
                  minHeight: 88,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: "var(--accent-sage-muted)",
                    color: "var(--accent-sage)",
                  }}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden />
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  {action.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    lineHeight: 1.3,
                  }}
                >
                  {action.hint}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
