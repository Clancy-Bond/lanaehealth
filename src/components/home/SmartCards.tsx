"use client";

import Link from "next/link";
import { Activity, AlertCircle, TrendingUp } from "lucide-react";
import { format, isYesterday, parseISO } from "date-fns";

interface ActiveProblem {
  id: string;
  problem: string;
  status: string;
}

interface StrongCorrelation {
  id: string;
  effect_description: string | null;
  confidence_level: string;
}

interface SmartCardsProps {
  hasLoggedToday: boolean;
  activeProblems: ActiveProblem[];
  latestSleepScore: number | null;
  avgSleepScore: number | null;
  latestHrv: number | null;
  avgHrv: number | null;
  ouraDate: string | null;
  strongCorrelation?: StrongCorrelation | null;
}

interface CardData {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: { label: string; href: string };
  borderColor?: string;
  prominent?: boolean;
}

/**
 * Generates a prioritized Oura insight based on comparing today's metrics
 * against the 7-day average. Warnings are prioritized over good news.
 */
function getSmartOuraInsight(
  sleepScore: number | null,
  avgSleep: number | null,
  hrv: number | null,
  avgHrvVal: number | null,
): { title: string; description: string; isWarning: boolean } | null {
  type Insight = { title: string; description: string; isWarning: boolean; priority: number };
  const insights: Insight[] = [];

  // HRV below baseline (warning, high priority)
  if (hrv !== null && avgHrvVal !== null && avgHrvVal > 0) {
    const hrvPctDiff = ((hrv - avgHrvVal) / avgHrvVal) * 100;
    if (hrvPctDiff <= -15) {
      insights.push({
        title: "HRV softer than usual",
        description: `HRV ${Math.round(hrv)}ms vs avg ${Math.round(avgHrvVal)}ms. This sometimes precedes symptom flares.`,
        isWarning: true,
        priority: 1,
      });
    } else if (hrvPctDiff >= 15) {
      insights.push({
        title: "HRV strong today",
        description: `HRV ${Math.round(hrv)}ms vs avg ${Math.round(avgHrvVal)}ms. Good recovery.`,
        isWarning: false,
        priority: 4,
      });
    }
  }

  // Sleep score below average (warning)
  if (sleepScore !== null && avgSleep !== null) {
    const sleepDiff = sleepScore - avgSleep;
    if (sleepDiff <= -10) {
      insights.push({
        title: "Rough sleep last night",
        description: `Sleep: ${sleepScore} (avg ${Math.round(avgSleep)}). Take it easy if you can.`,
        isWarning: true,
        priority: 2,
      });
    } else if (sleepDiff >= 10) {
      insights.push({
        title: "Good sleep last night",
        description: `Sleep: ${sleepScore} (avg ${Math.round(avgSleep)})`,
        isWarning: false,
        priority: 3,
      });
    }
  }

  // Sort: warnings first (priority 1, 2), then good news (3, 4)
  insights.sort((a, b) => a.priority - b.priority);

  if (insights.length > 0) {
    return insights[0];
  }

  // Fallback: show basic stats if no significant deviation
  if (sleepScore !== null || hrv !== null) {
    const parts: string[] = [];
    if (sleepScore !== null) {
      const cmp = avgSleep !== null ? ` (avg ${Math.round(avgSleep)})` : "";
      parts.push(`Sleep: ${sleepScore}${cmp}`);
    }
    if (hrv !== null) {
      const cmp = avgHrvVal !== null ? ` (avg ${Math.round(avgHrvVal)})` : "";
      parts.push(`HRV: ${Math.round(hrv)}ms${cmp}`);
    }
    return {
      title: "Oura Summary",
      description: parts.join("  |  "),
      isWarning: false,
    };
  }

  return null;
}

export function SmartCards({
  hasLoggedToday,
  activeProblems,
  latestSleepScore,
  avgSleepScore,
  latestHrv,
  avgHrv,
  ouraDate,
  strongCorrelation,
}: SmartCardsProps) {
  const cards: CardData[] = [];

  // Log check-in card removed -- now handled by the prominent CTA in the home page header

  // Active problems (always show if any exist)
  if (activeProblems.length > 0) {
    const problemNames = activeProblems
      .slice(0, 3)
      .map((p) => p.problem)
      .join(", ");
    const moreCount = activeProblems.length > 3 ? activeProblems.length - 3 : 0;
    const suffix = moreCount > 0 ? ` + ${moreCount} more` : "";

    cards.push({
      id: "active-problems",
      title: `${activeProblems.length} thing${activeProblems.length === 1 ? "" : "s"} we're watching`,
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

  // Card 3: Smart Oura insight with deviation-based messaging
  if (latestSleepScore !== null || latestHrv !== null) {
    const insight = getSmartOuraInsight(
      latestSleepScore,
      avgSleepScore,
      latestHrv,
      avgHrv,
    );

    if (insight) {
      const dateLabel = ouraDate
        ? ouraDate === new Date().toISOString().split("T")[0]
          ? "Last night"
          : isYesterday(parseISO(ouraDate))
            ? "Yesterday"
            : format(parseISO(ouraDate), "MMM d")
        : "Latest reading";

      cards.push({
        id: "oura-insight",
        title: insight.title !== "Oura Summary" ? insight.title : dateLabel,
        description: insight.description,
        icon: (
          <Activity
            size={18}
            style={{
              color: insight.isWarning
                ? "var(--accent-rose)"
                : "var(--accent-sage)",
            }}
            strokeWidth={2}
          />
        ),
        action: { label: "View", href: "/patterns?metric=sleep" },
        borderColor: insight.isWarning ? "var(--accent-blush)" : undefined,
      });
    }
  }

  // Card 4: Strong correlation pattern (if one exists)
  if (strongCorrelation?.effect_description) {
    cards.push({
      id: "pattern-found",
      title: "Pattern found",
      description: strongCorrelation.effect_description,
      icon: (
        <TrendingUp
          size={18}
          style={{ color: "var(--accent-sage)" }}
          strokeWidth={2}
        />
      ),
      action: { label: "View", href: "/patterns" },
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
      {cards.map((card) => {
        const accentColor = card.borderColor || "var(--accent-sage)";
        // Use hex for alpha transparency on accent background
        const iconBg = accentColor === "var(--accent-blush)"
          ? "rgba(212, 160, 160, 0.14)"
          : "rgba(107, 144, 128, 0.12)";
        return (
        <div
          key={card.id}
          style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            boxShadow: "var(--shadow-sm)",
            padding: card.prominent ? 20 : 16,
            border: "none",
            borderLeftWidth: 4,
            borderLeftStyle: "solid",
            borderLeftColor: accentColor,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: card.prominent ? "flex-start" : "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexDirection: card.prominent ? "column" : "row",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: iconBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accentColor,
                }}
              >
                {card.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: card.prominent ? 15 : 14,
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

            {card.prominent ? (
              <Link
                href={card.action.href}
                className="touch-target press-feedback"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-inverse)",
                  background: "var(--accent-sage)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  padding: "10px 24px",
                  borderRadius: 12,
                  marginTop: 4,
                  alignSelf: "flex-start",
                  marginLeft: 30,
                  boxShadow: "var(--shadow-sm)",
                  transition: "transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
                }}
              >
                {card.action.label}
              </Link>
            ) : (
              <Link
                href={card.action.href}
                className="touch-target press-feedback"
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
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}
