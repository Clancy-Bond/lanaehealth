'use client'

import { useState, useMemo } from 'react'
import { CalendarDays, Plus, X } from 'lucide-react'
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
  highlight?: boolean
}

function AppointmentCard({ appointment: apt, highlight = false }: AppointmentCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="card press-feedback w-full text-left p-4"
      style={{
        boxShadow: expanded ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: `box-shadow var(--duration-fast) var(--ease-standard)`,
      }}
      aria-expanded={expanded}
    >
      <div className="flex items-start gap-3">
        {/* Date column: sage only when this is the highlighted "next up" appointment */}
        <div
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-center"
          style={{
            background: highlight ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
            minWidth: '52px',
          }}
        >
          <p
            className="tabular text-xs font-bold"
            style={{ color: highlight ? 'var(--accent-sage)' : 'var(--text-muted)' }}
          >
            {new Date(apt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </p>
          <p
            className="tabular text-lg font-bold leading-tight"
            style={{ color: highlight ? 'var(--accent-sage)' : 'var(--text-primary)' }}
          >
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
          className="w-4 h-4 shrink-0 mt-1"
          style={{
            color: 'var(--text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: `transform var(--duration-fast) var(--ease-standard)`,
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
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
                Action items
              </p>
              <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{apt.action_items}</p>
            </div>
          )}
          {apt.follow_up_date && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Follow-up
              </p>
              <p className="tabular text-sm mt-0.5" style={{ color: 'var(--accent-sage)' }}>{formatDate(apt.follow_up_date)}</p>
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
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          New appointment
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="press-feedback rounded-lg p-1"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Close form"
        >
          <X size={18} />
        </button>
      </div>

      <label className="block">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Date *</span>
        <input
          type="date"
          required
          value={form.date}
          onChange={(e) => updateField('date', e.target.value)}
          className="tabular w-full mt-1 px-3 py-2.5 text-sm"
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
          className="touch-target press-feedback flex-1 rounded-xl py-2.5 text-sm font-semibold"
          style={{
            background: 'var(--accent-sage)',
            color: 'var(--text-inverse)',
            opacity: saving ? 0.5 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: `opacity var(--duration-fast) var(--ease-standard)`,
          }}
        >
          {saving ? 'Saving' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="touch-target press-feedback flex-1 rounded-xl py-2.5 text-sm font-medium"
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

  // The ONE sage chip per viewport: the next-up appointment. All others neutral.
  const nextUpId = upcoming[0]?.id

  return (
    <div className="space-y-6">
      {/* Add button: neutral when inactive so it's not a second sage primary */}
      <button
        onClick={() => setShowForm((v) => !v)}
        className="touch-target press-feedback w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
        style={{
          background: showForm ? 'var(--bg-elevated)' : 'var(--accent-sage-muted)',
          color: showForm ? 'var(--text-secondary)' : 'var(--accent-sage)',
          border: showForm ? 'none' : '1px solid rgba(107, 144, 128, 0.2)',
          transition: `background var(--duration-fast) var(--ease-standard)`,
        }}
      >
        {showForm ? (
          <>Cancel</>
        ) : (
          <>
            <Plus size={16} strokeWidth={2} />
            Add appointment
          </>
        )}
      </button>

      {showForm && (
        <AddAppointmentForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Empty state */}
      {appointments.length === 0 && !showForm && (
        <div className="empty-state">
          <CalendarDays className="empty-state__icon" strokeWidth={1.5} aria-hidden="true" />
          <p className="empty-state__title">No appointments booked</p>
          <p className="empty-state__hint">
            Add one once you have it on your calendar.
          </p>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="section-header" style={{ color: 'var(--text-primary)' }}>
            Upcoming
          </h3>
          <p className="section-subtitle tabular">
            {upcoming.length} scheduled
          </p>
          <div className="space-y-3 mt-3">
            {upcoming.map((apt) => (
              <AppointmentCard
                key={apt.id}
                appointment={apt}
                highlight={apt.id === nextUpId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="section-header" style={{ color: 'var(--text-primary)' }}>
            Past
          </h3>
          <p className="section-subtitle tabular">
            {past.length} on record
          </p>
          <div className="space-y-3 mt-3">
            {past.map((apt) => (
              <AppointmentCard key={apt.id} appointment={apt} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
