'use client'

/*
 * HormoneIndexClient
 *
 * Thin client wrapper that owns two client-only concerns for the
 * /v2/topics/cycle/hormones surface:
 *   1. FAB button that opens the entry sheet
 *   2. Entry sheet itself
 *
 * The card grid stays on the server so data stays near the
 * createServiceClient call. On a successful save we call
 * router.refresh() to re-run the server loader, keeping the client
 * tiny (no optimistic update, no client-side entry merging).
 *
 * Placed in MobileShell's `fab` slot. The FAB is position: fixed
 * regardless of tree placement, and Sheet portals to document.body,
 * so the slot choice does not affect layout.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FAB } from '@/v2/components/shell'
import HormoneEntrySheet from './HormoneEntrySheet'

export default function HormoneIndexClient() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <FAB
        label="Log hormone entry"
        variant="floating"
        onClick={() => setOpen(true)}
      />
      <HormoneEntrySheet
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  )
}
