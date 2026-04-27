'use client'

/**
 * FoodDetailHeader
 *
 * MFN parity surface for the top of /v2/calories/food/[fdcId].
 * Mirrors `docs/reference/mynetdiary/frames/full-tour/frame_0045.png`:
 * an edge-to-edge ~280pt photo with a dark gradient and the food
 * name overlaid bottom-left, plus a back chevron and favorite star
 * floating top-left/top-right.
 *
 * The previous design used a centered 64pt CALORIES headline above
 * a TopAppBar; user feedback (2026-04-27): "you see how this piece
 * is nothing like my net diary." This component replaces both.
 *
 * Why client component: the favorite-star is a `<form method="POST">`
 * but it lives inside a server component caller. Keeping the chrome
 * client-side means the back/star icon click targets share state
 * with the rest of the food-detail surface without a server round
 * trip. The actual favorite POST still goes through the existing
 * /api/calories/favorites/toggle route.
 */
import Link from 'next/link'

export interface FoodDetailHeaderProps {
  /** Display name. Long names truncate with ellipsis at the bottom-left
   *  overlay (single line preferred but wraps to 2 lines if needed). */
  name: string
  /** Open Food Facts photo URL when available. Falls back to a solid
   *  dark placeholder of the same dimensions so the layout never
   *  shifts based on whether the photo loaded. */
  photoUrl: string | null
  /** Where the back chevron navigates. Typically the search results. */
  backHref: string
  /** Favorite-toggle form props. The form posts to a server route
   *  that flips the row in `food_favorites` and 303-redirects back
   *  to `returnTo`. */
  favorite: {
    fdcId: number
    name: string
    returnTo: string
    isFav: boolean
  }
}

const HEADER_HEIGHT = 280

export default function FoodDetailHeader({
  name,
  photoUrl,
  backHref,
  favorite,
}: FoodDetailHeaderProps) {
  return (
    <header
      style={{
        position: 'relative',
        width: '100%',
        height: HEADER_HEIGHT,
        background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%)',
        overflow: 'hidden',
        // Pull the header outside the page padding so it goes
        // edge-to-edge. The page wraps content in a 16pt-padded
        // column; negative margin compensates exactly that much.
        margin: 'calc(var(--v2-space-4) * -1)',
        marginBottom: 0,
      }}
    >
      {photoUrl && (
        <img
          src={photoUrl}
          alt=""
          aria-hidden
          loading="eager"
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      {/* Dark gradient overlay so the food name reads on any photo. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.78) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top-left: back chevron */}
      <Link
        href={backHref}
        aria-label="Back to food search"
        style={{
          position: 'absolute',
          top: 'calc(var(--v2-safe-top, 0px) + var(--v2-space-3))',
          left: 'var(--v2-space-3)',
          width: 40,
          height: 40,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--v2-radius-full)',
          background: 'rgba(0,0,0,0.32)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#fff',
          textDecoration: 'none',
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        <ChevronLeftIcon />
      </Link>

      {/* Top-right: favorite star */}
      <form
        action="/api/calories/favorites/toggle"
        method="POST"
        style={{
          position: 'absolute',
          top: 'calc(var(--v2-safe-top, 0px) + var(--v2-space-3))',
          right: 'var(--v2-space-3)',
          margin: 0,
        }}
      >
        <input type="hidden" name="fdcId" value={favorite.fdcId} />
        <input type="hidden" name="name" value={favorite.name} />
        <input type="hidden" name="returnTo" value={favorite.returnTo} />
        <button
          type="submit"
          aria-label={favorite.isFav ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={favorite.isFav}
          style={{
            width: 40,
            height: 40,
            border: 0,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--v2-radius-full)',
            background: 'rgba(0,0,0,0.32)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: favorite.isFav ? '#FFD24A' : '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <StarIcon filled={favorite.isFav} />
        </button>
      </form>

      {/* Bottom-left: food name overlay */}
      <h1
        style={{
          position: 'absolute',
          left: 'var(--v2-space-4)',
          right: 'var(--v2-space-4)',
          bottom: 'var(--v2-space-4)',
          margin: 0,
          color: '#fff',
          fontSize: 'var(--v2-text-2xl)',
          fontWeight: 'var(--v2-weight-bold)',
          lineHeight: 1.2,
          letterSpacing: 'var(--v2-tracking-tight)',
          textShadow: '0 1px 8px rgba(0,0,0,0.45)',
          // Wrap to 2 lines max so very long names truncate cleanly.
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {name}
      </h1>
    </header>
  )
}

function ChevronLeftIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
