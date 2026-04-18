"use client";

/**
 * InsightCard - Plain-English correlation insight for the Patterns page.
 *
 * Renders:
 *   - Hero sentence (Claude-narrated or local template).
 *   - Chips: r-value, lag bucket, sample size.
 *   - Confidence accent bar (sage for strong, blush for moderate, muted for suggestive).
 *   - Freshness footnote so stale findings are honest about it.
 *
 * Design tokens only. No em dashes anywhere.
 */

import type { CorrelationResult } from "./PatternsClient";
import type { InsightNarration } from "@/lib/intelligence/insight-narrator";
import { InfoTip } from "@/components/ui/InfoTip";

export interface InsightCardProps {
  row: CorrelationResult;
  narration: InsightNarration;
  /** Hero variant: larger sentence, heavier chip, more padding. */
  prominent?: boolean;
}

// Confidence-tier style map. Sage for strong signals, blush for moderate,
// muted neutral for suggestive. Keeps visual hierarchy quiet but clear.
const TIER_STYLES: Record<
  InsightNarration["confidenceTier"],
  { bar: string; chipBg: string; chipText: string; label: string }
> = {
  strong: {
    bar: "var(--accent-sage)",
    chipBg: "var(--accent-sage-muted)",
    chipText: "var(--accent-sage)",
    label: "Strong",
  },
  moderate: {
    bar: "var(--accent-blush)",
    chipBg: "rgba(212, 160, 160, 0.14)",
    chipText: "#B07676",
    label: "Moderate",
  },
  suggestive: {
    bar: "var(--border)",
    chipBg: "var(--bg-elevated)",
    chipText: "var(--text-secondary)",
    label: "Suggestive",
  },
};

function Chip({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: "var(--radius-full, 999px)",
        background: bg,
        color,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}

export function InsightCard({
  row,
  narration,
  prominent = false,
}: InsightCardProps) {
  const tier = TIER_STYLES[narration.confidenceTier];

  return (
    <article
      className={prominent ? "card-elevated" : "card"}
      style={{
        position: "relative",
        padding: prominent ? "22px 22px 22px 26px" : "16px 18px 16px 22px",
        display: "flex",
        flexDirection: "column",
        gap: prominent ? 14 : 10,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
      aria-label={`Insight: ${row.factor_a} and ${row.factor_b}`}
    >
      {/* Confidence accent bar, wider on the hero */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: prominent ? 6 : 4,
          background: tier.bar,
        }}
      />

      {prominent && (
        <p
          className="route-hero__eyebrow"
          style={{
            margin: 0,
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Top insight this week
          <InfoTip term="top insight" />
        </p>
      )}

      {/* Hero sentence */}
      <p
        style={{
          fontSize: prominent ? "var(--text-xl)" : "var(--text-lg)",
          lineHeight: 1.4,
          color: "var(--text-primary)",
          margin: 0,
          fontWeight: prominent ? 600 : 500,
          letterSpacing: prominent ? "-0.01em" : 0,
        }}
      >
        {narration.sentence}
      </p>

      {/* Chip row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        <Chip label={tier.label} bg={tier.chipBg} color={tier.chipText} />
        {narration.rValueLabel && (
          <Chip
            label={narration.rValueLabel}
            bg="var(--bg-elevated)"
            color="var(--text-secondary)"
          />
        )}
        {narration.lagBucket && (
          <Chip
            label={narration.lagBucket}
            bg="var(--bg-elevated)"
            color="var(--text-secondary)"
          />
        )}
        {typeof row.sample_size === "number" && row.sample_size > 0 && (
          <Chip
            label={`n = ${row.sample_size}`}
            bg="var(--bg-elevated)"
            color="var(--text-secondary)"
          />
        )}
        {row.cycle_phase && (
          <Chip
            label={`${row.cycle_phase} phase`}
            bg="var(--bg-elevated)"
            color="var(--text-secondary)"
          />
        )}
      </div>

      {/* Freshness footnote */}
      <p
        style={{
          fontSize: "var(--text-xs)",
          color: narration.isStale ? "var(--accent-blush)" : "var(--text-muted)",
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {narration.isStale ? "Heads up, " : ""}
        {narration.freshnessLabel}
        {narration.isStale ? ". This finding may be out of date." : "."}
      </p>
    </article>
  );
}

/**
 * Section wrapper: header, list of cards, graceful empty state.
 * Consumes the already-narrated list so the page stays lean.
 */
export interface InsightCardListProps {
  items: Array<CorrelationResult & { narration: InsightNarration }>;
  hasEnough: boolean;
}

export function InsightCardList({ items, hasEnough }: InsightCardListProps) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Plain-English insights
          <InfoTip term="intelligence engine" />
        </h2>
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            margin: "4px 0 0",
            lineHeight: 1.4,
          }}
        >
          Short summaries of the strongest patterns in your data. Correlation is
          not causation.
        </p>
      </div>

      {hasEnough && items.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Hero: the strongest pattern gets the full attention of the viewport. */}
          <InsightCard
            key={items[0].id}
            row={items[0]}
            narration={items[0].narration}
            prominent
          />

          {/* Remaining patterns collapse behind a disclosure so the page
              doesn't overwhelm Lanae on a tired morning (design-decisions.md
              §10 Progressive Disclosure). The count is authoritative so she
              knows what's hiding. */}
          {items.length > 1 && (
            <details
              style={{
                marginTop: 4,
                borderRadius: "var(--radius-lg)",
              }}
            >
              <summary
                className="press-feedback"
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  padding: "12px 16px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  color: "var(--accent-sage)",
                  userSelect: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  transition:
                    "background var(--duration-fast) var(--ease-standard)",
                }}
              >
                <span>
                  Show {items.length - 1} more pattern
                  {items.length - 1 === 1 ? "" : "s"}
                </span>
                <span
                  aria-hidden
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  tap to expand
                </span>
              </summary>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                {items.slice(1).map((item) => (
                  <InsightCard
                    key={item.id}
                    row={item}
                    narration={item.narration}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: "18px 20px",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <p
            style={{
              fontSize: "var(--text-base)",
              color: "var(--text-primary)",
              margin: 0,
              fontWeight: 500,
            }}
          >
            Not enough confident patterns yet.
          </p>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Keep logging daily. Once a few strong or moderate correlations
            appear across your Oura, cycle, and symptom data, plain-English
            summaries will surface here.
          </p>
        </div>
      )}
    </div>
  );
}
