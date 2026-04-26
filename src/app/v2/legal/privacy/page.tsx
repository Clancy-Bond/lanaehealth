/**
 * /v2/legal/privacy
 *
 * Complete privacy policy. Patterned on Oura, Bearable, and the
 * HIPAA Privacy Rule notice-of-privacy-practices structure adapted
 * for a non-covered-entity health tracker. NC voice on intro and
 * "Your rights" section; legal precision elsewhere.
 *
 * Sources reviewed (cited inline per section):
 *  - Oura Health privacy policy (https://ouraring.com/en/privacy-policy-oura-health)
 *  - HHS HIPAA Privacy Rule guidance
 *  - Bearable app privacy disclosures (https://bearable.app/privacy)
 *  - Apple Health data privacy disclosures
 *  - GDPR Articles 13, 15, 17, 20 (data subject rights)
 *  - Standard SaaS privacy policy templates (Iubenda, Termly)
 *
 * Pure server component. No state, no JS.
 */
import LegalPageShell, {
  LegalH2,
  LegalH3,
  LegalP,
  LegalUL,
  LegalLI,
  LegalCitation,
} from '../_components/LegalPageShell'

export const metadata = {
  title: 'Privacy Policy - LanaeHealth',
  description: 'How LanaeHealth handles your health data.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated="April 25, 2026">
      <LegalP>
        LanaeHealth is a personal health tracking app. The data you put into it
        (cycle entries, food, sleep, symptoms, lab results, doctor notes) belongs
        to you. This page explains what we collect, how we use it, who sees it,
        and how you can take it back.
      </LegalP>
      <LegalP>
        We wrote this in plain language so you can actually read it. Where the
        law requires precise terms, we use them and define them.
      </LegalP>

      <LegalH2 id="data-we-collect">1. Data we collect</LegalH2>
      <LegalP>
        LanaeHealth collects two kinds of information: account information you
        give us when you sign up, and protected health information (PHI) you
        choose to log inside the app or import from a connected device.
      </LegalP>

      <LegalH3>Account information</LegalH3>
      <LegalUL>
        <LegalLI>Your email address (used to sign in and to send security alerts).</LegalLI>
        <LegalLI>An encrypted password hash, or, if you sign in with Apple or Google, an opaque provider identifier.</LegalLI>
        <LegalLI>Your first name (asked during onboarding so the app can address you).</LegalLI>
        <LegalLI>Optional passkey credentials registered with your device.</LegalLI>
      </LegalUL>

      <LegalH3>Health information you log or import</LegalH3>
      <LegalUL>
        <LegalLI><strong>Menstrual cycle data</strong>: period start and end dates, flow level, basal body temperature, cervical mucus observations, ovulation predictions.</LegalLI>
        <LegalLI><strong>Food and nutrition</strong>: meals logged with quantities, calories, macros, and micronutrients pulled from the USDA FoodData Central database or Edamam recipe API.</LegalLI>
        <LegalLI><strong>Sleep, recovery, and activity</strong>: synced from Oura Ring (sleep stages, HRV, resting heart rate, body temperature, steps, calories) when you connect it.</LegalLI>
        <LegalLI><strong>Symptoms and pain</strong>: free text entries, pain scores, body location markers, severity, duration.</LegalLI>
        <LegalLI><strong>Lab results, imaging studies, appointments, medications, diagnoses</strong>: whatever you import from your medical records or type in.</LegalLI>
        <LegalLI><strong>Photos</strong>: anything you choose to attach (food photos, medical document scans).</LegalLI>
        <LegalLI><strong>Free-form notes and chat history</strong>: questions you ask the AI assistant and the responses, plus any narrative entries you write.</LegalLI>
      </LegalUL>
      <LegalP>
        Sensor data routed through Apple HealthKit or Google Health Connect is
        treated identically to data you type in directly.
      </LegalP>

      <LegalH3>Information collected automatically</LegalH3>
      <LegalUL>
        <LegalLI>Server-side request logs containing your IP address, user agent, and the route you visited. Retained for 30 days for security forensics, then purged.</LegalLI>
        <LegalLI>Crash reports and error events sent to Sentry. We have stripped Sentry of personally identifying breadcrumbs but the report still contains your user ID so we can reproduce the bug.</LegalLI>
        <LegalLI>An essential cookie or two to keep you signed in and remember your color theme. See the <a href="/v2/legal/cookie-policy" style={{ color: 'var(--v2-accent-primary)' }}>Cookie Policy</a>.</LegalLI>
      </LegalUL>
      <LegalP>
        We do not run third-party analytics, advertising trackers, behavioral
        profiling, fingerprinting, or session replay tools.
      </LegalP>
      <LegalCitation>
        Categorization patterned on the Oura Ring privacy policy (six categories:
        contact, device, user-provided, sensor, calculated metrics, usage) and
        the Apple Health data disclosure framework.
      </LegalCitation>

      <LegalH2 id="how-we-use">2. How we use your data</LegalH2>
      <LegalP>
        Your data is for your eyes. The AI assistant uses it to give you
        personalized insight. We do not sell it, rent it, share it for
        advertising, or use it to train models that serve other people.
      </LegalP>
      <LegalUL>
        <LegalLI><strong>Show you your own data</strong>. The cycle, food, sleep, and labs surfaces all read directly from your records.</LegalLI>
        <LegalLI><strong>Generate AI insight you asked for</strong>. When you ask the assistant a question, the assistant reads relevant slices of your record and returns an answer. Each call is per-user, scoped to your data, and not retained by the AI provider beyond the immediate response (see Section 3).</LegalLI>
        <LegalLI><strong>Build doctor visit summaries</strong>. The doctor mode produces a one-page printable PDF summarizing the last 90 days. The PDF is generated server-side from your record and never sent anywhere except to your browser.</LegalLI>
        <LegalLI><strong>Send security and account emails</strong>. Sign-in alerts, password reset links, account deletion confirmations. Never marketing.</LegalLI>
        <LegalLI><strong>Operate and secure the service</strong>. Diagnose bugs, prevent abuse, comply with law.</LegalLI>
      </LegalUL>
      <LegalP>
        We do <strong>not</strong> use your data for advertising, for training
        any third party model, for data brokering, or for inference about other
        users.
      </LegalP>
      <LegalCitation>
        The {'"your data, your eyes"'} framing follows the Bearable and Apple
        Health positioning. The {'"never used for ad targeting"'} commitment
        is stronger than the average wellness app and is enforceable through
        the named sub-processor list in Section 3.
      </LegalCitation>

      <LegalH2 id="who-we-share-with">3. Who we share data with (sub-processors)</LegalH2>
      <LegalP>
        LanaeHealth shares your data with a short, named list of service
        providers ({'"sub-processors"'}) that operate parts of our infrastructure.
        Each one is contractually limited to processing your data only on our
        instructions, only for the purpose listed below.
      </LegalP>

      <LegalUL>
        <LegalLI>
          <strong>Supabase, Inc.</strong> (United States) - hosted Postgres database
          and authentication. Stores all account information and PHI you log.
          Data is encrypted at rest with AES-256 and in transit with TLS 1.2+.
          Row-level security policies (RLS) ensure no other user, including
          Supabase staff, can read your row without service-role credentials we
          control. Supabase signs a Data Processing Addendum and is GDPR-aligned.
        </LegalLI>
        <LegalLI>
          <strong>Anthropic PBC</strong> (United States) - Claude API for the AI
          assistant. Each chat call sends the relevant excerpt of your record
          plus your question. Per Anthropic&apos;s commercial terms, prompts and
          completions are not used to train Anthropic models and are deleted
          after a 30-day retention window for abuse monitoring.
        </LegalLI>
        <LegalLI>
          <strong>Vercel Inc.</strong> (United States) - application hosting and
          edge network. Vercel does not have access to your database; it serves
          the Next.js application code and proxies your encrypted requests.
        </LegalLI>
        <LegalLI>
          <strong>Functional Software, Inc. dba Sentry</strong> (United States) -
          error monitoring. Sentry receives crash stack traces and your user ID
          so a bug can be tied back to a record we can reproduce. We do not send
          PHI in breadcrumbs or extras.
        </LegalLI>
        <LegalLI>
          <strong>Apple Inc.</strong> and <strong>Google LLC</strong> - only if
          you choose Sign in with Apple or Sign in with Google. They receive an
          authentication request and return a verified identity. They do not
          receive any PHI.
        </LegalLI>
        <LegalLI>
          <strong>Oura Health Oy</strong> (Finland) - only if you connect your
          Oura Ring. Oura is the data source; we pull from their API on your
          behalf using the OAuth token you grant us. We do not push any data
          back to Oura.
        </LegalLI>
        <LegalLI>
          <strong>USDA FoodData Central</strong> and <strong>Edamam Inc.</strong> -
          we send the food name you typed (e.g. {'"egg"'}) to look up nutrition
          values. We do not send your user ID or any other personal information.
        </LegalLI>
      </LegalUL>

      <LegalP>
        We will publish any change to this list at least 14 days before the
        change takes effect. We never share your data with advertising
        networks, data brokers, or insurance companies.
      </LegalP>

      <LegalH3>Legal disclosures</LegalH3>
      <LegalP>
        We may disclose your information if compelled by a valid subpoena,
        court order, or other legal process. When the law allows, we will
        notify you first so you can challenge the request. We do not
        proactively share your data with law enforcement.
      </LegalP>
      <LegalCitation>
        The named sub-processor list pattern follows Natural Cycles, Bearable,
        and other regulated health apps. Naming each processor in the public
        privacy notice is best practice under GDPR Article 13(1)(e) and beyond
        the legal minimum required by US state privacy laws.
      </LegalCitation>

      <LegalH2 id="how-we-protect">4. How we protect your data</LegalH2>
      <LegalUL>
        <LegalLI>
          <strong>Encryption at rest</strong>: AES-256 disk encryption on every
          database row, applied transparently by Supabase.
        </LegalLI>
        <LegalLI>
          <strong>Encryption in transit</strong>: TLS 1.2 or higher between your
          device and our servers, and between our servers and every
          sub-processor listed above. We do not accept unencrypted connections.
        </LegalLI>
        <LegalLI>
          <strong>Row-level security (RLS)</strong>: every table that holds your
          data has database-enforced policies that block any read or write where
          the requesting auth ID does not match the row&apos;s owner. PHI rows
          are double-checked at the application layer as a defense in depth.
        </LegalLI>
        <LegalLI>
          <strong>Authentication</strong>: passwords are stored as bcrypt hashes
          (never plain text). Optional passkeys use FIDO2 / WebAuthn so no
          shared secret crosses the network.
        </LegalLI>
        <LegalLI>
          <strong>Audit logging</strong>: every privileged read and every write
          to a PHI table is logged with timestamp, route, and actor. Logs are
          retained 90 days.
        </LegalLI>
        <LegalLI>
          <strong>Least-privilege access</strong>: only the application service
          role and a small set of break-glass administrators can read PHI tables
          in production. Routine engineering work happens against a separate
          development database that does not contain user data.
        </LegalLI>
        <LegalLI>
          <strong>Patch management</strong>: we deploy security updates to the
          application within 24 hours of disclosure for critical issues, 7 days
          for high, 30 days for medium.
        </LegalLI>
      </LegalUL>
      <LegalP>
        Despite this, no online service can promise perfect security. If we
        ever experience a breach affecting your data, we will notify you
        without undue delay and within 72 hours of discovery, in accordance
        with GDPR Article 33 timelines (we apply the same standard worldwide).
      </LegalP>

      <LegalH2 id="your-rights">5. Your rights</LegalH2>
      <LegalP>
        You can do all of these from inside the app. No email or form
        submission required.
      </LegalP>
      <LegalUL>
        <LegalLI>
          <strong>Export</strong>: download a single ZIP containing every record
          we have on you, in machine-readable JSON plus a human-readable PDF
          summary. Settings, then Data export.
        </LegalLI>
        <LegalLI>
          <strong>Correct</strong>: every record in the app is editable inline.
          If something is wrong and the AI keeps using it, tell the assistant
          once and the correction is honored from then on.
        </LegalLI>
        <LegalLI>
          <strong>Delete</strong>: you can delete an individual entry, a whole
          day, or your entire account. Account deletion permanently removes
          your row and every linked PHI row within 30 days. Backups containing
          your data are purged on a 35-day rolling schedule.
        </LegalLI>
        <LegalLI>
          <strong>Object or restrict</strong>: you can pause AI processing of
          your data at any time from Settings, then Privacy. The app keeps
          working as a passive logger.
        </LegalLI>
        <LegalLI>
          <strong>Withdraw consent</strong>: signing out and deleting your
          account is the most complete withdrawal. We honor it within 30 days.
        </LegalLI>
      </LegalUL>
      <LegalP>
        If for any reason a self-service tool is not working, email{' '}
        <a href="mailto:privacy@lanaehealth.com" style={{ color: 'var(--v2-accent-primary)' }}>
          privacy@lanaehealth.com
        </a>{' '}
        and we will action your request within 30 days.
      </LegalP>
      <LegalCitation>
        Rights enumerated map to GDPR Articles 15 (access), 16 (rectification),
        17 (erasure), 18 (restriction), 20 (portability), 21 (objection), and
        US state equivalents (CCPA / CPRA, VCDPA, CPA, CTDPA, UCPA).
      </LegalCitation>

      <LegalH2 id="hipaa-status">6. HIPAA compliance status</LegalH2>
      <LegalP>
        LanaeHealth is currently <strong>not</strong> a HIPAA Covered Entity or
        a Business Associate of one. We are a personal health record (PHR)
        operated directly for you, the consumer.
      </LegalP>
      <LegalP>
        That said, we have built the system to HIPAA Security Rule technical
        safeguards: encryption in transit and at rest, role-based access
        control, audit logging, automatic logoff, integrity controls, and a
        written incident response procedure. We can sign a Business Associate
        Agreement (BAA) with a covered entity if and when one is required for
        an integration.
      </LegalP>
      <LegalP>
        Because we are not a covered entity, the HIPAA Privacy Rule&apos;s
        notice-of-privacy-practices format does not technically apply to us.
        We have nonetheless modeled this document on the same disclosure
        categories so you have parity with what your doctor&apos;s office
        provides.
      </LegalP>
      <LegalCitation>
        Conditional-HIPAA framing patterned on the Oura Ring policy
        (&quot;in some instances where Oura is acting as a Business Associate
        under HIPAA...&quot;). Technical-safeguards listing maps to 45 CFR
        164.312.
      </LegalCitation>

      <LegalH2 id="international">7. International users and GDPR</LegalH2>
      <LegalP>
        LanaeHealth servers and our sub-processors are located in the United
        States. If you are using the service from the European Economic Area,
        the United Kingdom, Switzerland, or Canada, your data will be
        transferred to and processed in the US.
      </LegalP>
      <LegalP>
        For users in the EEA, UK, and Switzerland, we rely on Standard
        Contractual Clauses (SCCs) and the EU-US Data Privacy Framework where
        our sub-processors participate. You retain all rights granted by GDPR
        Articles 12-23, including:
      </LegalP>
      <LegalUL>
        <LegalLI>The right of access (Article 15).</LegalLI>
        <LegalLI>The right to rectification (Article 16).</LegalLI>
        <LegalLI>The right to erasure - {'"right to be forgotten"'} (Article 17).</LegalLI>
        <LegalLI>The right to restrict processing (Article 18).</LegalLI>
        <LegalLI>The right to data portability (Article 20).</LegalLI>
        <LegalLI>The right to object (Article 21).</LegalLI>
        <LegalLI>The right to withdraw consent at any time (Article 7(3)).</LegalLI>
        <LegalLI>The right to lodge a complaint with your supervisory authority.</LegalLI>
      </LegalUL>
      <LegalP>
        Our lawful basis for processing your account information is the
        performance of our contract with you (GDPR Article 6(1)(b)). Our
        lawful basis for processing your health data is your explicit consent
        (Article 9(2)(a)), which you give by logging the data and which you
        can withdraw at any time by deleting it.
      </LegalP>
      <LegalCitation>
        GDPR cross-border transfer language patterned on the Oura privacy
        policy and the EDPB&apos;s 2022 SCC implementation guidance.
      </LegalCitation>

      <LegalH2 id="children">8. Children</LegalH2>
      <LegalP>
        LanaeHealth is not intended for users under the age of 18. We do not
        knowingly collect data from children. If you believe a child has
        created an account, contact us at{' '}
        <a href="mailto:privacy@lanaehealth.com" style={{ color: 'var(--v2-accent-primary)' }}>
          privacy@lanaehealth.com
        </a>{' '}
        and we will delete the account.
      </LegalP>

      <LegalH2 id="changes">9. Changes to this policy</LegalH2>
      <LegalP>
        We will update this policy when our practices change. Material
        changes (new sub-processors, new categories of data collected, new
        purposes of processing) trigger an in-app notice and an email to
        the address on file at least 14 days before the change takes effect.
        Cosmetic edits, typo fixes, and re-organizations do not require
        notice. The {'"Last updated"'} date at the top of this page always
        reflects the most recent change.
      </LegalP>

      <LegalH2 id="contact">10. Contact</LegalH2>
      <LegalP>
        Privacy questions, data requests, complaints, or anything that needs
        a human:
      </LegalP>
      <LegalP>
        <a href="mailto:privacy@lanaehealth.com" style={{ color: 'var(--v2-accent-primary)' }}>
          privacy@lanaehealth.com
        </a>
      </LegalP>
      <LegalP>
        For EU users, you have the right to lodge a complaint with your
        national data protection authority. A list of authorities is
        maintained by the European Data Protection Board at edpb.europa.eu.
      </LegalP>
    </LegalPageShell>
  )
}
