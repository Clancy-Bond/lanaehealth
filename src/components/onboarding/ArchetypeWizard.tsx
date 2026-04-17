'use client'

import { useState, useCallback, useEffect } from 'react'
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

const STEP_ORDER: Step[] = ['archetype', 'conditions', 'apps', 'modules']

export default function ArchetypeWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [archetype, setArchetype] = useState<UserArchetype | null>(null)
  const [conditions, setConditions] = useState<string[]>([])
  const [apps, setApps] = useState<string[]>([])
  const [modules, setModules] = useState<FeatureModule[]>([])
  const [saving, setSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState(0)
  const [saveComplete, setSaveComplete] = useState(false)

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
    setSaveProgress(15)
    // Fill the button left-to-right while the request is in flight
    const tick = setInterval(() => {
      setSaveProgress(prev => (prev < 85 ? prev + 5 : prev))
    }, 60)
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
      clearInterval(tick)
      setSaveProgress(100)
      setSaveComplete(true)
      // Let the fill-on-save animation finish before route transition
      setTimeout(() => router.push('/'), 400)
    } catch {
      clearInterval(tick)
      setSaving(false)
      setSaveProgress(0)
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

  // Slow-pulse keyframes injected once so the active progress dot breathes
  useEffect(() => {
    const id = 'onboarding-pulse-keyframes'
    if (typeof document === 'undefined' || document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes onboarding-dot-pulse {
        0%, 100% { transform: scale(1); opacity: 0.9; }
        50%      { transform: scale(1.35); opacity: 1; }
      }
      @keyframes onboarding-check-pop {
        0%   { transform: scale(0);   opacity: 0; }
        60%  { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(1);   opacity: 1; }
      }
    `
    document.head.appendChild(style)
  }, [])

  const currentStepIndex = STEP_ORDER.indexOf(step as Step)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div
        className={`flex-1 flex flex-col items-center justify-center w-full mx-auto ${
          step === 'welcome' ? 'route-desktop-wide' : ''
        }`}
        style={{
          paddingLeft: 'var(--space-6)',
          paddingRight: 'var(--space-6)',
          paddingTop: 'var(--space-8)',
          paddingBottom: 'var(--space-8)',
          maxWidth: step === 'welcome' ? undefined : '28rem',
        }}
      >

        {/* Welcome */}
        {step === 'welcome' && (
          <div
            className="w-full text-center"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 520 }}
          >
            <div className="text-5xl" aria-hidden="true">&#x1F33F;</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                Takes about a minute
              </p>
              <h1 className="page-title" style={{ margin: 0 }}>
                Welcome to LanaeHealth
              </h1>
            </div>
            <p
              style={{
                fontSize: 'var(--text-base)',
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
                margin: 0,
                maxWidth: 420,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Your health, your data, your way. We adapt to how you want to track: everything in one place, or just the parts that help.
            </p>
            <button
              type="button"
              onClick={() => setStep('archetype')}
              className="press-feedback"
              style={{
                width: '100%',
                maxWidth: 360,
                margin: '0 auto',
                borderRadius: 'var(--radius-md)',
                paddingTop: 'var(--space-4)',
                paddingBottom: 'var(--space-4)',
                background: 'var(--accent-sage)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard), background 150ms var(--ease-standard)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }}
            >
              Get started
            </button>
          </div>
        )}

        {/* Archetype Selection */}
        {step === 'archetype' && (
          <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                Step <span className="tabular">1</span> of <span className="tabular">4</span>
              </p>
              <h2 className="page-title" style={{ margin: 'var(--space-1) 0 0' }}>
                What describes you best?
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ARCHETYPES.map(a => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => handleArchetypeSelect(a.value)}
                  className="press-feedback"
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4)',
                    textAlign: 'left',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard), border-color 150ms var(--ease-standard)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                    e.currentTarget.style.borderColor = 'var(--accent-sage-muted)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                    e.currentTarget.style.borderColor = 'var(--border-light)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    <span className="text-2xl" aria-hidden="true">{a.icon}</span>
                    <div>
                      <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{a.title}</p>
                      <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{a.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conditions */}
        {step === 'conditions' && (
          <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                Step <span className="tabular">2</span> of <span className="tabular">4</span>
              </p>
              <h2 className="page-title" style={{ margin: 'var(--space-1) 0 0' }}>
                What conditions do you manage?
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 'var(--space-2) 0 0', lineHeight: 1.45 }}>
                Select all that apply. This helps us show the right tracking features.
              </p>
            </div>
            <div className="grid grid-cols-2" style={{ gap: 'var(--space-2)' }}>
              {CONDITION_PRESETS.map(p => {
                const isActive = conditions.includes(p.condition)
                return (
                  <button
                    key={p.condition}
                    type="button"
                    onClick={() => toggleCondition(p.condition)}
                    className="press-feedback"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                      textAlign: 'left',
                      background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-card)',
                      border: isActive ? '1.5px solid var(--accent-sage)' : '1px solid var(--border-light)',
                      boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                      transition: 'transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard), border-color 150ms var(--ease-standard), background 150ms var(--ease-standard)',
                    }}
                    onMouseEnter={e => {
                      if (isActive) return
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                    }}
                    onMouseLeave={e => {
                      if (isActive) return
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                    }}
                  >
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: isActive ? 'var(--accent-sage)' : 'var(--text-primary)', margin: 0 }}>
                      {p.condition}
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {p.description}
                    </p>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={handleConditionsNext}
              className="press-feedback"
              style={{
                width: '100%',
                borderRadius: 'var(--radius-md)',
                paddingTop: 'var(--space-3)',
                paddingBottom: 'var(--space-3)',
                background: 'var(--accent-sage)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }}
            >
              {conditions.length > 0 ? (
                <>
                  Continue with <span className="tabular">{conditions.length}</span> condition{conditions.length > 1 ? 's' : ''}
                </>
              ) : 'Skip for now'}
            </button>
          </div>
        )}

        {/* Apps */}
        {step === 'apps' && (
          <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                Step <span className="tabular">{archetype === 'condition_manager' ? 3 : 2}</span> of <span className="tabular">4</span>
              </p>
              <h2 className="page-title" style={{ margin: 'var(--space-1) 0 0' }}>
                Which apps do you use?
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 'var(--space-2) 0 0', lineHeight: 1.45 }}>
                We will show you how to import your data from these.
              </p>
            </div>
            <div className="flex flex-wrap justify-center" style={{ gap: 'var(--space-2)' }}>
              {KNOWN_APPS.map(app => {
                const isActive = apps.includes(app.name)
                return (
                  <button
                    key={app.name}
                    type="button"
                    onClick={() => toggleApp(app.name)}
                    className="press-feedback"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      borderRadius: 'var(--radius-full)',
                      paddingLeft: 'var(--space-3)',
                      paddingRight: 'var(--space-3)',
                      paddingTop: 'var(--space-2)',
                      paddingBottom: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 500,
                      background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-card)',
                      color: isActive ? 'var(--accent-sage)' : 'var(--text-secondary)',
                      border: isActive ? '1.5px solid var(--accent-sage)' : '1px solid var(--border-light)',
                      boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                      transition: 'transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard), border-color 150ms var(--ease-standard), background 150ms var(--ease-standard)',
                    }}
                    onMouseEnter={e => {
                      if (isActive) return
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                    }}
                    onMouseLeave={e => {
                      if (isActive) return
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                    }}
                  >
                    <span aria-hidden="true">{app.icon}</span>
                    {app.name}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={handleAppsNext}
              className="press-feedback"
              style={{
                width: '100%',
                borderRadius: 'var(--radius-md)',
                paddingTop: 'var(--space-3)',
                paddingBottom: 'var(--space-3)',
                background: 'var(--accent-sage)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }}
            >
              {apps.length > 0 ? (
                <>
                  Continue with <span className="tabular">{apps.length}</span> app{apps.length > 1 ? 's' : ''}
                </>
              ) : 'Skip for now'}
            </button>
          </div>
        )}

        {/* Modules */}
        {step === 'modules' && (
          <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                Step <span className="tabular">4</span> of <span className="tabular">4</span>
              </p>
              <h2 className="page-title" style={{ margin: 'var(--space-1) 0 0' }}>
                Your tracking features
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 'var(--space-2) 0 0', lineHeight: 1.45 }}>
                We suggested these based on your choices. Toggle any on or off. You can always change later.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {MODULE_DEFINITIONS.map(mod => {
                const isEnabled = modules.includes(mod.id)
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className="press-feedback"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--space-3)',
                      textAlign: 'left',
                      background: isEnabled ? 'var(--accent-sage-muted)' : 'var(--bg-card)',
                      border: isEnabled ? '1.5px solid var(--accent-sage)' : '1px solid var(--border-light)',
                      boxShadow: isEnabled ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                      transition: 'transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard), border-color 150ms var(--ease-standard), background 150ms var(--ease-standard)',
                    }}
                    onMouseEnter={e => {
                      if (isEnabled) return
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                    }}
                    onMouseLeave={e => {
                      if (isEnabled) return
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                    }}
                  >
                    <span className="text-lg" aria-hidden="true">{mod.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: isEnabled ? 'var(--accent-sage)' : 'var(--text-primary)', margin: 0 }}>
                        {mod.name}
                      </p>
                    </div>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isEnabled ? 'var(--accent-sage)' : 'var(--border-light)',
                        transition: 'background 150ms var(--ease-standard)',
                      }}
                    >
                      {isEnabled && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
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
              className="press-feedback"
              style={{
                width: '100%',
                borderRadius: 'var(--radius-md)',
                paddingTop: 'var(--space-3)',
                paddingBottom: 'var(--space-3)',
                background: 'var(--accent-sage)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Ready */}
        {step === 'ready' && (
          <div className="w-full text-center" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="text-5xl" aria-hidden="true">&#x2728;</div>
            <h2 className="page-title" style={{ margin: 0 }}>
              You are all set
            </h2>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              <span className="tabular">{modules.length}</span> tracking tools on your side
              {conditions.length > 0 ? ` for ${conditions.join(', ')}` : ''}.
              {apps.length > 0 ? ` We will help you import from ${apps.join(', ')}.` : ''}
            </p>
            <button
              type="button"
              onClick={handleComplete}
              disabled={saving}
              aria-label={saveComplete ? 'Saved' : saving ? 'Setting up' : 'Start tracking'}
              className="press-feedback"
              style={{
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                maxWidth: 360,
                margin: '0 auto',
                borderRadius: 'var(--radius-md)',
                paddingTop: 'var(--space-4)',
                paddingBottom: 'var(--space-4)',
                background: 'var(--accent-sage)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)',
                cursor: saving ? 'default' : 'pointer',
                opacity: saving && !saveComplete ? 0.92 : 1,
                transition: 'transform 150ms var(--ease-standard), box-shadow 150ms var(--ease-standard), opacity 150ms var(--ease-standard)',
              }}
              onMouseEnter={e => {
                if (saving) return
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                if (saving) return
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }}
            >
              {/* Fill-on-save layer (Strava pattern) */}
              {saving && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--accent-sage-light)',
                    transform: `scaleX(${saveProgress / 100})`,
                    transformOrigin: 'left',
                    transition: 'transform 300ms var(--ease-standard)',
                    pointerEvents: 'none',
                  }}
                />
              )}
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {saveComplete ? (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      fill="none"
                      aria-hidden="true"
                      style={{ animation: 'onboarding-check-pop 180ms var(--ease-spring)' }}
                    >
                      <path d="M4 9L7.5 12.5L14 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Saved
                  </>
                ) : saving ? (
                  'Setting up'
                ) : (
                  'Start tracking'
                )}
              </span>
            </button>
          </div>
        )}

        {/* Progress dots: slow pulse active, static siblings */}
        {step !== 'welcome' && step !== 'ready' && (
          <div
            aria-label={`Step ${currentStepIndex + 1} of ${STEP_ORDER.length}`}
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEP_ORDER.length}
            aria-valuenow={currentStepIndex + 1}
            style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-8)' }}
          >
            {STEP_ORDER.map(s => {
              const isActive = s === step
              const isComplete = STEP_ORDER.indexOf(s) < currentStepIndex
              return (
                <span
                  key={s}
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 'var(--radius-full)',
                    background: isActive || isComplete ? 'var(--accent-sage)' : 'var(--border-light)',
                    opacity: isComplete ? 0.45 : 1,
                    animation: isActive ? 'onboarding-dot-pulse 1.6s var(--ease-standard) infinite' : undefined,
                    transition: 'background 150ms var(--ease-standard), opacity 150ms var(--ease-standard)',
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
