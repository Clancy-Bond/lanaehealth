/*
 * Provider Directory (Oahu seed)
 *
 * Maps each known healthcare provider to the connection path the user
 * should take to get records into the app. The user types a hospital
 * or lab name, the search returns the matching provider, and the UI
 * tells them exactly what to tap.
 *
 * For Oahu specifically, the picture as of 2026 is dramatically simpler
 * than it sounds:
 *   - Three of the four major hospital systems (Queen's, Hawaii Pacific
 *     Health, Kaiser Permanente Hawaii) all run on Epic. One Apple
 *     Health Records connection per system covers everything.
 *   - Adventist Health Castle runs on Cerner / Oracle Health. Same
 *     story: one Apple Health Records connection covers the system.
 *   - Tripler Army Medical Center is on MHS GENESIS (the federal
 *     Cerner-based EHR). MHS GENESIS Patient Portal is in Apple's
 *     Health Records directory.
 *   - Quest Diagnostics labs flow via MyQuest, which exposes a
 *     documented FHIR API and is in Apple Health Records.
 *   - Diagnostic Lab Services (DLS) uses Luminate Health, which does
 *     NOT expose patient FHIR. Email-forwarding from DLS result emails
 *     is the working ingestion path.
 *   - LabCorp's patient FHIR API is technically available but the
 *     vendor has gatekept developer access historically. Treat as
 *     manual-upload primary, FHIR fallback if access gets opened up.
 *   - Pacific Radiology / Hawaii Pacific Radiology serves imaging via
 *     their MyImaging portal; no public FHIR. Manual upload is the
 *     practical path until imaging centers ship FHIR endpoints.
 *
 * The data file is the single source of truth. The UI is dumb.
 *
 * Adding a region: add entries with `region: 'oahu' | 'maui' | ...`
 * and the search code partitions by region.
 */

export type IngestionPath =
  | 'apple-health-records' // user adds account in iPhone Health app
  | 'fhir-direct' // SMART-on-FHIR per-vendor OAuth (Phase 5)
  | 'aggregator' // 1upHealth or Health Gorilla (Phase 5)
  | 'email-ingest' // forward result emails to ingest address (Phase 3)
  | 'manual-upload' // PDF / screenshot / FHIR Bundle JSON
  | 'browser-extension' // long-tail, deferred

export type ProviderCategory =
  | 'hospital'
  | 'clinic'
  | 'lab'
  | 'imaging'
  | 'specialty'
  | 'urgent-care'

export interface Provider {
  id: string
  name: string
  region: 'oahu' | 'hawaii-other' | 'continental-us' | 'national'
  category: ProviderCategory
  /** EHR / portal vendor when known. */
  ehr?: 'Epic' | 'Cerner' | 'Oracle Health' | 'MHS GENESIS' | 'athenahealth' | 'eClinicalWorks' | 'NextGen' | 'ModMed' | 'Greenway' | 'Allscripts' | 'Meditech' | 'Practice Fusion' | 'Luminate Health' | 'Other' | 'Unknown'
  /** User-visible portal URL (the link they'd hit in a browser). */
  portalUrl?: string
  /** Public FHIR R4 base URL when known. Empty for vendors without a public endpoint. */
  fhirBaseUrl?: string
  /** The exact name to type in Apple Health Records search if applicable. */
  appleHealthRecordsName?: string
  /** Primary recommended path for users today. */
  primaryPath: IngestionPath
  /** Fallback paths if the primary fails or the user prefers another. */
  fallbackPaths: IngestionPath[]
  /** Free-text caveat shown alongside the connection guidance. */
  note?: string
}

export const PROVIDERS: Provider[] = [
  // ── Major Oahu hospital systems (Epic) ───────────────────────────
  {
    id: 'queens-health-systems',
    name: "The Queen's Health Systems",
    region: 'oahu',
    category: 'hospital',
    ehr: 'Epic',
    portalUrl: 'https://mychart.queens.org/',
    appleHealthRecordsName: "The Queen's Health Systems",
    primaryPath: 'apple-health-records',
    fallbackPaths: ['fhir-direct', 'manual-upload'],
    note: "One connection covers Queen's Medical Center (Punchbowl), Queen's West O'ahu, North Hawaii Community Hospital, and the Wahiawā campus.",
  },
  {
    id: 'hawaii-pacific-health',
    name: 'Hawai‘i Pacific Health',
    region: 'oahu',
    category: 'hospital',
    ehr: 'Epic',
    portalUrl: 'https://mychart.hawaiipacifichealth.org/',
    appleHealthRecordsName: 'Hawaii Pacific Health',
    primaryPath: 'apple-health-records',
    fallbackPaths: ['fhir-direct', 'manual-upload'],
    note: 'One connection covers Straub, Pali Momi, Kapi‘olani Medical Center for Women & Children, and Wilcox.',
  },
  {
    id: 'kaiser-permanente-hawaii',
    name: 'Kaiser Permanente Hawaii',
    region: 'oahu',
    category: 'hospital',
    ehr: 'Epic',
    portalUrl: 'https://healthy.kaiserpermanente.org/hawaii',
    appleHealthRecordsName: 'Kaiser Permanente',
    primaryPath: 'apple-health-records',
    fallbackPaths: ['manual-upload'],
    note: 'One connection covers Moanalua Medical Center plus all KP Hawaii clinics.',
  },

  // ── Adventist (Cerner) ───────────────────────────────────────────
  {
    id: 'adventist-health-castle',
    name: 'Adventist Health Castle',
    region: 'oahu',
    category: 'hospital',
    ehr: 'Cerner',
    portalUrl: 'https://www.myadventisthealthportal.org/',
    appleHealthRecordsName: 'Adventist Health',
    primaryPath: 'apple-health-records',
    fallbackPaths: ['email-ingest', 'manual-upload'],
    note: 'MyAdventistHealth runs on Cerner. The Adventist Health system is in the Apple Health Records directory; the Castle campus is the Oahu site.',
  },

  // ── Military / federal ───────────────────────────────────────────
  {
    id: 'tripler-army-medical-center',
    name: 'Tripler Army Medical Center',
    region: 'oahu',
    category: 'hospital',
    ehr: 'MHS GENESIS',
    portalUrl: 'https://my.mhsgenesis.health.mil/',
    appleHealthRecordsName: 'MHS GENESIS Patient Portal',
    primaryPath: 'apple-health-records',
    fallbackPaths: ['manual-upload'],
    note: 'Tripler runs on MHS GENESIS, the DOD electronic health record built on Cerner. Service members, dependents, and retirees use the same portal.',
  },

  // ── Other Oahu hospitals ─────────────────────────────────────────
  {
    id: 'wahiawa-general-hospital',
    name: 'Wahiawā General Hospital',
    region: 'oahu',
    category: 'hospital',
    ehr: 'Epic',
    portalUrl: 'https://www.queens.org/locations/hospitals/wahiawa/',
    appleHealthRecordsName: "The Queen's Health Systems",
    primaryPath: 'apple-health-records',
    fallbackPaths: ['manual-upload'],
    note: 'Wahiawā General was acquired by Queen\'s Health Systems and is now on Queen\'s MyChart. The Apple Health Records connection for Queen\'s covers it.',
  },
  {
    id: 'kuakini-medical-center',
    name: 'Kuakini Medical Center',
    region: 'oahu',
    category: 'hospital',
    ehr: 'Other',
    portalUrl: 'https://www.kuakini.org/wps/portal/public/Patient-Information/MyKuakiniHealth',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest', 'browser-extension'],
    note: 'MyKuakiniHealth is a smaller portal without a public FHIR endpoint we have validated. Manual export from the portal is the working path until we confirm an API.',
  },
  {
    id: 'kahuku-medical-center',
    name: 'Kahuku Medical Center',
    region: 'oahu',
    category: 'hospital',
    ehr: 'Unknown',
    portalUrl: 'https://www.kmc-hi.org/patients-visitors/kmc-patient-portals/',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
    note: 'KMC routes to multiple portals depending on department. We default to manual upload until a FHIR endpoint is confirmed.',
  },
  {
    id: 'rehab-hospital-pacific',
    name: 'Rehabilitation Hospital of the Pacific',
    region: 'oahu',
    category: 'hospital',
    ehr: 'Unknown',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
    note: 'No public patient FHIR endpoint identified. Manual upload of discharge summaries / therapy notes works.',
  },
  {
    id: 'hawaii-state-hospital',
    name: 'Hawaii State Hospital',
    region: 'oahu',
    category: 'hospital',
    ehr: 'Other',
    primaryPath: 'manual-upload',
    fallbackPaths: [],
    note: 'State psychiatric hospital in Kāne‘ohe. Patient records are typically released by mail or in-person request.',
  },

  // ── Federally Qualified Health Centers (FQHCs) ───────────────────
  {
    id: 'wcchc',
    name: 'Waianae Coast Comprehensive Health Center',
    region: 'oahu',
    category: 'clinic',
    ehr: 'Unknown',
    portalUrl: 'https://www.wcchc.com/Patients/Portal',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
    note: 'Largest FQHC on Oahu. Patient portal exists but no public FHIR endpoint validated. Manual upload of visit summaries and labs is the working path.',
  },
  {
    id: 'kalihi-palama-health-center',
    name: 'Kalihi-Palama Health Center',
    region: 'oahu',
    category: 'clinic',
    ehr: 'Unknown',
    portalUrl: 'https://www.kphc.org/',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
    note: 'FQHC. Patient portal exists; FHIR endpoint not yet validated.',
  },
  {
    id: 'waikiki-health',
    name: 'Waikiki Health',
    region: 'oahu',
    category: 'clinic',
    ehr: 'Unknown',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
  },
  {
    id: 'koolauloa-health',
    name: "Ko‘olauloa Community Health & Wellness Center",
    region: 'oahu',
    category: 'clinic',
    ehr: 'Unknown',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
  },
  {
    id: 'kalihi-valley',
    name: 'Kōkua Kalihi Valley Comprehensive Family Services',
    region: 'oahu',
    category: 'clinic',
    ehr: 'Unknown',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
  },
  {
    id: 'waimanalo-health',
    name: 'Waimānalo Health Center',
    region: 'oahu',
    category: 'clinic',
    ehr: 'Unknown',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
  },
  {
    id: 'wahiawa-health',
    name: 'Wahiawā Health',
    region: 'oahu',
    category: 'clinic',
    ehr: 'Unknown',
    portalUrl: 'https://wahiawahealth.org/',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
    note: 'Wahiawā Health is a Central Oahu FQHC distinct from Wahiawā General Hospital.',
  },

  // ── Labs ─────────────────────────────────────────────────────────
  {
    id: 'dls-hawaii',
    name: 'Diagnostic Laboratory Services (DLS)',
    region: 'oahu',
    category: 'lab',
    ehr: 'Luminate Health',
    portalUrl: 'https://dlslab.com/lab-results/',
    primaryPath: 'email-ingest',
    fallbackPaths: ['manual-upload'],
    note: "DLS uses Luminate Health for the patient portal (MyDLSChart). Luminate does not expose a patient FHIR endpoint. Forward your DLS result emails to the LanaeHealth ingest address and the PDFs flow in automatically.",
  },
  {
    id: 'clinical-labs-hawaii',
    name: 'Clinical Labs of Hawaii',
    region: 'oahu',
    category: 'lab',
    ehr: 'Other',
    portalUrl: 'https://my.clinicallabs.com/',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
    note: 'myClinicalLabs offers PDF download per result. We accept PDF or CSV uploads; FHIR endpoint not yet validated.',
  },
  {
    id: 'quest-diagnostics',
    name: 'Quest Diagnostics',
    region: 'national',
    category: 'lab',
    ehr: 'Other',
    portalUrl: 'https://myquest.questdiagnostics.com/',
    appleHealthRecordsName: 'Quest Diagnostics',
    primaryPath: 'apple-health-records',
    fallbackPaths: ['fhir-direct', 'manual-upload'],
    note: "Quest's Quanum EHR exposes a documented FHIR API; MyQuest is also in Apple Health Records.",
  },
  {
    id: 'labcorp',
    name: 'LabCorp',
    region: 'national',
    category: 'lab',
    ehr: 'Other',
    portalUrl: 'https://patient.labcorp.com/',
    appleHealthRecordsName: 'Labcorp',
    primaryPath: 'apple-health-records',
    fallbackPaths: ['manual-upload'],
    note: "LabCorp Patient is in Apple Health Records. LabCorp's developer FHIR access has historically been gatekept; manual upload is a reliable fallback.",
  },

  // ── Imaging ──────────────────────────────────────────────────────
  {
    id: 'pacific-radiology',
    name: 'Pacific Radiology Group',
    region: 'oahu',
    category: 'imaging',
    ehr: 'Other',
    portalUrl: 'https://pacificradiology.com/patients/myimaging-portal',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
    note: 'MyImaging Portal lets patients download their reports and images. Upload the report PDF here; image DICOM viewing is a separate flow.',
  },
  {
    id: 'hawaii-diagnostic-radiology',
    name: 'Hawaii Diagnostic Radiology Services',
    region: 'oahu',
    category: 'imaging',
    ehr: 'Other',
    primaryPath: 'manual-upload',
    fallbackPaths: ['email-ingest'],
  },

  // ── Specialty (allergist used by patient zero) ───────────────────
  {
    id: 'modmed-klara',
    name: 'Allergist via Klara messaging (Modernizing Medicine EMA)',
    region: 'oahu',
    category: 'specialty',
    ehr: 'ModMed',
    primaryPath: 'apple-health-records',
    fallbackPaths: ['manual-upload', 'email-ingest'],
    note: "Klara is a messaging layer; the underlying ModMed EMA EHR exposes records via the practice's APPatient portal. Many ModMed practices are in Apple Health Records — search the practice name (not 'Klara').",
  },
]

/** Region buckets for the search UI. */
export const REGIONS = ['oahu', 'hawaii-other', 'continental-us', 'national'] as const

/** Plain-text descriptions of each ingestion path, used by the UI. */
export const PATH_DESCRIPTIONS: Record<IngestionPath, string> = {
  'apple-health-records':
    'Open the iPhone Health app → Browse → Health Records → Add Account → search the provider name → sign in to their portal once. Records flow into LanaeHealth automatically after.',
  'fhir-direct':
    'Sign in to the provider\'s patient portal directly through LanaeHealth. We use SMART on FHIR to read your records. Coming in Phase 5.',
  aggregator:
    'A connected health network (1upHealth or Health Gorilla) pulls your records on our behalf. Coming in Phase 5.',
  'email-ingest':
    'Forward result emails from this provider to your personal LanaeHealth ingest address. We parse the attachments. Coming in Phase 3.',
  'manual-upload':
    'Download the PDF or screenshot from the portal and upload it here. Always available.',
  'browser-extension':
    'A LanaeHealth browser extension captures records when you log into the portal yourself. Last-resort path; deferred.',
}
