'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    defaultOpen ? undefined : 0
  )

  useEffect(() => {
    if (!contentRef.current) return
    if (isOpen) {
      setContentHeight(contentRef.current.scrollHeight)
      // After transition, set to auto so dynamic content can resize
      const timer = setTimeout(() => setContentHeight(undefined), 300)
      return () => clearTimeout(timer)
    } else {
      // First set explicit height for the shrink animation
      setContentHeight(contentRef.current.scrollHeight)
      requestAnimationFrame(() => {
        setContentHeight(0)
      })
    }
  }, [isOpen])

  // Re-measure when children change and section is open
  useEffect(() => {
    if (isOpen && contentRef.current) {
      setContentHeight(undefined)
    }
  }, [children, isOpen])

  return (
    <div
      className="card overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 touch-target"
        style={{ minHeight: 48 }}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <div className="flex flex-col items-start">
          <span
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </span>
          {!isOpen && subtitle && (
            <span
              className="mt-0.5 text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              {subtitle}
            </span>
          )}
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
          }}
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        ref={contentRef}
        style={{
          height: contentHeight !== undefined ? contentHeight : 'auto',
          overflow: 'hidden',
          transition: 'height 0.25s ease',
        }}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}
