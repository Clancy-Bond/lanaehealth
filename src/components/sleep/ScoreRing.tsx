/**
 * Score ring for Sleep / Readiness hero values.
 *
 * Redesigned to drop the redundant band-label-inside-the-ring. The
 * label, band, and delta now live OUTSIDE the ring in a clean column,
 * freeing the inside for just the number. Big number, quiet label.
 * Ring color still encodes the band.
 */

import { bandForScore } from '@/lib/sleep/bands';

interface ScoreRingProps {
  label: string;
  score: number | null;
  caption?: string;
  size?: number;
  strokeWidth?: number;
  accentColor?: string;
  displayValue?: string;
  /**
   * When true, hide the external label column and show only the ring.
   * Used inside dashboards where the label sits outside the component.
   */
  ringOnly?: boolean;
}

export function ScoreRing({
  label,
  score,
  caption,
  size = 148,
  strokeWidth = 10,
  accentColor,
  displayValue,
  ringOnly = false,
}: ScoreRingProps) {
  const meta = bandForScore(score);
  const color = accentColor ?? meta.color;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = score === null ? 0 : Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const valueText = displayValue ?? (score !== null ? String(Math.round(score)) : '\u2014');

  const ring = (
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
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          className="tabular"
          style={{
            fontSize: Math.round(size * 0.34),
            fontWeight: 800,
            color: 'var(--text-primary)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {valueText}
        </span>
      </div>
    </div>
  );

  if (ringOnly) {
    return (
      <div
        aria-label={`${label}: ${score !== null ? Math.round(score) : 'no reading'}, ${meta.label}`}
      >
        {ring}
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
      aria-label={`${label}: ${score !== null ? Math.round(score) : 'no reading'} out of 100, ${meta.label}`}
    >
      {ring}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color,
            marginTop: 3,
          }}
        >
          {meta.label}
        </div>
        {caption && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{caption}</div>
        )}
      </div>
    </div>
  );
}
