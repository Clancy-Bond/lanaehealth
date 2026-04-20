/**
 * Render a PDF file to a list of JPEG data URLs (one per page).
 *
 * pdfjs-dist is loaded dynamically so the (~1.5MB) library only ships to
 * clients that actually use the PDF upload path. The worker is served from
 * `/pdf.worker.min.mjs` (copied from node_modules at build time).
 */

export interface RenderedPage {
  pageNumber: number
  base64: string
  mediaType: 'image/jpeg'
}

export interface RenderOptions {
  maxDim?: number
  quality?: number
  onProgress?: (pageNumber: number, totalPages: number) => void
}

const DEFAULT_MAX_DIM = 2048
const DEFAULT_QUALITY = 0.85

export async function renderPdfPages(
  file: File,
  options: RenderOptions = {}
): Promise<RenderedPage[]> {
  const maxDim = options.maxDim ?? DEFAULT_MAX_DIM
  const quality = options.quality ?? DEFAULT_QUALITY

  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise

  const totalPages = pdf.numPages
  const pages: RenderedPage[] = []

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    options.onProgress?.(pageNumber, totalPages)

    const page = await pdf.getPage(pageNumber)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(
      maxDim / baseViewport.width,
      maxDim / baseViewport.height,
      2
    )
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context to render PDF page.')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvasContext: ctx, viewport }).promise

    const base64Url = canvas.toDataURL('image/jpeg', quality)
    const base64 = base64Url.split(',')[1]

    pages.push({ pageNumber, base64, mediaType: 'image/jpeg' })

    page.cleanup()
  }

  await pdf.destroy()
  return pages
}
