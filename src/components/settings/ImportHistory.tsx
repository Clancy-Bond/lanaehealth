'use client'

import { useState, useEffect } from 'react'

interface ImportRecord {
  id: string
  format: string
  file_name: string | null
  source_app: string | null
  records_imported: number
  records_by_type: Record<string, number>
  date_range_start: string | null
  date_range_end: string | null
  imported_at: string
}

const FORMAT_LABELS: Record<string, string> = {
  'fhir-bundle': 'FHIR Bundle',
  'ccda-xml': 'C-CDA Medical Record',
  'pdf-medical': 'PDF Document',
  'image-medical': 'Photo/Screenshot',
  'csv-generic': 'CSV File',
  'json-generic': 'JSON File',
  'text-plain': 'Text',
  'apple-health-xml': 'Apple Health',
  'csv-mynetdiary': 'MyNetDiary',
  'csv-natural-cycles': 'Natural Cycles',
}

export default function ImportHistory() {
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/import/history')
      .then(r => r.ok ? r.json() : { records: [] })
      .then(data => setHistory(data.records ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-2 py-1">
        <div className="shimmer-bar" style={{ height: 1 }} />
        {[0, 1].map(i => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 36, borderRadius: 8 }}
          />
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
        No imports here yet. Drop a file above to start.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Recent Imports
      </p>
      {history.slice(0, 10).map(record => (
        <div
          key={record.id}
          className="press-feedback flex items-center gap-3 rounded-lg p-2.5 transition-all"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {record.source_app ?? FORMAT_LABELS[record.format] ?? record.format}
              {record.file_name ? ` - ${record.file_name}` : ''}
            </p>
            <p className="text-[10px] tabular" style={{ color: 'var(--text-muted)' }}>
              {record.records_imported} records
              {record.date_range_start ? ` (${record.date_range_start}` : ''}
              {record.date_range_end && record.date_range_start !== record.date_range_end
                ? ` to ${record.date_range_end})` : record.date_range_start ? ')' : ''}
            </p>
          </div>
          <span className="shrink-0 text-[10px] tabular" style={{ color: 'var(--text-muted)' }}>
            {new Date(record.imported_at).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  )
}
