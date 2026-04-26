/**
 * /v2/legal/terms
 *
 * Terms of Service for LanaeHealth. Standard SaaS template adapted
 * for a personal health record. The medical disclaimer (Section 4)
 * is the load-bearing clause and is rendered as a prominent
 * callout, not just a paragraph.
 *
 * Sources reviewed:
 *  - Standard SaaS ToS templates (Termly, Iubenda, Common Paper)
 *  - Bearable terms of service (medical disclaimer pattern)
 *  - Apple App Store Review Guidelines 5.1 (health/medical disclaimers)
 *  - Federal Arbitration Act for the dispute resolution clause
 *  - Delaware UCC for the limitation-of-liability cap
 *
 * Pure server component.
 */
import LegalPageShell, {
  LegalH2,
  LegalH3,
  LegalP,
  LegalUL,
  LegalLI,
  LegalCitation,
  LegalCallout,
} from '../_components/LegalPageShell'

export const metadata = {
  title: 'Terms of Service - LanaeHealth',
  description: 'The agreement between you and LanaeHealth.',
}

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated="April 25, 2026">
      <LegalP>
        These Terms of Service ({'"Terms"'}) form a binding agreement between
        you and LanaeHealth ({'"we"'}, {'"us"'}, {'"our"'}). By creating an
        account or otherwise using the LanaeHealth web application, mobile
        experience, or any related service (the {'"Service"'}), you agree to
        these Terms. If you do not agree, do not use the Service.
      </LegalP>

      <LegalH2 id="acceptance">1. Acceptance of terms</LegalH2>
      <LegalP>
        You accept these Terms by clicking {'"Create account"'}, by signing
        in with Apple, Google, or a passkey, or by otherwise accessing the
        Service. If you are accepting on behalf of an organization, you
        represent that you have authority to bind that organization, and
        {' '}{'"you"'} refers to that organization.
      </LegalP>
      <LegalP>
        We may update these Terms from time to time. Material changes will
        be announced inside the app and emailed to the address on file at
        least 14 days before they take effect. Your continued use of the
        Service after the effective date is acceptance of the new Terms. If
        you do not agree, you may delete your account.
      </LegalP>

      <LegalH2 id="eligibility">2. Eligibility</LegalH2>
      <LegalP>
        You may only use the Service if you are:
      </LegalP>
      <LegalUL>
        <LegalLI>At least 18 years old, and</LegalLI>
        <LegalLI>A resident of the United States.</LegalLI>
      </LegalUL>
      <LegalP>
        We do not currently support international users for purposes of
        purchase or paid features. If you access the Service from outside the
        United States, you do so on your own initiative and are responsible
        for compliance with local law. See the Privacy Policy for our GDPR
        obligations to EEA users who reach the service.
      </LegalP>
      <LegalP>
        The Service is not a substitute for emergency care. If you are
        having a medical emergency, call 911 or your local emergency number
        immediately.
      </LegalP>

      <LegalH2 id="account">3. Your account</LegalH2>
      <LegalUL>
        <LegalLI>
          You are responsible for safeguarding your sign-in credentials,
          including any passkeys registered with your device.
        </LegalLI>
        <LegalLI>
          You agree to provide accurate, current information at signup and to
          keep your account information up to date.
        </LegalLI>
        <LegalLI>
          You are responsible for all activity that occurs under your account.
          Notify us immediately at{' '}
          <a href="mailto:security@lanaehealth.com" style={{ color: 'var(--v2-accent-primary)' }}>
            security@lanaehealth.com
          </a>{' '}
          if you suspect your account has been compromised.
        </LegalLI>
        <LegalLI>
          You may not share your account, transfer it to another person, or
          create an account using false information.
        </LegalLI>
      </LegalUL>

      <LegalH2 id="medical-disclaimer">4. Medical disclaimer</LegalH2>

      <LegalCallout title="Important">
        <LegalP>
          <strong>
            LanaeHealth is not a medical device. It is not a substitute for
            professional medical advice, diagnosis, or treatment.
          </strong>
        </LegalP>
        <LegalP>
          The Service organizes information you log and surfaces patterns and
          AI-generated commentary about that information. None of the output
          is medical advice. Always seek the advice of a qualified physician
          or other health care provider with any questions you may have about
          a medical condition or before making any decision about your
          medications, treatment, diet, or care plan.
        </LegalP>
        <LegalP>
          Never disregard professional medical advice or delay seeking it
          because of something you read inside the Service.
        </LegalP>
        <LegalP>
          The Service is not approved by the United States Food and Drug
          Administration. It is not approved or cleared as contraception, as
          a fertility predictor, as a glucose monitor, as a diagnostic, or as
          any other regulated medical device. Do not use the Service to
          prevent or achieve pregnancy.
        </LegalP>
        <LegalP>
          The AI assistant can be wrong. It can hallucinate facts. It does
          not have your full medical history unless you have logged it. Use
          its output as a starting point for a conversation with your
          provider, never as a final answer.
        </LegalP>
      </LegalCallout>

      <LegalP>
        By using the Service you acknowledge and accept the limitations
        above. If you would like the Service to behave as a regulated
        medical device, you must wait until we have completed the relevant
        FDA pathway and updated this section to say so. Until that
        happens, the Service is a wellness tool and a personal record
        keeper, nothing more.
      </LegalP>
      <LegalCitation>
        Disclaimer pattern modeled on Bearable&apos;s terms of service
        ({'"Bearable is not intended to be a substitute for professional medical advice"'}),
        Apple App Store Review Guideline 5.1.1, and the FDA Software
        Precertification Program guidance for general wellness software.
      </LegalCitation>

      <LegalH2 id="acceptable-use">5. Acceptable use</LegalH2>
      <LegalP>You agree not to:</LegalP>
      <LegalUL>
        <LegalLI>
          Reverse engineer, decompile, or attempt to extract the source code
          of the Service, except as expressly permitted by law.
        </LegalLI>
        <LegalLI>
          Use the Service to harass, threaten, defame, or harm any other
          person.
        </LegalLI>
        <LegalLI>
          Upload content you do not have the right to upload (for example,
          another person&apos;s medical record without their consent).
        </LegalLI>
        <LegalLI>
          Probe, scan, or test the security of the Service without our
          written authorization. (We welcome good-faith security research.
          Email{' '}
          <a href="mailto:security@lanaehealth.com" style={{ color: 'var(--v2-accent-primary)' }}>
            security@lanaehealth.com
          </a>{' '}
          first.)
        </LegalLI>
        <LegalLI>
          Use automated tools to scrape, replicate, or load-test the Service
          beyond what a human user could plausibly generate.
        </LegalLI>
        <LegalLI>
          Use the Service to transmit malware, spam, or material that
          violates US law.
        </LegalLI>
        <LegalLI>
          Misrepresent the Service&apos;s output to a third party as
          professional medical advice.
        </LegalLI>
      </LegalUL>

      <LegalH2 id="ip">6. Intellectual property</LegalH2>
      <LegalH3>Your data</LegalH3>
      <LegalP>
        You retain ownership of all data you log into the Service. You
        grant us a worldwide, royalty-free license to host, copy, transmit,
        store, and display your data solely so we can provide the Service
        to you. This license terminates when you delete your account, with
        the exception of de-identified, aggregated statistics that contain
        no information about you personally.
      </LegalP>

      <LegalH3>Our service</LegalH3>
      <LegalP>
        The Service, its design, code, copy, and underlying intellectual
        property remain ours. We grant you a personal, non-transferable,
        non-exclusive license to use the Service for your own non-commercial
        health tracking. We reserve all rights not expressly granted.
      </LegalP>

      <LegalH3>Feedback</LegalH3>
      <LegalP>
        If you send us feedback or suggestions, we may use them without
        restriction or obligation.
      </LegalP>

      <LegalH2 id="termination">7. Termination</LegalH2>
      <LegalP>
        You may stop using the Service and delete your account at any time
        from Settings, then Account, then Delete account. Account deletion
        permanently removes your record within 30 days. Backups are purged
        on a 35-day rolling schedule.
      </LegalP>
      <LegalP>
        We may suspend or terminate your account if you violate these
        Terms, if your use of the Service exposes us or other users to
        legal or security risk, or if we are required to do so by law.
        Where the situation allows, we will give you advance notice and an
        opportunity to cure.
      </LegalP>
      <LegalP>
        Sections that by their nature should survive termination (4
        Medical disclaimer, 6 Intellectual property, 8 Liability limits, 9
        Disputes, 10 Governing law) survive.
      </LegalP>

      <LegalH2 id="warranty">8. Warranty disclaimer and liability limits</LegalH2>
      <LegalP>
        TO THE FULLEST EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED
        {' '}{'"AS IS"'} AND {'"AS AVAILABLE"'}, WITHOUT WARRANTIES OF ANY KIND,
        EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR THAT THE
        SERVICE WILL BE UNINTERRUPTED, ERROR FREE, OR FREE OF HARMFUL
        COMPONENTS.
      </LegalP>
      <LegalP>
        TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT WILL
        LANAEHEALTH OR ITS OFFICERS, EMPLOYEES, OR AGENTS BE LIABLE FOR
        ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
        DAMAGES, INCLUDING LOST PROFITS, LOST DATA, OR LOST GOODWILL,
        ARISING OUT OF OR IN CONNECTION WITH THE SERVICE, WHETHER UNDER
        CONTRACT, TORT, STRICT LIABILITY, OR ANY OTHER THEORY, EVEN IF WE
        HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
      </LegalP>
      <LegalP>
        OUR TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE IS
        LIMITED TO THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12
        MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED US DOLLARS
        ($100.00).
      </LegalP>
      <LegalP>
        SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF IMPLIED
        WARRANTIES OR LIMITATION OF CERTAIN DAMAGES, SO PARTS OF THE
        FOREGOING MAY NOT APPLY TO YOU. NOTHING IN THESE TERMS LIMITS
        LIABILITY FOR FRAUD, GROSS NEGLIGENCE, OR ANY OTHER LIABILITY
        THAT CANNOT BE EXCLUDED BY LAW.
      </LegalP>

      <LegalH2 id="indemnification">9. Indemnification</LegalH2>
      <LegalP>
        You agree to defend, indemnify, and hold harmless LanaeHealth and
        its officers, employees, and agents from and against any claims,
        damages, costs, and expenses (including reasonable attorneys&apos;
        fees) arising out of (a) your use of the Service in violation of
        these Terms or applicable law, or (b) content you submit to the
        Service that infringes a third party&apos;s rights.
      </LegalP>

      <LegalH2 id="disputes">10. Disputes and arbitration</LegalH2>
      <LegalP>
        <strong>Please read this section carefully. It affects your legal rights.</strong>
      </LegalP>
      <LegalP>
        Any dispute arising out of or relating to these Terms or the
        Service will first be resolved through good-faith informal
        negotiation. Either party may begin negotiation by sending written
        notice to the other party at the contact address in Section 12. If
        the dispute is not resolved within 60 days, either party may begin
        binding arbitration.
      </LegalP>
      <LegalP>
        Any arbitration will be conducted by the American Arbitration
        Association (AAA) under its Consumer Arbitration Rules. The
        arbitration will be conducted in English by a single arbitrator.
        The seat of the arbitration is Wilmington, Delaware. Each party
        bears its own costs except that we will pay the AAA filing fee for
        any consumer claim under $10,000.
      </LegalP>
      <LegalP>
        <strong>Class action waiver.</strong> Disputes will be brought on
        an individual basis only. You waive any right to bring or
        participate in a class, collective, or representative action.
      </LegalP>
      <LegalP>
        <strong>Opt-out.</strong> You may opt out of this arbitration
        agreement within 30 days of accepting these Terms by emailing{' '}
        <a href="mailto:legal@lanaehealth.com" style={{ color: 'var(--v2-accent-primary)' }}>
          legal@lanaehealth.com
        </a>{' '}
        with the subject line {'"Arbitration Opt-Out"'} and your account
        email. Opt-out has no other effect on your account.
      </LegalP>
      <LegalP>
        Notwithstanding the above, either party may seek emergency
        injunctive relief in any court of competent jurisdiction to
        protect intellectual property or confidential information.
      </LegalP>

      <LegalH2 id="governing-law">11. Governing law</LegalH2>
      <LegalP>
        These Terms are governed by the laws of the State of Delaware,
        without regard to its conflict of laws principles. The United
        Nations Convention on Contracts for the International Sale of
        Goods does not apply.
      </LegalP>
      <LegalP>
        Subject to the arbitration clause in Section 10, any court action
        permitted by these Terms shall be brought exclusively in the
        state or federal courts located in Wilmington, Delaware, and you
        consent to the personal jurisdiction of those courts.
      </LegalP>

      <LegalH2 id="contact">12. Contact and miscellaneous</LegalH2>
      <LegalP>
        Questions about these Terms:
      </LegalP>
      <LegalP>
        <a href="mailto:legal@lanaehealth.com" style={{ color: 'var(--v2-accent-primary)' }}>
          legal@lanaehealth.com
        </a>
      </LegalP>
      <LegalP>
        These Terms together with the Privacy Policy and Cookie Policy
        form the entire agreement between you and us regarding the
        Service. If any provision is held to be unenforceable, the
        remaining provisions remain in effect. Our failure to enforce a
        right is not a waiver of that right. You may not assign these
        Terms without our written consent; we may assign them to a
        successor in connection with a corporate transaction.
      </LegalP>
      <LegalCitation>
        Arbitration, class-action waiver, and 30-day opt-out structure are
        the standard pattern in current US consumer SaaS terms (e.g.
        Discord, Vercel, Linear). The Delaware governing-law and seat
        choice is also conventional for US-incorporated companies.
      </LegalCitation>
    </LegalPageShell>
  )
}
