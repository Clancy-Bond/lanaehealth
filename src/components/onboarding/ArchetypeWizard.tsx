'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { UserArchetype, FeatureModule } from '@/lib/api/user-preferences'
import { CONDITION_PRESETS, MODULE_DEFINITIONS, getDefaultModulesForArchetype } from '@/lib/api/user-preferences'

type Step = 'welcome' | 'archetype' | 'conditions' | 'apps' | 'modules' | 'ready'

const ARCHETYPES: { value: UserArchetype; title: string; description: string; icon: string }[] = [
  {
    value: 'aggregator',
    title: 'Data Hub',
    description: 'I love my existing apps. I just want all my health data in one place for analysis.',
    icon: '\u{1F4E5}',
  },
  {
    value: 'power_tracker',
    title: 'All-in-One',
    description: 'I want one app for everything. Replace all my other apps.',
    icon: '\u{1F4AA}',
  },
  {
    value: 'condition_manager',
    title: 'Condition Focus',
    description: 'I have a specific condition and need to track what matters for it.',
    icon: '\u{1FA7B}',
  },
  {
    value: 'health_curious',
    title: 'Getting Started',
    description: 'I just want to understand my health better. Keep it simple.',
    icon: '\u{1F331}',
  },
]

const KNOWN_APPS = [
  { name: 'Oura Ring', icon: '\u{1F48D}', category: 'wearable' },
  { name: 'Apple Watch', icon: '\u{231A}', category: 'wearable' },
  { name: 'WHOOP', icon: '\u{1F4AA}', category: 'wearable' },
  { name: 'Garmin', icon: '\u{231A}', category: 'wearable' },
  { name: 'Fitbit', icon: '\u{231A}', category: 'wearable' },
  { name: 'Dexcom', icon: '\u{1FA78}', category: 'cgm' },
  { name: 'MyFitnessPal', icon: '\u{1F34E}', category: 'nutrition' },
  { name: 'Cronometer', icon: '\u{1F34E}', category: 'nutrition' },
  { name: 'MyNetDiary', icon: '\u{1F34E}', category: 'nutrition' },
  { name: 'Natural Cycles', icon: '\u{1F319}', category: 'cycle' },
  { name: 'Flo', icon: '\u{1F319}', category: 'cycle' },
  { name: 'Clue', icon: '\u{1F319}', category: 'cycle' },
  { name: 'Bearable', icon: '\u{1F4CA}', category: 'symptoms' },
  { name: 'Daylio', icon: '\u{1F60A}', category: 'mood' },
  { name: 'Strava', icon: '\u{1F3C3}', category: 'fitness' },
]

export default function ArchetypeWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [archetype, setArchetype] = useState<UserArchetype | null>(null)
  const [conditions, setConditions] = useState<string[]>([])
  const [apps, setApps] = useState<string[]>([])
  const [modules, setModules] = useState<FeatureModule[]>([])
  const [saving, setSaving] = useState(false)

  const handleArchetypeSelect = useCallback((value: UserArchetype) => {
    setArchetype(value)
    // Pre-populate modules based on archetype
    const defaults = getDefaultModulesForArchetype(value)
    setModules(defaults)
    setStep(value === 'condition_manager' ? 'conditions' : 'apps')
  }, [])

  const handleConditionsNext = useCallback(() => {
    // Merge condition preset modules with archetype defaults
    const conditionModules: FeatureModule[] = []
    for (const condition of conditions) {
      const preset = CONDITION_PRESETS.find(p => p.condition === condition)
      if (preset) conditionModules.push(...preset.enabledModules)
    }
    setModules(prev => [...new Set([...prev, ...conditionModules])])
    setStep('apps')
  }, [conditions])

  const handleAppsNext = useCallback(() => {
    setStep('modules')
  }, [])

  const handleModulesNext = useCallback(() => {
    setStep('ready')
  }, [])

  const handleComplete = useCallback(async () => {
    setSaving(true)
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userArchetype: archetype,
          enabledModules: modules,
          conditions,
          connectedApps: apps,
          onboardingCompletedAt: new Date().toISOString(),
        }),
      })
      router.push('/')
    } catch {
      setSaving(false)
    }
  }, [archetype, modules, conditions, apps, router])

  const toggleCondition = useCallback((c: string) => {
    setConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }, [])

  const toggleApp = useCallback((a: string) => {
    setApps(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }, [])

  const toggleModule = useCallback((m: FeatureModule) => {
    setModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">

        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="text-5xl">&#x1F33F;</div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Welcome to LanaeHealth
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Your health, your data, your way. We adapt to how you want to track --
              whether that is everything in one place, or just bringing your existing data together.
            </p>
            <button
              type="button"
              onClick={() => setStep('archetype')}
              className="w-full rounded-xl py-4 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-sage)' }}
            >
              Get Started
            </button>
          </div>
        )}

        {/* Archetype Selection */}
        {step === 'archetype' && (
          <div className="w-full space-y-4">
            <h2 className="text-xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
              What describes you best?
            </h2>
            <div className="space-y-3">
              {ARCHETYPES.map(a => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => handleArchetypeSelect(a.value)}
                  className="w-full rounded-xl p-4 text-left transition-all"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{a.icon}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conditions */}
        {step === 'conditions' && (
          <div className="w-full space-y-4">
            <h2 className="text-xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
              What conditions do you manage?
            </h2>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Select all that apply. This helps us show the right tracking features.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CONDITION_PRESETS.map(p => {
                const isActive = conditions.includes(p.condition)
                return (
                  <button
                    key={p.condition}
                    type="button"
                    onClick={() => toggleCondition(p.condition)}
                    className="rounded-xl p-3 text-left transition-all"
                    style={{
                      background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-card)',
                      border: isActive ? '1.5px solid var(--accent-sage)' : '1px solid var(--border-light)',
                    }}
                  >
                    <p className="text-sm font-semibold" style={{ color: isActive ? 'var(--accent-sage)' : 'var(--text-primary)' }}>
                      {p.condition}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {p.description}
                    </p>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={handleConditionsNext}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-sage)' }}
            >
              {conditions.length > 0 ? `Continue with ${conditions.length} condition${conditions.length > 1 ? 's' : ''}` : 'Skip'}
            </button>
          </div>
        )}

        {/* Apps */}
        {step === 'apps' && (
          <div className="w-full space-y-4">
            <h2 className="text-xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
              Which apps do you use?
            </h2>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              We will show you how to import your data from these.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {KNOWN_APPS.map(app => {
                const isActive = apps.includes(app.name)
                return (
                  <button
                    key={app.name}
                    type="button"
                    onClick={() => toggleApp(app.name)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-all"
                    style={{
                      background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-card)',
                      color: isActive ? 'var(--accent-sage)' : 'var(--text-secondary)',
                      border: isActive ? '1.5px solid var(--accent-sage)' : '1px solid var(--border-light)',
                    }}
                  >
                    <span>{app.icon}</span>
                    {app.name}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={handleAppsNext}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-sage)' }}
            >
              {apps.length > 0 ? `Continue with ${apps.length} app${apps.length > 1 ? 's' : ''}` : 'Skip'}
            </button>
          </div>
        )}

        {/* Modules */}
        {step === 'modules' && (
          <div className="w-full space-y-4">
            <h2 className="text-xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
              Your tracking features
            </h2>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              We suggested these based on your choices. Toggle any on or off. You can always change later.
            </p>
            <div className="space-y-1.5">
              {MODULE_DEFINITIONS.map(mod => {
                const isEnabled = modules.includes(mod.id)
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className="w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-all"
                    style={{
                      background: isEnabled ? 'var(--accent-sage-muted)' : 'var(--bg-card)',
                      border: isEnabled ? '1.5px solid var(--accent-sage)' : '1px solid var(--border-light)',
                    }}
                  >
                    <span className="text-lg">{mod.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: isEnabled ? 'var(--accent-sage)' : 'var(--text-primary)' }}>
                        {mod.name}
                      </p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: isEnabled ? 'var(--accent-sage)' : 'var(--border-light)' }}
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
            </div>
            <button
              type="button"
              onClick={handleModulesNext}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-sage)' }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Ready */}
        {step === 'ready' && (
          <div className="text-center space-y-6">
            <div className="text-5xl">&#x2728;</div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              You are all set!
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {modules.length} features enabled
              {conditions.length > 0 ? ` for ${conditions.join(', ')}` : ''}.
              {apps.length > 0 ? ` We will help you import from ${apps.join(', ')}.` : ''}
            </p>
            <button
              type="button"
              onClick={handleComplete}
              disabled={saving}
              className="w-full rounded-xl py-4 text-sm font-semibold text-white"
              style={{ background: 'var(--accent-sage)', opacity: saving ? 0.5 : 1 }}
            >
              {saving ? 'Setting up...' : 'Start Tracking'}
            </button>
          </div>
        )}

        {/* Progress dots */}
        {step !== 'welcome' && step !== 'ready' && (
          <div className="flex gap-2 mt-8">
            {['archetype', 'conditions', 'apps', 'modules'].map(s => (
              <div
                key={s}
                className="w-2 h-2 rounded-full"
                style={{
                  background: s === step ? 'var(--accent-sage)' : 'var(--border-light)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
