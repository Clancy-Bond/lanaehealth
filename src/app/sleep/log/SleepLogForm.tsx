/**
 * Client form for /sleep/log.
 *
 * Tiny-footprint manual sleep form. Voice rule: every label is
 * invitational ("How did you sleep?") not shaming ("rate your sleep
 * quality"). Naps are opt-in chips so adding one is a single tap.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Nap {
  start: string;
  duration_min: number;
}

interface SleepLogFormProps {
  date: string;
  initialQuality: number | null;
  initialBedtime: string | null;
  initialWake: string | null;
  initialNotes: string | null;
  initialNaps: Nap[];
}

const QUALITY_LABELS: Record<number, string> = {
  1: 'Rough',
  2: 'Light',
  3: 'Okay',
  4: 'Restful',
  5: 'Restorative',
};

const NAP_SUGGESTIONS = [20, 30, 45, 60, 90];

function cleanTime(t: string | null): string {
  if (!t) return '';
  // Supabase "HH:MM:SS" -> "HH:MM" for input[type=time].
  return t.slice(0, 5);
}

export function SleepLogForm({
  date,
  initialQuality,
  initialBedtime,
  initialWake,
  initialNotes,
  initialNaps,
}: SleepLogFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quality, setQuality] = useState<number | null>(initialQuality);
  const [bedtime, setBedtime] = useState<string>(cleanTime(initialBedtime));
  const [wake, setWake] = useState<string>(cleanTime(initialWake));
  const [notes, setNotes] = useState<string>(initialNotes ?? '');
  const [naps, setNaps] = useState<Nap[]>(initialNaps ?? []);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveState('saving');
    setErrMsg(null);
    try {
      const res = await fetch('/api/sleep/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          bedtime: bedtime || null,
          wake_time: wake || null,
          perceived_quality: quality,
          naps,
          notes: notes.trim().length > 0 ? notes : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Save failed (${res.status})`);
      }
      setSaveState('saved');
      startTransition(() => router.refresh());
      setTimeout(() => setSaveState('idle'), 1400);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Something went wrong');
      setSaveState('error');
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Perceived quality */}
      <fieldset
        style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          margin: 0,
        }}
      >
        <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>
          How did you sleep?
        </legend>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = quality === n;
            return (
              <button
                type="button"
                key={n}
                aria-pressed={active}
                className={active ? 'pill pill-active' : 'pill'}
                onClick={() => setQuality(active ? null : n)}
                style={{ flex: '1 1 auto', minWidth: 72 }}
              >
                <span className="tabular" style={{ fontSize: 16, fontWeight: 800 }}>
                  {n}
                </span>
                <span style={{ marginLeft: 6, fontSize: 11 }}>{QUALITY_LABELS[n]}</span>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 6px 0', lineHeight: 1.4 }}>
          1 is rough, 5 is restorative. No wrong answer.
        </p>
      </fieldset>

      {/* Bedtime / wake time */}
      <fieldset
        style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          margin: 0,
        }}
      >
        <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>Bedtime & wake</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Bedtime
            <input
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: '10px 12px',
                fontSize: 14,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
              }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Wake up
            <input
              type="time"
              value={wake}
              onChange={(e) => setWake(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: '10px 12px',
                fontSize: 14,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
              }}
            />
          </label>
        </div>
      </fieldset>

      {/* Naps */}
      <fieldset
        style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          margin: 0,
        }}
      >
        <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>Naps</legend>
        {naps.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {naps.map((n, idx) => (
              <li
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <input
                  type="time"
                  value={n.start}
                  onChange={(e) =>
                    setNaps((prev) => prev.map((p, i) => (i === idx ? { ...p, start: e.target.value } : p)))
                  }
                  style={{
                    padding: '6px 8px',
                    fontSize: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                  }}
                />
                <span className="tabular" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {n.duration_min} min
                </span>
                <button
                  type="button"
                  onClick={() => setNaps((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Remove nap"
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-light)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {NAP_SUGGESTIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              className="pill"
              onClick={() =>
                setNaps((prev) => [...prev, { start: '', duration_min: mins }])
              }
            >
              + {mins} min nap
            </button>
          ))}
        </div>
      </fieldset>

      {/* Notes */}
      <fieldset
        style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          margin: 0,
        }}
      >
        <legend style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>Anything to remember?</legend>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Woke at 3am, left shoulder flare, thunderstorm..."
          style={{
            display: 'block',
            width: '100%',
            marginTop: 6,
            padding: '10px 12px',
            fontSize: 14,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </fieldset>

      {/* Submit */}
      <button
        type="submit"
        disabled={saveState === 'saving' || isPending}
        className="press-feedback"
        style={{
          padding: '14px 18px',
          borderRadius: 'var(--radius-lg)',
          background:
            saveState === 'saved'
              ? 'var(--accent-sage-muted)'
              : 'linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)',
          color: saveState === 'saved' ? 'var(--accent-sage)' : 'var(--text-inverse)',
          border: 'none',
          fontWeight: 700,
          fontSize: 14,
          cursor: saveState === 'saving' ? 'progress' : 'pointer',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {saveState === 'saving'
          ? 'Saving\u2026'
          : saveState === 'saved'
          ? 'Saved'
          : saveState === 'error'
          ? 'Try again'
          : 'Save night'}
      </button>
      {errMsg && (
        <p style={{ fontSize: 12, color: 'var(--accent-blush)', margin: 0 }}>{errMsg}</p>
      )}
    </form>
  );
}
