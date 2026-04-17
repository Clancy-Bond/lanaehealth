'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CheckInDoneButtonProps {
  label?: string
  sectionsLogged: number
  totalSections?: number
}

export default function CheckInDoneButton({
  label = 'Done for now',
  sectionsLogged,
  totalSections = 5,
}: CheckInDoneButtonProps) {
  const router = useRouter()
  const [clicked, setClicked] = useState(false)

  const complete = sectionsLogged >= Math.ceil(totalSections / 2)
  const onDone = () => {
    setClicked(true)
    setTimeout(() => {
      router.push('/')
    }, 800)
  }

  const message = clicked
    ? complete
      ? "Saved. Great work today."
      : 'Saved. Come back anytime.'
    : null

  return (
    <div className="pt-2 pb-4 space-y-2">
      <button
        type="button"
        onClick={onDone}
        disabled={clicked}
        className="press-feedback w-full py-3 rounded-full text-sm font-semibold"
        style={{
          background: clicked
            ? '#6B9080'
            : complete
            ? 'linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)'
            : '#FFFDF9',
          color: clicked ? '#fff' : complete ? '#fff' : '#6B9080',
          boxShadow: clicked || complete ? 'var(--shadow-md)' : 'none',
          border: clicked || complete ? 'none' : '1px solid rgba(107, 144, 128, 0.3)',
          opacity: clicked ? 0.8 : 1,
          transition: `background var(--duration-base) var(--ease-standard), box-shadow var(--duration-base) var(--ease-standard)`,
        }}
      >
        {clicked ? (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden>&#10003;</span> Saved
          </span>
        ) : (
          <>
            {label}
            <span className="tabular ml-2 text-xs opacity-80">
              {sectionsLogged}/{totalSections} logged
            </span>
          </>
        )}
      </button>
      {message ? (
        <p className="text-xs text-center" style={{ color: '#6B9080' }}>
          {message}
        </p>
      ) : (
        <p className="text-xs text-center" style={{ color: '#8a8a8a' }}>
          Everything saves automatically. Tap when you&apos;re done.
        </p>
      )}
    </div>
  )
}
