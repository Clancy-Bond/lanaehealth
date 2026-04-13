'use client'

import { useState, useMemo } from 'react'
import type { Appointment } from '@/lib/types'
import { addAppointment } from '@/lib/api/appointments'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

interface AppointmentCardProps {
  appointment: Appointment
}

function AppointmentCard({ appointment: apt }: AppointmentCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="card w-full text-left p-4 transition-shadow"
      style={{ boxShadow: expanded ? 'var(--shadow-md)' : 'var(--shadow-sm)' }}
    >
      <div className="flex items-start gap-3">
        {/* Date column */}
        <div
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-center"
          style={{ background: 'var(--accent-sage-muted)', minWidth: '52px' }}
        >
          <p className="text-xs font-bold" style={{ color: 'var(--accent-sage)' }}>
            {new Date(apt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </p>
          <p className="text-lg font-bold leading-tight" style={{ color: 'var(--accent-sage)' }}>
            {new Date(apt.date + 'T00:00:00').getDate()}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {apt.doctor_name && (
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {apt.doctor_name}
              </p>
            )}
            {apt.specialty && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--accent-blush-muted)', color: 'var(--accent-blush)' }}
              >
                {apt.specialty}
              </span>
            )}
          </div>
          {apt.clinic && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {apt.clinic}
            </p>
          )}
        </div>

        {/* Chevron */}
        <svg
          className="w-4 h-4 shrink-0 mt-1 transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 space-y-2" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          {apt.reason && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Reason
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{apt.reason}</p>
            </div>
          )}
          {apt.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Notes
              </p>
              <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{apt.notes}</p>
            </div>
          )}
          {apt.action_items && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Action Items
              </p>
              <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{apt.action_items}</p>
            </div>
          )}
          {apt.follow_up_date && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Follow-up
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--accent-sage)' }}>{formatDate(apt.follow_up_date)}</p>
            </div>
          )}
        </div>
      )}
    </button>
  )
}

interface AddFormProps {
  onSave: (apt: Appointment) => void
  onCancel: () => void
}

function AddAppointmentForm({ onSave, onCancel }: AddFormProps) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: todayString(),
    doctor_name: '',
    specialty: '',
    clinic: '',
    reason: '',
  })

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.date) return
    setSaving(true)
    try {
      const result = await addAppointment({
        date: form.date,
        doctor_name: form.doctor_name || null,
        specialty: form.specialty || null,
        clinic: form.clinic || null,
        reason: form.reason || null,
        notes: null,
        action_items: null,
        follow_up_date: null,
      })
      onSave(result)
    } catch {
      // Error handled silently for now
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        New Appointment
      </p>

      <label className="block">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Date *</span>
        <input
          type="date"
          required
          value={form.date}
          onChange={(e) => updateField('date', e.target.value)}
          className="w-full mt-1 px-3 py-2.5 text-sm"
          style={inputStyle}
        />
      </label>

      <label className="block">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Doctor</span>
        <input
          type="text"
          value={form.doctor_name}
          onChange={(e) => updateField('doctor_name', e.target.value)}
          placeholder="Dr. Smith"
          className="w-full mt-1 px-3 py-2.5 text-sm"
          style={inputStyle}
        />
      </label>

      <label className="block">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Specialty</span>
        <select
          value={form.specialty}
          onChange={(e) => updateField('specialty', e.target.value)}
          className="w-full mt-1 px-3 py-2.5 text-sm"
          style={inputStyle}
        >
          <option value="">Select specialty</option>
          <option value="OB/GYN">OB/GYN</option>
          <option value="Endometriosis Specialist">Endometriosis Specialist</option>
          <option value="PCP">PCP</option>
          <option value="Neurologist">Neurologist</option>
          <option value="Cardiologist">Cardiologist</option>
          <option value="Gastroenterologist">Gastroenterologist</option>
          <option value="ENT">ENT</option>
          <option value="Allergist">Allergist</option>
          <option value="Rheumatologist">Rheumatologist</option>
          <option value="Other">Other</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Clinic</span>
        <input
          type="text"
          value={form.clinic}
          onChange={(e) => updateField('clinic', e.target.value)}
          placeholder="Clinic or hospital name"
          className="w-full mt-1 px-3 py-2.5 text-sm"
          style={inputStyle}
        />
      </label>

      <label className="block">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Reason</span>
        <input
          type="text"
          value={form.reason}
          onChange={(e) => updateField('reason', e.target.value)}
          placeholder="Reason for visit"
          className="w-full mt-1 px-3 py-2.5 text-sm"
          style={inputStyle}
        />
      </label>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !form.date}
          className="touch-target flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity"
          style={{
            background: 'var(--accent-sage)',
            color: 'var(--text-inverse)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="touch-target flex-1 rounded-xl py-2.5 text-sm font-medium"
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

interface AppointmentsTabProps {
  appointments: Appointment[]
}

export function AppointmentsTab({ appointments: initialAppointments }: AppointmentsTabProps) {
  const [appointments, setAppointments] = useState(initialAppointments)
  const [showForm, setShowForm] = useState(false)

  const today = todayString()

  const upcoming = useMemo(
    () => appointments
      .filter((a) => a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [appointments, today]
  )

  const past = useMemo(
    () => appointments
      .filter((a) => a.date < today)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [appointments, today]
  )

  const handleSave = (newApt: Appointment) => {
    setAppointments((prev) => [newApt, ...prev])
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      {/* Add button */}
      <button
        onClick={() => setShowForm((v) => !v)}
        className="touch-target w-full rounded-xl py-3 text-sm font-semibold transition-colors"
        style={{
          background: showForm ? 'var(--bg-elevated)' : 'var(--accent-sage)',
          color: showForm ? 'var(--text-secondary)' : 'var(--text-inverse)',
        }}
      >
        {showForm ? 'Cancel' : '+ Add Appointment'}
      </button>

      {showForm && (
        <AddAppointmentForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Empty state */}
      {appointments.length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No appointments yet
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Tap the button above to add your first appointment
          </p>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--accent-sage)' }}>
            Upcoming
          </h3>
          <div className="space-y-3">
            {upcoming.map((apt) => (
              <AppointmentCard key={apt.id} appointment={apt} />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
            Past
          </h3>
          <div className="space-y-3">
            {past.map((apt) => (
              <AppointmentCard key={apt.id} appointment={apt} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
