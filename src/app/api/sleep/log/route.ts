/**
 * POST /api/sleep/log
 *
 * Manual sleep entry for days Oura missed (ring battery died, left on
 * charger, firmware update, etc.). Writes both daily_logs.sleep_quality
 * and a sleep_details row for the same log.
 *
 * Intentionally additive: we never overwrite existing Oura-synced
 * sleep_score in oura_daily. The manual entry lives alongside the
 * sensor readings so the user can compare what the ring captured vs.
 * what they felt.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import type { SleepNap } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface LogRequest {
  date: string; // YYYY-MM-DD
  bedtime: string | null; // "HH:mm"
  wake_time: string | null; // "HH:mm"
  perceived_quality: number | null; // 1-5
  naps: SleepNap[];
  notes: string | null;
}

function clampQuality(q: number | null): number | null {
  if (q === null || !Number.isFinite(q)) return null;
  return Math.max(1, Math.min(5, Math.round(q)));
}

export async function POST(req: NextRequest) {
  let body: LogRequest;
  try {
    body = (await req.json()) as LogRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Upsert today's daily_log so the sleep_details row has a parent.
  const { data: existingLog } = await supabase
    .from('daily_logs')
    .select('id, sleep_quality')
    .eq('date', body.date)
    .maybeSingle();

  const quality = clampQuality(body.perceived_quality);
  // Voice rule: the 1-5 slider is 1 "rough" and 5 "restorative". We
  // translate to the existing 0-10 sleep_quality column (multiply by 2
  // so 5 -> 10). Null-safe.
  const sleep_quality_0_10 = quality === null ? null : quality * 2;

  let logId: string;
  if (existingLog) {
    logId = existingLog.id as string;
    await supabase
      .from('daily_logs')
      .update({
        sleep_quality: sleep_quality_0_10,
        updated_at: new Date().toISOString(),
      })
      .eq('id', logId);
  } else {
    const { data: created, error } = await supabase
      .from('daily_logs')
      .insert({ date: body.date, sleep_quality: sleep_quality_0_10 })
      .select('id')
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? 'Failed to create log' }, { status: 500 });
    }
    logId = created.id as string;
  }

  // Upsert sleep_details for this log. Notes go through to the parent
  // daily_log so users don't have to duplicate text; sleep_details does
  // not have a notes column.
  if (body.notes !== null && body.notes.trim().length > 0) {
    await supabase
      .from('daily_logs')
      .update({ notes: body.notes, updated_at: new Date().toISOString() })
      .eq('id', logId);
  }

  const naps = Array.isArray(body.naps) ? body.naps.slice(0, 6) : [];
  const { error: detailErr } = await supabase
    .from('sleep_details')
    .upsert(
      {
        log_id: logId,
        bedtime: body.bedtime ?? null,
        wake_time: body.wake_time ?? null,
        sleep_latency_min: null,
        wake_episodes: [],
        sleep_quality_factors: [],
        naps,
      },
      { onConflict: 'log_id' },
    );
  if (detailErr) {
    return NextResponse.json({ error: detailErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, log_id: logId });
}
