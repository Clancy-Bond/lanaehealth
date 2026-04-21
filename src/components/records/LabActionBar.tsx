'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Camera, FileText } from 'lucide-react'
import type { LabResult } from '@/lib/types'
import { PhotoLabScanner } from '@/components/labs/PhotoLabScanner'
import { PdfLabScanner } from '@/components/labs/PdfLabScanner'
import { AddLabForm } from '@/components/records/LabsTab'

type Mode = 'idle' | 'form' | 'photo' | 'pdf'

export function LabActionBar() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('idle')

  const close = () => setMode('idle')

  const onAddOne = (_: LabResult) => {
    close()
    router.refresh()
  }

  const onScannedImport = (_: LabResult[]) => {
    // Keep the scanner open through its "done" screen; refresh in background
    router.refresh()
  }

  if (mode === 'form') {
    return <AddLabForm onClose={close} onSubmit={onAddOne} />
  }
  if (mode === 'photo') {
    return <PhotoLabScanner onClose={close} onImported={onScannedImport} />
  }
  if (mode === 'pdf') {
    return <PdfLabScanner onClose={close} onImported={onScannedImport} />
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => setMode('form')}
        className="press-feedback flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
        style={{
          background: 'var(--bg-elevated)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <Plus size={16} strokeWidth={2} />
        Add result
      </button>
      <button
        onClick={() => setMode('photo')}
        className="press-feedback flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
        style={{
          background: 'var(--accent-sage)',
          color: 'var(--text-inverse)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Camera size={16} strokeWidth={2.5} />
        Scan photo
      </button>
      <button
        onClick={() => setMode('pdf')}
        className="press-feedback flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
        style={{
          background: 'var(--bg-elevated)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <FileText size={16} strokeWidth={2} />
        Upload PDF
      </button>
    </div>
  )
}
