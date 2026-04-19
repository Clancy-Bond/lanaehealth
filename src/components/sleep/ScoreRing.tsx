/**
 * Progress ring for the readiness + sleep score on /sleep.
 *
 * Oura's hero pattern is "one big number surrounded by a progress arc
 * coloured by band". Users praise this more than any other single UI
 * element (see docs/competitive/oura/user-reviews.md). We follow the
 * same mental model but render with design-token colors so the ring
 * stays in the warm-modern palette, not Oura's navy.
 *
 * Server component. No interactivity. Returns null-safe when score is
 * missing so pages can map a list of rings without branching upstream.
 */

import { bandForScore } from '@/lib/sleep/bands';

interface ScoreRingProps {
  label: string;
  /** 0-100 score or null when no reading exists. */
  score: number | null;
  /** Tiny caption below the number ("last night", "today", "28-day avg"). */
  caption?: string;
  /** Pixel diameter of the ring. Defaults to 148. */
  size?: number;
  /** Stroke weight; defaults to 10. */
  strokeWidth?: number;
  /** Override the score's band color (e.g. for non-score metrics). */
  accentColor?: string;
  /** Override the number shown inside the ring (defaults to the score). */
  displayValue?: string;
}

export function ScoreRing({
  label,
  score,
  caption,
  size = 148,
  strokeWidth = 10,
  accentColor,
  displayValue,
}: ScoreRingProps) {
  const meta = bandForScore(score);
  const color = accentColor ?? meta.color;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = score === null ? 0 : Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const valueText = displayValue ?? (score !== null ? String(Math.round(score)) : '\u2014');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
      aria-label={`${label}: ${score !== null ? Math.round(score) : 'no reading'} out of 100, ${meta.label}`}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-light)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 600ms ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className="tabular"
            style={{
              fontSize: Math.round(size * 0.28),
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {valueText}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color,
              marginTop: 4,
            }}
          >
            {meta.label}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
          }}
        >
          {label}
        </div>
        {caption && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
