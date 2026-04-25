import { Card, MetricTile } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { DoctorPageData } from '@/app/doctor/page'
import type { SpecialistView } from '@/lib/doctor/specialist-config'
import { bucketVisible } from '@/lib/doctor/specialist-config'

interface ExecutiveSummaryCardProps {
  data: DoctorPageData
  view: SpecialistView
}

type VitalStatus = 'normal' | 'borderline' | 'abnormal'

function vitalColor(status: VitalStatus): string {
  if (status === 'normal') return 'var(--v2-accent-success)'
  if (status === 'borderline') return 'var(--v2-accent-highlight)'
  return 'var(--v2-accent-danger)'
}

function classifyHRV(val: number): VitalStatus {
  if (val >= 30 && val <= 100) return 'normal'
  if (val >= 20 || val <= 120) return 'borderline'
  return 'abnormal'
}

function classifyRestingHR(val: number): VitalStatus {
  if (val >= 50 && val <= 75) return 'normal'
  if (val >= 45 && val <= 85) return 'borderline'
  return 'abnormal'
}

function classifySleep(val: number): VitalStatus {
  if (val >= 70) return 'normal'
  if (val >= 55) return 'borderline'
  return 'abnormal'
}

function classifyReadiness(val: number): VitalStatus {
  if (val >= 70) return 'normal'
  if (val >= 55) return 'borderline'
  return 'abnormal'
}

function countAbnormalVitals(v: DoctorPageData['latestVitals']): number {
  let n = 0
  if (v.hrvAvg != null && classifyHRV(v.hrvAvg) === 'abnormal') n++
  if (v.restingHr != null && classifyRestingHR(v.restingHr) === 'abnormal') n++
  if (v.sleepScore != null && classifySleep(v.sleepScore) === 'abnormal') n++
  if (v.readinessScore != null && classifyReadiness(v.readinessScore) === 'abnormal') n++
  return n
}

/*
 * ExecutiveSummaryCard
 *
 * The 30-second read: who the patient is, the headline vitals, and how
 * many abnormals the doctor is about to see. Vitals tiles use the same
 * MetricTile primitive as the home dashboard so the visual language is
 * consistent across the app.
 */
export default function ExecutiveSummaryCard({ data, view }: ExecutiveSummaryCardProps) {
  if (!bucketVisible(view, 'vitals') && !bucketVisible(view, 'activeProblems')) return null

  const { patient, latestVitals, abnormalLabs, activeProblems } = data
  const abnormalVitalCount = countAbnormalVitals(latestVitals)
  const summaryParts: string[] = []
  if (activeProblems.length > 0) summaryParts.push(`${activeProblems.length} active problem${activeProblems.length === 1 ? '' : 's'}`)
  if (abnormalLabs.length > 0) summaryParts.push(`${abnormalLabs.length} abnormal lab${abnormalLabs.length === 1 ? '' : 's'}`)
  if (abnormalVitalCount > 0) summaryParts.push(`${abnormalVitalCount} vital${abnormalVitalCount === 1 ? '' : 's'} out of range`)
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : 'All key vitals in range today'

  return (
    <Card padding="md">
      <DoctorPanelHeader
        title={`${patient.name}, ${patient.age}${patient.sex.charAt(0).toLowerCase()}`}
        summary={summary}
      />
      <div style={{ display: 'flex', gap: 'var(--v2-space-2)', flexWrap: 'wrap' }}>
        {latestVitals.hrvAvg != null && (
          <MetricTile value={Math.round(latestVitals.hrvAvg)} label="HRV" color={vitalColor(classifyHRV(latestVitals.hrvAvg))} />
        )}
        {latestVitals.restingHr != null && (
          <MetricTile value={Math.round(latestVitals.restingHr)} label="RHR" color={vitalColor(classifyRestingHR(latestVitals.restingHr))} />
        )}
        {latestVitals.sleepScore != null && (
          <MetricTile value={Math.round(latestVitals.sleepScore)} label="Sleep" color={vitalColor(classifySleep(latestVitals.sleepScore))} />
        )}
        {latestVitals.readinessScore != null && (
          <MetricTile
            value={Math.round(latestVitals.readinessScore)}
            label="Readiness"
            color={vitalColor(classifyReadiness(latestVitals.readinessScore))}
          />
        )}
        {latestVitals.spo2Avg != null && <MetricTile value={latestVitals.spo2Avg.toFixed(1) + '%'} label="SpO2" />}
      </div>
      {data.confirmedDiagnoses.length > 0 && (
        <div style={{ marginTop: 'var(--v2-space-3)', fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          <span style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)' }}>
            Confirmed:
          </span>{' '}
          {data.confirmedDiagnoses.join(', ')}
        </div>
      )}
      {data.suspectedConditions.length > 0 && (
        <div style={{ marginTop: 'var(--v2-space-2)', fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          <span style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)' }}>
            Suspected:
          </span>{' '}
          {data.suspectedConditions.join(', ')}
        </div>
      )}
    </Card>
  )
}
