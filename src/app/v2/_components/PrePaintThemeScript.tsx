/*
 * PrePaintThemeScript
 *
 * Reads localStorage('v2-theme') and the OS preference, then writes
 * data-theme on the .v2 root before the first paint. Users with a
 * saved 'light' (or 'system' that resolves to light) never see a
 * flash of dark chrome on cold load.
 *
 * Implementation: a Next.js Script with strategy="beforeInteractive"
 * is the documented App Router primitive for pre-hydration scripts
 * and avoids dangerouslySetInnerHTML. The script body is a
 * hardcoded constant in this file (no user input, no XSS surface).
 *
 * Wrapped in try/catch so storage errors (private mode, sandbox)
 * never crash the page; the default dark theme just stays.
 */
import Script from 'next/script'
import type { JSX } from 'react'

// Hardcoded constant. No user-controlled interpolation.
const SCRIPT_BODY =
  "(function(){try{var t=localStorage.getItem('v2-theme');var resolved=(t==='light')||(t==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';var r=document.querySelector('.v2');if(!r)return;if(resolved==='light'){r.setAttribute('data-theme','light');}else{r.removeAttribute('data-theme');}}catch(e){}})();"

export default function PrePaintThemeScript(): JSX.Element {
  return (
    <Script id="v2-pre-paint-theme" strategy="beforeInteractive">
      {SCRIPT_BODY}
    </Script>
  )
}
