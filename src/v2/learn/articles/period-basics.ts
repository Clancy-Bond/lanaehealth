/*
 * Articles: Period basics
 */
import type { LearnArticle } from '../types'

export const FLOW_PATTERNS: LearnArticle = {
  slug: 'flow-patterns-and-what-they-mean',
  category: 'period-basics',
  title: 'Flow patterns and what they mean',
  subhead: 'A quick guide to reading your own period.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'A typical period sheds 30 to 40 milliliters of blood across three to seven days, with up to 80 ml still considered within range. That is roughly 2 to 5 tablespoons total. The actual feel of a period, which days are heaviest, how long it lasts, varies widely from one person to the next, and from one cycle to the next [OWH].',
    },
    { kind: 'h2', text: 'A common shape' },
    {
      kind: 'p',
      text: 'For many people, day 1 starts light or moderate, day 2 is the heaviest day, and flow tapers gradually through days 3 to 5. Some end abruptly; some have a final day of brown spotting before stopping. Both are within the normal pattern.',
    },
    { kind: 'h2', text: 'What heavy bleeding looks like' },
    {
      kind: 'p',
      text: 'The clinical name is heavy menstrual bleeding (HMB), or menorrhagia. Signs you have it [ACOG]:',
    },
    {
      kind: 'ul',
      items: [
        'Soaking through one or more pads or tampons every hour for several hours in a row.',
        'Needing to change protection at night.',
        'Doubling up on protection (pad plus tampon) to control flow.',
        'Passing blood clots larger than a quarter.',
        'A period that lasts longer than seven days.',
        'Symptoms of anemia: fatigue, shortness of breath, paleness.',
      ],
    },
    {
      kind: 'p',
      text: 'Heavy bleeding is common (it affects roughly 1 in 5 menstruating people) and almost always treatable. It is not something to live with. Causes range from fibroids and polyps to bleeding disorders, thyroid issues, and hormonal imbalances.',
    },
    { kind: 'h2', text: 'What light bleeding can mean' },
    {
      kind: 'p',
      text: 'Periods that are consistently very light (less than 30 ml total, ending in a day or two) may be normal for you, especially if you are on hormonal birth control, breastfeeding, or are an endurance athlete. Periods that suddenly turn very light without an obvious cause can be worth checking, as they sometimes signal anovulatory cycles, low body weight, thyroid issues, or perimenopause [Mayo Clinic].',
    },
    { kind: 'h2', text: 'Spotting between periods' },
    {
      kind: 'p',
      text: 'Light spotting outside your period (intermenstrual bleeding) is sometimes ovulation-related and harmless. Persistent or recurrent spotting, bleeding after sex, or any postmenopausal bleeding should be evaluated.',
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'Worth a same-week call',
      text: 'A sudden change in your usual flow pattern that lasts two cycles in a row. Pad-soaking heavy bleeding. Bleeding between periods that you cannot explain.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'If you log flow level on your period log, the cycle page builds a flow shape across each cycle. Bringing that shape to a doctor visit is more useful than trying to remember "I think it was heavy."',
    },
  ],
  citations: [
    {
      label: 'OWH',
      title: 'Period problems',
      url: 'https://www.womenshealth.gov/menstrual-cycle/period-problems',
      publisher: 'Office on Women\'s Health',
    },
    {
      label: 'ACOG',
      title: 'Heavy and abnormal periods',
      url: 'https://www.acog.org/womens-health/faqs/heavy-and-abnormal-periods',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Menstrual cycle: What is normal, what is not',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menstrual-cycle/art-20047186',
      publisher: 'Mayo Clinic',
    },
  ],
  related: ['period-pain-normal-vs-see-your-doctor', 'tracking-your-period-accurately'],
}

export const PERIOD_PAIN: LearnArticle = {
  slug: 'period-pain-normal-vs-see-your-doctor',
  category: 'period-basics',
  title: 'Period pain, normal vs see your doctor',
  subhead: 'Cramps are common. Pain that runs your day is not normal.',
  readingMinutes: 6,
  body: [
    {
      kind: 'p',
      text: 'Mild to moderate cramping in the lower belly during the first one to three days of a period is the most common complaint of menstruating people. The clinical name is primary dysmenorrhea, and it is caused by uterine contractions driven by chemicals called prostaglandins [ACOG].',
    },
    {
      kind: 'p',
      text: 'Primary dysmenorrhea usually responds to over-the-counter NSAIDs (like ibuprofen or naproxen), heat, gentle movement, and rest. It is uncomfortable but does not stop life.',
    },
    { kind: 'h2', text: 'When period pain is worth investigating' },
    {
      kind: 'p',
      text: 'Pain that fits any of the following deserves a clinician\'s attention. The clinical term is secondary dysmenorrhea, meaning the pain is being caused by an underlying condition rather than just the cycle itself.',
    },
    {
      kind: 'ul',
      items: [
        'Pain that does not respond to over-the-counter NSAIDs taken on schedule.',
        'Pain that keeps you home from school, work, or your usual activities.',
        'Pain that has gotten worse over the past several years rather than staying steady.',
        'Pain outside your period: ovulation, mid-cycle, or random days.',
        'Pain with sex (dyspareunia) or with bowel movements during your period.',
        'Pain in a new pattern or location.',
        'Heavy bleeding with the pain.',
      ],
    },
    {
      kind: 'p',
      text: 'These features make conditions like endometriosis, adenomyosis, fibroids, ovarian cysts, and pelvic inflammatory disease more likely. Endometriosis in particular is often missed for years; the average time from first symptom to diagnosis is still measured in years [ACOG]. Pain that fits this list is reason enough to be seen.',
    },
    { kind: 'h2', text: 'What helps mild to moderate cramps' },
    {
      kind: 'ul',
      items: [
        'NSAIDs taken on schedule, starting before pain peaks. Ibuprofen 400 to 600 mg every 6 to 8 hours, or naproxen 220 to 440 mg every 8 to 12 hours, with food, are typical doses for adults [Mayo Clinic].',
        'Continuous heat: a heating pad or hot water bottle on the lower belly or back.',
        'Light to moderate movement: walking or gentle yoga.',
        'Adequate sleep and hydration in the days leading up.',
      ],
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'Same-day care',
      text: 'Sudden, severe one-sided pelvic pain, especially with fainting, fever, or vomiting, is a reason to be seen the same day. Possible causes include ovarian torsion, ruptured ovarian cyst, ectopic pregnancy, and pelvic inflammatory disease.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'Logging pain level by day helps you and your doctor see whether your pain is steady, escalating across cycles, or shifting outside your period. Those patterns drive the workup.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Dysmenorrhea: Painful periods',
      url: 'https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Menstrual cramps',
      url: 'https://www.mayoclinic.org/diseases-conditions/menstrual-cramps/symptoms-causes/syc-20374938',
      publisher: 'Mayo Clinic',
    },
  ],
  related: ['flow-patterns-and-what-they-mean', 'tracking-your-period-accurately'],
}

export const TRACKING_PERIOD_ACCURATELY: LearnArticle = {
  slug: 'tracking-your-period-accurately',
  category: 'period-basics',
  title: 'Tracking your period accurately',
  subhead: 'Small habits that make the data trustworthy.',
  readingMinutes: 4,
  body: [
    {
      kind: 'p',
      text: 'A cycle tracker is only as good as what you log. A few simple habits keep the data trustworthy enough that you and a clinician can both rely on it.',
    },
    { kind: 'h2', text: 'Log day one accurately' },
    {
      kind: 'p',
      text: 'Day 1 is the first day of real bleeding, not spotting. Spotting is light pink or brown blood that does not require a pad or tampon. Real bleeding is bright or dark red and starts a normal flow. If spotting precedes a period, log the spotting separately and mark day 1 the next morning when real bleeding starts [Mayo Clinic].',
    },
    { kind: 'h2', text: 'Log every day of bleeding, not just the start and end' },
    {
      kind: 'p',
      text: 'A daily flow level (light, medium, heavy) is more useful than a single "I had a period" entry. Day-by-day flow lets the tracker build the shape of each period. The shape is what shows changes over time.',
    },
    { kind: 'h2', text: 'Log spotting separately' },
    {
      kind: 'p',
      text: 'Mid-cycle spotting, post-period spotting, and pre-period spotting all carry different clinical meanings. Logging them as spotting (not period) keeps cycle length predictions accurate.',
    },
    { kind: 'h2', text: 'Add the symptoms you actually noticed' },
    {
      kind: 'p',
      text: 'A long symptom list filled with a guess does more harm than good. Better to log the two or three things that genuinely affected your day. Pain level, mood, energy, and sleep quality cover most of what matters for cycle pattern reading.',
    },
    { kind: 'h2', text: 'Skip days are okay' },
    {
      kind: 'p',
      text: 'Missing a day is fine. Backfilling several months later from memory is not. If you are catching up, log only what you remember confidently and leave the rest blank. Blank is honest data.',
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'For doctor visits',
      text: 'Most clinicians want to see your last 3 to 6 cycles: cycle lengths, period lengths, peak flow days, and any unusual symptoms. Your cycle page already organizes this. Bringing it to your visit, on screen or printed, beats reciting from memory.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'The cycle page summarizes your last several cycles. If you log day 1 accurately and add flow each day, that summary will be ready for any doctor visit without extra work.',
    },
  ],
  citations: [
    {
      label: 'Mayo Clinic',
      title: 'Menstrual cycle: What is normal, what is not',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menstrual-cycle/art-20047186',
      publisher: 'Mayo Clinic',
    },
    {
      label: 'ACOG',
      title: 'Menstruation in Girls and Adolescents: Using the Menstrual Cycle as a Vital Sign',
      url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
  ],
  related: ['flow-patterns-and-what-they-mean', 'period-pain-normal-vs-see-your-doctor'],
}

export const PERIOD_BASICS_ARTICLES = [
  FLOW_PATTERNS,
  PERIOD_PAIN,
  TRACKING_PERIOD_ACCURATELY,
]
