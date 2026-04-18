/**
 * Topic Cycle Banner
 *
 * Small cycle-day + phase strip that sits at the top of topic pages
 * (orthostatic, migraine, nutrition). Lanae's conditions all correlate
 * with cycle phase in some way, so having the current phase visible
 * on every reading page beats making her navigate to /topics/cycle
 * to check.
 *
 * Shared banner component. Uses the SAME cycle helper that Home and
 * every other surface uses (src/lib/cycle/current-day.ts) so the
 * numbers never drift across pages. See
 * docs/qa/2026-04-16-cycle-day-three-values.md for why this matters.
 */

import { getCurrentCycleDay } from '@/lib/cycle/current-day';
import { format } from 'date-fns';

function phaseColor(phase: string | null): string {
  switch (phase?.toLowerCase()) {
    case 'menstrual':
      return 'var(--phase-menstrual)';
    case 'follicular':
      return 'var(--phase-follicular)';
    case 'ovulatory':
      return 'var(--phase-ovulatory)';
    case 'luteal':
      return 'var(--phase-luteal)';
    default:
      return 'var(--text-muted)';
  }
}

export async function TopicCycleBanner() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const cycle = await getCurrentCycleDay(today).catch(() => null);

  if (!cycle || cycle.day === null) {
    return null;
  }

  const phaseLabel = cycle.phase
    ? cycle.phase.charAt(0).toUpperCase() + cycle.phase.slice(1)
    : null;
  const accent = phaseColor(cycle.phase);

  return (
    <a
      href="/topics/cycle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        color: 'var(--text-secondary)',
        textDecoration: 'none',
        width: 'fit-content',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: accent,
          display: 'inline-block',
        }}
        aria-hidden
      />
      <span className="tabular">CD {cycle.day}</span>
      {phaseLabel && (
        <span style={{ color: accent, fontWeight: 700 }}>
          &middot; {phaseLabel}
        </span>
      )}
      {cycle.isUnusuallyLong && (
        <span style={{ color: 'var(--accent-blush)', fontWeight: 700 }}>
          &middot; long cycle
        </span>
      )}
    </a>
  );
}
