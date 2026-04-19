/**
 * Calories » Apple ring widget
 *
 * SVG apple-ish ring that MyNetDiary shows on both the Dashboard AND
 * the Food tab. Ring color shifts to blush when over target. Includes
 * a small "stem" + "leaf" so it reads as an apple, not just a donut.
 *
 * Used by /calories (dashboard hero) and /calories/food (repeated as
 * a visual anchor at the bottom of the Food tab so totals always have
 * the familiar ring next to them).
 */

export function CalorieApple({
  eaten,
  target,
  remaining,
  overTarget,
}: {
  eaten: number;
  target: number;
  remaining: number;
  overTarget: boolean;
}) {
  const viewSize = 180;
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const ratio = target > 0 ? Math.min(1, eaten / target) : 0;
  const dashoffset = circumference * (1 - ratio);
  const ringColor = overTarget ? 'var(--accent-blush)' : 'var(--accent-sage)';

  const primaryLabel = overTarget
    ? `+${Math.round(eaten - target)}`
    : Math.round(remaining);
  const primaryCaption = overTarget ? 'over target' : 'left';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 6px',
        borderRadius: 16,
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 2,
        }}
      >
        Calorie budget
      </span>
      <span
        className="tabular"
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 4,
          lineHeight: 1,
        }}
      >
        {target}
      </span>
      <div style={{ position: 'relative', width: '100%', maxWidth: 180 }}>
        <svg
          width="100%"
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          style={{ display: 'block' }}
          role="img"
          aria-label={`Calorie budget ring: ${Math.round(eaten)} of ${target} eaten`}
        >
          <rect
            x={viewSize / 2 - 2}
            y={6}
            width={4}
            height={10}
            rx={2}
            fill="var(--text-muted)"
            opacity="0.5"
          />
          <ellipse
            cx={viewSize / 2 + 10}
            cy={8}
            rx={6}
            ry={3}
            fill="var(--accent-sage)"
            opacity="0.6"
          />
          <circle
            cx={viewSize / 2}
            cy={viewSize / 2 + 4}
            r={radius}
            fill="none"
            stroke="var(--border-light)"
            strokeWidth="8"
          />
          <circle
            cx={viewSize / 2}
            cy={viewSize / 2 + 4}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${dashoffset}`}
            style={{
              transform: `rotate(-90deg)`,
              transformOrigin: `${viewSize / 2}px ${viewSize / 2 + 4}px`,
            }}
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
            pointerEvents: 'none',
          }}
        >
          <span
            className="tabular"
            style={{
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1,
              color: ringColor,
            }}
          >
            {primaryLabel}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginTop: 2,
            }}
          >
            {primaryCaption}
          </span>
          <span
            className="tabular"
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            {Math.round(eaten)} eaten
          </span>
        </div>
      </div>
    </div>
  );
}
