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

interface BarcodeScannerProps {
  onProductFound: (product: OpenFoodProduct) => void
  onClose: () => void
}

export default function BarcodeScanner({ onProductFound, onClose }: BarcodeScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const animFrameRef = useRef<number>(0)

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

    try {
      const res = await fetch(`/api/food/barcode?code=${encodeURIComponent(code)}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Product not found')
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
  }, [onProductFound])

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
      </div>
    </div>
  )
}

// TypeScript declaration for BarcodeDetector (not yet in lib.dom.d.ts)
declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  detect(image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>
}
