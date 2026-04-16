'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { MedicationReminder } from '@/lib/types'
import {
  requestNotificationPermission,
  hasNotificationPermission,
  startReminderScheduler,
  updateReminders,
  type ScheduledReminder,
} from '@/lib/notifications'

interface MedicationRemindersProps {
  initialReminders: MedicationReminder[]
}

interface ReminderFormData {
  medication_name: string
  reminder_times: string[]
  days_of_week: number[] | null
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const EMPTY_FORM: ReminderFormData = {
  medication_name: '',
  reminder_times: ['08:00'],
  days_of_week: null, // null = every day
}

export default function MedicationReminders({
  initialReminders,
}: MedicationRemindersProps) {
  const [reminders, setReminders] = useState<MedicationReminder[]>(initialReminders)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ReminderFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Start notification scheduler when reminders change
  useEffect(() => {
    setNotificationsEnabled(hasNotificationPermission())

    const scheduled: ScheduledReminder[] = reminders
      .filter(r => r.is_active)
      .flatMap(r =>
        (r.reminder_times ?? []).map((time: string, idx: number) => ({
          id: `${r.id}_${idx}`,
          medicationName: r.medication_name,
          dose: null,
          scheduledTime: time,
          daysOfWeek: r.days_of_week ?? [],
          isActive: true,
        }))
      )

    if (scheduled.length > 0 && hasNotificationPermission()) {
      startReminderScheduler(scheduled)
    }
  }, [reminders])

  const handleEnableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission()
    setNotificationsEnabled(granted)
    if (granted) {
      // Re-trigger scheduler with current reminders
      const scheduled: ScheduledReminder[] = reminders
        .filter(r => r.is_active)
        .flatMap(r =>
          (r.reminder_times ?? []).map((time: string, idx: number) => ({
            id: `${r.id}_${idx}`,
            medicationName: r.medication_name,
            dose: null,
            scheduledTime: time,
            daysOfWeek: r.days_of_week ?? [],
            isActive: true,
          }))
        )
      startReminderScheduler(scheduled)
    }
  }, [reminders])

  // Show brief success message
  const flashMessage = useCallback((msg: string) => {
    setSavedMessage(msg)
    setTimeout(() => setSavedMessage(null), 2000)
  }, [])

  // Open the form for a new reminder
  const handleAdd = useCallback(() => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }, [])

  // Open the form to edit an existing reminder
  const handleEdit = useCallback((reminder: MedicationReminder) => {
    setForm({
      medication_name: reminder.medication_name,
      reminder_times: [...reminder.reminder_times],
      days_of_week: reminder.days_of_week ? [...reminder.days_of_week] : null,
    })
    setEditingId(reminder.id)
    setShowForm(true)
  }, [])

  // Cancel the form
  const handleCancel = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }, [])

  // Save (create or update)
  const handleSave = useCallback(async () => {
    if (!form.medication_name.trim()) return
    if (form.reminder_times.length === 0) return

    setSaving(true)
    try {
      const payload = {
        medication_name: form.medication_name.trim(),
        reminder_times: form.reminder_times.filter(Boolean),
        days_of_week: form.days_of_week,
        is_active: true,
      }

      if (editingId) {
        // Update existing
        const { data, error } = await supabase
          .from('medication_reminders')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single()

        if (error) throw error

        setReminders((prev) =>
          prev.map((r) => (r.id === editingId ? data : r))
        )
        flashMessage('Reminder updated')
      } else {
        // Create new
        const { data, error } = await supabase
          .from('medication_reminders')
          .insert(payload)
          .select()
          .single()

        if (error) throw error

        setReminders((prev) => [...prev, data])
        flashMessage('Reminder saved')
      }

      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
    } catch {
      // Silently fail - user can retry
    } finally {
      setSaving(false)
    }
  }, [form, editingId, flashMessage])

  // Toggle active/inactive
  const handleToggle = useCallback(async (id: string, currentActive: boolean) => {
    const newActive = !currentActive

    const { error } = await supabase
      .from('medication_reminders')
      .update({ is_active: newActive })
      .eq('id', id)

    if (!error) {
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: newActive } : r))
      )
      flashMessage(newActive ? 'Reminder activated' : 'Reminder paused')
    }
  }, [flashMessage])

  // Delete
  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('medication_reminders')
      .delete()
      .eq('id', id)

    if (!error) {
      setReminders((prev) => prev.filter((r) => r.id !== id))
      if (editingId === id) {
        setShowForm(false)
        setEditingId(null)
      }
      flashMessage('Reminder deleted')
    }
  }, [editingId, flashMessage])

  // Form helpers
  const addTime = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      reminder_times: [...prev.reminder_times, '12:00'],
    }))
  }, [])

  const removeTime = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      reminder_times: prev.reminder_times.filter((_, i) => i !== index),
    }))
  }, [])

  const updateTime = useCallback((index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      reminder_times: prev.reminder_times.map((t, i) => (i === index ? value : t)),
    }))
  }, [])

  const toggleDay = useCallback((dayIndex: number) => {
    setForm((prev) => {
      const current = prev.days_of_week ?? [0, 1, 2, 3, 4, 5, 6]
      const isSelected = current.includes(dayIndex)
      let next: number[]

      if (isSelected) {
        next = current.filter((d) => d !== dayIndex)
      } else {
        next = [...current, dayIndex].sort()
      }

      // If all days selected, switch to null (every day)
      if (next.length === 7) return { ...prev, days_of_week: null }
      // If no days selected, keep at least one
      if (next.length === 0) return prev

      return { ...prev, days_of_week: next }
    })
  }, [])

  // Format time for display
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h = hours % 12 || 12
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  // Format days for display
  const formatDays = (days: number[] | null): string => {
    if (days === null) return 'Every day'
    if (days.length === 7) return 'Every day'
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays'
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends'
    return days.map((d) => DAY_NAMES[d]).join(', ')
  }

  return (
    <div>
      {/* Notification permission banner */}
      {!notificationsEnabled && reminders.length > 0 && (
        <button
          type="button"
          onClick={handleEnableNotifications}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: 10,
            background: '#FFF3E0',
            border: '1px solid #FFE082',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 18 }}>&#x1F514;</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#E65100', margin: 0 }}>
              Enable Notifications
            </p>
            <p style={{ fontSize: 11, color: '#F57F17', margin: 0 }}>
              Get reminded when it is time to take your medications
            </p>
          </div>
        </button>
      )}

      {notificationsEnabled && reminders.some(r => r.is_active) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'var(--accent-sage-muted)',
          }}
        >
          <span style={{ fontSize: 12 }}>&#x2713;</span>
          <span style={{ fontSize: 11, color: 'var(--accent-sage)', fontWeight: 500 }}>
            Notifications active for {reminders.filter(r => r.is_active).length} reminder(s)
          </span>
        </div>
      )}

      {/* Success message */}
      {savedMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-light)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-sage)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--accent-sage)',
            }}
          >
            {savedMessage}
          </span>
        </div>
      )}

      {/* Reminder list */}
      {reminders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-light)',
                opacity: reminder.is_active ? 1 : 0.5,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {reminder.medication_name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}
                >
                  {reminder.reminder_times.map(formatTime).join(', ')}
                  {' · '}
                  {formatDays(reminder.days_of_week)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {/* Edit button */}
                <button
                  type="button"
                  onClick={() => handleEdit(reminder)}
                  style={{
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                  title="Edit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>

                {/* Toggle button */}
                <button
                  type="button"
                  onClick={() => handleToggle(reminder.id, reminder.is_active)}
                  style={{
                    width: 44,
                    height: 26,
                    borderRadius: 13,
                    border: 'none',
                    background: reminder.is_active
                      ? 'var(--accent-sage)'
                      : 'var(--border)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 200ms ease',
                    flexShrink: 0,
                  }}
                  title={reminder.is_active ? 'Disable' : 'Enable'}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: 3,
                      left: reminder.is_active ? 21 : 3,
                      transition: 'left 200ms ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Reminder button */}
      {!showForm && (
        <button
          type="button"
          onClick={handleAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 16px',
            minHeight: 44,
            borderRadius: 12,
            border: 'none',
            background: 'var(--accent-sage)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Reminder
        </button>
      )}

      {/* Inline form */}
      {showForm && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-light)',
          }}
        >
          {/* Medication name */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-muted)',
                marginBottom: 4,
              }}
            >
              Medication name
            </label>
            <input
              type="text"
              value={form.medication_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, medication_name: e.target.value }))
              }
              placeholder="e.g. Vitamin D3"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
              }}
              autoFocus
            />
          </div>

          {/* Reminder times */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-muted)',
                marginBottom: 4,
              }}
            >
              Reminder times
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {form.reminder_times.map((time, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => updateTime(idx, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  {form.reminder_times.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(idx)}
                      style={{
                        width: 36,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 8,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                      title="Remove time"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M3 3L11 11M3 11L11 3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addTime}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 0',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--accent-sage)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                + Add another time
              </button>
            </div>
          </div>

          {/* Days of week */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-muted)',
                marginBottom: 6,
              }}
            >
              Days
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {DAY_LABELS.map((label, idx) => {
                const isSelected =
                  form.days_of_week === null || form.days_of_week.includes(idx)
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      border: isSelected
                        ? '2px solid var(--accent-sage)'
                        : '1px solid var(--border)',
                      background: isSelected
                        ? 'var(--accent-sage-muted)'
                        : 'transparent',
                      color: isSelected
                        ? 'var(--accent-sage)'
                        : 'var(--text-muted)',
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={DAY_NAMES[idx]}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <span
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--text-muted)',
                marginTop: 4,
              }}
            >
              {formatDays(form.days_of_week)}
            </span>
          </div>

          {/* Form actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.medication_name.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 20px',
                minHeight: 40,
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent-sage)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                opacity: saving || !form.medication_name.trim() ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => handleDelete(editingId)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 16px',
                  minHeight: 40,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: '#C85C5C',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}

            <button
              type="button"
              onClick={handleCancel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 16px',
                minHeight: 40,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Note about push notifications */}
      {reminders.length > 0 && !showForm && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            marginTop: 10,
          }}
        >
          Reminder configurations are saved. Push notifications will be available in a future update.
        </p>
      )}
    </div>
  )
}
