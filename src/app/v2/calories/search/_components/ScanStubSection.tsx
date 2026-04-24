'use client'

/*
 * ScanStubSection (now functional)
 *
 * The name is kept so existing imports continue to work, but this is
 * now a real barcode scanner. ZXing's BrowserMultiFormatReader runs
 * the camera stream through a continuous decode loop. iOS Safari
 * lacks the native BarcodeDetector API, so ZXing is required.
 *
 * Flow:
 *   1. Mount: try getUserMedia. If denied, show a friendly fallback.
 *   2. Stream: video tag receives the camera, scanner reads each
 *      frame. Reticle overlay is pure CSS.
 *   3. On hit: GET /api/food/barcode?code=<EAN>. If found, navigate
 *      to /v2/calories/food/[fdcId]. If not, surface a soft error
 *      with a manual-entry escape hatch.
 *   4. Unmount: stop tracks so the camera light goes off.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, EmptyState, Banner } from '@/v2/components/primitives'
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from '@zxing/browser'

type ScanState = 'idle' | 'requesting' | 'scanning' | 'looking-up' | 'denied' | 'unsupported' | 'error'

export interface ScanStubSectionProps {
  meal: string
}

export default function ScanStubSection({ meal }: ScanStubSectionProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastScanRef = useRef<string | null>(null)
  const [state, setState] = useState<ScanState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string>('Hold steady. We\u2019re looking for a barcode.')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!navigator?.mediaDevices?.getUserMedia) {
      setState('unsupported')
      return
    }

    let cancelled = false
    const reader = new BrowserMultiFormatReader()

    const start = async () => {
      setState('requesting')
      try {
        const video = videoRef.current
        if (!video) return
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          video,
          (result) => {
            if (cancelled) return
            if (!result) return
            const code = result.getText()
            if (!/^\d{6,32}$/.test(code)) return
            if (lastScanRef.current === code) return
            lastScanRef.current = code
            void handleHit(code)
          },
        )
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setState('scanning')
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        if (/Permission|denied|NotAllowed/i.test(msg)) {
          setState('denied')
        } else {
          setError(msg)
          setState('error')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleHit = async (code: string) => {
    setState('looking-up')
    setHint(`Looking up ${code}\u2026`)
    try {
      const res = await fetch(`/api/food/barcode?code=${encodeURIComponent(code)}`)
      if (res.status === 404) {
        setError(`Could not find ${code}. Try search instead.`)
        setHint('No match found. Try another or search by name.')
        setTimeout(() => {
          lastScanRef.current = null
          setState('scanning')
        }, 1500)
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(body.error ?? `Lookup failed (${res.status}).`)
      }
      const product = (await res.json()) as { fdcId?: number | string } & Record<string, unknown>
      // Open Food Facts results don't always carry a USDA fdcId. If we
      // got one, jump straight to the food detail page. If not, fall
      // back to a search by product name.
      if (product.fdcId) {
        const params = new URLSearchParams({ meal })
        router.push(`/v2/calories/food/${product.fdcId}?${params.toString()}`)
        return
      }
      const name =
        typeof product.name === 'string'
          ? product.name
          : typeof product.product_name === 'string'
            ? product.product_name
            : code
      const params = new URLSearchParams({ view: 'search', q: name, meal })
      router.push(`/v2/calories/search?${params.toString()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed.')
      setHint('Something went wrong. Try again or enter the code by hand.')
      setTimeout(() => {
        lastScanRef.current = null
        setState('scanning')
      }, 1500)
    }
  }

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manualCode.trim()
    if (!/^\d{6,32}$/.test(code)) {
      setError('Barcodes are 6 to 32 digits.')
      return
    }
    setError(null)
    void handleHit(code)
  }

  if (state === 'unsupported') {
    return (
      <EmptyState
        headline="Camera not available"
        subtext={'This browser can\u2019t reach the camera. Search by name or enter the barcode below.'}
        cta={
          <Button variant="primary" size="lg" onClick={() => setManualOpen(true)}>
            Enter barcode
          </Button>
        }
      />
    )
  }

  if (state === 'denied') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <EmptyState
          headline="Camera permission needed"
          subtext="Allow camera access in your browser settings, then come back. Or enter the barcode by hand."
          cta={
            <Button variant="primary" size="lg" onClick={() => setManualOpen(true)}>
              Enter barcode
            </Button>
          }
        />
        {manualOpen && (
          <ManualEntryForm
            value={manualCode}
            error={error}
            onChange={setManualCode}
            onSubmit={submitManual}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
      <div
        style={{
          position: 'relative', width: '100%',
          aspectRatio: '4 / 3', maxHeight: 480,
          background: '#000', borderRadius: 'var(--v2-radius-lg)',
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: 'block',
          }}
        />
        <Reticle />
      </div>

      <Card padding="md">
        <p
          aria-live="polite"
          style={{
            margin: 0, fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)', textAlign: 'center',
          }}
        >
          {state === 'requesting' ? 'Asking for camera\u2026' : hint}
        </p>
      </Card>

      {error && state !== 'looking-up' && (
        <Banner intent="warning" title="Barcode" body={error} />
      )}

      <div style={{ display: 'flex', gap: 'var(--v2-space-2)' }}>
        <Button
          variant="secondary" size="md" fullWidth
          onClick={() => setManualOpen((v) => !v)}
        >
          {manualOpen ? 'Hide manual entry' : 'Enter manually'}
        </Button>
        <Link
          href={`/v2/calories/search?view=search&meal=${encodeURIComponent(meal)}`}
          style={{ flex: 1, textDecoration: 'none' }}
        >
          <Button variant="tertiary" size="md" fullWidth>
            Search by name
          </Button>
        </Link>
      </div>

      {manualOpen && (
        <ManualEntryForm
          value={manualCode}
          error={error}
          onChange={setManualCode}
          onSubmit={submitManual}
        />
      )}
    </div>
  )
}

function Reticle() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '70%', height: '32%',
          border: '2px solid rgba(255,255,255,0.85)',
          borderRadius: 'var(--v2-radius-md)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
        }}
      />
    </div>
  )
}

function ManualEntryForm({
  value, error, onChange, onSubmit,
}: {
  value: string
  error: string | null
  onChange: (s: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <Card padding="md">
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <label
          htmlFor="manual-barcode"
          style={{
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          Barcode digits
        </label>
        <input
          id="manual-barcode"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          placeholder="e.g. 5449000000996"
          style={{
            minHeight: 'var(--v2-touch-target-min)',
            padding: '0 var(--v2-space-3)',
            border: '1px solid var(--v2-border)',
            borderRadius: 'var(--v2-radius-md)',
            background: 'var(--v2-bg-card)',
            color: 'var(--v2-text-primary)',
            fontSize: 'var(--v2-text-base)',
            fontFamily: 'inherit',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        {error && (
          <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-accent-danger)' }}>
            {error}
          </span>
        )}
        <Button type="submit" variant="primary" size="md" fullWidth>
          Look up
        </Button>
      </form>
    </Card>
  )
}
