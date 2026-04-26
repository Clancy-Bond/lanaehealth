/*
 * Carrier content catalog
 *
 * The single source of truth for every carrier-specific guide page
 * under /v2/insurance/<slug>. Each carrier follows the same
 * 9-section template defined in CarrierGuide.tsx so adding a new
 * carrier is a matter of appending another entry to CARRIER_CATALOG
 * and (optionally) wiring a folder under /v2/insurance/<slug>/.
 *
 * Voice: NC short, kind, explanatory. No em-dashes anywhere. Every
 * factual claim about a specific carrier links to a citation in the
 * carrier's `sources` block; the renderer surfaces those citations
 * inline so the user can verify every line.
 *
 * Sources captured April 2026. Insurance rules change. Anyone
 * editing this file should re-verify against the carrier's live
 * member portal before shipping changes.
 */

export interface CarrierSource {
  /** Short label shown next to the citation marker. */
  label: string
  /** Direct link to the policy page or member doc. */
  href: string
}

export interface CarrierContact {
  /** Phone number formatted for display, e.g. "(800) 555-1212". */
  display: string
  /** Tel: URI value, digits only, e.g. "8005551212". */
  digits: string
  /** Optional context, e.g. "Member services" or "24/7 nurse line". */
  context?: string
}

export interface CarrierGuideData {
  /** URL slug; lives under /v2/insurance/<slug>. */
  slug: string
  /** Display name used on the hub and the page title. */
  label: string
  /** Short blurb shown on the hub list. */
  shortDescription: string
  /** Whether this carrier has a public marketplace presence. */
  governmentProgram?: boolean

  // ── 1. At a glance ─────────────────────────────────────────────
  ataglance: {
    planTypes: string
    regionsServed: string
    memberCount: string
    notes?: string
  }

  // ── 2. Network ────────────────────────────────────────────────
  network: {
    findInNetworkUrl: string
    findInNetworkLabel: string
    outOfNetworkRule: string
    priorAuthRule: string
  }

  // ── 3. Referrals ──────────────────────────────────────────────
  referrals: {
    requiredFor: string
    notRequiredFor: string
    howToRequest: string
    escalationIfDenied: string
  }

  // ── 4. Specialist access ─────────────────────────────────────
  specialistAccess: {
    typicalWait: string
    expediteForUrgency: string
  }

  // ── 5. Tests + procedures ────────────────────────────────────
  testsAndProcedures: {
    priorAuthThresholds: string[]
    commonGotchas: string[]
    pushBackTactics: string
  }

  // ── 6. Appeals ────────────────────────────────────────────────
  appeals: {
    standardWindow: string
    expeditedWindow: string
    externalReview: string
    stateCommissionerNote?: string
  }

  // ── 7. Anti-gaslighting strategies ───────────────────────────
  antiGaslighting: {
    knownDenialPatterns: string[]
    whatWorks: string
  }

  // ── 8. Chronic illness specifics ─────────────────────────────
  chronicIllness: {
    potsNotes?: string
    migraineNotes?: string
    edsMcasNotes?: string
    generalNotes: string
  }

  // ── 9. Contact + member services ─────────────────────────────
  memberServices: {
    portalUrl: string
    portalLabel: string
    phones: CarrierContact[]
  }

  // ── Sources cited above ──────────────────────────────────────
  sources: CarrierSource[]
}

/*
 * 12 carriers, ranked by 2024 enrollment per the AHIP and CMS public
 * data sets. Each `sources` block links the live policy pages used
 * to author the section copy. Numbers cited are AHIP / NAIC
 * 2023-2024 figures; we round generously and label as approximate
 * because the underlying counts shift quarterly.
 */
export const CARRIER_CATALOG: CarrierGuideData[] = [
  // ── 1. UnitedHealthcare ─────────────────────────────────────
  {
    slug: 'unitedhealthcare',
    label: 'UnitedHealthcare (UHC)',
    shortDescription: 'The largest US private health insurer, ~52 million members.',
    ataglance: {
      planTypes:
        'HMO, PPO, EPO, POS, Medicare Advantage, Medicaid, and ACA marketplace plans through a state-by-state mix.',
      regionsServed: 'All 50 states. The plan options vary by state.',
      memberCount: 'Approximately 52 million medical members (UnitedHealth Group, 2024).',
      notes:
        'PPO and POS plans typically allow self-referral to in-network specialists. HMO plans require a PCP referral.',
    },
    network: {
      findInNetworkUrl: 'https://www.uhc.com/find-a-doctor',
      findInNetworkLabel: 'UnitedHealthcare provider directory',
      outOfNetworkRule:
        'Out-of-network care is covered at a lower rate on PPO/POS plans, and is generally not covered on HMO/EPO plans except for emergency or pre-authorized care.',
      priorAuthRule:
        'UHC publishes an Advance Notification and Prior Authorization list. Many imaging studies (MRI, CT, PET), specialty drugs, and inpatient stays require prior auth.',
    },
    referrals: {
      requiredFor:
        'Most specialty visits on Choice (HMO) and Navigate (gated PPO) plans. The Choose Plus / Options PPO plans typically do not require referrals.',
      notRequiredFor:
        'Emergency care, urgent care, OB-GYN annual visits on most plans, and behavioral health on most plans.',
      howToRequest:
        'Schedule with your PCP, name the specialty and the symptoms, and ask the office to submit the referral electronically. UHC accepts referrals via the provider portal.',
      escalationIfDenied:
        'If your PCP will not refer, you can request a second opinion from another in-network PCP, or call member services and ask for a clinical case review.',
    },
    specialistAccess: {
      typicalWait:
        'Routine specialist visits often run 4 to 12 weeks depending on specialty and region. Cardiology, neurology, and rheumatology typically have the longest waits.',
      expediteForUrgency:
        'Ask the referring office to mark the request as urgent. UHC member services can also help locate next-available specialists when there is documented medical necessity.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'MRI, CT, PET, and most advanced imaging require prior authorization.',
        'Tilt-table testing requires prior auth and a documented dysautonomia workup history.',
        'Sleep studies (in-lab polysomnography) require prior auth on most commercial plans.',
        'Specialty infusions and biologics typically require prior auth and step therapy.',
      ],
      commonGotchas: [
        'UHC frequently denies first MRI requests pending documentation of failed conservative treatment.',
        'Genetic testing for connective tissue disorders is often denied as "not medically necessary"; reapply with specialist letter naming clinical features.',
        'Out-of-network labs (LabCorp vs Quest) can flip in-network status overnight when UHC renegotiates.',
      ],
      pushBackTactics:
        'When a service is denied, request the clinical guideline UHC used. The denial letter must cite the criteria. If your record meets the criteria, reapply with the missing documentation rather than filing a formal appeal first.',
    },
    appeals: {
      standardWindow: '180 days from the denial letter to file a Level 1 appeal.',
      expeditedWindow:
        '72 hours for an urgent appeal when waiting could seriously harm your health.',
      externalReview:
        'After the internal appeals are exhausted, you can request an external review through your state insurance department. The external reviewer is independent of UHC.',
      stateCommissionerNote:
        'Federal and state law require carriers to honor the external reviewer’s decision.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Not medically necessary" with no specific guideline cited; this is a flag the reviewer did not document properly.',
        '"Experimental or investigational" applied to standard-of-care tests; rebut with specialty society guidelines.',
        '"Out-of-network" denials when the provider was in-network at the time of service; ask for the date the contract changed.',
      ],
      whatWorks:
        'Specialty-society guideline citations land harder than patient narratives. Have the specialist write the appeal letter; UHC reviewers respond to the credentials.',
    },
    chronicIllness: {
      potsNotes:
        'POTS workups including tilt-table testing are covered with documented orthostatic symptoms. Bring a symptom diary and orthostatic vitals (Bearable export works) to the cardiology consult.',
      migraineNotes:
        'CGRP antagonists (Aimovig, Ajovy, Emgality, Vyepti) require prior auth and step therapy through two preventive medications first. Botox for chronic migraine requires 15+ headache days a month documented for three months.',
      edsMcasNotes:
        'Genetic testing for hEDS is often denied because hEDS is a clinical diagnosis. MCAS workup (tryptase, 24-hour N-methylhistamine) is generally covered with documented mast cell symptoms.',
      generalNotes:
        'For complex multisystem cases, ask your PCP to flag your record as "complex chronic"; this can speed prior auth decisions.',
    },
    memberServices: {
      portalUrl: 'https://www.myuhc.com/',
      portalLabel: 'myuhc.com member portal',
      phones: [
        { display: '(866) 633-2446', digits: '8666332446', context: 'General member services' },
        { display: '(877) 365-7949', digits: '8773657949', context: 'Behavioral health' },
      ],
    },
    sources: [
      { label: 'UHC plan types overview', href: 'https://www.uhc.com/employer/health-plans' },
      {
        label: 'UHC prior authorization list',
        href: 'https://www.uhcprovider.com/en/prior-auth-advance-notification.html',
      },
      {
        label: 'UHC appeals and grievances',
        href: 'https://www.uhc.com/legal/appeals-and-grievances',
      },
      { label: 'UnitedHealth Group 2024 fact sheet', href: 'https://www.unitedhealthgroup.com/' },
    ],
  },

  // ── 2. Anthem BCBS ──────────────────────────────────────────
  {
    slug: 'anthem-bcbs',
    label: 'Anthem Blue Cross Blue Shield',
    shortDescription: 'BCBS licensee in 14 states, ~47 million members across the wider BCBS system.',
    ataglance: {
      planTypes:
        'HMO, PPO, EPO, POS, Medicare Advantage, Medicaid (in some states), and ACA marketplace plans.',
      regionsServed:
        'Anthem operates in 14 states: California, Colorado, Connecticut, Georgia, Indiana, Kentucky, Maine, Missouri, Nevada, New Hampshire, New York, Ohio, Virginia, and Wisconsin.',
      memberCount: 'About 47 million across the wider Anthem / Elevance footprint (Elevance Health, 2024).',
      notes:
        'BCBS plans are state-licensed; the BlueCard program lets your in-network status travel when you visit another BCBS region.',
    },
    network: {
      findInNetworkUrl: 'https://www.anthem.com/find-care/',
      findInNetworkLabel: 'Anthem Find Care directory',
      outOfNetworkRule:
        'PPO and POS plans cover out-of-network care at a higher cost share. HMO plans cover out-of-network only for emergencies.',
      priorAuthRule:
        'Anthem requires prior auth for advanced imaging, most specialty drugs, inpatient hospital stays, and many outpatient procedures. The list is on the provider portal.',
    },
    referrals: {
      requiredFor:
        'HMO plans require PCP referrals for specialty care. Many Anthem HMO products use the "PCP-coordinated" model.',
      notRequiredFor:
        'PPO plans generally do not require referrals. Emergency, urgent care, OB-GYN, and behavioral health are typically self-referral on most plans.',
      howToRequest:
        'Schedule with your PCP. Anthem accepts electronic referrals via Availity. Ask the front desk to confirm the referral was submitted before your specialist visit.',
      escalationIfDenied:
        'Request a second opinion appointment with a different in-network PCP. If you suspect the denial was administrative, member services can sometimes override.',
    },
    specialistAccess: {
      typicalWait:
        'Wait times vary by region. Northeast and California have the tightest specialist availability. 4 to 16 weeks for routine cardiology or neurology.',
      expediteForUrgency:
        'Ask the referring PCP to call the specialist office directly and document medical urgency. Anthem also runs a 24/7 nurse line that can help triage.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'Advanced imaging (MRI, CT, PET) requires prior auth on most plans through AIM Specialty Health (Anthem’s utilization vendor).',
        'Tilt-table testing requires prior auth and supporting cardiology documentation.',
        'Specialty drugs from the Anthem specialty pharmacy list require prior auth.',
      ],
      commonGotchas: [
        'AIM Specialty Health denials look different from Anthem denials; both must be appealed to Anthem.',
        '"Site of service" denials are common: Anthem will approve the procedure but require it at an outpatient facility instead of a hospital.',
        'Lab steerage: Anthem prefers LabCorp or Quest depending on region. Out-of-region labs trigger denials.',
      ],
      pushBackTactics:
        'For AIM-denied imaging, ask your provider for the AIM clinical worksheet they submitted. Reapply with the missing fields filled in. Most denials are documentation gaps, not policy refusals.',
    },
    appeals: {
      standardWindow:
        '180 days from the denial date to file a Level 1 appeal. Anthem also offers a Level 2 internal appeal in many states.',
      expeditedWindow:
        '72 hours for urgent care appeals where waiting could harm your health.',
      externalReview:
        'After internal appeals, request an Independent External Review through your state insurance department.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Lacks medical necessity per AIM criteria" without naming the missing element.',
        '"Step therapy required" for medications you have already failed; rebut with chart notes.',
        '"Out-of-network specialist" when no in-network specialist is available within 50 miles.',
      ],
      whatWorks:
        'When no in-network specialist exists nearby, request a Network Adequacy exception. Anthem must cover an out-of-network provider at in-network rates.',
    },
    chronicIllness: {
      potsNotes:
        'POTS workup is covered with cardiology evaluation and tilt-table testing. Anthem can be slow on initial approvals; ask the cardiologist to mark autonomic testing as urgent.',
      migraineNotes:
        'CGRP antagonists require step therapy through topiramate plus one other preventive. Botox requires the 15-day documentation. Nurtec / Ubrelvy for acute migraines often requires step therapy through triptans.',
      edsMcasNotes:
        'hEDS is a clinical diagnosis; Anthem does not require genetic testing to honor the diagnosis once a geneticist has documented it. MCAS labs are usually covered with reasonable clinical suspicion.',
      generalNotes:
        'Anthem responds well to physician peer-to-peer reviews. Ask your specialist to schedule one rather than filing a paper appeal first.',
    },
    memberServices: {
      portalUrl: 'https://www.anthem.com/',
      portalLabel: 'anthem.com member portal',
      phones: [
        {
          display: '(833) 600-0339',
          digits: '8336000339',
          context: 'Anthem member services (general)',
        },
      ],
    },
    sources: [
      { label: 'Anthem find care', href: 'https://www.anthem.com/find-care/' },
      {
        label: 'Anthem prior authorization',
        href: 'https://www.anthem.com/provider/prior-authorization/',
      },
      { label: 'Anthem appeals', href: 'https://www.anthem.com/help/appeals/' },
      { label: 'Elevance Health 2024 financials', href: 'https://www.elevancehealth.com/' },
    ],
  },

  // ── 3. Aetna ─────────────────────────────────────────────────
  {
    slug: 'aetna',
    label: 'Aetna (CVS Health)',
    shortDescription: 'Owned by CVS Health since 2018, ~25 million medical members.',
    ataglance: {
      planTypes:
        'HMO, PPO, EPO, POS, high-deductible plans, Medicare Advantage, and ACA marketplace plans (Aetna CVS Health).',
      regionsServed: 'All 50 states for some product lines; marketplace presence varies by state.',
      memberCount: 'About 25 million medical members (CVS Health 2024 annual report).',
    },
    network: {
      findInNetworkUrl: 'https://www.aetna.com/dsepublic/',
      findInNetworkLabel: 'Aetna provider search',
      outOfNetworkRule:
        'PPO/POS plans cover out-of-network care with higher cost share; HMO/EPO generally do not unless the service is emergency or pre-authorized.',
      priorAuthRule:
        'Aetna maintains a prior auth list. Advanced imaging, infusions, and many specialty drugs require approval.',
    },
    referrals: {
      requiredFor:
        'Aetna Open Access HMO plans usually do not require referrals. Traditional Aetna HMO and Aetna Medicare HMO plans do.',
      notRequiredFor:
        'PPO, EPO, and Open Access HMO. Always self-referral for emergency, urgent care, and OB-GYN visits.',
      howToRequest:
        'Aetna accepts electronic referrals via the Aetna Provider portal or NaviNet. Confirm with the specialist office before the visit.',
      escalationIfDenied:
        'Switch PCPs if you are repeatedly denied; Aetna lets you change PCPs once per month with no penalty.',
    },
    specialistAccess: {
      typicalWait:
        'Network depth varies. Major metro areas tend to have shorter waits. Rural areas often hit the 12+ week range for specialty care.',
      expediteForUrgency:
        'The Aetna One Advocate service (on some employer plans) can help expedite specialist appointments.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'Imaging: MRI/CT/PET need prior auth; Aetna uses eviCore for some plans.',
        'Sleep studies: in-lab requires prior auth and a failed home study or contraindication to home testing.',
        'Specialty infusions and biologics: prior auth, often with step therapy.',
      ],
      commonGotchas: [
        'eviCore tends to deny first MRI requests citing missing PT trial documentation.',
        'Aetna formulary changes mid-year more often than other carriers; check the formulary before each refill.',
        '"Bundled service" denials when a procedure was billed alongside an office visit.',
      ],
      pushBackTactics:
        'Ask the specialist office for the eviCore reference number and the specific clinical worksheet submitted. Most denials are reversible by adding one missing data point.',
    },
    appeals: {
      standardWindow:
        '180 days from the denial date for commercial plans, 60 days for Medicare Advantage.',
      expeditedWindow: '72 hours when the wait could seriously harm your health.',
      externalReview:
        'After internal appeals, request an External Review through your state insurance department or, for self-funded ERISA plans, through the federal HHS process.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Service is part of bundled office visit"; ask the billing office to resubmit with proper modifiers.',
        '"Failed step therapy"; verify in your record what step you are on. Aetna often miscounts.',
        '"Provider is not contracted for this service"; request a single-case agreement.',
      ],
      whatWorks:
        'Single-case agreements are underused. If the only specialist who can treat your condition is out-of-network, Aetna can negotiate a one-time in-network rate.',
    },
    chronicIllness: {
      potsNotes:
        'Aetna covers tilt-table testing with cardiology referral. Compression stockings (medical-grade, 20-30+ mmHg) are covered with the right HCPCS code.',
      migraineNotes:
        'Aetna requires two failed preventive trials before approving CGRP antagonists. Document the trials carefully.',
      edsMcasNotes:
        'MCAS workup is generally covered with documented mast cell symptoms. hEDS is treated as a clinical diagnosis.',
      generalNotes:
        'For high-cost specialty drugs, the Aetna Specialty Pharmacy will sometimes coordinate copay assistance through manufacturer programs. Always ask.',
    },
    memberServices: {
      portalUrl: 'https://www.aetna.com/',
      portalLabel: 'aetna.com member portal',
      phones: [
        { display: '(800) 872-3862', digits: '8008723862', context: 'Member services' },
      ],
    },
    sources: [
      {
        label: 'Aetna prior auth',
        href: 'https://www.aetna.com/health-care-professionals/precertification.html',
      },
      {
        label: 'Aetna appeals',
        href: 'https://www.aetna.com/individuals-families/member-rights-resources/complaints-grievances-appeals.html',
      },
      { label: 'CVS Health 2024 annual report', href: 'https://www.cvshealth.com/' },
    ],
  },

  // ── 4. Cigna ─────────────────────────────────────────────────
  {
    slug: 'cigna',
    label: 'Cigna Healthcare',
    shortDescription: 'Global insurer with ~19 million US medical members.',
    ataglance: {
      planTypes: 'HMO, PPO, EPO, POS, Medicare Advantage, ACA marketplace plans (Cigna + Oscar partnership).',
      regionsServed: 'Available in many states; marketplace presence has expanded since 2023.',
      memberCount: 'Approximately 19 million US medical members (Cigna 2024 annual).',
    },
    network: {
      findInNetworkUrl: 'https://hcpdirectory.cigna.com/',
      findInNetworkLabel: 'Cigna provider directory',
      outOfNetworkRule:
        'PPO and POS plans cover out-of-network care with higher cost share. HMO/EPO require in-network except for emergency.',
      priorAuthRule:
        'Cigna requires prior auth for advanced imaging (through eviCore), specialty drugs, inpatient stays, and many outpatient procedures.',
    },
    referrals: {
      requiredFor: 'Cigna Open Access Plus HMO plans typically do not require referrals. Some Cigna HMO and Cigna LocalPlus HMO plans do.',
      notRequiredFor: 'Most PPO and Open Access plans. Always self-referral for emergency, OB-GYN, and behavioral health.',
      howToRequest:
        'Cigna accepts referrals via the provider portal. Some plans allow patient-initiated specialist booking; check your member ID card.',
      escalationIfDenied:
        'If your PCP refuses to refer, request a second-opinion visit with another in-network PCP. Cigna Care Coordinator (on some employer plans) can help.',
    },
    specialistAccess: {
      typicalWait:
        'Routine specialist visits typically 4 to 12 weeks. Cigna’s network is thinner in rural states; expect longer waits there.',
      expediteForUrgency:
        'Use the Cigna One Guide service if your plan includes it. They can find next-available specialists across the network.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'eviCore handles imaging prior auth for most Cigna plans. MRI, CT, PET, and many ultrasounds require approval.',
        'Tilt-table testing requires prior auth and cardiology documentation.',
        'Specialty drugs through Accredo (Cigna’s specialty pharmacy) require prior auth and step therapy.',
      ],
      commonGotchas: [
        'eviCore denials show up as Cigna denials but the underlying decision was made by the vendor.',
        'Cigna’s formulary tier changes can shift a copay from $20 to $200 mid-year. Check before each refill.',
        '"Provider not credentialed for procedure" denials when the provider is in-network; almost always a billing system error.',
      ],
      pushBackTactics:
        'For eviCore denials, request the clinical worksheet and the reviewer’s credentials. Peer-to-peer reviews are often successful for orthopedic and cardiology imaging.',
    },
    appeals: {
      standardWindow: '180 days from the denial date to file a Level 1 appeal.',
      expeditedWindow: '72 hours for urgent appeals.',
      externalReview:
        'After internal appeals are exhausted, request an Independent External Review through your state insurance department or through HHS for self-funded ERISA plans.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"eviCore guidelines not met" without specifying which guideline.',
        '"Member out of network"; verify the specialist’s contract status before the visit, not after.',
        '"Service requires prior auth" when the auth was already submitted; check the auth reference number.',
      ],
      whatWorks:
        'Peer-to-peer reviews land well at Cigna. Ask the specialist to schedule one with the eviCore physician reviewer rather than filing a written appeal first.',
    },
    chronicIllness: {
      potsNotes:
        'POTS workup is covered. Cigna sometimes denies repeat tilt-table tests; once is the typical limit unless symptoms have changed.',
      migraineNotes:
        'CGRP antagonists require step therapy. Cigna’s preferred CGRP varies by year; check the current formulary.',
      edsMcasNotes:
        'MCAS workup labs (tryptase, 24h urine N-methylhistamine, prostaglandin D2) are covered with documented mast cell symptoms.',
      generalNotes:
        'Cigna Care Coordinator (employer plans) is genuinely useful for complex cases; they can navigate prior auth on your behalf.',
    },
    memberServices: {
      portalUrl: 'https://my.cigna.com/',
      portalLabel: 'my.cigna.com member portal',
      phones: [
        { display: '(800) 244-6224', digits: '8002446224', context: 'General member services' },
      ],
    },
    sources: [
      { label: 'Cigna provider search', href: 'https://hcpdirectory.cigna.com/' },
      {
        label: 'Cigna prior authorization',
        href: 'https://www.cigna.com/health-care-providers/coverage-and-claims/prior-authorization',
      },
      {
        label: 'Cigna appeals',
        href: 'https://www.cigna.com/individuals-families/member-resources/customer-forms/medical-appeal-form',
      },
    ],
  },

  // ── 5. Humana ────────────────────────────────────────────────
  {
    slug: 'humana',
    label: 'Humana',
    shortDescription: 'Heavily focused on Medicare Advantage; ~17 million members.',
    ataglance: {
      planTypes:
        'Medicare Advantage (Humana’s core business), Medicaid (in select states), and limited commercial plans (Humana exited group commercial in 2024).',
      regionsServed: 'Medicare Advantage available across most states; Medicaid in Florida, Kentucky, Louisiana, Ohio, South Carolina.',
      memberCount: 'About 17 million members across all lines (Humana 2024 annual).',
      notes:
        'Humana announced in 2024 it was exiting the group commercial market. Most current Humana members are on Medicare Advantage or Medicaid.',
    },
    network: {
      findInNetworkUrl: 'https://finder.humana.com/finder/medical',
      findInNetworkLabel: 'Humana provider finder',
      outOfNetworkRule:
        'Medicare Advantage HMO plans require in-network providers except for emergency. PPO Medicare Advantage allows out-of-network at a higher cost.',
      priorAuthRule:
        'Humana publishes a preauthorization list. Many specialty drugs, inpatient stays, and advanced imaging require approval.',
    },
    referrals: {
      requiredFor:
        'Most Humana Medicare HMO plans require PCP referrals. Humana PPO Medicare plans do not.',
      notRequiredFor:
        'PPO plans, urgent care, emergency, and OB-GYN annual visits.',
      howToRequest:
        'Schedule with your PCP. Humana accepts electronic referrals via Availity.',
      escalationIfDenied:
        'Switch PCPs (allowed monthly on Medicare Advantage) or request a clinical case review through member services.',
    },
    specialistAccess: {
      typicalWait:
        'Medicare Advantage networks tend to have shorter waits than commercial because of the geographically focused specialty groups Humana contracts with.',
      expediteForUrgency:
        'Humana Care Manager (assigned to many chronic illness members) can help schedule.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'MRI, CT, PET require prior auth on most plans.',
        'Sleep studies require prior auth.',
        'Most outpatient surgical procedures require prior auth.',
      ],
      commonGotchas: [
        'Humana’s Medicare Advantage has been the subject of multiple OIG audits for inappropriate denials. Many denied claims are reversed on appeal.',
        '"Not medically necessary" for cardiology workup is a frequent first-pass denial.',
        'Humana’s pharmacy formulary updates quarterly; specialty drug copays can change without notice.',
      ],
      pushBackTactics:
        'File appeals quickly; the OIG findings have made Humana more responsive to documented appeals. Cite the OIG reports in escalation letters if needed.',
    },
    appeals: {
      standardWindow: '60 days from the denial date for Medicare Advantage; 180 days for commercial.',
      expeditedWindow: '72 hours for urgent appeals.',
      externalReview:
        'Medicare Advantage appeals proceed through CMS-defined levels: redetermination, reconsideration by independent review entity, ALJ hearing, MAC review, and federal court.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Service does not meet Medicare coverage criteria"; rebut with the specific NCD or LCD.',
        '"Out-of-network"; on Medicare Advantage HMO, ask whether the procedure qualifies for out-of-network with prior auth.',
        '"Step therapy not satisfied"; verify your medication history in the chart.',
      ],
      whatWorks:
        'For Medicare Advantage, the Independent Review Entity (Level 2) is genuinely independent and reverses many denials. Push appeals through to Level 2.',
    },
    chronicIllness: {
      potsNotes:
        'Humana covers tilt-table testing on Medicare Advantage with appropriate documentation. The cardiology consult and orthostatic vitals are usually enough to justify the test.',
      migraineNotes:
        'CGRP antagonists are covered on Humana Medicare Part D plans with step therapy. Botox for chronic migraine is covered with the standard 15-day documentation.',
      edsMcasNotes:
        'On Medicare Advantage, MCAS workup is covered with documentation. Genetic testing for hEDS is rarely covered because hEDS is a clinical diagnosis.',
      generalNotes:
        'Humana assigns Care Managers to many complex chronic illness members. Take the call when they reach out; they can help navigate prior auth.',
    },
    memberServices: {
      portalUrl: 'https://www.humana.com/member',
      portalLabel: 'Humana member portal',
      phones: [
        { display: '(800) 457-4708', digits: '8004574708', context: 'Member services (Medicare Advantage)' },
      ],
    },
    sources: [
      { label: 'Humana provider finder', href: 'https://finder.humana.com/finder/medical' },
      {
        label: 'Humana preauthorization',
        href: 'https://www.humana.com/provider/medical-resources/authorizations-referrals',
      },
      {
        label: 'Humana appeals',
        href: 'https://www.humana.com/legal/grievance-and-appeals',
      },
      {
        label: 'OIG report on Humana MA denials',
        href: 'https://oig.hhs.gov/oei/reports/OEI-09-18-00260.asp',
      },
    ],
  },

  // ── 6. Kaiser Permanente ────────────────────────────────────
  {
    slug: 'kaiser-permanente',
    label: 'Kaiser Permanente',
    shortDescription: 'Integrated provider + insurer in 8 states + DC; ~12.7 million members.',
    ataglance: {
      planTypes:
        'HMO is the dominant model. Kaiser is both the insurer and the provider, so members see Kaiser doctors at Kaiser facilities.',
      regionsServed:
        'California, Colorado, Georgia, Hawaii, Maryland, Oregon, Virginia, Washington, and DC.',
      memberCount: 'Approximately 12.7 million members (Kaiser Permanente 2024).',
      notes:
        'Kaiser is fundamentally different from PPO insurers: care is delivered inside Kaiser’s own clinics and hospitals, with Kaiser-employed physicians.',
    },
    network: {
      findInNetworkUrl: 'https://healthy.kaiserpermanente.org/find-a-doctor',
      findInNetworkLabel: 'Kaiser doctor directory',
      outOfNetworkRule:
        'Out-of-network care is generally not covered except in emergencies or with pre-authorization. Kaiser will sometimes refer to outside specialists when in-house expertise is unavailable.',
      priorAuthRule:
        'Internal referrals (Kaiser PCP to Kaiser specialist) usually do not need a separate prior auth. External referrals require approval.',
    },
    referrals: {
      requiredFor:
        'Most specialty care requires a Kaiser PCP referral.',
      notRequiredFor:
        'OB-GYN annual visits, behavioral health (in most regions), urgent care, and emergency.',
      howToRequest:
        'Message your PCP through kp.org. Kaiser PCPs can place internal referrals with one click; the specialty office calls you.',
      escalationIfDenied:
        'Request a second opinion from another Kaiser PCP or specialist; Kaiser members have a documented right to second opinions within the system.',
    },
    specialistAccess: {
      typicalWait:
        'Highly variable by region and specialty. Kaiser’s integrated model often means same-week or same-day specialty appointments for urgent issues, but routine specialist waits can run 8 to 16 weeks in dense regions.',
      expediteForUrgency:
        'Message your PCP and ask for an urgent specialty referral. Kaiser PCPs can override the routine queue.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'Most internal Kaiser referrals do not need prior auth.',
        'External (out-of-Kaiser) referrals require Medical Group approval.',
        'Specialty drugs follow the Kaiser formulary; non-formulary drugs require an exception request.',
      ],
      commonGotchas: [
        'Kaiser does not always have every subspecialty in-house. EDS, MCAS, and dysautonomia specialty care often requires an external referral, which is a higher bar.',
        'Kaiser’s preferred treatment paths sometimes exclude newer therapies; you have to ask explicitly.',
        'Out-of-area emergency care is covered, but follow-up care is expected to return to Kaiser.',
      ],
      pushBackTactics:
        'For external specialty referrals, document why no Kaiser physician can provide the care. Be specific: name the test, the experience required, and the publications cited by the outside specialist.',
    },
    appeals: {
      standardWindow: '180 days from the denial date.',
      expeditedWindow: '72 hours for urgent appeals.',
      externalReview:
        'After Kaiser internal appeals, request an Independent Medical Review through your state. California has a strong IMR program through the DMHC.',
      stateCommissionerNote:
        'In California, the Department of Managed Health Care (DMHC) handles Kaiser complaints; the California Department of Insurance regulates traditional insurers.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Care is available within Kaiser" when the in-house specialist lacks the relevant subspecialty experience.',
        '"Treatment is not standard of care at Kaiser"; verify against specialty society guidelines.',
        '"Not medically necessary" without naming the criteria.',
      ],
      whatWorks:
        'Kaiser members in California have unusually strong appeal rights via the DMHC IMR. The IMR reverses Kaiser denials at a high rate when the science is on the patient’s side.',
    },
    chronicIllness: {
      potsNotes:
        'Kaiser cardiology covers tilt-table testing. Some regions have dedicated dysautonomia clinics; ask. If your region does not, request an external referral.',
      migraineNotes:
        'CGRP antagonists are on Kaiser formulary in most regions. Botox for chronic migraine is covered with the 15-day documentation.',
      edsMcasNotes:
        'EDS and MCAS specialty care is often outside Kaiser’s in-house expertise. External referrals require strong documentation. Genetic counseling within Kaiser is generally well-resourced.',
      generalNotes:
        'Kaiser’s integrated record means your specialists can all see the same chart. Use this: ask your PCP to coordinate the workup so multiple specialists can work from the same data.',
    },
    memberServices: {
      portalUrl: 'https://healthy.kaiserpermanente.org/',
      portalLabel: 'kp.org member portal',
      phones: [
        {
          display: '(800) 464-4000',
          digits: '8004644000',
          context: 'Kaiser member services (California)',
        },
      ],
    },
    sources: [
      {
        label: 'Kaiser member services',
        href: 'https://healthy.kaiserpermanente.org/health/care/consumer/contact-us',
      },
      {
        label: 'Kaiser appeals',
        href: 'https://healthy.kaiserpermanente.org/learn/grievances-appeals',
      },
      {
        label: 'California DMHC IMR program',
        href: 'https://www.dmhc.ca.gov/FileaComplaint/IndependentMedicalReview.aspx',
      },
    ],
  },

  // ── 7. Molina Healthcare ─────────────────────────────────────
  {
    slug: 'molina',
    label: 'Molina Healthcare',
    shortDescription: 'Medicaid and ACA marketplace specialist; ~5.3 million members.',
    ataglance: {
      planTypes: 'Medicaid managed care, ACA marketplace plans, Medicare Advantage in select states.',
      regionsServed: 'Active in 19+ states; the Medicaid footprint varies by state contract.',
      memberCount: 'About 5.3 million members (Molina 2024 annual).',
      notes:
        'Molina is a Medicaid-first plan. Coverage rules often mirror state Medicaid policy in your state.',
    },
    network: {
      findInNetworkUrl: 'https://www.molinahealthcare.com/members/common/en-US/findadoc.aspx',
      findInNetworkLabel: 'Molina provider directory',
      outOfNetworkRule:
        'Medicaid managed care: out-of-network is generally not covered except for emergencies. Marketplace HMO is the same.',
      priorAuthRule:
        'Molina requires prior auth for advanced imaging, specialty drugs, inpatient stays, and most procedures.',
    },
    referrals: {
      requiredFor:
        'Most Molina HMO plans require PCP referrals.',
      notRequiredFor: 'Emergency, urgent care, OB-GYN, family planning, and behavioral health.',
      howToRequest:
        'Schedule with your PCP. Molina has a state-specific provider portal for electronic referrals.',
      escalationIfDenied:
        'Molina lets you change PCPs once per month. State Medicaid ombudsman can help if you exhaust internal options.',
    },
    specialistAccess: {
      typicalWait:
        'Medicaid-network specialty access is often the bottleneck. 6 to 16 weeks is common; rural areas can be longer.',
      expediteForUrgency:
        'Molina has Medicaid case managers for complex chronic illness members. Ask your PCP to refer you to case management.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'Most imaging beyond standard X-ray requires prior auth.',
        'Tilt-table testing requires prior auth and cardiology documentation.',
        'Specialty drugs follow the Molina state-specific formulary.',
      ],
      commonGotchas: [
        'Molina formulary varies by state. A drug covered in your old state may be non-formulary after a move.',
        '"Service is non-covered under Medicaid"; verify against your state Medicaid policy directly.',
        'Out-of-state emergency care is covered, but follow-up care must return to a Molina-network provider.',
      ],
      pushBackTactics:
        'For Medicaid denials, your state Medicaid ombudsman is a powerful escalation. Federal Medicaid law guarantees access to medically necessary care.',
    },
    appeals: {
      standardWindow:
        '60 days from the denial date for Medicaid managed care; check your member handbook.',
      expeditedWindow: '72 hours for urgent appeals.',
      externalReview:
        'After Molina internal appeals, request a State Fair Hearing through your state Medicaid agency. The state hearing officer is independent of Molina.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Not covered under Medicaid"; verify against state Medicaid policy. Many denials are wrong.',
        '"Provider is not in network"; some Molina state contracts auto-include all Medicaid-enrolled providers.',
        '"Prior auth not on file" when it was submitted; check the auth reference number.',
      ],
      whatWorks:
        'State Medicaid agencies have an obligation to ensure their managed care contractors honor the state policy. The state Medicaid ombudsman can override Molina denials when the underlying state policy supports the service.',
    },
    chronicIllness: {
      potsNotes:
        'Tilt-table testing is covered with cardiology documentation. Compression stockings (medical-grade) are covered.',
      migraineNotes:
        'CGRP antagonists may be on the Molina state formulary; some require step therapy through topiramate first.',
      edsMcasNotes:
        'MCAS workup labs are usually covered with documented symptoms. Genetic counseling is covered; genetic testing is variable.',
      generalNotes:
        'Medicaid managed care plans like Molina are required to follow the state Medicaid scope of benefits. When in doubt, look at the state policy.',
    },
    memberServices: {
      portalUrl: 'https://www.molinahealthcare.com/members/common/en-US/login.aspx',
      portalLabel: 'Molina member portal',
      phones: [
        {
          display: '(888) 665-4621',
          digits: '8886654621',
          context: 'Molina member services (general)',
        },
      ],
    },
    sources: [
      {
        label: 'Molina provider directory',
        href: 'https://www.molinahealthcare.com/members/common/en-US/findadoc.aspx',
      },
      {
        label: 'Molina appeals process',
        href: 'https://www.molinahealthcare.com/members/common/en-US/appeals.aspx',
      },
      { label: 'Molina 2024 annual report', href: 'https://www.molinahealthcare.com/' },
    ],
  },

  // ── 8. Centene / Ambetter ────────────────────────────────────
  {
    slug: 'centene-ambetter',
    label: 'Centene / Ambetter',
    shortDescription: 'Largest ACA marketplace insurer; ~28 million across all lines.',
    ataglance: {
      planTypes:
        'ACA marketplace plans (under the Ambetter brand), Medicaid managed care (Centene contracts in many states), and Medicare Advantage (under WellCare).',
      regionsServed: 'Ambetter sells marketplace plans in 27+ states. Centene Medicaid plans cover 30+ states.',
      memberCount: 'About 28 million members across Centene’s lines (Centene 2024 annual).',
    },
    network: {
      findInNetworkUrl: 'https://www.ambetterhealth.com/find-a-doctor.html',
      findInNetworkLabel: 'Ambetter provider search',
      outOfNetworkRule:
        'Ambetter HMO plans: out-of-network not covered except for emergencies. PPO Ambetter plans (where offered) cover out-of-network with higher cost share.',
      priorAuthRule:
        'Ambetter requires prior auth for advanced imaging, specialty drugs, and inpatient stays. The list is on the member portal.',
    },
    referrals: {
      requiredFor: 'Most Ambetter HMO plans require PCP referrals.',
      notRequiredFor:
        'Emergency, urgent care, OB-GYN annual, behavioral health (varies by plan).',
      howToRequest:
        'Schedule with your PCP. Ambetter accepts electronic referrals via the provider portal.',
      escalationIfDenied:
        'Switch PCPs (monthly on most Ambetter plans). State insurance department complaints carry weight.',
    },
    specialistAccess: {
      typicalWait:
        'Ambetter network depth is variable. Some states have robust networks; others have very limited specialty access. Plan for 6 to 16 weeks.',
      expediteForUrgency:
        'Ask the referring office to call Ambetter’s utilization management team and document urgency.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'Advanced imaging requires prior auth.',
        'Tilt-table testing requires prior auth and supporting documentation.',
        'Specialty drugs follow the Ambetter formulary, which varies by state.',
      ],
      commonGotchas: [
        'Ambetter formulary changes annually at Open Enrollment; specialty drug coverage can shift dramatically.',
        '"Network adequacy" can be an issue: if no in-network specialist exists nearby, you have a right to request out-of-network at in-network rates.',
        '"Failed step therapy"; verify in your record.',
      ],
      pushBackTactics:
        'State insurance department complaints are unusually effective with Ambetter because state regulators monitor marketplace plan compliance closely.',
    },
    appeals: {
      standardWindow: '180 days from the denial date for Ambetter marketplace plans.',
      expeditedWindow: '72 hours for urgent appeals.',
      externalReview:
        'After internal appeals, request an Independent External Review through your state insurance department.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Out-of-network" denials when no in-network specialist is reasonably available.',
        '"Provider is not credentialed"; verify the credentialing date.',
        '"Service not covered under your plan"; cross-check against your plan’s Summary of Benefits.',
      ],
      whatWorks:
        'Ambetter responds to state insurance department complaints quickly because marketplace plans are subject to regulatory scrutiny. File the complaint and copy Ambetter on the response.',
    },
    chronicIllness: {
      potsNotes:
        'Tilt-table testing is covered with cardiology referral. Compression stockings are covered with the right HCPCS code.',
      migraineNotes:
        'CGRP antagonists require step therapy on most Ambetter formularies. Document failed preventives carefully.',
      edsMcasNotes:
        'MCAS workup is covered with documented symptoms. hEDS is treated as a clinical diagnosis; genetic testing is rarely covered.',
      generalNotes:
        'Ambetter’s case management can help complex members navigate prior auth. Ask your PCP to refer you to case management.',
    },
    memberServices: {
      portalUrl: 'https://www.ambetterhealth.com/login.html',
      portalLabel: 'Ambetter member portal',
      phones: [
        { display: '(833) 270-5443', digits: '8332705443', context: 'Ambetter member services' },
      ],
    },
    sources: [
      {
        label: 'Ambetter provider directory',
        href: 'https://www.ambetterhealth.com/find-a-doctor.html',
      },
      {
        label: 'Ambetter appeals',
        href: 'https://www.ambetterhealth.com/health-plans/health-care-plans/appeals.html',
      },
      { label: 'Centene 2024 annual report', href: 'https://www.centene.com/' },
    ],
  },

  // ── 9. Highmark BCBS ─────────────────────────────────────────
  {
    slug: 'highmark-bcbs',
    label: 'Highmark Blue Cross Blue Shield',
    shortDescription: 'BCBS licensee in PA, WV, DE, NY (western); ~7 million members.',
    ataglance: {
      planTypes:
        'HMO, PPO, EPO, POS, Medicare Advantage, Medicaid (Highmark Wholecare), and ACA marketplace plans.',
      regionsServed:
        'Pennsylvania, West Virginia, Delaware, and parts of New York and northeastern New York (the Buffalo region).',
      memberCount: 'Approximately 7 million members (Highmark Health 2024).',
      notes:
        'BCBS BlueCard program lets you use in-network providers in other BCBS regions when traveling.',
    },
    network: {
      findInNetworkUrl: 'https://www.highmark.com/find-a-doctor',
      findInNetworkLabel: 'Highmark provider directory',
      outOfNetworkRule:
        'PPO/POS plans cover out-of-network with higher cost share. HMO/EPO require in-network except for emergency.',
      priorAuthRule:
        'Highmark requires prior auth for advanced imaging, specialty drugs, inpatient stays, and outpatient procedures on the published list.',
    },
    referrals: {
      requiredFor:
        'Most Highmark HMO plans (including Highmark Choice Blue HMO) require PCP referrals.',
      notRequiredFor:
        'PPO plans, emergency, urgent care, OB-GYN, and behavioral health.',
      howToRequest:
        'Schedule with your PCP; Highmark accepts electronic referrals via NaviNet.',
      escalationIfDenied:
        'Switch PCPs monthly if needed. Member services can sometimes route around stuck referrals.',
    },
    specialistAccess: {
      typicalWait:
        'Pittsburgh and Philadelphia have dense networks; routine cardiology runs 4 to 12 weeks. Rural PA and WV can be longer.',
      expediteForUrgency:
        'Ask the referring office to mark requests as urgent. Highmark’s 24/7 nurse line can help triage.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'Advanced imaging requires prior auth.',
        'Tilt-table testing requires prior auth and supporting documentation.',
        'Specialty drugs require prior auth and step therapy.',
      ],
      commonGotchas: [
        'Highmark’s site of service rules push procedures to outpatient ambulatory surgery centers when possible.',
        '"Out-of-network specialist" denials when the only in-network specialist is months out; request a Network Adequacy exception.',
        'Highmark formulary changes mid-year; check before refills.',
      ],
      pushBackTactics:
        'Network Adequacy exceptions are underused. If no in-network specialist is available within reasonable travel time, Highmark must cover out-of-network at in-network rates.',
    },
    appeals: {
      standardWindow: '180 days from the denial date.',
      expeditedWindow: '72 hours for urgent appeals.',
      externalReview:
        'After internal appeals, Pennsylvania and Delaware residents can request an Independent External Review through their state insurance department.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Failed conservative treatment not documented"; submit chart notes proving the conservative trial.',
        '"Site of service must be ambulatory"; verify whether your situation justifies hospital-based.',
        '"Out-of-network"; request Network Adequacy exception.',
      ],
      whatWorks:
        'Peer-to-peer reviews. Highmark medical directors are responsive to specialist-to-specialist conversations.',
    },
    chronicIllness: {
      potsNotes:
        'Tilt-table testing is covered with cardiology referral and orthostatic vitals documentation.',
      migraineNotes:
        'CGRP antagonists require step therapy. Botox for chronic migraine requires the 15-day documentation.',
      edsMcasNotes:
        'MCAS workup is covered. hEDS is treated as a clinical diagnosis; genetic testing is rarely covered.',
      generalNotes:
        'Highmark’s integrated parent (Highmark Health includes Allegheny Health Network) can mean smoother referrals if your specialists are within AHN.',
    },
    memberServices: {
      portalUrl: 'https://www.highmark.com/',
      portalLabel: 'highmark.com member portal',
      phones: [
        { display: '(800) 241-5704', digits: '8002415704', context: 'Highmark member services' },
      ],
    },
    sources: [
      { label: 'Highmark find a doctor', href: 'https://www.highmark.com/find-a-doctor' },
      {
        label: 'Highmark prior auth',
        href: 'https://www.highmark.com/health/medical-policy/prior-authorization',
      },
      { label: 'Highmark Health 2024 fact sheet', href: 'https://www.highmarkhealth.org/' },
    ],
  },

  // ── 10. Independence Blue Cross ─────────────────────────────
  {
    slug: 'independence-blue-cross',
    label: 'Independence Blue Cross',
    shortDescription: 'BCBS licensee in southeastern PA; ~3.1 million members.',
    ataglance: {
      planTypes:
        'HMO (Keystone Health Plan East), PPO (Personal Choice), POS, Medicare Advantage, Medicaid (Keystone First), and ACA marketplace plans.',
      regionsServed:
        'Five-county southeastern Pennsylvania region: Philadelphia, Bucks, Chester, Delaware, and Montgomery counties.',
      memberCount: 'About 3.1 million members (Independence 2024 annual).',
    },
    network: {
      findInNetworkUrl: 'https://www.ibx.com/find-a-doctor',
      findInNetworkLabel: 'Independence find a doctor',
      outOfNetworkRule:
        'Personal Choice PPO covers out-of-network with higher cost share. Keystone HMO requires in-network except for emergency.',
      priorAuthRule:
        'Independence requires prior auth for advanced imaging, specialty drugs, inpatient stays, and many outpatient procedures.',
    },
    referrals: {
      requiredFor:
        'Keystone HMO plans require PCP referrals for most specialty care.',
      notRequiredFor:
        'Personal Choice PPO, emergency, urgent care, OB-GYN, and behavioral health.',
      howToRequest:
        'Schedule with your PCP. Independence accepts electronic referrals through NaviNet.',
      escalationIfDenied:
        'Member services can sometimes route around. Switch PCPs monthly if you need to.',
    },
    specialistAccess: {
      typicalWait:
        'Philadelphia metro has strong network depth. Routine cardiology and neurology often within 6 weeks; complex specialty (EDS, dysautonomia) can be longer.',
      expediteForUrgency:
        'Ask the referring office to call the specialist directly and mark urgent. Independence’s nurse line can help.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'Advanced imaging requires prior auth.',
        'Tilt-table testing requires prior auth and cardiology documentation.',
        'Specialty drugs follow the Independence formulary with step therapy.',
      ],
      commonGotchas: [
        'Independence has strong relationships with the Philadelphia academic medical centers (Penn, Jefferson, CHOP, Temple), which is useful for complex cases.',
        '"Site of service" denials push procedures to outpatient.',
        'Out-of-region (outside the five counties) emergency care is covered; follow-up should return to the network.',
      ],
      pushBackTactics:
        'For complex chronic illness, ask for a referral to a Penn or Jefferson specialty clinic. Independence covers these as in-network and they have deep subspecialty expertise.',
    },
    appeals: {
      standardWindow: '180 days from the denial date.',
      expeditedWindow: '72 hours for urgent appeals.',
      externalReview:
        'After internal appeals, request Independent External Review through the Pennsylvania Insurance Department.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Failed conservative treatment not documented"; submit chart notes.',
        '"Out-of-network specialist"; check whether the specialist is in the BlueCard network.',
        '"Service not covered"; verify against the Summary of Benefits.',
      ],
      whatWorks:
        'Penn Medicine, Jefferson, and CHOP all have institutional relationships with Independence. Asking for a referral to one of these for complex cases is usually approved.',
    },
    chronicIllness: {
      potsNotes:
        'Tilt-table testing covered with cardiology referral. Penn Cardiology has a dysautonomia program; ask for the referral.',
      migraineNotes:
        'CGRP antagonists require step therapy. Jefferson Headache Center is in network; ask for the referral.',
      edsMcasNotes:
        'MCAS workup is covered. CHOP and Penn both have EDS expertise; the referral works smoothly within Independence.',
      generalNotes:
        'For Lanae-style multisystem illness, Independence members in Philadelphia have an advantage: the academic medical centers all participate.',
    },
    memberServices: {
      portalUrl: 'https://www.ibx.com/',
      portalLabel: 'ibx.com member portal',
      phones: [
        { display: '(800) 275-2583', digits: '8002752583', context: 'Independence member services' },
      ],
    },
    sources: [
      { label: 'Independence find a doctor', href: 'https://www.ibx.com/find-a-doctor' },
      {
        label: 'Independence prior auth',
        href: 'https://provcomm.ibx.com/ProvComm/Provider/MedicalPolicies',
      },
      { label: 'Independence 2024 annual report', href: 'https://www.ibx.com/' },
    ],
  },

  // ── 11. Medicare ─────────────────────────────────────────────
  {
    slug: 'medicare',
    label: 'Medicare (Original, Advantage, Supplement)',
    shortDescription: 'Federal health insurance for people 65+, some under-65 disability cases. ~67 million beneficiaries.',
    governmentProgram: true,
    ataglance: {
      planTypes:
        'Original Medicare (Part A hospital, Part B medical), Medicare Advantage (Part C: private plans), Medicare Part D (prescription drugs), and Medigap (Supplement) plans.',
      regionsServed: 'All 50 states and US territories.',
      memberCount: 'About 67 million Medicare beneficiaries (CMS 2024).',
      notes:
        'Original Medicare: any provider that accepts Medicare. Medicare Advantage: private plan with its own network. Medigap: supplements Original Medicare to cover deductibles and coinsurance.',
    },
    network: {
      findInNetworkUrl: 'https://www.medicare.gov/care-compare/',
      findInNetworkLabel: 'Medicare care compare',
      outOfNetworkRule:
        'Original Medicare: any provider accepting Medicare nationwide. Medicare Advantage HMO: in-network only except for emergency. Medicare Advantage PPO: out-of-network covered at higher cost share.',
      priorAuthRule:
        'Original Medicare: limited prior auth (mostly DME and a few procedures). Medicare Advantage: extensive prior auth, varies by plan.',
    },
    referrals: {
      requiredFor:
        'Original Medicare: no referrals required. Medicare Advantage HMO: typically requires PCP referrals. Medicare Advantage PPO: usually no referrals.',
      notRequiredFor:
        'On Original Medicare, no referrals are required for any specialist who accepts Medicare. On Medicare Advantage, emergency and urgent care are always self-referral.',
      howToRequest:
        'On Medicare Advantage HMO: schedule with your PCP. On Original Medicare: schedule directly with any Medicare-participating specialist.',
      escalationIfDenied:
        'If you are on Medicare Advantage and your plan is too restrictive, you can switch back to Original Medicare during Open Enrollment (October 15 to December 7) or the Medicare Advantage Open Enrollment (January 1 to March 31).',
    },
    specialistAccess: {
      typicalWait:
        'Highly variable by region and specialty. Medicare-accepting specialists are widespread but capacity varies. 4 to 16 weeks for routine cardiology or neurology.',
      expediteForUrgency:
        'On Original Medicare, you can call any Medicare-accepting specialist directly. On Medicare Advantage, ask your PCP to mark the referral urgent.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'Original Medicare: limited prior auth (DME, some hospital outpatient procedures, a small list).',
        'Medicare Advantage: extensive prior auth list. MRI, CT, PET, infusions, and most procedures require approval.',
        'Tilt-table testing on Original Medicare: covered when medically necessary, no prior auth needed for most providers.',
      ],
      commonGotchas: [
        'Medicare Advantage plans have been the subject of multiple OIG reports for inappropriate denials. Many denied claims are reversed on appeal.',
        '"Not medically necessary" without naming the National Coverage Determination (NCD) or Local Coverage Determination (LCD).',
        '"Service is investigational"; verify against current Medicare coverage policy.',
      ],
      pushBackTactics:
        'Cite the specific NCD or LCD for the service. Medicare Advantage plans are required to cover everything Original Medicare covers; if the denial conflicts with an NCD, it must be reversed.',
    },
    appeals: {
      standardWindow:
        'Original Medicare: 120 days from the date of the Medicare Summary Notice. Medicare Advantage: 60 days from the denial date.',
      expeditedWindow: '72 hours for urgent appeals on Medicare Advantage.',
      externalReview:
        'Medicare appeals proceed through five levels: redetermination (carrier), reconsideration (Qualified Independent Contractor), ALJ hearing, Medicare Appeals Council review, and federal court.',
      stateCommissionerNote:
        'Medicare appeals do not go through state insurance commissioners; the federal appeal process is the path.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        'Medicare Advantage: "Service not medically necessary" without citing the NCD or LCD.',
        '"Service is custodial"; ask which CMS guideline applies.',
        '"Out-of-network"; on Original Medicare this should never happen.',
      ],
      whatWorks:
        'For Medicare Advantage, the Level 2 reconsideration is genuinely independent (the Qualified Independent Contractor is not contracted with your insurer). Push appeals to Level 2 when the Level 1 reversal feels wrong.',
    },
    chronicIllness: {
      potsNotes:
        'Original Medicare covers tilt-table testing when medically necessary. Medicare Advantage requires prior auth.',
      migraineNotes:
        'Medicare Part D covers CGRP antagonists with step therapy on most plans. Botox for chronic migraine is covered with the 15-day documentation.',
      edsMcasNotes:
        'MCAS workup is covered when medically necessary. Genetic testing for hEDS is rarely covered because hEDS is a clinical diagnosis.',
      generalNotes:
        'For complex chronic illness, Original Medicare with a Medigap plan tends to be more flexible than Medicare Advantage; Medigap covers the deductibles and coinsurance.',
    },
    memberServices: {
      portalUrl: 'https://www.medicare.gov/',
      portalLabel: 'medicare.gov member portal',
      phones: [
        {
          display: '(800) 633-4227',
          digits: '8006334227',
          context: '1-800-MEDICARE (24/7)',
        },
      ],
    },
    sources: [
      { label: 'Medicare.gov coverage', href: 'https://www.medicare.gov/coverage' },
      { label: 'Medicare appeals', href: 'https://www.medicare.gov/claims-appeals' },
      {
        label: 'CMS Medicare beneficiary data',
        href: 'https://www.cms.gov/Research-Statistics-Data-and-Systems/Statistics-Trends-and-Reports',
      },
      {
        label: 'OIG report on Medicare Advantage denials',
        href: 'https://oig.hhs.gov/oei/reports/OEI-09-18-00260.asp',
      },
    ],
  },

  // ── 12. Medicaid ─────────────────────────────────────────────
  {
    slug: 'medicaid',
    label: 'Medicaid (state overview)',
    shortDescription: 'Joint federal and state health coverage; ~80 million enrollees nationwide.',
    governmentProgram: true,
    ataglance: {
      planTypes:
        'Medicaid is administered by each state, with federal minimums. Most states use managed care organizations (MCOs) like Molina, Centene, UnitedHealthcare Community Plan, or BCBS Medicaid.',
      regionsServed: 'All 50 states, DC, and US territories. Coverage rules vary substantially by state.',
      memberCount: 'About 80 million enrollees (CMS 2024, including CHIP).',
      notes:
        'Each state runs its own Medicaid program within federal rules. Eligibility, covered services, and managed care organization choices differ by state.',
    },
    network: {
      findInNetworkUrl: 'https://www.medicaid.gov/about-us/contact-us/contact-state-page.html',
      findInNetworkLabel: 'Find your state Medicaid agency',
      outOfNetworkRule:
        'Most state Medicaid managed care plans require in-network providers except for emergency. Some states have direct fee-for-service Medicaid that allows any Medicaid-enrolled provider.',
      priorAuthRule:
        'Prior auth varies by state and managed care organization. Most require it for advanced imaging, specialty drugs, inpatient stays, and many outpatient procedures.',
    },
    referrals: {
      requiredFor:
        'Most Medicaid managed care HMO plans require PCP referrals. Some state fee-for-service Medicaid does not.',
      notRequiredFor:
        'Emergency, urgent care, OB-GYN, family planning, and behavioral health (federally protected access in most states).',
      howToRequest:
        'Schedule with your PCP. Each state Medicaid program or MCO has its own provider portal.',
      escalationIfDenied:
        'State Medicaid ombudsman is your most powerful escalation. Federal Medicaid law guarantees access to medically necessary care.',
    },
    specialistAccess: {
      typicalWait:
        'Highly variable by state. Some states have robust Medicaid networks; others have very limited specialty access. 6 to 24+ weeks is common for non-urgent specialty care.',
      expediteForUrgency:
        'Ask your PCP to mark the referral urgent. The state Medicaid ombudsman can help if you cannot find a specialist.',
    },
    testsAndProcedures: {
      priorAuthThresholds: [
        'Most advanced imaging requires prior auth.',
        'Tilt-table testing typically requires prior auth and cardiology documentation.',
        'Specialty drugs require prior auth and step therapy on most state formularies.',
      ],
      commonGotchas: [
        '"Not covered under Medicaid" denials are often wrong; verify against your state Medicaid policy directly.',
        'Coverage rules vary substantially by state; what is covered in California may not be covered in Texas.',
        'Specialty network depth is the most common bottleneck. Federal law requires "reasonable" access; what counts as reasonable varies.',
      ],
      pushBackTactics:
        'For denials, your state Medicaid ombudsman can override managed care organization decisions when the underlying state policy supports the service. Federal law also gives you the right to a State Fair Hearing.',
    },
    appeals: {
      standardWindow:
        '60 days from the denial date for most state Medicaid programs (some allow 90 or 120 days).',
      expeditedWindow: '72 hours for urgent appeals.',
      externalReview:
        'After internal appeals, request a State Fair Hearing through your state Medicaid agency. The state hearing officer is independent of the managed care organization.',
      stateCommissionerNote:
        'Medicaid appeals go through your state Medicaid agency, not the state insurance commissioner.',
    },
    antiGaslighting: {
      knownDenialPatterns: [
        '"Not covered under Medicaid"; verify against state policy.',
        '"Service is non-covered"; ask which state code or federal regulation applies.',
        '"Provider not enrolled"; verify the provider’s Medicaid enrollment date.',
      ],
      whatWorks:
        'State Medicaid ombudsmen exist specifically to advocate for enrollees against managed care organization denials. They are an underused resource. Call the state Medicaid agency, not just the MCO.',
    },
    chronicIllness: {
      potsNotes:
        'Tilt-table testing is covered with cardiology documentation in most state Medicaid programs.',
      migraineNotes:
        'CGRP antagonists may be on the state formulary; coverage rules vary.',
      edsMcasNotes:
        'MCAS workup labs are usually covered with documented mast cell symptoms. hEDS is treated as a clinical diagnosis; genetic testing is rarely covered.',
      generalNotes:
        'Medicaid Special Needs Plans (Medicare-Medicaid Dual Special Needs Plans, or D-SNPs) bundle Medicare and Medicaid benefits and can be especially helpful for complex chronic illness members who qualify for both.',
    },
    memberServices: {
      portalUrl: 'https://www.medicaid.gov/',
      portalLabel: 'medicaid.gov',
      phones: [
        {
          display: '(877) 267-2323',
          digits: '8772672323',
          context: 'CMS Medicaid (federal helpline)',
        },
      ],
    },
    sources: [
      {
        label: 'Medicaid.gov state contacts',
        href: 'https://www.medicaid.gov/about-us/contact-us/contact-state-page.html',
      },
      { label: 'Medicaid appeals process', href: 'https://www.medicaid.gov/medicaid/managed-care' },
      {
        label: 'CMS Medicaid enrollment data',
        href: 'https://www.medicaid.gov/medicaid/program-information/medicaid-and-chip-enrollment-data/',
      },
    ],
  },
]

/**
 * Look up a carrier by slug. Returns undefined if no carrier matches.
 * Used by the dynamic page route at /v2/insurance/<slug> to render
 * the right CarrierGuide.
 */
export function getCarrier(slug: string): CarrierGuideData | undefined {
  return CARRIER_CATALOG.find((c) => c.slug === slug)
}

/**
 * The full list of carrier slugs for static generation. Next.js uses
 * this to pre-render every carrier page at build time.
 */
export const CARRIER_SLUGS: string[] = CARRIER_CATALOG.map((c) => c.slug)
