/*
 * Articles: Hormones
 */
import type { LearnArticle } from '../types'

export const ESTROGEN_AND_PROGESTERONE: LearnArticle = {
  slug: 'estrogen-and-progesterone-in-plain-english',
  category: 'hormones',
  title: 'Estrogen and progesterone in plain English',
  subhead: 'The two main hormones of your cycle, what each one does.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'Estrogen and progesterone are the two main hormones of the menstrual cycle. Each one runs the show during a different half of the cycle, and the two communicate with your brain in a feedback loop that keeps the rhythm going [OWH].',
    },
    { kind: 'h2', text: 'Estrogen: the build-up' },
    {
      kind: 'p',
      text: 'Estrogen rises in the first half of your cycle (the follicular phase). It thickens the lining of your uterus, sharpens cognition for many people, lifts mood, and increases vaginal lubrication. It also feeds back to the brain to trigger the LH surge that releases the egg.',
    },
    {
      kind: 'p',
      text: 'In the body more broadly, estrogen helps maintain bone density, supports skin elasticity, and influences cholesterol metabolism. Its effects reach far beyond the reproductive system [Mayo Clinic].',
    },
    {
      kind: 'p',
      text: 'You can often "feel" estrogen rising in the days before ovulation: more energy, more verbal fluency, generally feeling like yourself.',
    },
    { kind: 'h2', text: 'Progesterone: the maintain' },
    {
      kind: 'p',
      text: 'Progesterone takes over after ovulation (the luteal phase). It is made by the corpus luteum (the empty follicle left behind after the egg is released). Progesterone holds the uterine lining steady in case of pregnancy. It also raises basal body temperature, slows GI motility, and has a calming, sometimes sedating effect on the brain.',
    },
    {
      kind: 'p',
      text: 'In the late luteal phase, if pregnancy does not happen, the corpus luteum dies. Progesterone (and estrogen) drop quickly. That drop is what triggers your next period and is also when many premenstrual symptoms peak.',
    },
    { kind: 'h2', text: 'How they work together' },
    {
      kind: 'p',
      text: 'A typical cycle looks like a hand-off: estrogen builds, ovulation happens, progesterone takes over and holds. If progesterone never rises (an anovulatory cycle), the lining keeps thickening under estrogen alone until it breaks down on its own. Cycles like that are often longer, irregular, and may have heavier or unpredictable bleeding [ACOG].',
    },
    {
      kind: 'p',
      text: 'When the two hormones are in balance, the cycle runs in a roughly predictable pattern. When they are not, the pattern shifts: cycles get longer or shorter, periods get heavier or lighter, premenstrual symptoms intensify or disappear.',
    },
    { kind: 'h2', text: 'A note on testosterone' },
    {
      kind: 'p',
      text: 'Testosterone is also part of the picture, in smaller amounts. It contributes to libido, energy, and muscle. Many cycle conditions, including PCOS, involve elevated testosterone alongside the estrogen and progesterone story [ACOG].',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'The phase explainer on your cycle page shows where you are in this cycle\'s estrogen and progesterone arc. Symptoms that recur in the same hormonal phase month after month are how your tracker turns biology into a pattern you can use.',
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
      label: 'Mayo Clinic',
      title: 'Estrogen and progesterone in the menstrual cycle',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menstrual-cycle/art-20047186',
      publisher: 'Mayo Clinic',
    },
    {
      label: 'ACOG',
      title: 'Polycystic Ovary Syndrome (PCOS)',
      url: 'https://www.acog.org/womens-health/faqs/polycystic-ovary-syndrome-pcos',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
  ],
  related: ['signs-your-hormones-are-off', 'how-to-talk-to-your-doctor-about-hormone-testing'],
}

export const SIGNS_HORMONES_OFF: LearnArticle = {
  slug: 'signs-your-hormones-are-off',
  category: 'hormones',
  title: 'Signs your hormones are off',
  subhead: 'When patterns deserve a closer look.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'Hormones do not need to be in textbook ranges to feel right. They need to be in your range, holding the rhythm your body usually keeps. The most useful sign that something has shifted is a change in your own pattern.',
    },
    { kind: 'h2', text: 'Cycle-related signals' },
    {
      kind: 'ul',
      items: [
        'Cycles that have drifted longer or shorter for two or more consecutive months without an obvious cause.',
        'Periods that have changed in flow (much heavier, much lighter) compared to your usual.',
        'Mid-cycle bleeding or spotting that recurs.',
        'Premenstrual symptoms that have become much more intense, or that now last more than a week before your period.',
        'A luteal phase shorter than 10 days or longer than 17.',
        'Skipped periods (no period for 90 days or more) outside of pregnancy and breastfeeding.',
      ],
    },
    {
      kind: 'p',
      text: 'These can point to anovulation, luteal phase defect, PCOS, thyroid issues, perimenopause, or simpler causes like stress, weight change, and overtraining [ACOG].',
    },
    { kind: 'h2', text: 'Whole-body signals' },
    {
      kind: 'p',
      text: 'Hormonal shifts often show up in places that do not seem connected to the cycle. Worth tracking and mentioning if they cluster:',
    },
    {
      kind: 'ul',
      items: [
        'Persistent fatigue that does not resolve with sleep.',
        'Hair changes: thinning on the scalp, new growth on the face or chest.',
        'Acne in adult years, especially along the jaw and chin.',
        'Unexplained weight gain or loss, especially central weight gain.',
        'Cold intolerance, dry skin, slow heart rate (suggestive of low thyroid).',
        'Heat intolerance, palpitations, anxiety, weight loss (suggestive of high thyroid).',
        'Hot flashes, night sweats, vaginal dryness, sleep changes (suggestive of perimenopause).',
        'Mood changes that follow a cyclical pattern, often peaking in the week before your period.',
      ],
    },
    {
      kind: 'p',
      text: 'These symptoms have many possible causes. Mentioned together with cycle changes, they help a clinician narrow down where to look [Mayo Clinic].',
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'A useful framing',
      text: 'You are not asking your doctor "is this normal?" You are saying "this is what my pattern was, and this is what it is now, and these are the other things I noticed." That framing leads to better workups.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'Your patterns page surfaces shifts in your cycle, sleep, mood, and pain alongside each other. Bringing that page (or a screenshot) to a visit gives your doctor the change story without you having to assemble it from memory.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Abnormal Uterine Bleeding',
      url: 'https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Hormonal imbalance: Symptoms, causes, and treatment',
      url: 'https://www.mayoclinic.org/diseases-conditions/menstrual-cramps/symptoms-causes/syc-20374938',
      publisher: 'Mayo Clinic',
    },
  ],
  related: ['estrogen-and-progesterone-in-plain-english', 'how-to-talk-to-your-doctor-about-hormone-testing'],
}

export const TALK_TO_DOCTOR_HORMONES: LearnArticle = {
  slug: 'how-to-talk-to-your-doctor-about-hormone-testing',
  category: 'hormones',
  title: 'How to talk to your doctor about hormone testing',
  subhead: 'What to ask, when timing matters, and which tests to know about.',
  readingMinutes: 6,
  body: [
    {
      kind: 'p',
      text: 'Hormone testing is most useful when it is the right test, at the right time in your cycle, ordered to answer a specific question. Walking in with a clear story about your pattern usually gets you better tests than asking for "a hormone panel" with no context.',
    },
    { kind: 'h2', text: 'What to bring' },
    {
      kind: 'ul',
      items: [
        'Your last 3 to 6 cycle lengths.',
        'When (in the cycle) symptoms cluster: early follicular, ovulation, luteal, or premenstrual.',
        'How long the change has been going on, and whether it has gotten worse.',
        'Other relevant signals: weight changes, hair changes, skin changes, sleep changes, mood changes.',
        'A short list of questions you want answered (not solutions you want delivered).',
      ],
    },
    { kind: 'h2', text: 'Tests commonly ordered, and what they show' },
    {
      kind: 'p',
      text: 'These are the most common labs for cycle and hormone questions. Each one has a best timing window in the cycle, which is why timing the draw matters [ACOG].',
    },
    {
      kind: 'ul',
      items: [
        'FSH and LH: best on cycle day 2 to 5. Help characterize ovarian function and rule in or out PCOS or perimenopause.',
        'Estradiol (E2): often drawn with FSH on day 2 to 5; can also be drawn mid-luteal phase to assess corpus luteum function.',
        'Progesterone: best drawn 7 days after ovulation (typically day 21 of a 28-day cycle, or "7 days before expected period"). A normal mid-luteal progesterone is the cleanest evidence ovulation actually happened.',
        'Prolactin: any cycle day. High levels can suppress ovulation and cause irregular cycles.',
        'TSH and free T4: any cycle day. Thyroid disorders are a common, treatable cause of cycle changes.',
        'Total and free testosterone, DHEA-S: any cycle day. Useful when PCOS or unusual androgen-related symptoms (acne, hair growth, hair loss) are present.',
        'AMH (anti-Mullerian hormone): any cycle day. Reflects ovarian reserve.',
        '17-hydroxyprogesterone: best in early follicular phase. Helps screen for non-classic congenital adrenal hyperplasia, an under-diagnosed cause of PCOS-like symptoms.',
      ],
    },
    {
      kind: 'p',
      text: 'No single hormone test is diagnostic on its own. Patterns across several tests, plus your symptom story, are what build a picture [Mayo Clinic].',
    },
    { kind: 'h2', text: 'Useful questions to ask' },
    {
      kind: 'ul',
      items: [
        '"Given my pattern, what tests would you order, and on which cycle days?"',
        '"What would you want to rule out first?"',
        '"If a test comes back borderline, what is the next step?"',
        '"What symptoms should make me come back sooner?"',
      ],
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'A note on at-home hormone tests',
      text: 'Direct-to-consumer hormone panels can be useful screens, but they often skip cycle-day timing and may miss the patterns clinicians look for. If you use one, bring the results in with the cycle days each draw was taken on.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'Your tracker can flag a test you should ask about given your recent pattern. The cycle page keeps your last cycle lengths and symptoms in one view, so the conversation starts with data instead of memory.',
    },
  ],
  citations: [
    {
      label: 'ACOG',
      title: 'Evaluating Infertility',
      url: 'https://www.acog.org/womens-health/faqs/evaluating-infertility',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
    {
      label: 'Mayo Clinic',
      title: 'Hormonal evaluation in menstrual disorders',
      url: 'https://www.mayoclinic.org/diseases-conditions/menstrual-cramps/diagnosis-treatment/drc-20374944',
      publisher: 'Mayo Clinic',
    },
  ],
  related: ['estrogen-and-progesterone-in-plain-english', 'signs-your-hormones-are-off'],
}

export const HORMONES_ARTICLES = [
  ESTROGEN_AND_PROGESTERONE,
  SIGNS_HORMONES_OFF,
  TALK_TO_DOCTOR_HORMONES,
]
