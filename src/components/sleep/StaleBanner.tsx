/**
 * "Last synced" banner shown on every sleep route when oura_daily's most
 * recent row is more than 24 hours old.
 *
 * Directly addresses Oura's top review complaint: firmware-breaking-sync
 * that leaves users staring at stale numbers they think are fresh
 * (docs/competitive/oura/user-reviews.md HATES section). We never hide
 * the gap; we surface it with a resync affordance.
 *
 * Client component only because the resync button uses fetch(). Layout
 * falls back gracefully when JS is disabled (the form still POSTs).
 */

'use client';

import { useState } from 'react';
import type { StaleResult } from '@/lib/sleep/stale';

interface StaleBannerProps {
  stale: StaleResult;
  /** ISO date of the latest oura_daily row, shown in the secondary text. */
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
      // Give the user a moment to read "synced" before the page refreshes.
      setTimeout(() => window.location.reload(), 800);
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
        return 'Try again';
      default:
        return 'Sync Oura now';
    }
  })();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: 'var(--accent-blush-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          {stale.label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
          {latestDate
            ? `Last reading from ${latestDate}. We never fake today\u2019s numbers from yesterday.`
            : 'Connect your Oura ring from Settings to start syncing readings.'}
        </div>
      </div>
      {latestDate && (
        <button
          type="button"
          onClick={handleResync}
          disabled={status === 'syncing' || status === 'done'}
          className="press-feedback"
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            background:
              status === 'error' ? 'var(--accent-blush-muted)' : 'var(--accent-sage-muted)',
            color: status === 'error' ? 'var(--accent-blush)' : 'var(--accent-sage)',
            border: '1px solid',
            borderColor:
              status === 'error' ? 'var(--accent-blush)' : 'var(--accent-sage)',
            fontSize: 11,
            fontWeight: 600,
            cursor: status === 'syncing' ? 'progress' : 'pointer',
            minHeight: 32,
            whiteSpace: 'nowrap',
          }}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}
