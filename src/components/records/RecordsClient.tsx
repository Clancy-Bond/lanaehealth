'use client'

import { useState, useCallback } from 'react'
import type { LabResult, Appointment, ImagingStudy, MedicalTimelineEvent } from '@/lib/types'
import { LabsTab } from './LabsTab'
import { ImagingTab } from './ImagingTab'
import { AppointmentsTab } from './AppointmentsTab'
import { TimelineTab } from './TimelineTab'

type TabId = 'labs' | 'imaging' | 'appointments' | 'timeline'

const tabs: { id: TabId; label: string }[] = [
  { id: 'labs', label: 'Labs' },
  { id: 'imaging', label: 'Imaging' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'timeline', label: 'Timeline' },
]

interface RecordsClientProps {
  labs: LabResult[]
  imaging: ImagingStudy[]
  appointments: Appointment[]
  timeline: MedicalTimelineEvent[]
}

export function RecordsClient({ labs, imaging, appointments, timeline }: RecordsClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('labs')
  const [labResults, setLabResults] = useState<LabResult[]>(labs)

  const handleLabAdd = useCallback((result: LabResult) => {
    setLabResults((prev) => [result, ...prev])
  }, [])

  return (
    <div className="mt-4">
      {/* Tab pills */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="touch-target rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
            style={
              activeTab === tab.id
                ? {
                    background: 'var(--accent-sage)',
                    color: 'var(--text-inverse)',
                  }
                : {
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                  }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'labs' && <LabsTab results={labResults} onAdd={handleLabAdd} />}
        {activeTab === 'imaging' && <ImagingTab studies={imaging} />}
        {activeTab === 'appointments' && <AppointmentsTab appointments={appointments} />}
        {activeTab === 'timeline' && <TimelineTab events={timeline} />}
      </div>
    </div>
  )
}
