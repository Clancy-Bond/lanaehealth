import type { ReactNode } from 'react'
import '@/v2/theme/tokens.css'
import PrePaintThemeScript from './_components/PrePaintThemeScript'

export const metadata = {
  title: 'LanaeHealth v2',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#0A0A0B',
}

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <div className="v2">
      <PrePaintThemeScript />
      {children}
    </div>
  )
}
