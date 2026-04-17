'use client'

/**
 * Barcode Scanner Component
 *
 * Uses the native BarcodeDetector API (Chrome, Edge, Samsung Internet)
 * with camera access for real-time barcode scanning.
 * Falls back to manual entry for unsupported browsers (Safari, Firefox).
 *
 * Scanned barcodes are looked up via Open Food Facts API.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { OpenFoodProduct } from '@/lib/api/open-food-facts'
import type { MealType } from '@/lib/types'

interface BarcodeScannerProps {
  onProductFound: (product: OpenFoodProduct) => void
  onClose: () => void
  /**
   * Optional graceful fallback handler. When the scanned barcode is not found
   * in Open Food Facts, the scanner surfaces a 3-field inline quick-add form
   * (name, meal type, triggers) and calls this handler. If omitted, the
   * scanner falls back to the previous behavior (display error only).
   */
  onQuickAdd?: (entry: {
    name: string
    mealType: MealType
    triggers: string[]
    barcode: string
  }) => Promise<void> | void
}

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

// Keep this list tight, matches the trigger categories used by food-triggers.ts
const TRIGGER_OPTIONS = [
  'Gluten',
  'Dairy',
  'Soy',
  'Red Meat',
  'Alcohol',
  'Caffeine',
  'Sugar',
  'High FODMAP',
]

/**
 * Pick a sensible default meal_type based on the local hour.
 * Matches MyFitnessPal defaults: breakfast 4-10, lunch 10-15, dinner 15-21, snack otherwise.
 */
function defaultMealTypeForNow(): MealType {
  const h = new Date().getHours()
  if (h >= 4 && h < 10) return 'breakfast'
  if (h >= 10 && h < 15) return 'lunch'
  if (h >= 15 && h < 21) return 'dinner'
  return 'snack'
}

export default function BarcodeScanner({ onProductFound, onClose, onQuickAdd }: BarcodeScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const animFrameRef = useRef<number>(0)

  // Graceful fallback state: when a scanned barcode returns 404 from Open Food
  // Facts, we collect the missing-barcode value and surface a 3-field inline
  // form rather than dumping the user back to the scanner with just an error.
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null)
  const [quickName, setQuickName] = useState('')
  const [quickMealType, setQuickMealType] = useState<MealType>(() => defaultMealTypeForNow())
  const [quickTriggers, setQuickTriggers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Check if BarcodeDetector is available
  const hasBarcodeApi = typeof window !== 'undefined' && 'BarcodeDetector' in window

  // Start camera and scanning
  useEffect(() => {
    if (mode !== 'camera' || !hasBarcodeApi) {
      setMode('manual')
      return
    }

    let active = true

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        })

        if (!active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        detectorRef.current = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
        setScanning(true)
        scan()
      } catch (e) {
        setError('Camera access denied. Use manual entry instead.')
        setMode('manual')
      }
    }

    async function scan() {
      if (!active || !videoRef.current || !detectorRef.current) return

      try {
        const barcodes = await detectorRef.current.detect(videoRef.current)
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          setScanning(false)
          await lookupBarcode(barcodes[0].rawValue)
          return
        }
      } catch {
        // Detection error -- retry
      }

      if (active) {
        animFrameRef.current = requestAnimationFrame(scan)
      }
    }

    startCamera()

    return () => {
      active = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [mode, hasBarcodeApi]) // eslint-disable-line react-hooks/exhaustive-deps

  const lookupBarcode = useCallback(async (code: string) => {
    setLooking(true)
    setError(null)
    setNotFoundCode(null)

    try {
      const res = await fetch(`/api/food/barcode?code=${encodeURIComponent(code)}`)
      if (!res.ok) {
        // Graceful not-found: open Food Facts doesn't index every regional
        // product (especially Hawaii-local brands for Lanae). Show an inline
        // 3-field quick-add rather than a dead-end error, if caller opted in.
        if (res.status === 404 && onQuickAdd) {
          setNotFoundCode(code)
          setQuickName('')
          setQuickTriggers([])
          setQuickMealType(defaultMealTypeForNow())
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? 'Product not found')
        }
        setLooking(false)
        return
      }

      const product = await res.json()
      onProductFound(product)
    } catch {
      setError('Lookup failed. Try again.')
    } finally {
      setLooking(false)
    }
  }, [onProductFound, onQuickAdd])

  const toggleTrigger = useCallback((label: string) => {
    setQuickTriggers((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label],
    )
  }, [])

  const handleQuickAddSubmit = useCallback(async () => {
    if (!onQuickAdd || !notFoundCode) return
    if (!quickName.trim()) return
    setSaving(true)
    try {
      await onQuickAdd({
        name: quickName.trim(),
        mealType: quickMealType,
        triggers: quickTriggers,
        barcode: notFoundCode,
      })
      onClose()
    } catch {
      setError('Save failed. Try again.')
    } finally {
      setSaving(false)
    }
  }, [onQuickAdd, notFoundCode, quickName, quickMealType, quickTriggers, onClose])

  const handleManualSubmit = useCallback(() => {
    if (manualCode.length >= 6) {
      lookupBarcode(manualCode)
    }
  }, [manualCode, lookupBarcode])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.9)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <h3 className="text-sm font-semibold text-white">Scan Barcode</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-white text-sm px-3 py-1 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.2)' }}
        >
          Close
        </button>
      </div>

      {/* Camera view */}
      {mode === 'camera' && (
        <div className="flex-1 flex items-center justify-center relative">
          <video
            ref={videoRef}
            className="max-w-full max-h-full object-cover rounded-xl"
            playsInline
            muted
          />
          {scanning && (
            <div
              className="absolute inset-x-8"
              style={{
                top: '45%',
                height: 2,
                background: '#C62828',
                boxShadow: '0 0 10px #C62828',
                animation: 'scan-line 2s ease-in-out infinite',
              }}
            />
          )}
          {looking && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-white" />
            </div>
          )}
        </div>
      )}

      {/* Manual entry */}
      <div className="p-4 space-y-3">
        {mode === 'camera' && (
          <button
            type="button"
            onClick={() => setMode('manual')}
            className="w-full text-center text-xs py-2"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            Enter barcode manually instead
          </button>
        )}

        {mode === 'manual' && (
          <div className="space-y-2">
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {!hasBarcodeApi
                ? 'Your browser does not support camera scanning. Enter the barcode number:'
                : 'Enter the barcode number:'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Barcode number"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)',
                  minHeight: 44,
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={manualCode.length < 6 || looking}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                style={{
                  background: 'var(--accent-sage)',
                  opacity: manualCode.length < 6 || looking ? 0.5 : 1,
                }}
              >
                {looking ? 'Looking...' : 'Lookup'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-center" style={{ color: '#EF9A9A' }}>{error}</p>
        )}

        {/* Graceful not-found fallback: 3-field inline quick add.
            Only surfaces when the caller opts in with onQuickAdd. */}
        {notFoundCode && onQuickAdd && (
          <div
            className="space-y-3 rounded-xl p-3"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
              We could not find barcode {notFoundCode}. Add it by hand, we will
              remember it next time you scan.
            </p>

            {/* Field 1: Name */}
            <input
              type="text"
              autoFocus
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickName.trim()) handleQuickAddSubmit()
              }}
              placeholder="What is it? (e.g., Hawaiian sweet bread)"
              className="w-full rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                minHeight: 44,
              }}
            />

            {/* Field 2: Meal type */}
            <div className="flex gap-1.5">
              {MEAL_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setQuickMealType(opt.value)}
                  className="flex-1 rounded-lg px-1 text-xs font-medium"
                  style={{
                    background:
                      quickMealType === opt.value
                        ? 'var(--accent-sage)'
                        : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    minHeight: 44,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Field 3: Triggers (optional multiselect) */}
            <div className="flex flex-wrap gap-1.5">
              {TRIGGER_OPTIONS.map((label) => {
                const active = quickTriggers.includes(label)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleTrigger(label)}
                    className="rounded-full px-3 text-xs font-medium"
                    style={{
                      background: active ? 'var(--accent-blush)' : 'rgba(255,255,255,0.1)',
                      color: 'white',
                      border: active
                        ? '1px solid var(--accent-blush)'
                        : '1px solid rgba(255,255,255,0.2)',
                      minHeight: 44,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={handleQuickAddSubmit}
              disabled={!quickName.trim() || saving}
              className="w-full rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{
                background: 'var(--accent-sage)',
                color: '#fff',
                minHeight: 44,
              }}
            >
              {saving ? 'Saving...' : 'Save entry'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// TypeScript declaration for BarcodeDetector (not yet in lib.dom.d.ts)
declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  detect(image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>
}
