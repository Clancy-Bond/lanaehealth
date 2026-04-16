'use client'

import { useState, useCallback, useEffect } from 'react'

interface ModuleDef {
  id: string
  name: string
  description: string
  icon: string
  supportsNative: boolean
  supportsImport: boolean
  importSources: string[]
}

interface ModuleCustomizerProps {
  initialModules?: string[]
}

export default function ModuleCustomizer({ initialModules }: ModuleCustomizerProps) {
  const [modules, setModules] = useState<ModuleDef[]>([])
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initialModules ?? []))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/preferences')
      .then(r => r.json())
      .then(data => {
        setModules(data.moduleDefinitions ?? [])
        setEnabled(new Set(data.enabledModules ?? []))
      })
      .catch(() => {})
  }, [])

  const handleToggle = useCallback(async (moduleId: string) => {
    const wasEnabled = enabled.has(moduleId)
    const next = new Set(enabled)
    if (wasEnabled) {
      next.delete(moduleId)
    } else {
      next.add(moduleId)
    }
    setEnabled(next)

    setSaving(true)
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledModules: Array.from(next) }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch {
      // Revert on failure
      setEnabled(enabled)
    } finally {
      setSaving(false)
    }
  }, [enabled])

  if (modules.length === 0) {
    return (
      <div className="py-4 text-center">
        <div className="h-5 w-5 mx-auto animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: 'var(--accent-sage)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Toggle features on/off. Disabled modules are hidden from navigation and logging.
        </p>
        {saved && (
          <span className="text-xs font-medium" style={{ color: 'var(--accent-sage)' }}>
            Saved
          </span>
        )}
      </div>

      {modules.map(mod => {
        const isEnabled = enabled.has(mod.id)
        return (
          <button
            key={mod.id}
            type="button"
            onClick={() => handleToggle(mod.id)}
            disabled={saving}
            className="w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-all"
            style={{
              background: isEnabled ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
              border: isEnabled ? '1.5px solid var(--accent-sage)' : '1.5px solid transparent',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <span className="text-lg shrink-0">{mod.icon}</span>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: isEnabled ? 'var(--accent-sage)' : 'var(--text-primary)' }}
              >
                {mod.name}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {mod.description}
              </p>
            </div>
            <div
              className="shrink-0 flex items-center justify-center rounded-full transition-all"
              style={{
                width: 22,
                height: 22,
                background: isEnabled ? 'var(--accent-sage)' : 'var(--border-light)',
              }}
            >
              {isEnabled && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </button>
        )
      })}

      {/* Import-only note */}
      <p className="text-[10px] pt-2 text-center" style={{ color: 'var(--text-muted)' }}>
        Disabled modules can still receive imported data. Toggle on to add native tracking.
      </p>
    </div>
  )
}
