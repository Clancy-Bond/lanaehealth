'use client'

/**
 * Poor Man's Tilt Table Test
 *
 * Guided flow for orthostatic vital sign measurement.
 * 1. Lie down 5-10 min, record baseline HR and BP
 * 2. Stand and remain still
 * 3. Record HR and BP at 1, 3, 5, 7, 10 minutes
 * 4. Show the rise/recovery pattern with POTS threshold alerting
 *
 * POTS diagnostic criteria: HR increase >= 30 bpm within 10 min of standing
 * (>= 40 bpm for adolescents) without significant BP drop.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { createServiceClient } from '@/lib/supabase'

interface Reading {
  minute: number
  position: 'supine' | 'standing'
  heartRate: number | null
  systolic: number | null
  diastolic: number | null
}

type TestPhase = 'intro' | 'supine' | 'standing' | 'results'

function getHrColor(delta: number): string {
  if (delta >= 30) return '#C62828'
  if (delta >= 20) return '#E65100'
  if (delta >= 10) return '#F57F17'
  return 'var(--accent-sage)'
}

export default function TiltTableTest({ date }: { date: string }) {
  const [phase, setPhase] = useState<TestPhase>('intro')
  const [readings, setReadings] = useState<Reading[]>([])
  const [currentInput, setCurrentInput] = useState({ hr: '', sys: '', dia: '' })
  const [timer, setTimer] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [standingMinute, setStandingMinute] = useState(0)
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const STANDING_CHECKPOINTS = [1, 3, 5, 7, 10]

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimer(t => t + 1)
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const addReading = useCallback((position: 'supine' | 'standing', minute: number) => {
    const hr = currentInput.hr ? parseInt(currentInput.hr) : null
    const sys = currentInput.sys ? parseInt(currentInput.sys) : null
    const dia = currentInput.dia ? parseInt(currentInput.dia) : null

    if (hr === null) return // Need at least HR

    setReadings(prev => [...prev, { minute, position, heartRate: hr, systolic: sys, diastolic: dia }])
    setCurrentInput({ hr: '', sys: '', dia: '' })
  }, [currentInput])

  const startSupine = useCallback(() => {
    setPhase('supine')
    setTimer(0)
    setTimerRunning(true)
  }, [])

  const recordSupine = useCallback(() => {
    addReading('supine', 0)
    setTimerRunning(false)
    setPhase('standing')
    setTimer(0)
    setStandingMinute(0)
  }, [addReading])

  const startStanding = useCallback(() => {
    setTimerRunning(true)
  }, [])

  const recordStanding = useCallback(() => {
    const checkpointMinute = STANDING_CHECKPOINTS[standingMinute]
    addReading('standing', checkpointMinute)

    if (standingMinute >= STANDING_CHECKPOINTS.length - 1) {
      setTimerRunning(false)
      setPhase('results')
    } else {
      setStandingMinute(prev => prev + 1)
    }
  }, [standingMinute, addReading])

  const saveResults = useCallback(async () => {
    setSaving(true)
    try {
      const sb = createServiceClient()

      for (const reading of readings) {
        if (reading.heartRate) {
          await sb.from('lab_results').upsert({
            date,
            test_name: `Tilt Test HR (${reading.position} ${reading.minute}min)`,
            value: reading.heartRate,
            unit: 'bpm',
            category: 'Vitals',
            flag: 'normal',
            source_document_id: `tilt_test_${date}`,
          }, { onConflict: 'date,test_name' })
        }
        if (reading.systolic) {
          await sb.from('lab_results').upsert({
            date,
            test_name: `Tilt Test BP (${reading.position} ${reading.minute}min)`,
            value: reading.systolic,
            unit: 'mmHg',
            category: 'Vitals',
            flag: 'normal',
            source_document_id: `tilt_test_${date}`,
          }, { onConflict: 'date,test_name' })
        }
      }

      // Save the HR delta
      const supineHr = readings.find(r => r.position === 'supine')?.heartRate
      const maxStandingHr = Math.max(...readings.filter(r => r.position === 'standing').map(r => r.heartRate ?? 0))
      if (supineHr && maxStandingHr) {
        await sb.from('lab_results').upsert({
          date,
          test_name: 'Tilt Test Max HR Delta',
          value: maxStandingHr - supineHr,
          unit: 'bpm',
          category: 'Vitals',
          flag: maxStandingHr - supineHr >= 30 ? 'high' : 'normal',
          reference_range_low: 0,
          reference_range_high: 30,
          source_document_id: `tilt_test_${date}`,
        }, { onConflict: 'date,test_name' })
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }, [date, readings])

  // Results calculations
  const supineHr = readings.find(r => r.position === 'supine')?.heartRate ?? 0
  const standingReadings = readings.filter(r => r.position === 'standing' && r.heartRate)
  const maxStandingHr = standingReadings.length > 0 ? Math.max(...standingReadings.map(r => r.heartRate!)) : 0
  const maxDelta = maxStandingHr - supineHr

  return (
    <div className="card" style={{ background: 'var(--bg-card)', borderRadius: '1rem', borderColor: 'var(--border-light)' }}>
      <div className="px-4 py-4 space-y-4">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Tilt Table Test
        </h3>

        {/* Intro */}
        {phase === 'intro' && (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This guided test measures your heart rate response to standing.
              A rise of 30+ bpm may indicate POTS. You will need a way to measure your heart rate (pulse, watch, or oximeter).
            </p>
            <div className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Steps:</p>
              <ol className="text-[11px] mt-1 space-y-1 list-decimal pl-4" style={{ color: 'var(--text-secondary)' }}>
                <li>Lie down and rest for 5-10 minutes</li>
                <li>Record your resting heart rate (and BP if available)</li>
                <li>Stand up and remain still</li>
                <li>Record HR at 1, 3, 5, 7, and 10 minutes</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={startSupine}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-sage)' }}
            >
              Start Test
            </button>
          </div>
        )}

        {/* Supine Phase */}
        {phase === 'supine' && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Lie down and rest...</p>
              <p className="text-3xl font-bold mt-1" style={{ color: 'var(--accent-sage)' }}>
                {formatTime(timer)}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {timer < 300 ? 'Rest for at least 5 minutes' : 'Ready! Record your resting vitals'}
              </p>
            </div>

            <div className="flex gap-2">
              <input type="number" inputMode="numeric" placeholder="HR (bpm)" value={currentInput.hr}
                onChange={e => setCurrentInput(p => ({ ...p, hr: e.target.value }))}
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: 44 }} />
              <input type="number" inputMode="numeric" placeholder="Sys" value={currentInput.sys}
                onChange={e => setCurrentInput(p => ({ ...p, sys: e.target.value }))}
                className="w-16 rounded-lg px-2 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: 44 }} />
              <input type="number" inputMode="numeric" placeholder="Dia" value={currentInput.dia}
                onChange={e => setCurrentInput(p => ({ ...p, dia: e.target.value }))}
                className="w-16 rounded-lg px-2 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: 44 }} />
            </div>

            <button
              type="button" onClick={recordSupine}
              disabled={!currentInput.hr}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-sage)', opacity: currentInput.hr ? 1 : 0.5 }}
            >
              Record Resting Vitals & Stand Up
            </button>
          </div>
        )}

        {/* Standing Phase */}
        {phase === 'standing' && (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: '#E65100' }}>
                Standing -- remain still
              </p>
              <p className="text-3xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                {formatTime(timer)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--accent-sage)' }}>
                {!timerRunning
                  ? 'Tap Start when you stand up'
                  : `Record at ${STANDING_CHECKPOINTS[standingMinute]} minute mark`}
              </p>
            </div>

            {/* Previously recorded */}
            {readings.length > 0 && (
              <div className="space-y-1">
                {readings.map((r, i) => (
                  <div key={i} className="flex justify-between text-xs px-2 py-1 rounded"
                    style={{ background: 'var(--bg-elevated)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {r.position === 'supine' ? 'Resting' : `Standing ${r.minute}min`}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      HR: {r.heartRate} {r.systolic ? `BP: ${r.systolic}/${r.diastolic}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!timerRunning ? (
              <button type="button" onClick={startStanding}
                className="w-full rounded-lg py-3 text-sm font-semibold text-white"
                style={{ background: '#E65100' }}>
                Stand Up Now -- Start Timer
              </button>
            ) : (
              <>
                <div className="flex gap-2">
                  <input type="number" inputMode="numeric" placeholder="HR" value={currentInput.hr}
                    onChange={e => setCurrentInput(p => ({ ...p, hr: e.target.value }))}
                    className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: 44 }} />
                  <input type="number" inputMode="numeric" placeholder="Sys" value={currentInput.sys}
                    onChange={e => setCurrentInput(p => ({ ...p, sys: e.target.value }))}
                    className="w-16 rounded-lg px-2 py-2 text-sm outline-none"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: 44 }} />
                  <input type="number" inputMode="numeric" placeholder="Dia" value={currentInput.dia}
                    onChange={e => setCurrentInput(p => ({ ...p, dia: e.target.value }))}
                    className="w-16 rounded-lg px-2 py-2 text-sm outline-none"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', minHeight: 44 }} />
                </div>
                <button type="button" onClick={recordStanding}
                  disabled={!currentInput.hr}
                  className="w-full rounded-lg py-3 text-sm font-semibold text-white"
                  style={{ background: 'var(--accent-sage)', opacity: currentInput.hr ? 1 : 0.5 }}>
                  Record ({STANDING_CHECKPOINTS[standingMinute]} min checkpoint)
                </button>
              </>
            )}
          </div>
        )}

        {/* Results */}
        {phase === 'results' && (
          <div className="space-y-3">
            {/* HR delta banner */}
            <div
              className="rounded-lg p-4 text-center"
              style={{
                background: maxDelta >= 30 ? '#FFEBEE' : 'var(--accent-sage-muted)',
                border: `1px solid ${maxDelta >= 30 ? '#EF9A9A' : 'var(--accent-sage)'}`,
              }}
            >
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Maximum HR Change</p>
              <p className="text-3xl font-bold" style={{ color: getHrColor(maxDelta) }}>
                +{maxDelta} bpm
              </p>
              <p className="text-xs font-semibold" style={{ color: getHrColor(maxDelta) }}>
                {maxDelta >= 30
                  ? 'POTS Threshold Met (30+ bpm rise)'
                  : maxDelta >= 20
                  ? 'Elevated orthostatic response'
                  : 'Within normal range'}
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Resting: {supineHr} bpm, Peak standing: {maxStandingHr} bpm
              </p>
            </div>

            {/* All readings */}
            <div className="space-y-1">
              {readings.map((r, i) => {
                const delta = r.position === 'standing' ? (r.heartRate ?? 0) - supineHr : 0
                return (
                  <div key={i} className="flex justify-between text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-elevated)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {r.position === 'supine' ? 'Resting' : `Standing ${r.minute}min`}
                    </span>
                    <div className="flex items-center gap-3">
                      <span style={{ color: 'var(--text-primary)' }}>
                        HR: {r.heartRate}
                      </span>
                      {r.position === 'standing' && (
                        <span style={{ color: getHrColor(delta), fontWeight: 600 }}>
                          +{delta}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button type="button" onClick={saveResults}
              disabled={saving}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-sage)', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving...' : 'Save Test Results'}
            </button>

            <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
              Share these results with your cardiologist. This is not a clinical diagnostic tool.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
