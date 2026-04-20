/**
 * Compact "last synced" pill shown across every sleep route.
 *
 * Previously rendered as a full card with body copy; a design review
 * flagged that as too chunky. This rewrite collapses it to a single-
 * line pill that still pressing tap resyncs and still tells the user
 * exactly how stale the data is — just without eating a quarter of
 * the viewport.
 */

'use client';

import { useState } from 'react';
import type { StaleResult } from '@/lib/sleep/stale';

interface StaleBannerProps {
  stale: StaleResult;
  latestDate: string | null;
}

export function StaleBanner({ stale, latestDate }: StaleBannerProps) {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');

  if (stale.status === 'fresh') return null;

  const handleResync = async () => {
    if (status === 'syncing') return;
    setStatus('syncing');
    try {
      const res = await fetch('/api/oura/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('done');
      setTimeout(() => window.location.reload(), 500);
    } catch {
      setStatus('error');
    }
  };

  const buttonLabel = (() => {
    switch (status) {
      case 'syncing':
        return 'Syncing\u2026';
      case 'done':
        return 'Reloading\u2026';
      case 'error':
        return 'Retry';
      default:
        return 'Sync';
    }
  })();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 8px 6px 14px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--accent-blush-muted)',
        border: '1px solid var(--accent-blush-light)',
        fontSize: 12,
        color: 'var(--text-primary)',
        lineHeight: 1.3,
      }}
    >
      <span style={{ fontWeight: 600 }}>{stale.label}</span>
      <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {latestDate ? `Last synced ${latestDate}` : 'Connect Oura in Settings'}
      </span>
      {latestDate && (
        <button
          type="button"
          onClick={handleResync}
          disabled={status === 'syncing' || status === 'done'}
          className="press-feedback"
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-card)',
            color: 'var(--accent-sage)',
            border: '1px solid var(--accent-sage)',
            fontSize: 11,
            fontWeight: 700,
            cursor: status === 'syncing' ? 'progress' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}
