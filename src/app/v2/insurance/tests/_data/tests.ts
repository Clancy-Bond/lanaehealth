/*
 * Test catalog
 *
 * The single source of truth for every test guide rendered under
 * /v2/insurance/tests/<slug>. Each entry follows the same template
 * defined in TestGuide.tsx so adding a test is a data change rather
 * than a new component.
 *
 * Voice: NC short, kind, explanatory. No em-dashes. No invented
 * denial reasons or counter-arguments. Every clinical claim points
 * at a citation in the test's `sources` block.
 *
 * Sources captured April 2026. Coding rules and insurance criteria
 * change. Anyone editing this file should re-verify before shipping.
 *
 * Coverage focus: tests relevant to POTS, migraine, and
 * EDS-MCAS clusters. The catalog is not exhaustive; it is the set
 * Lanae and patients with overlapping conditions are most likely to
 * need ordered or to push back on a denial for.
 */

export type TestCategorySlug =
  | 'cardiology'
  | 'neurology'
  | 'allergy-immunology'
  | 'gastroenterology'
  | 'endocrinology'
  | 'genetic'
  | 'imaging'

export interface TestCategory {
  slug: TestCategorySlug
  label: string
  shortDescription: string
}

export const TEST_CATEGORIES: TestCategory[] = [
  {
    slug: 'cardiology',
    label: 'Cardiology and autonomic',
    shortDescription:
      'Tests that look at heart rhythm, structure, and how the autonomic nervous system manages standing.',
  },
  {
    slug: 'neurology',
    label: 'Neurology',
    shortDescription:
      'Brain and nerve tests for migraine, dysautonomia, sleep, and structural questions.',
  },
  {
    slug: 'allergy-immunology',
    label: 'Allergy and immunology',
    shortDescription:
      'The mast cell workup. These tests are timing-sensitive and easy to get ordered wrong.',
  },
  {
    slug: 'gastroenterology',
    label: 'Gastroenterology',
    shortDescription: 'GI tests for nausea, motility, SIBO, and structural causes of pain.',
  },
  {
    slug: 'endocrinology',
    label: 'Endocrinology',
    shortDescription: 'Hormones, adrenal axis, thyroid, and metabolic labs.',
  },
  {
    slug: 'genetic',
    label: 'Genetic',
    shortDescription: 'Heritable connective tissue and dysautonomia panels.',
  },
  {
    slug: 'imaging',
    label: 'Specialty imaging',
    shortDescription:
      'Upright MRI, vascular ultrasound, bone density. Often denied as not medically necessary.',
  },
]

export interface TestSource {
  /** Short label shown next to the citation. */
  label: string
  /** Direct link to the source. Prefer peer-reviewed or society guideline. */
  href: string
}

export interface TestGuideData {
  /** URL slug; lives under /v2/insurance/tests/<slug>. */
  slug: string
  /** Display name used on the hub and the page title. */
  label: string
  /** Category for grouping in the hub. */
  category: TestCategorySlug
  /** One-line subtitle shown under the title. */
  subtitle: string
  /** 1 to 2 sentence plain-language explainer. */
  whatItIs: string
  /** NC voice paragraph: why a chronic illness patient might want this. */
  whyOrdered: string
  /** Verbatim PCP request script the patient can adapt. */
  pcpScript: string
  /** Prep, duration, sensations, recovery. NC voice. */
  whatToExpect: string
  /** How results read, in plain language. No false precision. */
  resultsInterpretation: string
  /** Each entry is a real denial pattern + the documented counter-argument. */
  denialPushback: Array<{
    denialReason: string
    counterArgument: string
    /** Optional citation key into `sources` for the counter. */
    citationLabel?: string
  }>
  /** Specialist who can order if PCP refuses. NC voice. */
  specialistReferralPath: string
  /** Typical price range and what insurance usually covers. */
  costExpectations: string
  /** Linked condition deep-dive paths in the v2 surface, if any. */
  relatedTopicHrefs?: Array<{ href: string; label: string }>
  /** Citations. Prefer peer-reviewed and major society guidelines. */
  sources: TestSource[]
}

// ── shared sources used across multiple tests ───────────────────────
// (Kept inline per-test for renderer simplicity. If a citation
// reappears, repeat the link. The renderer dedupes for display.)

export const TEST_CATALOG: TestGuideData[] = [
  // ──────────────────────────────────────────────────────────────
  // CARDIOLOGY / AUTONOMIC
  // ──────────────────────────────────────────────────────────────
  {
    slug: 'tilt-table-test',
    label: 'Tilt table test',
    category: 'cardiology',
    subtitle: 'The reference test for POTS, neurocardiogenic syncope, and orthostatic intolerance.',
    whatItIs:
      'You are strapped to a flat table, then the table is tilted upright (usually 60 to 70 degrees) for 30 to 45 minutes while a tech monitors your heart rate, blood pressure, and symptoms. The test reproduces orthostatic stress in a controlled setting so the autonomic response can be measured.',
    whyOrdered:
      'Tilt table is considered the reference standard for diagnosing POTS, neurocardiogenic (vasovagal) syncope, and other orthostatic disorders. A 10-minute active stand test in clinic can suggest POTS, but tilt allows precise heart-rate and blood-pressure tracking and rules out neurally mediated syncope, which a stand test cannot.',
    pcpScript:
      'I have been experiencing presyncope, lightheadedness, and a fast heart rate when I stand for the past several months. My active stand tests at home consistently show a heart rate increase of more than 30 beats per minute within 10 minutes. I would like to be referred for a tilt table test to evaluate for POTS or neurocardiogenic syncope. If you cannot order it directly, can you refer me to cardiology or a dysautonomia clinic that can?',
    whatToExpect:
      'No food or caffeine for 4 hours before. Wear loose clothes. You will lie flat for 10 to 15 minutes for baseline readings, then the table tilts upright. You stay still and report symptoms (lightheadedness, nausea, vision changes). Most labs cap the upright phase at 45 minutes. Some protocols give nitroglycerin or isoproterenol if the passive tilt is negative; this is provocative and can trigger syncope. Total visit is usually 1 to 2 hours. Plan a ride home; some people feel wiped out after.',
    resultsInterpretation:
      'POTS is defined as a sustained heart-rate increase of more than 30 beats per minute (or to over 120 bpm) within 10 minutes of upright posture, without a significant drop in blood pressure. Neurocardiogenic syncope shows a sudden drop in blood pressure and heart rate that causes fainting. Orthostatic hypotension shows a 20 mmHg systolic or 10 mmHg diastolic drop within 3 minutes. A negative test does not rule out POTS if the symptoms are real; it just means the test did not catch a positive on that day.',
    denialPushback: [
      {
        denialReason: 'Not medically necessary; an active stand test in the office is sufficient.',
        counterArgument:
          'Active stand tests can suggest POTS but do not rule out neurally mediated syncope and cannot capture late-phase responses. The American Autonomic Society and Heart Rhythm Society consensus statement names tilt table as the diagnostic standard for unexplained syncope and recommends it when the diagnosis remains unclear after history and physical exam.',
        citationLabel: 'Heart Rhythm Society 2015 consensus',
      },
      {
        denialReason: 'Try beta blockers first.',
        counterArgument:
          'Empirical treatment without a confirmed mechanism is not a substitute for diagnosis. Beta blockers are appropriate for some POTS subtypes but contraindicated in hyperadrenergic forms and unhelpful for neurocardiogenic syncope. The differential matters, and tilt table is how it is established.',
      },
      {
        denialReason: 'Out of network at the only autonomic lab in the area.',
        counterArgument:
          'Request a network gap exception. If no in-network provider performs the specific procedure, plans are generally required to authorize an out-of-network provider at in-network cost share. State insurance commissioners enforce this for most regulated plans.',
      },
    ],
    specialistReferralPath:
      'Cardiology (electrophysiology subspecialty) or a dedicated autonomic / dysautonomia clinic. Major academic centers usually have an autonomic lab; Dysautonomia International maintains a directory of clinicians experienced with POTS.',
    costExpectations:
      'Typical billed price ranges from about $1,500 to $4,000 depending on the lab. With in-network insurance and prior authorization, patient out-of-pocket is usually a specialist visit copay plus the procedure coinsurance up to your deductible. Without authorization the full cost can land on you.',
    relatedTopicHrefs: [
      { href: '/v2/topics/orthostatic', label: 'Orthostatic deep-dive' },
    ],
    sources: [
      {
        label: 'Sheldon RS et al. 2015 HRS expert consensus on syncope (Heart Rhythm)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/25980576/',
      },
      {
        label: 'Vernino S et al. 2021 POTS consensus statement (Auton Neurosci)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/34245547/',
      },
      {
        label: 'Dysautonomia International: physician list',
        href: 'https://www.dysautonomiainternational.org/page.php?ID=14',
      },
    ],
  },
  {
    slug: 'holter-monitor',
    label: 'Holter monitor (24 to 48 hours)',
    category: 'cardiology',
    subtitle: 'Continuous heart-rhythm recording for symptoms that happen daily.',
    whatItIs:
      'A small portable ECG with three to five sticky electrodes on your chest. It records every heartbeat for 24 or 48 hours while you go about a normal day. You keep a log of any symptoms so the cardiologist can correlate rhythm changes to what you felt.',
    whyOrdered:
      'Used when symptoms (palpitations, presyncope, racing heart) happen often enough that a one to two day window will catch them. For POTS, a Holter can document tachycardia patterns through orthostatic stressors. For arrhythmias, it captures runs of supraventricular or ventricular activity that a 12-second resting ECG would miss.',
    pcpScript:
      'I am having near-daily episodes of palpitations and lightheadedness. A resting ECG looked normal but the symptoms keep happening. I would like a 48-hour Holter monitor so we can capture rhythm during a real episode. If a Holter is not the right tool, can we discuss a longer event monitor?',
    whatToExpect:
      'You shower the morning of the appointment because the electrodes have to stay dry. The tech places three to five leads on your chest; the recorder clips to your belt or wears on a lanyard. You keep a paper or app diary of symptoms with timestamps. Sleep, eat, and move normally. You return the device when the recording window ends. Skin under the electrodes can itch.',
    resultsInterpretation:
      'The cardiologist reviews 24 or 48 hours of beats for arrhythmias, pauses, ST changes, and average / max / min heart rate. For POTS the focus is on heart-rate response to position changes you logged. A normal Holter does not rule out paroxysmal arrhythmia; it just means nothing happened during that window.',
    denialPushback: [
      {
        denialReason: 'Symptoms are infrequent; a Holter will not capture them.',
        counterArgument:
          'If symptoms truly are infrequent, ask for an event monitor or implantable loop recorder instead, not for the test to be denied. The point is to match the recording window to symptom frequency. The American College of Cardiology, AHA, and HRS recommend ambulatory monitoring for evaluation of palpitations and unexplained syncope.',
        citationLabel: 'ACC/AHA/HRS 2018 syncope guideline',
      },
      {
        denialReason: 'Resting ECG was normal.',
        counterArgument:
          'A resting ECG is a 10-second sample. Most arrhythmias are paroxysmal and will not appear in that window. The whole point of ambulatory monitoring is to extend the recording past the resting snapshot.',
      },
    ],
    specialistReferralPath:
      'Most PCPs can order a Holter directly. If they decline, cardiology or electrophysiology can.',
    costExpectations:
      'Typically $500 to $1,500 billed. Generally covered when ordered for documented symptoms; coinsurance applies up to your deductible.',
    relatedTopicHrefs: [
      { href: '/v2/topics/orthostatic', label: 'Orthostatic deep-dive' },
    ],
    sources: [
      {
        label: 'Shen WK et al. 2017 ACC/AHA/HRS syncope guideline (Circulation)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/28280232/',
      },
      {
        label: 'Crawford MH et al. ACC/AHA ambulatory ECG guidelines',
        href: 'https://www.ahajournals.org/doi/10.1161/01.CIR.100.8.886',
      },
    ],
  },
  {
    slug: 'event-monitor',
    label: 'Event monitor (30-day)',
    category: 'cardiology',
    subtitle: 'For symptoms that happen weekly, not daily.',
    whatItIs:
      'A small wearable that records your heart rhythm for up to 30 days. You press a button when you feel a symptom; the device saves the surrounding minutes of ECG and transmits to the monitoring center.',
    whyOrdered:
      'When palpitations or near-fainting happen often enough to bother you but not so often that a 24-hour Holter will catch them. The longer recording window dramatically increases diagnostic yield for paroxysmal arrhythmias and intermittent POTS triggers.',
    pcpScript:
      'I am getting episodes of palpitations and presyncope about once a week. A Holter would probably miss them. I would like a 30-day event monitor so we can capture an event when it happens.',
    whatToExpect:
      'A patch on your chest or a small bedside transmitter. You press an event button when symptoms start. Most modern monitors auto-detect tachycardia, pauses, and atrial fibrillation. You wear the device 24/7 and can shower with the patch types. Battery and patch swap once or twice during the month.',
    resultsInterpretation:
      'The monitoring service flags any captured arrhythmia and sends the report to the ordering doctor. A symptom press without a rhythm change is also useful information; it suggests symptoms are not always tied to an arrhythmia.',
    denialPushback: [
      {
        denialReason: 'A 24-hour Holter is sufficient.',
        counterArgument:
          'For weekly or less-frequent symptoms, the Holter window is too short. Multiple guideline statements (ACC/AHA/HRS 2017, HRS 2015) recommend matching monitor duration to symptom frequency. A 30-day monitor is the appropriate next step when a Holter is non-diagnostic.',
        citationLabel: 'ACC/AHA/HRS 2018 syncope guideline',
      },
    ],
    specialistReferralPath: 'PCP can usually order. Cardiology if they refuse.',
    costExpectations:
      '$500 to $2,000 billed depending on monitor type. Usually covered with prior authorization.',
    sources: [
      {
        label: 'Shen WK et al. 2017 ACC/AHA/HRS syncope guideline (Circulation)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/28280232/',
      },
    ],
  },
  {
    slug: 'echocardiogram',
    label: 'Echocardiogram (TTE)',
    category: 'cardiology',
    subtitle: 'Ultrasound of the heart. Looks at structure and function.',
    whatItIs:
      'An ultrasound probe is moved across your chest and ribs to image the heart in motion. The cardiologist measures chamber sizes, ejection fraction (how forcefully the heart pumps), valve function, and looks for structural problems like a hole between chambers or a thickened wall.',
    whyOrdered:
      'For POTS workup, a TTE rules out structural causes of tachycardia and confirms the heart itself is normal. For chest pain, dyspnea, or unexplained fatigue, it is the standard first-line cardiac imaging. EDS patients also need it because of higher prevalence of mitral valve prolapse and aortic root dilation.',
    pcpScript:
      'I am being worked up for POTS / unexplained tachycardia / chest pain. I would like an echocardiogram to rule out structural heart disease before we attribute symptoms to dysautonomia. For EDS specifically, the EDS Society recommends a baseline echo to check for valve and aortic root involvement.',
    whatToExpect:
      'No prep usually needed. You lie on your left side, gel is applied to your chest, and the tech moves the probe to capture views from several angles. Takes 30 to 45 minutes. Painless. You may be asked to hold your breath briefly during certain views.',
    resultsInterpretation:
      'Reports include ejection fraction (normal is 55 to 70 percent), chamber sizes, wall thickness, valve function, and any noted abnormalities. For EDS, the aortic root diameter is the load-bearing measurement; values above 40 mm in an adult flag for vascular workup.',
    denialPushback: [
      {
        denialReason: 'No cardiac symptoms; not medically necessary.',
        counterArgument:
          'For confirmed or suspected hypermobile EDS, the EDS Society 2017 international classification recommends baseline echocardiogram at diagnosis to screen for aortic root dilation and mitral valve prolapse. This is a guideline-supported indication that does not require active cardiac symptoms.',
        citationLabel: 'EDS Society 2017 hEDS criteria',
      },
      {
        denialReason: 'Try a simpler test first.',
        counterArgument:
          'TTE is the simplest non-invasive cardiac imaging available. There is no less-invasive alternative that provides the structural data needed.',
      },
    ],
    specialistReferralPath:
      'PCP can order in most networks. Cardiology if denied or for follow-up.',
    costExpectations:
      'Typically $1,000 to $3,000 billed. Usually covered when there is a cardiac indication; specialist visit copay plus coinsurance.',
    sources: [
      {
        label: 'Malfait F et al. 2017 international EDS classification (Am J Med Genet)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/28306229/',
      },
      {
        label: 'ACC appropriate use criteria for echocardiography',
        href: 'https://www.acc.org/Guidelines/Appropriate-Use-Criteria',
      },
    ],
  },
  {
    slug: 'cardiac-mri',
    label: 'Cardiac MRI',
    category: 'cardiology',
    subtitle: 'High-detail imaging of heart muscle, scar, and inflammation.',
    whatItIs:
      'An MRI focused on the heart. Unlike echo, MRI can detect myocardial inflammation (myocarditis), scar tissue from prior infarction, and infiltrative diseases. Often performed with gadolinium contrast for tissue characterization.',
    whyOrdered:
      'When echo or symptoms suggest something the ultrasound cannot characterize: post-COVID myocarditis, suspected cardiomyopathy, unexplained ventricular ectopy, or athlete-style heart adaptation versus pathology. For long-COVID and post-viral POTS, MRI can identify subclinical myocarditis.',
    pcpScript:
      'My echocardiogram showed [finding], or I have unexplained palpitations and a recent viral illness, and I would like a cardiac MRI to look for myocarditis or structural change that an echo would not detect.',
    whatToExpect:
      '45 to 90 minutes inside the MRI tube. You lie still on your back; ECG leads are placed; you hold your breath for short stretches during image acquisition. If contrast is used, an IV is placed. Loud knocking sounds; earplugs are provided. People with claustrophobia should ask about open MRI or sedation.',
    resultsInterpretation:
      'Report describes ventricular volumes, ejection fraction, valve function, and tissue characterization on T1 / T2 / late gadolinium enhancement (LGE). Patchy LGE in a non-coronary distribution suggests myocarditis. Diffuse fibrosis raises concern for cardiomyopathy.',
    denialPushback: [
      {
        denialReason: 'Echo was normal; MRI not indicated.',
        counterArgument:
          'Echo cannot characterize myocardial tissue. The Society for Cardiovascular Magnetic Resonance and ACC consensus name cardiac MRI as the imaging standard for suspected myocarditis, infiltrative cardiomyopathies, and unexplained ventricular arrhythmia. A normal echo does not rule out these conditions.',
        citationLabel: 'SCMR / ACC consensus on cardiac MRI',
      },
    ],
    specialistReferralPath: 'Cardiology, often referred to a center with cardiac MRI capability.',
    costExpectations:
      'Typically $2,000 to $5,000 billed. Almost always requires prior authorization. With approval, cost share is the imaging coinsurance up to your deductible.',
    sources: [
      {
        label: 'Leiner T et al. SCMR clinical indications consensus (J Cardiovasc Magn Reson)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/33256790/',
      },
    ],
  },
  // ──────────────────────────────────────────────────────────────
  // NEUROLOGY
  // ──────────────────────────────────────────────────────────────
  {
    slug: 'brain-mri',
    label: 'Brain MRI (with and without contrast)',
    category: 'neurology',
    subtitle: 'High-resolution imaging of the brain. The neurologic workhorse test.',
    whatItIs:
      'An MRI of the brain, often run as two passes: one without contrast for structural and one with gadolinium contrast highlighting blood-brain-barrier breakdown, inflammation, or vascular lesions. Standard for unexplained migraine red flags, MS evaluation, and structural workup.',
    whyOrdered:
      'For chronic migraine with red-flag features (sudden onset, worst-ever, progressive, focal symptoms), to rule out tumor, vascular malformation, MS lesions, Chiari malformation, or pituitary lesion. For EDS patients, also screens for craniocervical instability and intracranial hypertension.',
    pcpScript:
      'I have chronic migraine that has changed pattern recently / I have new neurologic symptoms / I have suspected EDS and want to screen for Chiari and craniocervical instability. I would like a brain MRI with and without contrast. If you cannot order it directly, can you refer me to neurology?',
    whatToExpect:
      'No food restriction usually. Remove all metal. You lie on your back on a table that slides into the tube. Total time 30 to 60 minutes. If contrast, an IV is placed. Loud knocking; earplugs and headphones provided. You can hold a panic button. Some people feel claustrophobic; ask about open MRI or anxiolytic premedication.',
    resultsInterpretation:
      'Report describes any structural lesions, white matter changes, ventricle size, and any contrast-enhancing areas. Migraine patients commonly show non-specific T2 hyperintensities (white-matter spots) that do not change management. MS lesions have a characteristic distribution. Chiari is graded by the degree of cerebellar tonsillar descent below the foramen magnum.',
    denialPushback: [
      {
        denialReason: 'Migraine without red flags; imaging not indicated.',
        counterArgument:
          'AAN and American Headache Society guidance does say routine imaging is not needed for stable migraine. But several features mandate imaging: change in pattern, new neurologic deficit, onset after age 50, exertional or thunderclap headache, or known immunosuppression. Document which red flag applies in your request.',
        citationLabel: 'AHS/AAN headache imaging guidance',
      },
      {
        denialReason: 'No contrast needed.',
        counterArgument:
          'Without-and-with contrast is the standard sequence when looking for inflammatory, infectious, or neoplastic lesions. A non-contrast MRI cannot rule these out.',
      },
    ],
    specialistReferralPath:
      'Neurology. For Chiari / EDS specifically, request a center experienced with hypermobility-related neurologic conditions.',
    costExpectations:
      'Typically $1,500 to $4,000 billed for both sequences. Almost always requires prior authorization. Cost share is the imaging coinsurance up to your deductible.',
    relatedTopicHrefs: [{ href: '/v2/topics/orthostatic', label: 'Orthostatic deep-dive' }],
    sources: [
      {
        label: 'Loder E et al. Choosing Wisely AHS imaging recommendations',
        href: 'https://americanheadachesociety.org/news/five-things-physicians-and-patients-should-question/',
      },
      {
        label: 'AAN practice parameter on neuroimaging in migraine',
        href: 'https://pubmed.ncbi.nlm.nih.gov/8071225/',
      },
    ],
  },
  {
    slug: 'mra',
    label: 'MRA (magnetic resonance angiography)',
    category: 'neurology',
    subtitle: 'MRI imaging focused on blood vessels.',
    whatItIs:
      'An MRI sequence that visualizes arteries (and sometimes veins) without iodinated contrast in many cases. For brain workup, MRA looks at the circle of Willis and major intracranial vessels for aneurysm, stenosis, dissection, or vascular malformation.',
    whyOrdered:
      'When workup raises concern for aneurysm, vascular malformation, or arterial dissection. For EDS, especially vascular EDS, periodic vascular surveillance is indicated. For thunderclap headache, MRA is part of the standard workup alongside MRI.',
    pcpScript:
      'I have [thunderclap headache / family history of aneurysm / suspected vascular EDS]. In addition to a brain MRI, I would like an MRA of the head and neck to evaluate for aneurysm, dissection, or vascular malformation.',
    whatToExpect:
      'Same logistics as a brain MRI. May or may not use contrast depending on the technique. Total time 45 to 75 minutes if combined with brain MRI.',
    resultsInterpretation:
      'Report describes vessel patency, any aneurysmal dilation (with size measured in mm), stenosis, dissection flaps, or vascular malformations. Aneurysms under 5 mm are often surveilled rather than treated; larger ones may require neurosurgical or interventional consultation.',
    denialPushback: [
      {
        denialReason: 'No clinical indication beyond MRI.',
        counterArgument:
          'Vascular pathology can present with normal parenchymal MRI. AHA / American Stroke Association guidance lists MRA as appropriate for screening when family history of aneurysm or known connective tissue disease (especially vascular EDS) is present.',
        citationLabel: 'AHA/ASA aneurysm screening guidance',
      },
    ],
    specialistReferralPath: 'Neurology or vascular surgery.',
    costExpectations: 'Typically $1,500 to $3,500 added when bundled with brain MRI.',
    sources: [
      {
        label: 'Thompson BG et al. AHA/ASA unruptured intracranial aneurysm guidelines (Stroke)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/26103745/',
      },
    ],
  },
  {
    slug: 'eeg',
    label: 'EEG (electroencephalogram)',
    category: 'neurology',
    subtitle: 'Records electrical activity of the brain.',
    whatItIs:
      'Electrodes are placed on your scalp with a conductive paste; the device records brain electrical activity for 20 to 60 minutes. Variants include sleep-deprived EEG, ambulatory EEG (24 to 72 hours), and continuous video EEG (inpatient).',
    whyOrdered:
      'To evaluate for seizure activity in unexplained loss of consciousness, episodes that look like seizure, or migraine variants with focal symptoms. Helpful when distinguishing syncope (POTS related) from seizure.',
    pcpScript:
      'I have had episodes of [loss of awareness / unusual sensation / movements] that I and my doctors are not sure are syncope or seizure. I would like an EEG to help differentiate.',
    whatToExpect:
      'Wash hair the night before; no conditioner or product. The tech glues 20 to 25 small electrodes to your scalp. You sit or lie still while the recording runs. You may be asked to hyperventilate or look at a strobe (these are activation maneuvers). Standard EEG is 30 to 60 minutes; ambulatory monitors can run for days.',
    resultsInterpretation:
      'Report describes background rhythm, any focal slowing, and epileptiform discharges (spikes, sharp waves). A normal EEG does not rule out epilepsy because it is a snapshot.',
    denialPushback: [
      {
        denialReason: 'No witnessed seizure; not indicated.',
        counterArgument:
          'AAN guidance recommends EEG in the workup of any first unexplained event of altered consciousness, especially when the differential includes both syncope and seizure. The point of the test is the differential.',
        citationLabel: 'AAN EEG guidelines',
      },
    ],
    specialistReferralPath: 'Neurology.',
    costExpectations: 'Typically $200 to $1,000 billed for routine EEG; ambulatory studies cost more.',
    sources: [
      {
        label: 'Krumholz A et al. AAN evidence-based guideline first unprovoked seizure (Neurology)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/25401570/',
      },
    ],
  },
  {
    slug: 'sleep-study',
    label: 'Sleep study (polysomnography)',
    category: 'neurology',
    subtitle: 'Overnight monitoring of sleep stages, breathing, and heart rhythm.',
    whatItIs:
      'You sleep at a sleep lab (or sometimes at home with a portable kit) while sensors record EEG, eye movements, muscle tone, breathing, oxygen saturation, and heart rhythm. The polysomnographer scores sleep stages and apnea events.',
    whyOrdered:
      'For unrefreshing sleep that the Oura ring or other trackers suggest is fragmented; for suspected sleep apnea (snoring, witnessed apneas, BMI risk); for unexplained daytime fatigue; for parasomnias. Particularly important in POTS where untreated sleep-disordered breathing worsens autonomic symptoms.',
    pcpScript:
      'I have unrefreshing sleep, daytime fatigue, and [snoring / witnessed apneas / morning headaches / frequent wake-ups]. I would like a polysomnography to evaluate for sleep apnea and other sleep disorders. If you can start with a home sleep apnea test, that is fine, but if it is negative I want to escalate to in-lab.',
    whatToExpect:
      'In-lab: arrive in the evening, change into pajamas, sensors applied (about 45 minutes of setup). You sleep in a private room while the tech monitors from another room. Out by morning. Home tests use a chest belt, finger oximeter, and nasal cannula; you sleep in your own bed. The home test misses subtler events but is enough to rule in obstructive sleep apnea.',
    resultsInterpretation:
      'Report includes total sleep time, sleep stages, AHI (apnea-hypopnea index), oxygen nadir, and heart rate trends. AHI under 5 is normal; 5 to 15 is mild OSA; 15 to 30 is moderate; over 30 is severe. Treatment thresholds vary; even mild OSA may warrant CPAP if symptoms are significant.',
    denialPushback: [
      {
        denialReason: 'Try a home sleep test first.',
        counterArgument:
          'Home tests are appropriate for high-pretest-probability OSA in otherwise healthy adults. They are inadequate for evaluating insomnia, parasomnia, central sleep apnea, restless legs, or any complex sleep complaint. AASM clinical practice guidelines limit home tests to uncomplicated suspected OSA.',
        citationLabel: 'AASM home sleep apnea testing clinical practice guideline',
      },
    ],
    specialistReferralPath: 'Sleep medicine; PCP can refer.',
    costExpectations:
      'In-lab study: $1,000 to $3,000. Home study: $200 to $500. Usually covered with prior authorization.',
    sources: [
      {
        label: 'Kapur VK et al. AASM clinical practice guideline OSA diagnostic testing',
        href: 'https://pubmed.ncbi.nlm.nih.gov/28162150/',
      },
    ],
  },
  {
    slug: 'lumbar-puncture',
    label: 'Lumbar puncture (CSF analysis)',
    category: 'neurology',
    subtitle: 'Sampling spinal fluid. Diagnostic and sometimes therapeutic.',
    whatItIs:
      'A needle is placed in the lower back, between two lumbar vertebrae, to collect cerebrospinal fluid for analysis. Opening pressure is measured at the start. Performed bedside under sterile conditions, often with imaging guidance.',
    whyOrdered:
      'For suspected meningitis or encephalitis (urgent), MS workup, idiopathic intracranial hypertension (IIH), spontaneous intracranial hypotension (CSF leak), or unexplained headache that imaging cannot explain. For EDS-related new daily persistent headache, ruling out CSF leak is critical and often delayed.',
    pcpScript:
      'I have [chronic daily headache that worsens when upright / suspected IIH with elevated ICP signs / new neurologic symptoms with abnormal MRI]. I would like a lumbar puncture to measure opening pressure and analyze CSF. This is best done by neurology or interventional radiology under fluoroscopy.',
    whatToExpect:
      'You lie on your side curled up or sit hunched forward. The skin is cleaned, lidocaine numbs the area, and a thin needle is inserted. Some pressure but not sharp pain. Opening pressure is measured, CSF is collected (a few teaspoons), and the needle is removed. Lie flat for 1 to 2 hours after to reduce risk of post-LP headache. Drink fluids and limit lifting for 24 hours.',
    resultsInterpretation:
      'Opening pressure (normal 6 to 25 cm H2O in adults), cell count, protein, glucose, and any specific testing (oligoclonal bands for MS, viral PCR, autoantibodies). High opening pressure suggests IIH; low pressure suggests CSF leak. Elevated white cells suggest infection or inflammation.',
    denialPushback: [
      {
        denialReason: 'Imaging is normal; LP not needed.',
        counterArgument:
          'CSF leaks and IIH frequently have normal MRI. Opening pressure measurement requires LP. AAN guidance and the International Headache Society support LP when CSF pressure abnormality is part of the differential and imaging is non-diagnostic.',
        citationLabel: 'AAN headache evaluation guidance',
      },
    ],
    specialistReferralPath:
      'Neurology, or interventional radiology under fluoroscopy (preferred for difficult anatomy or high body weight).',
    costExpectations:
      '$500 to $2,000 for the procedure plus $200 to $800 for CSF lab analysis.',
    sources: [
      {
        label: 'Schievink WI. Spontaneous intracranial hypotension (NEJM)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/34784121/',
      },
      {
        label: 'Mollan SP et al. IIH consensus guidelines',
        href: 'https://pubmed.ncbi.nlm.nih.gov/29903905/',
      },
    ],
  },
  {
    slug: 'emg-ncs',
    label: 'EMG and nerve conduction study',
    category: 'neurology',
    subtitle: 'Tests for nerve and muscle function.',
    whatItIs:
      'Two paired tests: nerve conduction study (NCS) sends small electrical pulses along nerves and measures the response; needle EMG inserts a thin needle into selected muscles to record electrical activity at rest and during contraction.',
    whyOrdered:
      'For unexplained weakness, numbness, tingling, or muscle atrophy. For suspected small fiber neuropathy in POTS / EDS, conventional EMG/NCS is normal because it measures large fibers; you may need a skin biopsy instead.',
    pcpScript:
      'I have unexplained [weakness / numbness / tingling / muscle wasting]. I would like an EMG with nerve conduction study to evaluate. If small fiber neuropathy is on the differential, please also discuss skin biopsy because EMG/NCS will not detect it.',
    whatToExpect:
      'NCS first: small electrodes are placed on the skin and brief shocks are delivered. Uncomfortable but quick. Then EMG: thin needles into specific muscles; you contract the muscle while the device records. Some soreness for 24 to 48 hours after. Total time 45 to 90 minutes.',
    resultsInterpretation:
      'NCS report includes amplitude, latency, and conduction velocity for tested nerves. EMG describes spontaneous activity (fibrillations, fasciculations) and motor unit morphology. Patterns suggest neuropathy versus myopathy versus normal.',
    denialPushback: [
      {
        denialReason: 'Symptoms are subjective; no objective deficit on exam.',
        counterArgument:
          'Subjective symptoms can precede objective findings on neurologic exam. AAN guidance supports EMG/NCS in the workup of paresthesias, weakness, or unexplained pain when neuropathy is on the differential.',
        citationLabel: 'AAN practice parameter on neuropathy evaluation',
      },
    ],
    specialistReferralPath: 'Neurology, often with subspecialty in neuromuscular medicine.',
    costExpectations: '$500 to $2,000 billed.',
    sources: [
      {
        label: 'England JD et al. AAN practice parameter on distal symmetric polyneuropathy',
        href: 'https://pubmed.ncbi.nlm.nih.gov/19171837/',
      },
    ],
  },
  // ──────────────────────────────────────────────────────────────
  // ALLERGY / IMMUNOLOGY (MCAS WORKUP)
  // ──────────────────────────────────────────────────────────────
  {
    slug: 'tryptase',
    label: 'Tryptase (baseline and post-flare)',
    category: 'allergy-immunology',
    subtitle: 'Marker for mast cell activation. Timing is everything.',
    whatItIs:
      'A blood test for tryptase, a protein released by mast cells. Baseline tryptase reflects mast cell burden over time. Post-flare tryptase, drawn within a specific time window, captures acute mast cell activation.',
    whyOrdered:
      'Suspected mast cell activation syndrome (MCAS), systemic mastocytosis, or unexplained anaphylaxis. The post-flare draw is the most useful for MCAS diagnosis, because baseline tryptase is normal in most MCAS patients.',
    pcpScript:
      'I have symptoms consistent with mast cell activation: flushing, hives, GI upset, lightheadedness, and a clear trigger pattern. I would like a baseline tryptase. When I have a flare, I want the lab order in hand so I can get a post-flare tryptase drawn within 1 to 4 hours of the reaction starting; this is the time window where it will be elevated.',
    whatToExpect:
      'Standard blood draw. The critical detail is timing for the post-flare sample: it must be drawn within 1 to 4 hours of symptom onset to be diagnostically useful, with a follow-up baseline at least 24 hours after symptoms resolve.',
    resultsInterpretation:
      'A 20 percent increase from baseline plus 2 ng/mL during a flare is diagnostic of mast cell activation per the international consensus criteria (Akin et al. 2010). A baseline tryptase over 11.4 ng/mL raises concern for mastocytosis and prompts further workup. Many MCAS patients have normal baseline tryptase; do not let a normal baseline rule out the diagnosis.',
    denialPushback: [
      {
        denialReason: 'Standalone allergy panel is sufficient.',
        counterArgument:
          'Standard IgE testing detects classic allergy. MCAS involves non-IgE mast cell activation that conventional allergy panels miss. The 2010 international consensus criteria (Akin, Valent, Metcalfe) explicitly require tryptase as the primary biomarker.',
        citationLabel: 'Akin C et al. 2010 MCAS consensus criteria',
      },
      {
        denialReason: 'Tryptase was normal so MCAS ruled out.',
        counterArgument:
          'A normal baseline does not rule out MCAS. Per consensus criteria, the post-flare draw within 1 to 4 hours of symptoms is what establishes the diagnosis, alongside elevated 24-hour urine N-methylhistamine and prostaglandin metabolites.',
      },
    ],
    specialistReferralPath:
      'Allergy / immunology, ideally a center experienced with MCAS. Mast Cell Diseases Society maintains a clinician list.',
    costExpectations: '$50 to $200 per draw. Usually covered.',
    sources: [
      {
        label: 'Akin C et al. 2010 mast cell activation consensus criteria (J Allergy Clin Immunol)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/20633745/',
      },
      {
        label: 'Valent P et al. Diagnostic criteria for mast cell activation syndrome',
        href: 'https://pubmed.ncbi.nlm.nih.gov/22041891/',
      },
      {
        label: 'The Mast Cell Disease Society',
        href: 'https://tmsforacure.org/',
      },
    ],
  },
  {
    slug: 'plasma-histamine',
    label: 'Plasma histamine',
    category: 'allergy-immunology',
    subtitle: 'Captures acute histamine release. Even more time-sensitive than tryptase.',
    whatItIs:
      'A blood test measuring plasma histamine, released alongside tryptase from activated mast cells. Histamine has a much shorter half-life so the draw window is very narrow.',
    whyOrdered:
      'As part of an MCAS workup alongside tryptase. A positive plasma histamine in the right window strengthens the case when tryptase is borderline.',
    pcpScript:
      'Along with tryptase, I would like a plasma histamine drawn during a flare. I understand the sample needs to go to the lab on ice within 30 minutes for a valid result.',
    whatToExpect:
      'Standard blood draw. The lab handling is the hard part. Sample must be kept cold and processed within 30 minutes; many labs cannot meet that, so the draw should be planned at a hospital lab capable of handling it.',
    resultsInterpretation:
      'Reference range varies by lab; a sharp elevation above baseline supports mast cell activation. A normal value does not rule out MCAS.',
    denialPushback: [
      {
        denialReason: 'Tryptase is sufficient; histamine adds no value.',
        counterArgument:
          'Histamine and tryptase have different release kinetics and capture different windows. The 2010 MCAS consensus criteria recommend assessing multiple mast cell mediators because no single one is sensitive enough alone.',
        citationLabel: 'Akin C et al. 2010 MCAS consensus criteria',
      },
    ],
    specialistReferralPath: 'Allergy / immunology with a hospital-affiliated lab.',
    costExpectations: '$50 to $150.',
    sources: [
      {
        label: 'Akin C et al. 2010 mast cell activation consensus criteria',
        href: 'https://pubmed.ncbi.nlm.nih.gov/20633745/',
      },
    ],
  },
  {
    slug: 'urine-n-methylhistamine',
    label: '24-hour urine N-methylhistamine',
    category: 'allergy-immunology',
    subtitle: 'Captures cumulative mast cell activity over a day.',
    whatItIs:
      'A 24-hour urine collection measuring N-methylhistamine, the major histamine metabolite. Because urine integrates over the collection period, this test is less timing-sensitive than plasma draws.',
    whyOrdered:
      'A core part of MCAS workup. Captures activation that intermittent symptoms might miss on a single blood draw.',
    pcpScript:
      'I would like a 24-hour urine collection for N-methylhistamine, ideally during a symptom flare. This is part of the standard MCAS workup alongside tryptase and prostaglandin metabolites.',
    whatToExpect:
      'Pick up the collection container at the lab. Start the morning of day 1 by emptying your bladder into the toilet (this urine is discarded). Collect every subsequent void into the container, kept refrigerated. Final void at the same time on day 2 goes into the container. Drop off promptly.',
    resultsInterpretation:
      'Reference range varies by lab. Elevation supports mast cell activation. A negative test in a single 24-hour window does not rule out MCAS.',
    denialPushback: [
      {
        denialReason: 'Inconvenient and not specific enough.',
        counterArgument:
          'The 24-hour collection window catches events a single blood draw will miss. It is a guideline-supported component of MCAS workup per Valent et al. 2012 international criteria.',
        citationLabel: 'Valent P et al. 2012 MCAS criteria',
      },
    ],
    specialistReferralPath: 'Allergy / immunology.',
    costExpectations: '$100 to $300.',
    sources: [
      {
        label: 'Valent P et al. Diagnostic criteria for MCAS',
        href: 'https://pubmed.ncbi.nlm.nih.gov/22041891/',
      },
    ],
  },
  {
    slug: 'prostaglandin-d2',
    label: 'Prostaglandin D2 (urine and serum)',
    category: 'allergy-immunology',
    subtitle: 'Another mast cell mediator with different kinetics from histamine.',
    whatItIs:
      'Prostaglandin D2 (PGD2) and its metabolites are produced by activated mast cells. Often measured in 24-hour urine alongside N-methylhistamine.',
    whyOrdered:
      'Adds specificity to the MCAS workup; some patients release PGD2 more than histamine, so testing only one metabolite misses cases.',
    pcpScript:
      'Please add 24-hour urine prostaglandin D2 metabolites to the MCAS workup. Consensus criteria recommend at least two elevated mast cell mediators alongside symptoms for diagnosis.',
    whatToExpect:
      'Combined with the N-methylhistamine collection in most labs. Same protocol.',
    resultsInterpretation:
      'Elevated values support mast cell activation. As with histamine, a single negative collection does not rule out MCAS.',
    denialPushback: [
      {
        denialReason: 'Redundant with histamine testing.',
        counterArgument:
          'PGD2 and histamine are independently released; some MCAS patients have one elevated and not the other. Multi-mediator testing is standard per international consensus.',
        citationLabel: 'Valent P et al. 2012 MCAS criteria',
      },
    ],
    specialistReferralPath: 'Allergy / immunology.',
    costExpectations: '$100 to $400.',
    sources: [
      {
        label: 'Valent P et al. Diagnostic criteria for MCAS',
        href: 'https://pubmed.ncbi.nlm.nih.gov/22041891/',
      },
    ],
  },
  {
    slug: 'bone-marrow-biopsy',
    label: 'Bone marrow biopsy',
    category: 'allergy-immunology',
    subtitle: 'The definitive test for mastocytosis. Reserved for high suspicion.',
    whatItIs:
      'A needle is inserted into the back of the hip bone (posterior iliac crest) to extract bone marrow for analysis. Tissue is examined for mast cell aggregates and tested for the KIT D816V mutation.',
    whyOrdered:
      'When tryptase is persistently over 20 ng/mL, when KIT D816V is detected in peripheral blood, or when there is unexplained hepatosplenomegaly or skin lesions concerning for mastocytosis. Not part of routine MCAS workup; reserved for high suspicion of systemic mastocytosis.',
    pcpScript:
      'My baseline tryptase is persistently over 20 / I have detected KIT D816V in blood / I have skin findings concerning for mastocytosis. I would like a referral to hematology for bone marrow biopsy to evaluate for systemic mastocytosis.',
    whatToExpect:
      'Done by hematology in a procedure room. Local anesthetic numbs the area; you feel pressure as the needle goes in and a deep ache when marrow is aspirated. Procedure takes 20 to 30 minutes. Soreness at the site for several days.',
    resultsInterpretation:
      'Pathology looks for multifocal mast cell aggregates (more than 15 cells), abnormal mast cell morphology, CD25 / CD2 surface expression, KIT mutation, and elevated tryptase. The WHO criteria for systemic mastocytosis require specific combinations of these findings.',
    denialPushback: [
      {
        denialReason: 'Invasive; try less invasive testing first.',
        counterArgument:
          'Less invasive testing has been completed. The WHO 2016 classification of myeloid neoplasms requires bone marrow biopsy for definitive diagnosis of systemic mastocytosis when peripheral findings are suggestive.',
        citationLabel: 'WHO 2016 mastocytosis classification',
      },
    ],
    specialistReferralPath: 'Hematology, ideally with mastocytosis experience.',
    costExpectations: '$2,000 to $5,000.',
    sources: [
      {
        label: 'Valent P et al. WHO classification of mastocytosis (Blood)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/27069254/',
      },
    ],
  },
  // ──────────────────────────────────────────────────────────────
  // GASTROENTEROLOGY
  // ──────────────────────────────────────────────────────────────
  {
    slug: 'egd',
    label: 'Upper endoscopy (EGD)',
    category: 'gastroenterology',
    subtitle: 'Camera through the mouth into the stomach and duodenum.',
    whatItIs:
      'A thin flexible scope is passed through the mouth into the esophagus, stomach, and first portion of the small intestine. Performed under sedation. The doctor can take biopsies of any abnormal areas.',
    whyOrdered:
      'For unexplained nausea, vomiting, dysphagia, weight loss, persistent reflux that does not respond to PPI, suspected celiac disease (with duodenal biopsy), or unexplained iron deficiency anemia.',
    pcpScript:
      'I have [persistent nausea / dysphagia / unexplained iron deficiency / suspected celiac]. I would like a referral to gastroenterology for an upper endoscopy with biopsies.',
    whatToExpect:
      'Nothing by mouth for 6 to 8 hours before. IV sedation is given. The procedure takes 15 to 30 minutes. You wake in recovery; sore throat is common for a day. No driving for 24 hours after sedation.',
    resultsInterpretation:
      'Endoscopist reports any visible abnormalities (esophagitis, ulcers, erosions, varices) and biopsy results follow in 5 to 10 days. Biopsies can detect H. pylori, eosinophilic esophagitis, celiac, gastritis.',
    denialPushback: [
      {
        denialReason: 'Try a longer PPI trial first.',
        counterArgument:
          'For symptoms that have failed an adequate PPI trial (8 weeks), or for alarm features (dysphagia, weight loss, anemia, persistent vomiting), AGA and ACG guidelines recommend EGD without further empirical therapy. Document which alarm feature applies.',
        citationLabel: 'AGA Clinical Practice Update on GERD evaluation',
      },
    ],
    specialistReferralPath: 'Gastroenterology.',
    costExpectations: '$1,500 to $4,000 with sedation.',
    sources: [
      {
        label: 'Katz PO et al. ACG guideline for GERD diagnosis and management',
        href: 'https://pubmed.ncbi.nlm.nih.gov/34807007/',
      },
    ],
  },
  {
    slug: 'colonoscopy',
    label: 'Colonoscopy',
    category: 'gastroenterology',
    subtitle: 'Camera through the colon. Both screening and diagnostic.',
    whatItIs:
      'A flexible scope is passed through the rectum into the colon and terminal ileum. The doctor inspects the mucosa, removes polyps, and takes biopsies of any abnormal areas. Performed under sedation.',
    whyOrdered:
      'For unexplained rectal bleeding, persistent change in bowel habit, suspected inflammatory bowel disease, iron deficiency anemia (especially in adults over 50), or per screening guidelines starting at age 45.',
    pcpScript:
      'I have [rectal bleeding / chronic diarrhea / unexplained iron deficiency / family history of colorectal cancer]. I would like a referral to gastroenterology for a colonoscopy with biopsies. Please make sure the order specifies diagnostic indication so it is not coded as screening (which can affect coverage).',
    whatToExpect:
      'Clear-liquid diet for 24 hours before, then the bowel prep (a gallon of polyethylene glycol solution) the evening before and morning of. The prep is the worst part. IV sedation during the procedure. Total time 30 to 60 minutes. Recovery for an hour. No driving for 24 hours.',
    resultsInterpretation:
      'Endoscopist reports findings and pathology follows. Polyps are categorized by histology and size; surveillance interval depends on findings.',
    denialPushback: [
      {
        denialReason: 'Routine screening not yet indicated by age.',
        counterArgument:
          'This is not a screening colonoscopy; it is a diagnostic procedure for documented symptoms. Diagnostic indications (bleeding, anemia, IBD workup) are covered at any age.',
      },
    ],
    specialistReferralPath: 'Gastroenterology.',
    costExpectations:
      '$2,000 to $5,000. Screening colonoscopies are usually 100 percent covered under ACA. Diagnostic colonoscopies are subject to deductible and coinsurance.',
    sources: [
      {
        label: 'Shaukat A et al. ACG colorectal cancer screening guideline',
        href: 'https://pubmed.ncbi.nlm.nih.gov/33625375/',
      },
    ],
  },
  {
    slug: 'sibo-breath-test',
    label: 'Hydrogen breath test (SIBO)',
    category: 'gastroenterology',
    subtitle: 'Tests for small intestinal bacterial overgrowth.',
    whatItIs:
      'You drink a sugar solution (glucose or lactulose), then breathe into a collection bag every 15 to 30 minutes for 2 to 3 hours. Bacteria in the small intestine ferment the sugar and produce hydrogen and methane, which appear in your breath.',
    whyOrdered:
      'For chronic bloating, diarrhea, or abdominal pain that started after antibiotic exposure, abdominal surgery, or a gut infection. For POTS and EDS patients, slowed motility increases SIBO risk.',
    pcpScript:
      'I have chronic bloating, alternating bowel habits, and post-meal symptoms. I would like a hydrogen breath test for SIBO. Please specify lactulose substrate; it is more sensitive than glucose for distal small bowel overgrowth.',
    whatToExpect:
      'Strict prep: low-fiber diet for 24 hours, fast for 12 hours, no antibiotics for 4 weeks before, no laxatives or PPIs for 2 weeks. The test itself takes 2 to 3 hours; you sit in the lab and breathe into bags on a schedule.',
    resultsInterpretation:
      'A rise in hydrogen of 20 ppm above baseline within 90 minutes suggests SIBO. A rise in methane of 10 ppm at any point suggests intestinal methanogen overgrowth (IMO). Many labs follow the North American Consensus.',
    denialPushback: [
      {
        denialReason: 'Try empirical antibiotics first.',
        counterArgument:
          'Empirical rifaximin without a breath test is sometimes appropriate, but objective testing helps tailor therapy (rifaximin alone vs. plus neomycin for IMO) and identify cases that will not respond. The North American Consensus (Pimentel et al. 2020) supports breath testing for these distinctions.',
        citationLabel: 'Pimentel M et al. 2020 North American Consensus on breath testing',
      },
    ],
    specialistReferralPath: 'Gastroenterology.',
    costExpectations: '$200 to $500. Often not covered without prior auth.',
    sources: [
      {
        label: 'Pimentel M et al. ACG North American Consensus on hydrogen breath testing',
        href: 'https://pubmed.ncbi.nlm.nih.gov/32418184/',
      },
    ],
  },
  {
    slug: 'gastric-emptying-study',
    label: 'Gastric emptying study (scintigraphy)',
    category: 'gastroenterology',
    subtitle: 'Measures how fast your stomach empties.',
    whatItIs:
      'You eat a standardized meal (usually scrambled eggs with a small amount of radioactive tracer) and lie under a gamma camera at intervals over 4 hours. The scan tracks how much of the meal has left the stomach.',
    whyOrdered:
      'For early satiety, post-meal nausea, vomiting of undigested food, bloating after small meals; suspected gastroparesis. POTS patients have higher rates of gastroparesis.',
    pcpScript:
      'I have early satiety, post-meal nausea, and bloating with small meals. I would like a 4-hour gastric emptying study to evaluate for gastroparesis. The 90-minute study is not adequate; the 4-hour version is the diagnostic standard.',
    whatToExpect:
      'No food after midnight. Nothing slowing the gut for 48 hours (no opioids, no GLP-1 agonists, no anticholinergics). At the lab you eat the test meal and lie on a table; you are scanned at 0, 1, 2, and 4 hours. Bring a book.',
    resultsInterpretation:
      'Normal: less than 10 percent retention at 4 hours. Mild gastroparesis: 10 to 20 percent. Moderate: 20 to 35 percent. Severe: greater than 35 percent. The 4-hour value is the most reliable.',
    denialPushback: [
      {
        denialReason: 'Symptoms are functional; not necessary.',
        counterArgument:
          'AGA and ANMS guidance lists gastric emptying scintigraphy as the diagnostic standard for suspected gastroparesis. Functional dyspepsia and gastroparesis present similarly; objective testing distinguishes them and changes treatment.',
        citationLabel: 'AGA gastroparesis guideline',
      },
    ],
    specialistReferralPath: 'Gastroenterology, often with motility expertise.',
    costExpectations: '$1,000 to $2,500.',
    sources: [
      {
        label: 'Camilleri M et al. ACG clinical guideline on gastroparesis',
        href: 'https://pubmed.ncbi.nlm.nih.gov/35147643/',
      },
    ],
  },
  {
    slug: 'capsule-endoscopy',
    label: 'Capsule endoscopy',
    category: 'gastroenterology',
    subtitle: 'A camera in a swallowed pill images the small intestine.',
    whatItIs:
      'You swallow a vitamin-sized capsule containing a tiny camera that takes thousands of pictures as it moves through your small intestine. A recorder worn on a belt collects the images. The capsule passes naturally.',
    whyOrdered:
      'When EGD and colonoscopy do not explain GI symptoms; for suspected small bowel Crohn disease, obscure GI bleeding, or unexplained iron deficiency anemia after negative upper and lower scopes.',
    pcpScript:
      'EGD and colonoscopy were both negative; I still have unexplained [GI bleeding / iron deficiency / abdominal pain]. I would like a capsule endoscopy to image the small bowel.',
    whatToExpect:
      'Clear liquid diet the day before; nothing after midnight. Swallow the capsule in the morning at the GI office; wear the recorder for 8 to 12 hours. You can eat after 2 hours. The capsule passes in stool over the next 1 to 3 days; usually you do not see it.',
    resultsInterpretation:
      'GI doctor reviews the video for bleeding sources, ulcers, polyps, or strictures. A retained capsule is a complication if there is a stricture; this is why a patency capsule is sometimes done first.',
    denialPushback: [
      {
        denialReason: 'Conventional endoscopy was sufficient.',
        counterArgument:
          'EGD reaches only the duodenum; colonoscopy reaches the terminal ileum. The mid small bowel is invisible to both. ASGE guidelines support capsule endoscopy when conventional studies are non-diagnostic and small bowel pathology is suspected.',
        citationLabel: 'ASGE capsule endoscopy guideline',
      },
    ],
    specialistReferralPath: 'Gastroenterology.',
    costExpectations: '$1,000 to $3,000.',
    sources: [
      {
        label: 'Enns RA et al. ASGE clinical guideline on capsule endoscopy',
        href: 'https://pubmed.ncbi.nlm.nih.gov/28433170/',
      },
    ],
  },
  // ──────────────────────────────────────────────────────────────
  // ENDOCRINOLOGY
  // ──────────────────────────────────────────────────────────────
  {
    slug: 'cortisol-am-and-24h',
    label: 'Cortisol (AM serum and 24-hour urine)',
    category: 'endocrinology',
    subtitle: 'Tests adrenal function and circadian cortisol rhythm.',
    whatItIs:
      'Two related tests: an 8 AM serum cortisol captures the morning peak; a 24-hour urine free cortisol integrates total daily output. Together they screen for adrenal insufficiency (low) and Cushing syndrome (high).',
    whyOrdered:
      'For unexplained fatigue, hypotension, weight loss, hyperpigmentation (low cortisol concern), or for weight gain, easy bruising, hypertension, glucose intolerance (high cortisol concern). For chronic illness with adrenal-axis questions.',
    pcpScript:
      'I have symptoms consistent with possible adrenal dysfunction: [unexplained fatigue / orthostatic hypotension / hyperpigmentation]. I would like an 8 AM serum cortisol and 24-hour urine free cortisol. If the morning value is borderline I want to discuss an ACTH stimulation test.',
    whatToExpect:
      'Serum cortisol: standard blood draw at 8 AM. 24-hour urine: collect every void over 24 hours into a refrigerated container.',
    resultsInterpretation:
      'AM serum cortisol over 18 mcg/dL excludes adrenal insufficiency in most cases. Below 3 mcg/dL is diagnostic. Values between 3 and 18 require ACTH stimulation testing. 24-hour urine free cortisol elevation flags for Cushing workup.',
    denialPushback: [
      {
        denialReason: 'Symptoms are non-specific.',
        counterArgument:
          'Endocrine Society guidelines support screening cortisol in patients with persistent unexplained fatigue plus orthostatic hypotension or hyperpigmentation. The test is inexpensive and high-value when adrenal axis is on the differential.',
        citationLabel: 'Endocrine Society adrenal insufficiency guideline',
      },
    ],
    specialistReferralPath: 'Endocrinology if results are abnormal or borderline.',
    costExpectations: '$50 to $300.',
    sources: [
      {
        label: 'Bornstein SR et al. Endocrine Society adrenal insufficiency guideline',
        href: 'https://pubmed.ncbi.nlm.nih.gov/26760044/',
      },
    ],
  },
  {
    slug: 'acth-stimulation-test',
    label: 'ACTH stimulation test',
    category: 'endocrinology',
    subtitle: 'Provocative test for adrenal insufficiency.',
    whatItIs:
      'Synthetic ACTH (cosyntropin) is injected; cortisol is measured at baseline, 30 minutes, and 60 minutes. A normal response confirms the adrenal glands can make cortisol when stimulated.',
    whyOrdered:
      'When morning cortisol is borderline or symptoms strongly suggest adrenal insufficiency despite a non-diagnostic baseline.',
    pcpScript:
      'My morning cortisol came back borderline (or normal but my symptoms continue). I would like a standard 250 mcg cosyntropin stimulation test. I understand the low-dose 1 mcg version is more sensitive for secondary adrenal insufficiency if that is on the differential.',
    whatToExpect:
      'Done at the lab. IV is placed; baseline cortisol drawn; cosyntropin injected; cortisol redrawn at 30 and 60 minutes. Total time about 90 minutes.',
    resultsInterpretation:
      'A peak cortisol above 18 to 20 mcg/dL at any time point indicates intact adrenal reserve. Failure to reach this is diagnostic of adrenal insufficiency.',
    denialPushback: [
      {
        denialReason: 'Single morning cortisol was sufficient.',
        counterArgument:
          'Borderline morning cortisol is by definition non-diagnostic. Endocrine Society guidance recommends ACTH stimulation testing for any borderline result when clinical suspicion is significant.',
        citationLabel: 'Endocrine Society adrenal insufficiency guideline',
      },
    ],
    specialistReferralPath: 'Endocrinology.',
    costExpectations: '$200 to $500.',
    sources: [
      {
        label: 'Bornstein SR et al. Endocrine Society adrenal insufficiency guideline',
        href: 'https://pubmed.ncbi.nlm.nih.gov/26760044/',
      },
    ],
  },
  {
    slug: 'comprehensive-thyroid-panel',
    label: 'Comprehensive thyroid panel',
    category: 'endocrinology',
    subtitle: 'TSH alone is not enough. The full panel matters.',
    whatItIs:
      'TSH plus Free T4, Free T3, reverse T3, anti-TPO antibodies, and anti-thyroglobulin antibodies. The full picture distinguishes primary hypothyroidism, secondary hypothyroidism, autoimmune thyroiditis (Hashimoto), and conversion problems.',
    whyOrdered:
      'For unexplained fatigue, weight changes, cold intolerance, brain fog, or hair changes when initial TSH is normal or borderline. For known thyroid patients, periodic full panel catches conversion and antibody changes a TSH alone misses.',
    pcpScript:
      'I have classic hypothyroid symptoms but my TSH is in the reference range. I would like a comprehensive thyroid panel: TSH, Free T4, Free T3, reverse T3, anti-TPO, and anti-thyroglobulin antibodies.',
    whatToExpect: 'Standard blood draw. Best done in the morning, fasting.',
    resultsInterpretation:
      'TSH normal range is roughly 0.4 to 4.5 mIU/L (some labs use tighter ranges). Free T4 and Free T3 in their reference ranges with normal TSH is generally reassuring. High anti-TPO suggests Hashimoto, which can cause symptoms even with normal TSH. Elevated reverse T3 suggests reduced T4-to-T3 conversion.',
    denialPushback: [
      {
        denialReason: 'TSH is normal; further testing not needed.',
        counterArgument:
          'TSH is a marker of pituitary signaling and can be normal in central hypothyroidism, T4-to-T3 conversion problems, and early Hashimoto. American Thyroid Association guidance supports broader testing when TSH is normal but symptoms persist or autoimmune thyroid disease is suspected.',
        citationLabel: 'ATA hypothyroidism guidelines',
      },
    ],
    specialistReferralPath: 'Endocrinology if results are complex.',
    costExpectations: '$100 to $400 for the full panel.',
    sources: [
      {
        label: 'Jonklaas J et al. ATA guidelines for treatment of hypothyroidism',
        href: 'https://pubmed.ncbi.nlm.nih.gov/25266247/',
      },
    ],
  },
  {
    slug: 'sex-hormone-panel-by-cycle-phase',
    label: 'Sex hormone panel (cycle-phase timed)',
    category: 'endocrinology',
    subtitle: 'Estrogen, progesterone, LH, FSH timed to your cycle.',
    whatItIs:
      'Serum estradiol, progesterone, LH, and FSH drawn at specific cycle phases. Day 3 captures baseline ovarian reserve markers (FSH, estradiol). Mid-luteal day 21 (or 7 days post-ovulation) captures peak progesterone, which confirms ovulation.',
    whyOrdered:
      'For irregular cycles, suspected anovulation, infertility workup, premature ovarian insufficiency screening, or to characterize cycle-phase symptom patterns (catamenial migraine, perimenstrual POTS flares).',
    pcpScript:
      'I want to characterize my cycle hormones to investigate [anovulation / catamenial migraine / perimenstrual POTS flares]. I would like a Day 3 panel (FSH, LH, estradiol) and a Day 21 panel (progesterone). I am tracking my cycle so I can time the draws accurately.',
    whatToExpect:
      'Two timed blood draws. Cycle Day 1 is the first day of full menstrual flow. Day 3 is the third day of bleeding. Day 21 is in the mid-luteal phase. If your cycle is irregular, your provider may use ovulation prediction kits or basal body temp to time the second draw.',
    resultsInterpretation:
      'Day 3: FSH over 10 mIU/mL suggests reduced ovarian reserve. Day 21 progesterone over 3 ng/mL suggests ovulation occurred; under that suggests anovulation.',
    denialPushback: [
      {
        denialReason: 'Hormones cannot be interpreted without cycle context.',
        counterArgument:
          'That is the point of timed draws. ASRM guidance supports cycle-phase testing for these specific questions; the timing makes the interpretation possible.',
        citationLabel: 'ASRM guidance on ovulation testing',
      },
    ],
    specialistReferralPath: 'Reproductive endocrinology or gynecology.',
    costExpectations: '$200 to $500 across both draws.',
    sources: [
      {
        label: 'ASRM Practice Committee on testing and interpretation of measures of ovarian reserve',
        href: 'https://pubmed.ncbi.nlm.nih.gov/32115183/',
      },
    ],
    relatedTopicHrefs: [{ href: '/v2/topics/cycle', label: 'Cycle deep-dive' }],
  },
  {
    slug: 'insulin-resistance-hba1c',
    label: 'HbA1c, fasting insulin, and lipids',
    category: 'endocrinology',
    subtitle: 'Metabolic baseline for chronic illness patients.',
    whatItIs:
      'HbA1c reflects average blood sugar over 3 months. Fasting insulin combined with fasting glucose calculates HOMA-IR, an estimate of insulin resistance. Lipid panel covers total, HDL, LDL, triglycerides.',
    whyOrdered:
      'Annual screening once chronic illness is established, especially with weight changes, PCOS suspicion, fatigue, or cardiovascular family history. Insulin resistance often precedes overt diabetes by years.',
    pcpScript:
      'I would like an HbA1c, fasting insulin and glucose for HOMA-IR calculation, and a lipid panel as part of my annual metabolic baseline.',
    whatToExpect: 'Fasting blood draw (8 to 12 hours of no food).',
    resultsInterpretation:
      'HbA1c under 5.7 percent is normal; 5.7 to 6.4 is prediabetes; over 6.5 is diabetes. HOMA-IR over 2.5 suggests insulin resistance. LDL targets vary by cardiovascular risk; under 100 mg/dL is generally desirable.',
    denialPushback: [
      {
        denialReason: 'Not screening eligible by USPSTF criteria.',
        counterArgument:
          'For symptomatic patients (fatigue, weight changes) or high-risk groups, ADA supports annual metabolic screening regardless of strict USPSTF age cutoffs. Documenting symptoms in the request usually clears this.',
      },
    ],
    specialistReferralPath: 'PCP can order. Endocrinology if results are complex.',
    costExpectations: '$100 to $300.',
    sources: [
      {
        label: 'ADA Standards of Medical Care in Diabetes',
        href: 'https://pubmed.ncbi.nlm.nih.gov/36507650/',
      },
    ],
  },
  // ──────────────────────────────────────────────────────────────
  // GENETIC
  // ──────────────────────────────────────────────────────────────
  {
    slug: 'eds-gene-panel',
    label: 'EDS gene panel',
    category: 'genetic',
    subtitle: 'Sequences the genes for the 12 non-hypermobile EDS subtypes.',
    whatItIs:
      'A multi-gene panel covering the 12 of 13 EDS subtypes that have known genetic causes (everything except hypermobile EDS, which currently has no validated genetic test). Panels typically include COL5A1, COL5A2, COL3A1, COL1A1, COL1A2, FKBP14, ADAMTS2, and several others.',
    whyOrdered:
      'When clinical features suggest a non-hypermobile EDS subtype, especially vascular EDS (COL3A1) where early diagnosis is life-saving. Strong family history of dissection, organ rupture, or characteristic skin findings are key indications.',
    pcpScript:
      'I have features that raise concern for [vascular EDS / classical EDS / kyphoscoliotic EDS]: [specific findings]. I would like a referral to medical genetics for an EDS gene panel. The Ehlers-Danlos Society guidelines list specific clinical criteria for which I meet [list them].',
    whatToExpect:
      'Genetic counseling first, then a blood draw or saliva sample sent to a specialty lab. Results take 3 to 6 weeks. Counseling at result return covers implications for family members.',
    resultsInterpretation:
      'A pathogenic variant confirms the subtype. A variant of uncertain significance (VUS) does not confirm or rule out. A negative panel does not rule out hEDS or rare subtypes not covered.',
    denialPushback: [
      {
        denialReason: 'Clinical diagnosis is sufficient.',
        counterArgument:
          'For vascular EDS specifically, genetic confirmation is essential because management (vascular surveillance, pregnancy planning, avoidance of arterial procedures) depends on the diagnosis. The EDS Society 2017 international classification recommends genetic testing for any clinically suspected non-hypermobile subtype.',
        citationLabel: 'Malfait F et al. 2017 EDS classification',
      },
    ],
    specialistReferralPath: 'Medical genetics. Genetic counselor strongly preferred for pre-test counseling.',
    costExpectations:
      '$1,000 to $5,000. Many specialty labs offer reduced rates and patient assistance for uninsured.',
    sources: [
      {
        label: 'Malfait F et al. 2017 international classification of EDS',
        href: 'https://pubmed.ncbi.nlm.nih.gov/28306229/',
      },
      {
        label: 'The Ehlers-Danlos Society',
        href: 'https://www.ehlers-danlos.com/',
      },
    ],
  },
  {
    slug: 'pots-dysautonomia-panel',
    label: 'POTS / dysautonomia panel',
    category: 'genetic',
    subtitle: 'Tests for known autonomic genetic syndromes.',
    whatItIs:
      'A panel covering genes implicated in familial dysautonomias and norepinephrine transporter deficiency (NET deficiency, SLC6A2). Not a routine test; reserved for cases with family history or features suggesting a monogenic cause.',
    whyOrdered:
      'When POTS is severe, treatment-resistant, has clear familial pattern, or has features of a known dysautonomia syndrome.',
    pcpScript:
      'I have severe POTS with [strong family history / features suggesting NET deficiency or familial dysautonomia]. I would like a referral to medical genetics for a dysautonomia panel.',
    whatToExpect:
      'Genetic counseling, then blood or saliva sample. Results in 3 to 6 weeks.',
    resultsInterpretation:
      'Most POTS is multifactorial without a single genetic cause; a positive test is uncommon but informative when found.',
    denialPushback: [
      {
        denialReason: 'Low yield; not standard of care.',
        counterArgument:
          'For severe or treatment-resistant POTS with family history, genetic evaluation can identify treatable monogenic causes (e.g., NET deficiency responds to atomoxetine). The American Autonomic Society recognizes genetic testing as appropriate in selected cases.',
      },
    ],
    specialistReferralPath: 'Medical genetics with autonomic experience.',
    costExpectations: '$500 to $3,000.',
    sources: [
      {
        label: 'Vernino S et al. 2021 POTS consensus statement',
        href: 'https://pubmed.ncbi.nlm.nih.gov/34245547/',
      },
    ],
  },
  {
    slug: 'hla-typing',
    label: 'HLA typing for autoimmune workup',
    category: 'genetic',
    subtitle: 'HLA-B27, HLA-DQ2/DQ8, and others as indicated.',
    whatItIs:
      'Tests specific HLA alleles linked to autoimmune disease risk. HLA-B27 is associated with axial spondyloarthritis and ankylosing spondylitis. HLA-DQ2 and DQ8 are associated with celiac disease.',
    whyOrdered:
      'Workup of inflammatory back pain (HLA-B27), uveitis evaluation (HLA-B27), or to help rule out celiac when standard antibody testing is equivocal (HLA-DQ2/DQ8 negative makes celiac very unlikely).',
    pcpScript:
      'I have [inflammatory back pain / suspected ankylosing spondylitis / equivocal celiac antibody testing]. I would like HLA typing for [specific allele].',
    whatToExpect: 'Blood draw or saliva. Results in 1 to 3 weeks.',
    resultsInterpretation:
      'A positive HLA-B27 raises but does not confirm spondyloarthritis. A negative HLA-DQ2/DQ8 makes celiac extremely unlikely (high negative predictive value).',
    denialPushback: [
      {
        denialReason: 'Not specific enough.',
        counterArgument:
          'HLA typing is not used as a sole diagnostic, but ACR and rheumatology guidance support it as part of the workup for inflammatory back pain and as a rule-out for celiac.',
      },
    ],
    specialistReferralPath: 'Rheumatology or gastroenterology depending on the question.',
    costExpectations: '$100 to $500.',
    sources: [
      {
        label: 'Ward MM et al. ACR axial spondyloarthritis recommendations',
        href: 'https://pubmed.ncbi.nlm.nih.gov/31436026/',
      },
    ],
  },
  // ──────────────────────────────────────────────────────────────
  // SPECIALTY IMAGING
  // ──────────────────────────────────────────────────────────────
  {
    slug: 'standing-mri',
    label: 'Standing (upright) MRI',
    category: 'imaging',
    subtitle: 'For suspected craniocervical instability and cervical issues that change with posture.',
    whatItIs:
      'An MRI performed in the upright position. Conventional MRI is supine, which can mask instability that only manifests under axial loading. Few centers in the US offer this.',
    whyOrdered:
      'For suspected craniocervical instability (CCI) or atlantoaxial instability (AAI), particularly in EDS patients with neurologic symptoms (headache, brainstem symptoms, autonomic dysfunction). Also for cervical disc disease that worsens with upright posture.',
    pcpScript:
      'I have suspected craniocervical instability with [neurologic symptoms]. Standard supine MRI may not show postural instability. I would like a referral for upright MRI of the cervical spine. Few centers offer this; please refer to one with experience interpreting upright cervical imaging in EDS.',
    whatToExpect:
      'You stand or sit in the open MRI between two flat magnets. The technician images you in neutral, flexion, and extension positions. Total time 30 to 60 minutes. No claustrophobia issues because the design is open.',
    resultsInterpretation:
      'Radiologist measures specific lines and angles (basion-axial interval, basion-dental interval, clivo-axial angle, Grabb-Oakes line). Values outside reference ranges flag for craniocervical instability. Interpretation requires experience; many radiologists are not familiar with the EDS literature.',
    denialPushback: [
      {
        denialReason: 'Standard MRI is sufficient.',
        counterArgument:
          'Supine MRI cannot detect postural instability by definition. Multiple peer-reviewed series (Henderson et al. 2017, Bolognese et al. 2021) document the role of upright imaging in CCI evaluation specifically in connective tissue disease patients.',
        citationLabel: 'Henderson FC et al. CCI in hereditary CT disorders',
      },
      {
        denialReason: 'Out of network at the only upright MRI center.',
        counterArgument:
          'Request a network gap exception. If no in-network provider performs upright MRI for this clinical indication, your plan should authorize the out-of-network center at in-network cost.',
      },
    ],
    specialistReferralPath: 'Neurosurgery (CCI specialist) or neurology with experience in EDS.',
    costExpectations:
      '$2,000 to $5,000. Often denied initially; appeal often succeeds with strong documentation.',
    sources: [
      {
        label: 'Henderson FC et al. CCI in hereditary connective tissue disorders (Am J Med Genet C)',
        href: 'https://pubmed.ncbi.nlm.nih.gov/28220607/',
      },
    ],
  },
  {
    slug: 'vascular-ultrasound',
    label: 'Vascular ultrasound (carotid and vertebral)',
    category: 'imaging',
    subtitle: 'Non-invasive vessel imaging.',
    whatItIs:
      'Doppler ultrasound of the carotid and vertebral arteries in the neck. Shows vessel diameter, flow velocity, and any plaque or stenosis. Non-invasive, no contrast.',
    whyOrdered:
      'For suspected vertebral artery dissection (especially after neck manipulation), carotid stenosis evaluation, or vessel surveillance in vascular EDS.',
    pcpScript:
      'I have [neck pain plus neurologic symptoms / family history of dissection / suspected vEDS]. I would like a carotid and vertebral artery duplex ultrasound to screen for dissection or vascular abnormality.',
    whatToExpect:
      'You lie on your back; gel is applied to your neck; the tech moves the probe along each side of your neck. 30 to 45 minutes. Painless.',
    resultsInterpretation:
      'Report describes vessel diameters, flow velocities, intima-media thickness, and any plaque or dissection flap.',
    denialPushback: [
      {
        denialReason: 'Symptoms are non-specific; CT angiography preferred.',
        counterArgument:
          'For initial screening or vessel surveillance, ultrasound is non-invasive, requires no contrast, and is appropriate as the first-line study per AHA / ASA guidance. CT angiography or MRA are reserved for confirmation or when ultrasound is non-diagnostic.',
      },
    ],
    specialistReferralPath: 'Vascular medicine, neurology, or vascular surgery.',
    costExpectations: '$300 to $1,000.',
    sources: [
      {
        label: 'AbuRahma AF et al. Society for Vascular Surgery carotid disease guideline',
        href: 'https://pubmed.ncbi.nlm.nih.gov/35381117/',
      },
    ],
  },
  {
    slug: 'dexa-scan',
    label: 'DEXA scan (bone density)',
    category: 'imaging',
    subtitle: 'Measures bone mineral density.',
    whatItIs:
      'A low-dose X-ray scan of the spine and hip that measures bone mineral density. Compared to age and sex norms (Z-score) and to peak adult bone mass (T-score).',
    whyOrdered:
      'For chronic illness with risk factors for osteoporosis: prolonged glucocorticoid use, low body weight, amenorrhea, EDS (which can lower bone density), prolonged immobility, malabsorption, or family history. USPSTF recommends screening at age 65 for women, earlier with risk factors.',
    pcpScript:
      'I have risk factors for low bone density: [list them]. I would like a DEXA scan to establish a baseline bone mineral density.',
    whatToExpect:
      'Lie on a padded table; the scanner arm moves over you. Total time 10 to 30 minutes. No prep required. Painless.',
    resultsInterpretation:
      'T-score 0 to -1 is normal; -1 to -2.5 is osteopenia; under -2.5 is osteoporosis. Z-score under -2 is unexpected for age.',
    denialPushback: [
      {
        denialReason: 'Patient too young; not yet indicated.',
        counterArgument:
          'NOF and ACOG guidance support earlier DEXA screening with documented risk factors (steroids, EDS, amenorrhea, prior fracture, low body weight). USPSTF age 65 cutoff applies to average-risk women without risk factors.',
        citationLabel: 'NOF clinician guide to osteoporosis prevention',
      },
    ],
    specialistReferralPath: 'PCP can usually order. Endocrinology or rheumatology if results are abnormal.',
    costExpectations: '$100 to $400.',
    sources: [
      {
        label: 'Cosman F et al. National Osteoporosis Foundation clinician guide',
        href: 'https://pubmed.ncbi.nlm.nih.gov/25182228/',
      },
    ],
  },
]

// ── Lookups for the renderer ─────────────────────────────────────

export const TEST_SLUGS: string[] = TEST_CATALOG.map((t) => t.slug)

export function getTest(slug: string): TestGuideData | undefined {
  return TEST_CATALOG.find((t) => t.slug === slug)
}

export function getTestsByCategory(category: TestCategorySlug): TestGuideData[] {
  return TEST_CATALOG.filter((t) => t.category === category)
}

export function getCategory(slug: TestCategorySlug): TestCategory | undefined {
  return TEST_CATEGORIES.find((c) => c.slug === slug)
}
