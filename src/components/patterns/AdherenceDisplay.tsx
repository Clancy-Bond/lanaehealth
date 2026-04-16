'use client'

/**
 * Medication Adherence Display
 *
 * Shows PDC (Proportion of Days Covered) for scheduled medications
 * and PRN usage trends for as-needed medications.
 *
 * PDC >= 80% = adherent (green), < 80% = needs attention (amber/red)
 */

import { useState, useEffect } from 'react'

interface AdherenceReport {
  medication: string
  pdc: number
  isAdherent: boolean
  daysCovered: number
  totalDays: number
}

interface PrnReport {
  medication: string
  totalDoses: number
  avgDailyDoses: number
  weeklyTrend: number[]
  isEscalating: boolean
}

function getPdcColor(pdc: number): string {
  if (pdc >= 80) return 'var(--accent-sage)'
  if (pdc >= 60) return '#F57F17'
  return '#C62828'
}

export default function AdherenceDisplay() {
  const [scheduled, setScheduled] = useState<AdherenceReport[]>([])
  const [prn, setPrn] = useState<PrnReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAdherence() {
      // Fetch for known medications -- in production these come from health_profile
      const meds = [
        { name: 'Iron Supplement', isPrn: false },
        { name: 'Vitamin D', isPrn: false },
        { name: 'Tylenol', isPrn: true },
        { name: 'Ibuprofen', isPrn: true },
      ]

      const scheduledReports: AdherenceReport[] = []
      const prnReports: PrnReport[] = []

      for (const med of meds) {
        try {
          const params = new URLSearchParams({
            medication: med.name,
            prn: med.isPrn.toString(),
          })
          const res = await fetch(`/api/medications/adherence?${params}`)
          if (res.ok) {
            const data = await res.json()
            if (med.isPrn) {
              prnReports.push(data)
            } else {
              scheduledReports.push(data)
            }
          }
        } catch {
          // Skip failed fetches
        }
      }

      setScheduled(scheduledReports)
      setPrn(prnReports)
      setLoading(false)
    }

    fetchAdherence()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <div className="py-3 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
            style={{ borderTopColor: 'var(--accent-sage)' }} />
        </div>
      </div>
    )
  }

  if (scheduled.length === 0 && prn.length === 0) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Medication Adherence
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Log medication doses to track your adherence over time.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Scheduled Medication PDC */}
      {scheduled.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Medication Adherence (30 days)
          </h3>
          <div className="space-y-3">
            {scheduled.map(med => {
              const color = getPdcColor(med.pdc)
              return (
                <div key={med.medication}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {med.medication}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color }}>
                        {med.pdc}% PDC
                      </span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{
                          background: med.isAdherent ? 'var(--accent-sage-muted)' : '#FFF3E0',
                          color: med.isAdherent ? 'var(--accent-sage)' : '#E65100',
                        }}
                      >
                        {med.isAdherent ? 'Adherent' : 'Below 80%'}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${med.pdc}%`, background: color }}
                    />
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {med.daysCovered} of {med.totalDays} days covered
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* PRN Usage Trends */}
      {prn.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            As-Needed Medication Usage
          </h3>
          <div className="space-y-3">
            {prn.map(med => (
              <div key={med.medication}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    {med.medication}
                  </span>
                  {med.isEscalating && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ background: '#FFEBEE', color: '#C62828' }}
                    >
                      Increasing use
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {med.totalDoses} doses ({med.avgDailyDoses}/day avg)
                  </span>
                </div>
                {/* Weekly trend mini-chart */}
                <div className="flex items-end gap-1 mt-2 h-8">
                  {med.weeklyTrend.map((count, i) => {
                    const maxVal = Math.max(...med.weeklyTrend, 1)
                    const height = Math.max(2, (count / maxVal) * 32)
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full rounded-sm"
                          style={{
                            height,
                            background: i === med.weeklyTrend.length - 1
                              ? (med.isEscalating ? '#C62828' : 'var(--accent-sage)')
                              : 'var(--bg-elevated)',
                          }}
                        />
                        <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>
                          W{i + 1}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Increasing PRN use may indicate worsening symptoms. Discuss with your doctor.
          </p>
        </div>
      )}
    </div>
  )
}
