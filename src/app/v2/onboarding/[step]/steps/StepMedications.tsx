'use client'

/**
 * Step 4: Medications + Allergies
 *
 * Two stacked quick-add lists. Medications take name + optional dose
 * + optional schedule; allergies take substance + optional reaction.
 * Adding an entry pushes a new row into the local list; removing
 * pulls one.
 *
 * Submitting fires two POSTs: one for medications, one for allergies.
 * Either can no-op (empty list) which is fine because the AI's
 * permanent-core handles empty sections gracefully.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@/v2/components/primitives'
import OnboardingShell from '../../_components/OnboardingShell'
import { STEP_TITLES } from './config'
import type { StepNumber } from './config'
import type { MedicationDraft, AllergyDraft } from './load-draft'

interface StepMedicationsProps {
  step: StepNumber
  totalSteps: number
  initialMedications: MedicationDraft[]
  initialAllergies: AllergyDraft[]
}

export default function StepMedications({
  step,
  totalSteps,
  initialMedications,
  initialAllergies,
}: StepMedicationsProps) {
  const router = useRouter()
  const titleCfg = STEP_TITLES[step]

  const [meds, setMeds] = useState<MedicationDraft[]>(initialMedications)
  const [medName, setMedName] = useState('')
  const [medDose, setMedDose] = useState('')
  const [medSchedule, setMedSchedule] = useState('')

  const [allergies, setAllergies] = useState<AllergyDraft[]>(initialAllergies)
  const [allergySubstance, setAllergySubstance] = useState('')
  const [allergyReaction, setAllergyReaction] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addMed() {
    const name = medName.trim()
    if (!name) return
    setMeds((prev) => [
      ...prev,
      {
        name,
        ...(medDose.trim() ? { dose: medDose.trim() } : {}),
        ...(medSchedule.trim() ? { schedule: medSchedule.trim() } : {}),
      },
    ])
    setMedName('')
    setMedDose('')
    setMedSchedule('')
  }

  function removeMed(idx: number) {
    setMeds((prev) => prev.filter((_, i) => i !== idx))
  }

  function addAllergy() {
    const substance = allergySubstance.trim()
    if (!substance) return
    setAllergies((prev) => [
      ...prev,
      { substance, ...(allergyReaction.trim() ? { reaction: allergyReaction.trim() } : {}) },
    ])
    setAllergySubstance('')
    setAllergyReaction('')
  }

  function removeAllergy(idx: number) {
    setAllergies((prev) => prev.filter((_, i) => i !== idx))
  }

  async function onContinue() {
    setSaving(true)
    setError(null)
    try {
      const medRes = await fetch('/api/v2/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ step: 'medications', data: meds }),
      })
      if (!medRes.ok) {
        const body = (await medRes.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Save failed. Try again in a moment.')
        setSaving(false)
        return
      }
      const allergyRes = await fetch('/api/v2/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ step: 'allergies', data: allergies }),
      })
      if (!allergyRes.ok) {
        const body = (await allergyRes.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Save failed. Try again in a moment.')
        setSaving(false)
        return
      }
      router.push('/v2/onboarding/5')
    } catch {
      setError('Network hiccup. Check your connection and try again.')
      setSaving(false)
    }
  }

  return (
    <OnboardingShell
      step={step}
      totalSteps={totalSteps}
      title={titleCfg.title}
      subtitle={titleCfg.subtitle}
      primaryAction={
        <Button variant="primary" size="lg" fullWidth onClick={onContinue} disabled={saving}>
          {saving ? 'Saving' + '…' : 'Continue'}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <Card>
          <SectionLabel>Medications</SectionLabel>
          {meds.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--v2-space-3)' }}>
              {meds.map((m, idx) => (
                <li key={idx} style={rowStyle}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--v2-text-primary)', fontSize: 'var(--v2-text-base)' }}>
                      {m.name}
                    </span>
                    {(m.dose || m.schedule) && (
                      <span style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-sm)' }}>
                        {[m.dose, m.schedule].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMed(idx)}
                    aria-label={`Remove ${m.name}`}
                    style={removeBtnStyle}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <Input
              placeholder="Drug name (e.g. midodrine)"
              value={medName}
              onChange={setMedName}
            />
            <div style={{ display: 'flex', gap: 'var(--v2-space-2)' }}>
              <div style={{ flex: 1 }}>
                <Input placeholder="Dose (e.g. 5 mg)" value={medDose} onChange={setMedDose} />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Schedule (e.g. AM)"
                  value={medSchedule}
                  onChange={setMedSchedule}
                />
              </div>
            </div>
            <Button variant="secondary" size="md" onClick={addMed} disabled={!medName.trim()}>
              Add medication
            </Button>
          </div>
        </Card>

        <Card>
          <SectionLabel>Allergies</SectionLabel>
          {allergies.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--v2-space-3)' }}>
              {allergies.map((a, idx) => (
                <li key={idx} style={rowStyle}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--v2-text-primary)', fontSize: 'var(--v2-text-base)' }}>
                      {a.substance}
                    </span>
                    {a.reaction && (
                      <span style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-sm)' }}>
                        {a.reaction}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAllergy(idx)}
                    aria-label={`Remove ${a.substance}`}
                    style={removeBtnStyle}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <Input
              placeholder="Substance (e.g. penicillin)"
              value={allergySubstance}
              onChange={setAllergySubstance}
            />
            <Input
              placeholder="Reaction (optional)"
              value={allergyReaction}
              onChange={setAllergyReaction}
            />
            <Button
              variant="secondary"
              size="md"
              onClick={addAllergy}
              disabled={!allergySubstance.trim()}
            >
              Add allergy
            </Button>
          </div>
        </Card>

        {error && (
          <p
            role="alert"
            style={{ margin: 0, color: 'var(--v2-accent-danger)', fontSize: 'var(--v2-text-sm)' }}
          >
            {error}
          </p>
        )}
      </div>
    </OnboardingShell>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: '0 0 var(--v2-space-3)',
        fontSize: 'var(--v2-text-base)',
        fontWeight: 'var(--v2-weight-semibold)',
        color: 'var(--v2-text-primary)',
      }}
    >
      {children}
    </h2>
  )
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: 'var(--v2-space-3)',
        fontSize: 'var(--v2-text-base)',
        borderRadius: 'var(--v2-radius-md)',
        background: 'var(--v2-bg-primary)',
        border: '1px solid var(--v2-border-strong)',
        color: 'var(--v2-text-primary)',
        fontFamily: 'inherit',
      }}
    />
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--v2-space-2)',
  padding: 'var(--v2-space-2) 0',
  borderBottom: '1px solid var(--v2-border-subtle)',
}

const removeBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 'var(--v2-radius-full)',
  border: '1px solid var(--v2-border-strong)',
  background: 'transparent',
  color: 'var(--v2-text-muted)',
  fontSize: 'var(--v2-text-sm)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
