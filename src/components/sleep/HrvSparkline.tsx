/**
 * Tiny HRV sparkline for the sleep overview + home widget.
 *
 * Oura reviewers repeatedly cite the multi-day HRV line as the thing
 * that distinguishes bad-day signal from baseline noise. We render the
 * same shape: a thin sage line with a filled band underneath and the
 * last point emphasized so the eye lands on "today".
 *
 * Server component. SVG fully self-contained; no client-side JS.
 */

interface HrvSparklineProps {
  /** Values in order, oldest first. Nulls get dropped. */
  values: (number | null | undefined)[];
  /** Optional CSS width override; defaults to 100% via viewBox scaling. */
  width?: number;
  height?: number;
}

export function HrvSparkline({ values, width = 180, height = 48 }: HrvSparklineProps) {
  const cleaned = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => typeof p.v === 'number' && Number.isFinite(p.v));

  if (cleaned.length < 2) {
    return (
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Not enough HRV data to draw a sparkline"
      >
        <line
          x1={6}
          x2={width - 6}
          y1={height / 2}
          y2={height / 2}
          stroke="var(--border-light)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
      </svg>
    );
  }

  const xs = cleaned.map((p) => p.i);
  const vs = cleaned.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const padTop = 6;
  const padBottom = 6;
  const plotH = height - padTop - padBottom;
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xSpan = xMax - xMin || 1;

  const points = cleaned.map((p) => {
    const x = 4 + ((p.i - xMin) / xSpan) * (width - 8);
    const y = padTop + plotH - ((p.v - min) / span) * plotH;
    return { x, y, v: p.v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padBottom} L ${points[0].x.toFixed(1)} ${height - padBottom} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`HRV sparkline, ${cleaned.length} days, latest ${Math.round(last.v)}ms`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="hrv-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-sage)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent-sage)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#hrv-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--accent-sage)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={3} fill="var(--accent-sage)" />
      <circle cx={last.x} cy={last.y} r={1.25} fill="#ffffff" />
    </svg>
  );
}
