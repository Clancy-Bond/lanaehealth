/**
 * Calorie Card (Home)
 *
 * The MyNetDiary-signature surface: running calorie total vs target,
 * visible on app open without navigating to /log. Under the hood,
 * LanaeHealth already uses USDA FoodData Central (the same database
 * MyNetDiary runs on) via QuickMealLog's FoodSearchAutocomplete.
 * This card exposes the running total and links to the full log for
 * search/add.
 *
 * Server component, pre-fetched data from page.tsx. Mirrors the
 * pattern of BaselineCard / AdaptiveMovementCard / MorningSignalCard.
 */

const CALORIE_TARGET_DEFAULT = 1800;

interface Props {
  /** Sum of today's food_entries.calories for today's log. */
  caloriesToday: number;
  /** Daily calorie target. Defaults to 1800. */
  target?: number;
  /** Number of distinct meals logged today (for the sub-copy). */
  mealCount: number;
}

export function CalorieCard({
  caloriesToday,
  target = CALORIE_TARGET_DEFAULT,
  mealCount,
}: Props) {
  const ratio = Math.min(1, caloriesToday / target);
  const overTarget = caloriesToday > target;
  const remaining = Math.max(0, target - caloriesToday);

  // Ring geometry (match the check-in progress circle idiom from page.tsx).
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - Math.min(1, ratio));

  const bandColor = overTarget ? 'var(--accent-blush)' : 'var(--accent-sage)';
  const bandAccent = overTarget
    ? 'var(--accent-blush-light)'
    : 'var(--accent-sage-muted)';

  return (
    <div style={{ padding: '0 16px' }}>
      <a
        href="/log"
        className="press-feedback"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 18px',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
          border: '1px solid var(--border-light)',
          borderLeftWidth: 3,
          borderLeftStyle: 'solid',
          borderLeftColor: bandAccent,
          boxShadow: 'var(--shadow-sm)',
          textDecoration: 'none',
          color: 'var(--text-primary)',
          transition:
            'transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
        }}
      >
        {/* Ring */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle
              cx="36"
              cy="36"
              r={radius}
              fill="none"
              stroke="var(--border-light)"
              strokeWidth="4"
            />
            <circle
              cx="36"
              cy="36"
              r={radius}
              fill="none"
              stroke={bandColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${dashoffset}`}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
                transition:
                  'stroke-dashoffset var(--duration-slow) var(--ease-decelerate)',
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
              lineHeight: 1,
            }}
          >
            <span
              className="tabular"
              style={{ fontSize: 16, fontWeight: 700, color: bandColor }}
            >
              {Math.round(caloriesToday)}
            </span>
            <span
              style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginTop: 2,
              }}
            >
              cal
            </span>
          </div>
        </div>

        {/* Copy */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Today\u2019s calories
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {overTarget ? (
              <>Over target by <span className="tabular">{Math.round(caloriesToday - target)}</span> cal</>
            ) : caloriesToday === 0 ? (
              'Log your first meal'
            ) : (
              <><span className="tabular">{Math.round(remaining)}</span> cal remaining</>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {mealCount === 0
              ? 'Tap to search USDA food database'
              : `${mealCount} meal${mealCount === 1 ? '' : 's'} logged \u00B7 target ${target}`}
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
        >
          <path
            d="M7.5 5L12.5 10L7.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </div>
  );
}
