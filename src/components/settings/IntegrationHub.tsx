'use client'

import { useState, useCallback, useEffect } from 'react'

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

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  connected: { bg: '#E8F5E9', text: '#2E7D32', label: 'Connected' },
  syncing: { bg: '#E3F2FD', text: '#1565C0', label: 'Syncing...' },
  disconnected: { bg: 'var(--bg-elevated)', text: 'var(--text-muted)', label: 'Not Connected' },
  error: { bg: '#FFEBEE', text: '#C62828', label: 'Error' },
  expired: { bg: '#FFF3E0', text: '#E65100', label: 'Reconnect Needed' },
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

function IntegrationCard({ integration }: { integration: IntegrationInfo }) {
  const [status, setStatus] = useState(integration.status)
  const [syncing, setSyncing] = useState(false)
  const statusInfo = STATUS_COLORS[status] ?? STATUS_COLORS.disconnected

  const handleConnect = useCallback(() => {
    // Redirect to OAuth authorization endpoint
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

  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3 transition-all"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
      }}
    >
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
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: statusInfo.bg, color: statusInfo.text }}
          >
            {statusInfo.label}
          </span>
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

      {/* Action Button */}
      <div className="shrink-0">
        {status === 'disconnected' || status === 'expired' ? (
          <button
            type="button"
            onClick={handleConnect}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ background: 'var(--accent-sage)' }}
          >
            Connect
          </button>
        ) : status === 'connected' ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="rounded-lg px-2.5 py-2 text-xs font-medium"
              style={{
                background: 'var(--accent-sage-muted)',
                color: 'var(--accent-sage)',
                opacity: syncing ? 0.5 : 1,
              }}
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="rounded-lg px-2.5 py-2 text-xs font-medium"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              {'\u00D7'}
            </button>
          </div>
        ) : status === 'syncing' ? (
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
            style={{ borderTopColor: 'var(--accent-sage)' }}
          />
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            className="rounded-lg px-3 py-2 text-xs font-medium"
            style={{ background: '#FFEBEE', color: '#C62828' }}
          >
            Reconnect
          </button>
        )}
      </div>
    </div>
  )
}

export default function IntegrationHub() {
  return (
    <div className="space-y-2">
      {INTEGRATIONS.map(integration => (
        <IntegrationCard key={integration.id} integration={integration} />
      ))}
      <p
        className="text-center text-[11px] pt-1"
        style={{ color: 'var(--text-muted)' }}
      >
        Oura Ring is managed separately above. More integrations coming soon.
      </p>
    </div>
  )
}
