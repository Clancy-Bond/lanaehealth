'use client'

import { useState, useCallback } from 'react'
import { Check, ArrowRight } from 'lucide-react'

interface IntegrationInfo {
  id: string
  name: string
  description: string
  icon: string
  category: string
  status: 'disconnected' | 'connected' | 'syncing' | 'error' | 'expired'
  dataTypes: string[]
  lastSynced: string | null
}

const DATA_TYPE_LABELS: Record<string, string> = {
  sleep: 'Sleep',
  heart_rate: 'Heart Rate',
  hrv: 'HRV',
  spo2: 'SpO2',
  temperature: 'Temperature',
  stress: 'Stress',
  activity: 'Activity',
  steps: 'Steps',
  calories: 'Calories',
  workout: 'Workouts',
  recovery: 'Recovery',
  blood_glucose: 'Glucose',
  blood_pressure: 'Blood Pressure',
  weight: 'Weight',
  body_composition: 'Body Comp',
  medical_records: 'Medical Records',
  labs: 'Labs',
  medications: 'Medications',
  conditions: 'Conditions',
}

const STATUS_LABEL: Record<string, string> = {
  connected: 'Connected',
  syncing: 'Syncing',
  disconnected: 'Ready to connect',
  error: 'Something broke',
  expired: 'Reconnect needed',
}

// Static list of integrations (mirrors the registry)
const INTEGRATIONS: IntegrationInfo[] = [
  {
    id: 'dexcom',
    name: 'Dexcom CGM',
    description: 'Continuous glucose monitoring',
    icon: '\u{1FA78}',
    category: 'cgm',
    status: 'disconnected',
    dataTypes: ['blood_glucose'],
    lastSynced: null,
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    description: 'Recovery, strain, sleep',
    icon: '\u{1F4AA}',
    category: 'wearable',
    status: 'disconnected',
    dataTypes: ['sleep', 'heart_rate', 'hrv', 'recovery', 'workout'],
    lastSynced: null,
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    description: 'Fitness and health data',
    icon: '\u{231A}',
    category: 'wearable',
    status: 'disconnected',
    dataTypes: ['heart_rate', 'steps', 'sleep', 'stress', 'spo2'],
    lastSynced: null,
  },
  {
    id: 'withings',
    name: 'Withings',
    description: 'Weight, BP, body composition',
    icon: '\u{2696}',
    category: 'scale',
    status: 'disconnected',
    dataTypes: ['weight', 'body_composition', 'blood_pressure'],
    lastSynced: null,
  },
  {
    id: 'libre',
    name: 'FreeStyle Libre',
    description: 'Continuous glucose monitoring',
    icon: '\u{1FA78}',
    category: 'cgm',
    status: 'disconnected',
    dataTypes: ['blood_glucose'],
    lastSynced: null,
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Activity, sleep, heart rate',
    icon: '\u{1F4F1}',
    category: 'wearable',
    status: 'disconnected',
    dataTypes: ['activity', 'sleep', 'heart_rate', 'steps', 'spo2'],
    lastSynced: null,
  },
  {
    id: 'strava',
    name: 'Strava',
    description: 'Running, cycling, workouts',
    icon: '\u{1F3C3}',
    category: 'app',
    status: 'disconnected',
    dataTypes: ['workout', 'activity', 'heart_rate', 'calories'],
    lastSynced: null,
  },
  {
    id: 'fhir-portal',
    name: 'Patient Portal',
    description: 'Medical records via SMART on FHIR',
    icon: '\u{1F3E5}',
    category: 'medical',
    status: 'disconnected',
    dataTypes: ['medical_records', 'labs', 'medications', 'conditions'],
    lastSynced: null,
  },
]

function StatusBadge({ status }: { status: IntegrationInfo['status'] }) {
  const label = STATUS_LABEL[status] ?? STATUS_LABEL.disconnected

  if (status === 'connected') {
    return (
      <span
        className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'var(--accent-sage-muted)',
          color: 'var(--accent-sage)',
        }}
      >
        <Check size={10} strokeWidth={3} />
        {label}
      </span>
    )
  }

  if (status === 'syncing') {
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'var(--accent-sage-muted)',
          color: 'var(--accent-sage)',
        }}
      >
        {label}
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'var(--bg-elevated)',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
    )
  }

  if (status === 'expired') {
    return (
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'rgba(244, 196, 48, 0.14)',
          color: '#9A7B1A',
        }}
      >
        {label}
      </span>
    )
  }

  // disconnected
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
      }}
    >
      {label}
    </span>
  )
}

function IntegrationCard({ integration }: { integration: IntegrationInfo }) {
  const [status, setStatus] = useState(integration.status)
  const [syncing, setSyncing] = useState(false)

  const handleConnect = useCallback(() => {
    window.location.href = `/api/integrations/${integration.id}/authorize`
  }, [integration.id])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setStatus('syncing')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const res = await fetch(`/api/integrations/${integration.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: thirtyDaysAgo, endDate: today }),
      })

      if (res.ok) {
        setStatus('connected')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setSyncing(false)
    }
  }, [integration.id])

  const handleDisconnect = useCallback(async () => {
    if (!confirm(`Disconnect ${integration.name}? Your imported data will be kept.`)) return

    try {
      await fetch(`/api/integrations/${integration.id}/disconnect`, { method: 'POST' })
      setStatus('disconnected')
    } catch {
      // Silently fail
    }
  }, [integration.id, integration.name])

  const isConnected = status === 'connected'
  const isSyncing = status === 'syncing'

  return (
    <div
      className="press-feedback flex items-center gap-3 rounded-xl p-3 transition-all"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        position: 'relative',
      }}
    >
      {isSyncing && <div className="shimmer-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, borderRadius: '12px 12px 0 0' }} />}

      {/* Icon */}
      <div
        className="flex shrink-0 items-center justify-center rounded-lg text-xl"
        style={{ width: 44, height: 44, background: 'var(--bg-elevated)' }}
      >
        {integration.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {integration.name}
          </p>
          <StatusBadge status={status} />
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {integration.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {integration.dataTypes.slice(0, 4).map(dt => (
            <span
              key={dt}
              className="rounded px-1.5 py-0.5 text-[9px] font-medium"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              {DATA_TYPE_LABELS[dt] ?? dt}
            </span>
          ))}
          {integration.dataTypes.length > 4 && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-medium"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              +{integration.dataTypes.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* Action Button: neutral outline to respect Scarce Accent */}
      <div className="shrink-0">
        {status === 'disconnected' || status === 'expired' ? (
          <button
            type="button"
            onClick={handleConnect}
            className="press-feedback rounded-lg px-3 py-2 text-xs font-semibold transition-all"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            Connect
          </button>
        ) : isConnected ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="press-feedback rounded-lg px-2.5 py-2 text-xs font-medium transition-all"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                opacity: syncing ? 0.6 : 1,
              }}
            >
              {syncing ? 'Syncing' : 'Sync'}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              aria-label={`Disconnect ${integration.name}`}
              className="press-feedback rounded-lg text-xs font-medium transition-all flex items-center justify-center"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-muted)',
                width: 32,
                height: 32,
              }}
            >
              {'\u00D7'}
            </button>
          </div>
        ) : isSyncing ? (
          <span
            className="inline-flex items-center rounded-lg px-3 py-2 text-xs font-medium"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            Syncing
          </span>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            className="press-feedback inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-all"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
            }}
          >
            Reconnect
            <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function IntegrationHub() {
  return (
    <div className="space-y-2">
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        No devices connected yet. Start by connecting your Oura Ring above, or pick one below.
      </p>
      {INTEGRATIONS.map(integration => (
        <IntegrationCard key={integration.id} integration={integration} />
      ))}
      <p
        className="text-center text-[11px] pt-1"
        style={{ color: 'var(--text-muted)' }}
      >
        Oura Ring lives in the section above. More devices land here as they're added.
      </p>
    </div>
  )
}
