'use client'

/**
 * Medication Onset/Peak/Duration Timeline
 *
 * Theraview-inspired visualization showing when medications
 * kick in, reach peak effect, and wear off.
 *
 * Helps patients understand their medication timing windows.
 */

interface MedCurve {
  name: string
  dose: string | null
  takenAt: string               // "08:00" format
  onsetMinutes: number          // Time to start working
  peakMinutes: number           // Time to peak effect
  durationMinutes: number       // Total duration of effect
  color: string
}

interface MedTimelineProps {
  medications: MedCurve[]
  currentHour: number           // 0-23, for "now" marker
}

// Common medication timing profiles (approximate)
export const MED_PROFILES: Record<string, { onset: number; peak: number; duration: number }> = {
  'ibuprofen': { onset: 30, peak: 120, duration: 360 },
  'acetaminophen': { onset: 30, peak: 60, duration: 240 },
  'tylenol': { onset: 30, peak: 60, duration: 240 },
  'iron supplement': { onset: 60, peak: 180, duration: 480 },
  'vitamin d': { onset: 120, peak: 720, duration: 1440 },
  'melatonin': { onset: 30, peak: 60, duration: 300 },
  'prednisone': { onset: 60, peak: 120, duration: 720 },
  'gabapentin': { onset: 60, peak: 180, duration: 480 },
  'adderall': { onset: 30, peak: 120, duration: 360 },
  'adderall xr': { onset: 60, peak: 240, duration: 720 },
  'vyvanse': { onset: 60, peak: 240, duration: 780 },
  'concerta': { onset: 30, peak: 480, duration: 720 },
}

export default function MedTimeline({ medications, currentHour }: MedTimelineProps) {
  if (medications.length === 0) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Medication Timeline
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Log medication doses to see when they are active in your system.
        </p>
      </div>
    )
  }

  const chartWidth = 320
  const rowHeight = 40
  const chartHeight = medications.length * rowHeight + 30
  const hourWidth = chartWidth / 24

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        Medication Timeline
      </h3>

      <div className="overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ display: 'block' }}
        >
          {/* Hour grid lines */}
          {[0, 6, 12, 18, 24].map(hour => (
            <g key={hour}>
              <line
                x1={hour * hourWidth}
                x2={hour * hourWidth}
                y1={0}
                y2={chartHeight - 20}
                stroke="var(--border-light)"
                strokeWidth="0.5"
              />
              <text
                x={hour * hourWidth}
                y={chartHeight - 5}
                fontSize="9"
                fill="var(--text-muted)"
                textAnchor="middle"
              >
                {hour === 0 ? '12a' : hour === 6 ? '6a' : hour === 12 ? '12p' : hour === 18 ? '6p' : '12a'}
              </text>
            </g>
          ))}

          {/* "Now" marker */}
          <line
            x1={currentHour * hourWidth}
            x2={currentHour * hourWidth}
            y1={0}
            y2={chartHeight - 20}
            stroke="#C62828"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          <text
            x={currentHour * hourWidth}
            y={chartHeight - 14}
            fontSize="8"
            fill="#C62828"
            textAnchor="middle"
            fontWeight="600"
          >
            now
          </text>

          {/* Medication curves */}
          {medications.map((med, i) => {
            const y = i * rowHeight + 5
            const [hours, mins] = med.takenAt.split(':').map(Number)
            const takenHour = hours + mins / 60

            const onsetStart = takenHour + med.onsetMinutes / 60
            const peakTime = takenHour + med.peakMinutes / 60
            const endTime = takenHour + med.durationMinutes / 60

            const xTaken = takenHour * hourWidth
            const xOnset = Math.min(onsetStart * hourWidth, chartWidth)
            const xPeak = Math.min(peakTime * hourWidth, chartWidth)
            const xEnd = Math.min(endTime * hourWidth, chartWidth)

            const barY = y + 12
            const barH = 16

            return (
              <g key={med.name}>
                {/* Med name label */}
                <text x={2} y={y + 10} fontSize="9" fill="var(--text-primary)" fontWeight="500">
                  {med.name} {med.dose ?? ''}
                </text>

                {/* Onset ramp (transparent to color) */}
                <rect x={xTaken} y={barY} width={xOnset - xTaken} height={barH} rx={3}
                  fill={med.color} opacity="0.15" />

                {/* Active window (onset to end) */}
                <rect x={xOnset} y={barY} width={xEnd - xOnset} height={barH} rx={3}
                  fill={med.color} opacity="0.3" />

                {/* Peak window (brighter) */}
                <rect
                  x={xOnset + (xPeak - xOnset) * 0.3}
                  y={barY + 2}
                  width={(xPeak - xOnset) * 0.7 + (xEnd - xPeak) * 0.3}
                  height={barH - 4}
                  rx={2}
                  fill={med.color}
                  opacity="0.6"
                />

                {/* Peak marker */}
                <circle cx={xPeak} cy={barY + barH / 2} r={3} fill={med.color} />

                {/* Taken dot */}
                <circle cx={xTaken} cy={barY + barH / 2} r={2} fill="var(--text-muted)" />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-2">
        {medications.map(med => (
          <div key={med.name} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: med.color }} />
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {med.name}: peaks at {Math.round(med.peakMinutes / 60)}h, lasts {Math.round(med.durationMinutes / 60)}h
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
