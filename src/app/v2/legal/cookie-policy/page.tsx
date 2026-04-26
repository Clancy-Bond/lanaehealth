/**
 * /v2/legal/cookie-policy
 *
 * Minimal-cookie disclosure. We use only essential cookies; no
 * third-party analytics, no tracking pixels, no advertising
 * cookies. The page documents each cookie by name, purpose, and
 * lifetime so a user can verify what their browser is storing.
 *
 * Sources reviewed:
 *  - GDPR Article 6 / ePrivacy Directive (essential vs non-essential)
 *  - ICO (UK) cookie guidance
 *  - Apple Health and Bearable cookie disclosures (minimal pattern)
 *  - Standard SaaS cookie policy templates (Iubenda, Cookiebot)
 *
 * Pure server component.
 */
import LegalPageShell, {
  LegalH2,
  LegalP,
  LegalUL,
  LegalLI,
  LegalCitation,
} from '../_components/LegalPageShell'

export const metadata = {
  title: 'Cookie Policy - LanaeHealth',
  description: 'Which cookies LanaeHealth uses and why.',
}

export default function CookiePolicyPage() {
  return (
    <LegalPageShell title="Cookie Policy" lastUpdated="April 25, 2026">
      <LegalP>
        LanaeHealth uses only the cookies and local-storage values strictly
        necessary to keep you signed in and remember your preferences. We do
        not use cookies for advertising, behavioral profiling, or
        cross-site tracking. We do not run any third-party analytics that
        share your data.
      </LegalP>

      <LegalH2 id="what-is-a-cookie">What is a cookie?</LegalH2>
      <LegalP>
        A cookie is a small piece of text a website asks your browser to
        store. The next time you visit, your browser sends the cookie back
        so the site can recognize you. Local storage and session storage
        are similar mechanisms with different lifetimes. We treat all three
        the same in this policy.
      </LegalP>

      <LegalH2 id="cookies-we-use">Cookies and storage we use</LegalH2>
      <LegalP>Every entry below is strictly necessary for the Service.</LegalP>
      <LegalUL>
        <LegalLI>
          <strong>Authentication session</strong> (cookie, set by Supabase
          Auth). Keeps you signed in. Encrypted and HttpOnly. Lifetime: up
          to 60 days, refreshed on activity. Required to use the app.
        </LegalLI>
        <LegalLI>
          <strong>Theme preference</strong> (local storage,{' '}
          <code>v2-theme</code>). Remembers whether you chose light or dark
          mode. Lifetime: until you clear browser storage. Used only by
          the in-page script that sets the color scheme before paint, to
          avoid the flash of wrong theme.
        </LegalLI>
        <LegalLI>
          <strong>Cookie consent acknowledgement</strong> (local storage,{' '}
          <code>v2-cookie-consent</code>). Records that you have seen the
          consent banner so we do not show it again on every visit.
          Lifetime: until you clear browser storage.
        </LegalLI>
        <LegalLI>
          <strong>Onboarding draft</strong> (session storage). Holds your
          partial onboarding answers between steps so you do not lose
          them on a page refresh. Lifetime: until you close the tab.
        </LegalLI>
        <LegalLI>
          <strong>CSRF protection token</strong> (cookie). A short-lived,
          random value paired with each form submission to prevent
          cross-site request forgery. Lifetime: per session.
        </LegalLI>
      </LegalUL>

      <LegalH2 id="not-used">What we do not use</LegalH2>
      <LegalUL>
        <LegalLI>Google Analytics, Plausible, Fathom, or any other third-party analytics product.</LegalLI>
        <LegalLI>Advertising cookies (Google Ads, Meta Pixel, TikTok Pixel, etc.).</LegalLI>
        <LegalLI>Behavioral profiling, fingerprinting, or device-graph cookies.</LegalLI>
        <LegalLI>Session replay or screen recording tools (LogRocket, Hotjar, FullStory, etc.).</LegalLI>
        <LegalLI>Cross-site tracking pixels of any kind.</LegalLI>
      </LegalUL>
      <LegalP>
        We send error reports to Sentry (see the Privacy Policy) but
        Sentry does not set browser cookies in our integration; it uses an
        in-page JavaScript SDK that posts crash data over fetch.
      </LegalP>

      <LegalH2 id="control">Your control</LegalH2>
      <LegalP>
        Because we only use essential cookies, the consent banner you saw
        on first visit is informational rather than a choice. Strictly
        necessary cookies do not require consent under GDPR, the UK
        ePrivacy Regulation, or US state privacy law. If you block them in
        your browser, the Service may not function (you will not be able
        to stay signed in).
      </LegalP>
      <LegalP>
        You can clear all stored values at any time from your browser
        settings. Doing so will sign you out and reset your theme
        preference.
      </LegalP>

      <LegalH2 id="changes">Changes to this policy</LegalH2>
      <LegalP>
        If we ever introduce a new cookie or storage value, we will list
        it on this page and announce the change in the app at least 14
        days before it takes effect. We will not introduce a non-essential
        cookie without an in-app opt-in.
      </LegalP>

      <LegalH2 id="contact">Contact</LegalH2>
      <LegalP>
        Questions about this policy:{' '}
        <a href="mailto:privacy@lanaehealth.com" style={{ color: 'var(--v2-accent-primary)' }}>
          privacy@lanaehealth.com
        </a>
      </LegalP>
      <LegalCitation>
        Minimal-cookie posture follows the Apple Health and Bearable
        precedent (essential-only). The {'"strictly necessary"'} exception to
        consent is set out in GDPR Recital 32 / ePrivacy Directive Article
        5(3) and the UK ICO&apos;s 2019 cookie guidance.
      </LegalCitation>
    </LegalPageShell>
  )
}
