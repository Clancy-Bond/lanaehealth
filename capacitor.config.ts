/**
 * Capacitor configuration for the iOS shell.
 *
 * Architecture: thin native shell that loads the live web build from
 * Vercel. Code changes ship via `git push` and reach the WebView on
 * the user's device on next app launch (or live, if she has the app
 * open during deploy). The native shell only needs to be re-built
 * when adding a new Capacitor plugin or changing the Info.plist
 * permissions; that is rare.
 *
 * server.url points at production. For development against
 * lanaehealth-dev (port 3005) on the Mac, set CAP_SERVER_URL to a
 * tunneled URL (e.g. ngrok) before `npx cap sync` so the iPhone can
 * reach the dev box across the LAN.
 *
 * The webDir field is required by the CLI even when server.url is
 * set; it points at /public (which exists in any Next.js project)
 * so the CLI can copy a placeholder. server.url overrides at runtime.
 */
import type { CapacitorConfig } from '@capacitor/cli'

const PROD_URL = 'https://lanaehealth.vercel.app'

const config: CapacitorConfig = {
  appId: 'app.lanaehealth.mobile',
  appName: 'LanaeHealth',
  webDir: 'public',
  ios: {
    // No splash transition; the WebView loads the deployed app
    // directly so any branded splash should live in the web build.
    contentInset: 'always',
    // Allow `https://lanaehealth.vercel.app` and the Supabase / Oura
    // host families. The default iOS App Transport Security policy
    // already allows arbitrary HTTPS so no NSAppTransportSecurity
    // exception is required at build time.
    backgroundColor: '#0B0B0F',
  },
  server: {
    // Point the WebView at the live deploy. Override locally with
    // CAP_SERVER_URL=https://your-tunnel.ngrok.app npx cap sync ios
    url: process.env.CAP_SERVER_URL || PROD_URL,
    // We DO want to follow Supabase + Oura auth redirects, so leave
    // androidScheme/iosScheme defaults alone.
    cleartext: false,
    // Allow the WebView to also load any other origins the web app
    // talks to (Sentry ingest, Anthropic, etc). The deployed app
    // already enforces its own CSP; Capacitor's allowNavigation only
    // affects iframes.
    allowNavigation: ['*.vercel.app', 'lanaehealth.vercel.app'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0B0B0F',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },
    Keyboard: {
      // Avoid the iOS WebView's default behavior where the keyboard
      // pushes the entire view up out of the safe area (which would
      // hide the bottom tab bar / FAB).
      resize: 'native',
      style: 'dark',
    },
  },
}

export default config
