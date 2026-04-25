'use client'

import { useCallback, useRef, useState } from 'react'

interface UsePdfExportResult {
  contentRef: React.RefObject<HTMLDivElement | null>
  exporting: boolean
  printing: boolean
  exportPdf: (filename?: string) => Promise<void>
}

/*
 * usePdfExport
 *
 * Captures a ref'd content region to a multi-page A4 PDF using
 * html2canvas + jspdf. The printing state flips to true just before
 * capture so the caller can swap the content wrapper to the
 * `v2-surface-explanatory` class for the capture, then revert.
 *
 * Why swap: the dark Oura chrome looks harsh on paper. Explanatory
 * surfaces (cream bg, white cards, dark text) are the intended
 * printable treatment per docs/v2-design-system.md.
 *
 * Fallback: if anything in the capture/PDF pipeline throws, we fall
 * back to window.print() so the user still gets a printable surface.
 */
export function usePdfExport(): UsePdfExportResult {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [exporting, setExporting] = useState(false)
  const [printing, setPrinting] = useState(false)

  const exportPdf = useCallback(async (filename?: string) => {
    if (!contentRef.current || exporting) return
    setExporting(true)
    setPrinting(true)
    // Give React a frame to apply the v2-surface-explanatory class
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))

    try {
      const { default: html2canvas } = await import('html2canvas')
      const { default: jsPDF } = await import('jspdf')

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FAF5ED',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      const pdf = new jsPDF('p', 'mm', 'a4')
      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const today = new Date().toISOString().split('T')[0]
      pdf.save(filename ?? `LanaeHealth-DoctorReport-${today}.pdf`)
    } catch {
      if (typeof window !== 'undefined') window.print()
    } finally {
      setPrinting(false)
      setExporting(false)
    }
  }, [exporting])

  return { contentRef, exporting, printing, exportPdf }
}
