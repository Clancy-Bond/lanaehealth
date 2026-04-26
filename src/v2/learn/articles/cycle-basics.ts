/*
 * Articles: Cycle basics
 */
import type { LearnArticle } from '../types'

export const HOW_YOUR_CYCLE_WORKS: LearnArticle = {
  slug: 'how-your-cycle-works',
  category: 'cycle-basics',
  title: 'How your cycle works',
  subhead: 'A plain English tour, from one bleed to the next.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'A menstrual cycle is the rhythm your body keeps as it prepares, every month, for a possible pregnancy. The cycle starts on day one of bleeding and ends the day before the next bleed begins. It is driven by a quiet conversation between your brain and your ovaries, conducted in hormones.',
    },
    {
      kind: 'p',
      text: 'For most adults, that conversation runs on a 21 to 35 day loop, with the average sitting near 28. Cycles outside that range, or that vary widely month to month after your mid-twenties, are worth a note in your tracker and a conversation with a clinician [ACOG].',
    },
    { kind: 'h2', text: 'The four moving parts' },
    {
      kind: 'p',
      text: 'Four hormones do most of the work: estrogen, progesterone, luteinizing hormone (LH), and follicle stimulating hormone (FSH). Estrogen rises in the first half of your cycle. Progesterone takes over in the second half. LH is the spike that triggers ovulation. FSH wakes up the follicles in your ovaries each cycle [OWH].',
    },
    {
      kind: 'p',
      text: 'You can think of it as two halves connected by ovulation. The first half builds up: an egg matures, the lining of your uterus thickens. Ovulation releases the egg. The second half maintains: progesterone holds the lining steady in case the egg is fertilized. If pregnancy does not happen, both hormones fall, the lining sheds, and the cycle starts again.',
    },
    { kind: 'h2', text: 'What "day one" really means' },
    {
      kind: 'p',
      text: 'Cycle day one is the first day of real bleeding, not spotting. Spotting is light pink or brown blood that does not need a pad or tampon. Real bleeding is bright or dark red and usually arrives within a day of any spotting [Mayo Clinic].',
    },
    {
      kind: 'p',
      text: 'Tracking from day one matters because every prediction your app makes, period, fertile window, ovulation, anchors to that anchor point. If you log the wrong day as day one, every downstream prediction shifts.',
    },
    { kind: 'h2', text: 'Length is a signal, not a verdict' },
    {
      kind: 'p',
      text: 'A 24-day cycle is not better or worse than a 32-day cycle. Both are typical for adults. What matters is the pattern: do your cycles look roughly alike from one to the next, or are they swinging from 22 to 45 days with no rhythm? Variation greater than seven to nine days between cycles in adults can signal an underlying issue worth investigating [ACOG].',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'Your tracker shows your last cycle length on the cycle page. If recent cycles are drifting longer than usual, that is the kind of pattern your doctor will want to hear about, even if no single cycle was alarming on its own.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Menstruation in Girls and Adolescents: Using the Menstrual Cycle as a Vital Sign',
      url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'OWH',
      title: 'Your menstrual cycle',
      url: 'https://www.womenshealth.gov/menstrual-cycle/your-menstrual-cycle',
      publisher: 'Office on Women\'s Health',
    },
    {
      label: 'Mayo Clinic',
      title: 'Menstrual cycle: What is normal, what is not',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menstrual-cycle/art-20047186',
      publisher: 'Mayo Clinic',
    },
  ],
  related: ['the-four-phases-explained', 'when-is-a-cycle-typical'],
}

export const FOUR_PHASES_EXPLAINED: LearnArticle = {
  slug: 'the-four-phases-explained',
  category: 'cycle-basics',
  title: 'The four phases explained',
  subhead: 'Menstrual, follicular, ovulation, luteal. What changes, and what you might feel.',
  readingMinutes: 6,
  body: [
    {
      kind: 'p',
      text: 'Most cycle apps split the cycle into four phases. The phases are not separate events with hard borders; they overlap. But naming them helps you read your own pattern and put words to what your body is doing.',
    },
    { kind: 'h2', text: 'Menstrual phase: roughly days 1 to 5' },
    {
      kind: 'p',
      text: 'This is your period. Estrogen and progesterone are at their lowest. Your uterus sheds the lining it built last cycle. Energy may feel flat. Cramps, fatigue, lower back ache, and mood shifts are common in the first one to three days [OWH].',
    },
    {
      kind: 'p',
      text: 'A typical period lasts three to seven days. Heavy flow that soaks through a pad or tampon every hour for several hours, or a period that lasts longer than a week, is worth flagging [ACOG].',
    },
    { kind: 'h2', text: 'Follicular phase: roughly days 1 to 13' },
    {
      kind: 'p',
      text: 'Overlaps with menstruation at the start. Your ovaries grow several follicles, each holding an egg. Estrogen climbs steadily. Many people report feeling more energetic, focused, and social as estrogen rises [Mayo Clinic].',
    },
    {
      kind: 'p',
      text: 'Toward the end of this phase, one follicle pulls ahead, the dominant follicle, and prepares to release its egg.',
    },
    { kind: 'h2', text: 'Ovulation: roughly day 14, but variable' },
    {
      kind: 'p',
      text: 'A surge in luteinizing hormone (LH) breaks the dominant follicle open and the egg is released. The egg lives for 12 to 24 hours after release. Sperm can survive in the reproductive tract for up to five days, which is why the fertile window stretches several days before ovulation [ACOG].',
    },
    {
      kind: 'p',
      text: 'You may feel a brief, one-sided pelvic twinge (called mittelschmerz). Cervical mucus often turns slippery and stretchy, like raw egg white. Basal body temperature ticks up by about 0.4 to 0.8 degrees Fahrenheit after ovulation, a shift that confirms it happened in retrospect, not before [OWH].',
    },
    { kind: 'h2', text: 'Luteal phase: roughly days 15 to 28' },
    {
      kind: 'p',
      text: 'After ovulation, the empty follicle becomes the corpus luteum, which pumps out progesterone. Progesterone keeps the uterine lining thick and ready for a fertilized egg. Estrogen also has a smaller second peak [Mayo Clinic].',
    },
    {
      kind: 'p',
      text: 'In the late luteal phase, if no pregnancy occurs, the corpus luteum shrinks. Progesterone and estrogen both drop. That drop is what triggers the next period and is often when premenstrual symptoms (PMS) feel strongest. The luteal phase is usually 11 to 17 days long; phases shorter than 10 days may indicate a luteal phase defect worth discussing with a clinician [ACOG].',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'Your cycle page shows which phase you are in today and roughly when each phase began. If symptoms cluster in the same phase month after month, that pattern is gold for your doctor.',
    },
  ],
  citations: [
    {
      label: 'OWH',
      title: 'Your menstrual cycle',
      url: 'https://www.womenshealth.gov/menstrual-cycle/your-menstrual-cycle',
      publisher: 'Office on Women\'s Health',
    },
    {
      label: 'ACOG',
      title: 'Menstruation in Girls and Adolescents: Using the Menstrual Cycle as a Vital Sign',
      url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Menstrual cycle: What is normal, what is not',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menstrual-cycle/art-20047186',
      publisher: 'Mayo Clinic',
    },
  ],
  related: ['how-your-cycle-works', 'when-is-a-cycle-typical'],
}

export const WHEN_IS_CYCLE_TYPICAL: LearnArticle = {
  slug: 'when-is-a-cycle-typical',
  category: 'cycle-basics',
  title: 'When is a cycle typical, when is it not',
  subhead: 'Plain ranges, plain reasons to seek a clinician.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'There is a wide range of normal in cycle length, period length, and symptom intensity. Tracking is what tells you what your normal is. Once you know your baseline, deviations become easier to spot.',
    },
    { kind: 'h2', text: 'Typical ranges for adults' },
    {
      kind: 'ul',
      items: [
        'Cycle length: 21 to 35 days. Average about 28.',
        'Period length: 3 to 7 days.',
        'Total blood loss per period: about 30 to 40 milliliters, with up to 80 ml still considered within range.',
        'Ovulation: usually 12 to 16 days before the next period starts (so ovulation timing can shift by cycle).',
        'Luteal phase length: 11 to 17 days.',
      ],
    },
    {
      kind: 'p',
      text: 'These ranges come from large clinical studies summarized by ACOG and the Office on Women\'s Health [ACOG] [OWH].',
    },
    { kind: 'h2', text: 'What is worth a conversation' },
    {
      kind: 'p',
      text: 'No single off cycle is automatically a problem. A pattern across two or three months is what matters. Reasons to call your clinician:',
    },
    {
      kind: 'ul',
      items: [
        'Cycles consistently shorter than 21 days or longer than 35.',
        'A swing of more than 7 to 9 days between cycle lengths in adults.',
        'Periods that last more than 7 days.',
        'Bleeding heavy enough to soak through a pad or tampon every hour for several hours, or to pass clots larger than a quarter.',
        'Bleeding between periods or after sex.',
        'No period for 90 days or more, when not pregnant or breastfeeding.',
        'Severe pain that does not respond to over-the-counter medication or that interrupts your day.',
      ],
    },
    {
      kind: 'callout',
      tone: 'caution',
      title: 'When to seek care sooner',
      text: 'Sudden, severe pelvic pain. Bleeding that soaks two full pads back to back in two hours. Fainting. Any of these warrants same-day care.',
    },
    { kind: 'h2', text: 'Why patterns matter more than single cycles' },
    {
      kind: 'p',
      text: 'Stress, illness, travel, sleep loss, and big training shifts can all push a single cycle off. The body usually self-corrects within one to two cycles. What clinicians look for is the pattern: have your cycles been drifting longer for several months, or did just one cycle look unusual? Tracking gives you the answer.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'On your cycle page, the recent cycles chart shows your last six cycle lengths. A glance there before a doctor visit gives you the pattern in one image.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Menstruation in Girls and Adolescents: Using the Menstrual Cycle as a Vital Sign',
      url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'OWH',
      title: 'Period problems',
      url: 'https://www.womenshealth.gov/menstrual-cycle/period-problems',
      publisher: 'Office on Women\'s Health',
    },
  ],
  related: ['how-your-cycle-works', 'the-four-phases-explained', 'flow-patterns-and-what-they-mean'],
}

export const CYCLE_BASICS_ARTICLES = [
  HOW_YOUR_CYCLE_WORKS,
  FOUR_PHASES_EXPLAINED,
  WHEN_IS_CYCLE_TYPICAL,
]
