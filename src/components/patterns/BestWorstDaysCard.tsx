/**
 * BestWorstDaysCard (Daylio Feature 3)
 *
 * Two columns on /patterns showing which activities, factors, or symptoms
 * co-occur most often with Lanae's best-mood days (4-5) and her roughest
 * days (1-2). Frequency-only, no statistical claims.
 *
 * Non-shaming rules enforced:
 *   - Minimum 10 entries per bucket before anything renders for that side.
 *     If neither side meets the threshold, the whole card shows one hold
 *     state. If only one side meets it, the other side shows a small hint,
 *     not scary empty space.
 *   - Column labels say "Best" and "Rough", never "Good/Bad".
 *   - Footer always shows the correlation-vs-causation disclaimer.
 *   - No em dashes (CLAUDE.md rule).
 *
 * This component is a server component. The aggregation happens on the
 * server via `aggregateBestWorst`; pass the result down as a prop.
 */

import type {
  AggregationResult,
  BucketResult,
  TopItem,
} from "@/lib/intelligence/best-worst-aggregator";
import { COPY, formatFrequency } from "@/lib/intelligence/best-worst-aggregator";

export interface BestWorstDaysCardProps {
  /** Pre-aggregated result. Server page should call aggregateBestWorst. */
  result: AggregationResult;
}

function BucketIcon({ icon }: { icon: string | null }) {
  if (!icon) {
    return (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 18,
          height: 18,
          borderRadius: 6,
          background: "var(--bg-elevated, rgba(0,0,0,0.05))",
          flexShrink: 0,
        }}
      />
    );
  }
  // We store `icon` as a plain string key (e.g. "bed", "salt"). Rendering
  // is left visually minimal: a rounded badge with the first letter. The
  // UI can evolve to lucide-react icons later; the aggregator already
  // surfaces the raw icon key so that swap is trivial.
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-secondary)",
        background: "var(--bg-elevated, rgba(0,0,0,0.05))",
        flexShrink: 0,
        textTransform: "uppercase",
      }}
    >
      {icon.slice(0, 2)}
    </span>
  );
}

function TopItemRow({ item, accent }: { item: TopItem; accent: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.06))",
      }}
    >
      <BucketIcon icon={item.icon} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          Common on {formatFrequency(item.frequency)} of these days
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: accent,
          whiteSpace: "nowrap",
        }}
      >
        {formatFrequency(item.frequency)}
      </div>
    </li>
  );
}

function BucketColumn({
  bucket,
  accent,
  background,
}: {
  bucket: BucketResult;
  accent: string;
  background: string;
}) {
  const body = (() => {
    if (!bucket.hasEnoughData) {
      return (
        <p
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            margin: "8px 0 0 0",
            lineHeight: 1.5,
          }}
        >
          {`Need 10 days in this group to show top factors. Logged so far: ${bucket.bucketSize}.`}
        </p>
      );
    }
    if (bucket.items.length === 0) {
      return (
        <p
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            margin: "8px 0 0 0",
            lineHeight: 1.5,
          }}
        >
          No activities logged yet on these days. Try the lite log.
        </p>
      );
    }
    return (
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: "8px 0 0 0",
        }}
      >
        {bucket.items.map((item) => (
          <TopItemRow key={item.trackable_id} item={item} accent={accent} />
        ))}
      </ol>
    );
  })();

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        background,
        border: `1px solid ${accent}33`,
        borderRadius: 12,
        padding: "12px 14px",
      }}
      aria-label={bucket.label}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: accent,
            margin: 0,
            letterSpacing: "0.01em",
          }}
        >
          {bucket.label}
        </h3>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          n = {bucket.bucketSize}
        </span>
      </header>
      {body}
    </section>
  );
}

function HoldState({ result }: { result: AggregationResult }) {
  const totalDays = result.best.bucketSize + result.worst.bucketSize;
  return (
    <div
      style={{
        padding: "18px 16px",
        textAlign: "center",
        color: "var(--text-secondary)",
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: 0,
        }}
      >
        {COPY.holdTitle}
      </h3>
      <p
        style={{
          fontSize: 12,
          margin: "6px auto 0",
          maxWidth: 380,
          lineHeight: 1.5,
        }}
      >
        {COPY.holdBody}
      </p>
      <p
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          margin: "8px 0 0 0",
        }}
      >
        {`Best so far: ${result.best.bucketSize}. Rough so far: ${result.worst.bucketSize}. Total mood-logged days: ${totalDays}.`}
      </p>
    </div>
  );
}

export function BestWorstDaysCard({ result }: BestWorstDaysCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Your best vs rough days
        </h2>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            margin: "2px 0 0 0",
          }}
        >
          {result.windowLabel}
        </p>
      </header>

      {result.anyBucketReady ? (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <BucketColumn
            bucket={result.best}
            accent="var(--accent-sage)"
            background="var(--accent-sage-muted, rgba(107, 144, 128, 0.08))"
          />
          <BucketColumn
            bucket={result.worst}
            accent="var(--accent-blush)"
            background="var(--accent-blush-muted, rgba(212, 160, 160, 0.08))"
          />
        </div>
      ) : (
        <HoldState result={result} />
      )}

      <footer
        style={{
          borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.06))",
          paddingTop: 8,
          fontSize: 11,
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        {result.footnote}
      </footer>
    </div>
  );
}

export default BestWorstDaysCard;
