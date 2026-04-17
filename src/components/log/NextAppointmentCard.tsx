'use client'

import { format, parseISO } from 'date-fns'
import type { CheckInPrefill } from '@/lib/log/prefill'

interface NextAppointmentCardProps {
  appointment: CheckInPrefill['nextAppointment']
}

export default function NextAppointmentCard({ appointment }: NextAppointmentCardProps) {
  if (!appointment) return null

  const dayLabel =
    appointment.daysAway === 0
      ? 'Today'
      : appointment.daysAway === 1
      ? 'Tomorrow'
      : `in ${appointment.daysAway} days`

  const dateLabel = format(parseISO(appointment.date), 'EEE, MMM d')
  const line2 = [appointment.specialty, appointment.doctor].filter(Boolean).join(' \u00b7 ')

  const urgent = appointment.daysAway <= 3

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: urgent ? '#F5EEE6' : '#FFFDF9',
        border: `1px solid ${urgent ? 'rgba(204, 177, 103, 0.4)' : 'rgba(107, 144, 128, 0.15)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold" style={{ color: '#6B9080', letterSpacing: '0.01em' }}>
            Next appointment &middot; {dayLabel}
          </div>
          <div className="text-sm font-medium mt-1 truncate" style={{ color: '#3a3a3a' }}>
            {dateLabel}{appointment.reason ? ` \u00b7 ${appointment.reason}` : ''}
          </div>
          {line2 ? (
            <div className="text-xs truncate mt-0.5" style={{ color: '#8a8a8a' }}>
              {line2}
            </div>
          ) : null}
        </div>
        {urgent ? (
          <a
            href="/doctor"
            className="press-feedback shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full hover:brightness-95"
            style={{ background: '#CCB167', color: '#3a2e1f', textDecoration: 'none' }}
          >
            Prep doctor mode
          </a>
        ) : (
          <a
            href="/doctor"
            className="press-feedback shrink-0 text-xs underline"
            style={{ color: '#6B9080' }}
          >
            Doctor mode
          </a>
        )}
      </div>
    </div>
  )
}
