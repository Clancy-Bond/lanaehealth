"use client";

import Link from "next/link";
import { ClipboardList, Activity, AlertCircle } from "lucide-react";

interface ActiveProblem {
  id: string;
  problem: string;
  status: string;
}

interface SmartCardsProps {
  hasLoggedToday: boolean;
  activeProblems: ActiveProblem[];
  latestSleepScore: number | null;
  avgSleepScore: number | null;
  latestHrv: number | null;
  avgHrv: number | null;
  ouraDate: string | null;
}

interface CardData {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: { label: string; href: string };
}

export function SmartCards({
  hasLoggedToday,
  activeProblems,
  latestSleepScore,
  avgSleepScore,
  latestHrv,
  avgHrv,
  ouraDate,
}: SmartCardsProps) {
  const cards: CardData[] = [];

  // Card 1: Log check-in (if not logged)
  if (!hasLoggedToday) {
    cards.push({
      id: "log-checkin",
      title: "Log your check-in",
      description: "Start your morning check-in to track how you feel today.",
      icon: (
        <ClipboardList
          size={18}
          style={{ color: "var(--accent-sage)" }}
          strokeWidth={2}
        />
      ),
      action: { label: "Log now", href: "/log" },
    });
  }

  // Card 2: Active problems (always show if any exist)
  if (activeProblems.length > 0) {
    const problemNames = activeProblems
      .slice(0, 3)
      .map((p) => p.problem)
      .join(", ");
    const moreCount = activeProblems.length > 3 ? activeProblems.length - 3 : 0;
    const suffix = moreCount > 0 ? ` + ${moreCount} more` : "";

    cards.push({
      id: "active-problems",
      title: `${activeProblems.length} active problem${activeProblems.length === 1 ? "" : "s"} being tracked`,
      description: problemNames + suffix,
      icon: (
        <AlertCircle
          size={18}
          style={{ color: "var(--accent-sage)" }}
          strokeWidth={2}
        />
      ),
      action: { label: "View", href: "/doctor" },
    });
  }

  // Card 3: Latest Oura insight (if data exists)
  if (latestSleepScore !== null || latestHrv !== null) {
    const parts: string[] = [];
    if (latestSleepScore !== null) {
      const sleepCompare =
        avgSleepScore !== null
          ? ` (avg ${Math.round(avgSleepScore)})`
          : "";
      parts.push(`Sleep: ${latestSleepScore}${sleepCompare}`);
    }
    if (latestHrv !== null) {
      const hrvCompare =
        avgHrv !== null ? ` (avg ${Math.round(avgHrv)})` : "";
      parts.push(`HRV: ${Math.round(latestHrv)}ms${hrvCompare}`);
    }
    const dateLabel = ouraDate
      ? ouraDate === new Date().toISOString().split("T")[0]
        ? "Last night"
        : `From ${ouraDate}`
      : "Latest reading";

    cards.push({
      id: "oura-insight",
      title: dateLabel,
      description: parts.join("  |  "),
      icon: (
        <Activity
          size={18}
          style={{ color: "var(--accent-sage)" }}
          strokeWidth={2}
        />
      ),
      action: { label: "View", href: "/patterns?metric=sleep" },
    });
  }

  if (cards.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "0 16px",
      }}
    >
      {cards.map((card) => (
        <div
          key={card.id}
          style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            boxShadow: "var(--shadow-sm)",
            padding: 16,
            borderLeft: "4px solid var(--accent-sage)",
            border: "1px solid var(--border-light)",
            borderLeftWidth: 4,
            borderLeftColor: "var(--accent-sage)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
              <div
                style={{
                  marginTop: 1,
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    margin: "4px 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  {card.description}
                </p>
              </div>
            </div>

            <Link
              href={card.action.href}
              className="touch-target"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--accent-sage)",
                textDecoration: "none",
                whiteSpace: "nowrap",
                padding: "6px 0",
                flexShrink: 0,
              }}
            >
              {card.action.label}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
