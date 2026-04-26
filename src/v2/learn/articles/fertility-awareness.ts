/*
 * Articles: Fertility awareness
 */
import type { LearnArticle } from '../types'

export const HOW_BBT_PREDICTS_OVULATION: LearnArticle = {
  slug: 'how-bbt-predicts-ovulation',
  category: 'fertility-awareness',
  title: 'How BBT predicts ovulation',
  subhead: 'Basal body temperature does not predict ovulation. It confirms it.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'Basal body temperature, or BBT, is your temperature at rest. After ovulation, progesterone rises and pushes your resting temperature up by about 0.4 to 0.8 degrees Fahrenheit. The shift usually appears within one to two days of ovulation and stays elevated until your next period [Mayo Clinic].',
    },
    {
      kind: 'p',
      text: 'That sustained higher plateau is the signal. A single warm reading does not mean you ovulated; the algorithm needs to see at least three consecutive higher readings before it confirms the shift.',
    },
    { kind: 'h2', text: 'What BBT can and cannot do' },
    {
      kind: 'p',
      text: 'BBT confirms ovulation in retrospect, after the egg has already been released. It does not predict ovulation ahead of time. By the time the temperature shift shows up, the most fertile days are usually behind you. To predict the fertile window in advance, BBT is paired with cervical mucus changes and LH testing [ACOG].',
    },
    {
      kind: 'p',
      text: 'For tracking and confirming a cycle is ovulatory, BBT is a strong, low-cost signal. For timing intercourse to a fertile day, BBT alone is too late.',
    },
    { kind: 'h2', text: 'How to read a BBT chart' },
    {
      kind: 'p',
      text: 'A typical chart shows a low plateau in the follicular phase (roughly 96.0 to 97.0 degrees Fahrenheit), a small dip near ovulation, then a rise into a higher plateau (roughly 97.2 to 98.0 degrees Fahrenheit) for the luteal phase. Your individual baseline matters more than the absolute number; some people run consistently warmer or cooler.',
    },
    {
      kind: 'ul',
      items: [
        'Pre-ovulation low plateau, varying by 0.1 to 0.3 degrees day to day.',
        'A possible small dip the day of ovulation (not seen in every cycle).',
        'A sustained rise of at least 0.4 degrees over the previous baseline, holding for three or more days.',
        'A drop back to the lower baseline a day or two before your period (or stays elevated if pregnancy occurred).',
      ],
    },
    { kind: 'h2', text: 'What can throw a BBT reading off' },
    {
      kind: 'p',
      text: 'BBT is sensitive. A reading is most reliable when taken at the same time each morning, before you sit up, drink water, or talk. Things that can spike a reading and confuse the chart:',
    },
    {
      kind: 'ul',
      items: [
        'Less than three to four hours of consecutive sleep before the measurement.',
        'Alcohol the night before.',
        'A fever, cold, or infection.',
        'Travel across time zones.',
        'Taking the reading at a meaningfully different time than usual.',
      ],
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'A note on wearables',
      text: 'Devices like the Oura Ring measure overnight skin or finger temperature, not classical oral BBT, but the underlying signal (the post-ovulation rise) is the same. The shift may appear with a slight lag and a different absolute number, which is why wearable apps build a personal baseline over your first few cycles.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'If your tracker is showing temperature data, look for the sustained rise rather than any single high reading. The cover line your app draws is the algorithm\'s estimate of where your ovulatory shift sits.',
    },
  ],
  citations: [
    {
      label: 'Mayo Clinic',
      title: 'Basal body temperature for natural family planning',
      url: 'https://www.mayoclinic.org/tests-procedures/basal-body-temperature/about/pac-20393026',
      publisher: 'Mayo Clinic',
    },
    {
      label: 'ACOG',
      title: 'Fertility Awareness-Based Methods of Family Planning',
      url: 'https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
  ],
  related: ['what-lh-tests-really-measure', 'cervical-mucus-changes-by-phase'],
}

export const WHAT_LH_TESTS_MEASURE: LearnArticle = {
  slug: 'what-lh-tests-really-measure',
  category: 'fertility-awareness',
  title: 'What LH tests really measure',
  subhead: 'Plain words on the surge that triggers ovulation.',
  readingMinutes: 4,
  body: [
    {
      kind: 'p',
      text: 'A urine LH test, the kind sold as an "ovulation predictor kit," looks for luteinizing hormone in your urine. LH is the brain signal that triggers ovulation. Levels rise sharply, the LH surge, in the day or two before your ovary releases the egg [ACOG].',
    },
    {
      kind: 'p',
      text: 'A positive LH test, in most cycles, means you will ovulate within the next 12 to 36 hours. That makes LH testing a forward-looking signal, unlike BBT, which only confirms ovulation after it has happened.',
    },
    { kind: 'h2', text: 'What a positive test does and does not prove' },
    {
      kind: 'p',
      text: 'A positive LH test means the surge happened. It does not, on its own, prove that an egg was actually released; in some cycles the follicle can fail to release the egg even after a normal LH surge (called a luteinized unruptured follicle). For most cycles, though, the LH surge is a reliable predictor of ovulation within a day or two.',
    },
    {
      kind: 'p',
      text: 'Pairing LH testing with BBT confirmation gives the strongest read on whether a cycle was truly ovulatory. The LH test catches the surge; the BBT shift, three to four days later, confirms an egg was released and progesterone is being made [Mayo Clinic].',
    },
    { kind: 'h2', text: 'When to test' },
    {
      kind: 'p',
      text: 'Start testing several days before you expect ovulation. For a 28-day cycle, that means starting around day 10 or 11. For longer cycles, push the start later. Test daily, ideally at the same time of day, with afternoon urine (early afternoon is when the LH surge is most likely to be detectable).',
    },
    { kind: 'h2', text: 'When LH tests can mislead' },
    {
      kind: 'p',
      text: 'Polycystic ovary syndrome (PCOS) often produces chronically elevated LH levels, which can give misleading positive tests across many days of the cycle. People with PCOS often need a different ovulation marker, such as serum progesterone drawn about a week after suspected ovulation [ACOG].',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'If you log LH test results, your tracker can match the surge to your subsequent BBT shift. A clean alignment is reassurance the cycle was ovulatory; a missing temperature shift after a positive LH is a question worth asking.',
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
      title: 'Ovulation predictor kits: When and how to use them',
      url: 'https://www.mayoclinic.org/healthy-lifestyle/getting-pregnant/in-depth/ovulation/art-20045180',
      publisher: 'Mayo Clinic',
    },
  ],
  related: ['how-bbt-predicts-ovulation', 'cervical-mucus-changes-by-phase'],
}

export const CERVICAL_MUCUS_BY_PHASE: LearnArticle = {
  slug: 'cervical-mucus-changes-by-phase',
  category: 'fertility-awareness',
  title: 'Cervical mucus changes by phase',
  subhead: 'A free, low-tech window onto your hormones.',
  readingMinutes: 5,
  body: [
    {
      kind: 'p',
      text: 'Cervical mucus is a fluid your cervix produces, and its texture changes across the cycle in response to estrogen and progesterone. Watching it is one of the oldest fertility-awareness methods. It is also one of the most sensitive, because it responds to the hormone shifts directly [OWH].',
    },
    { kind: 'h2', text: 'A typical cycle of changes' },
    {
      kind: 'ul',
      items: [
        'Just after your period: usually dry or very little mucus.',
        'Early follicular phase: small amounts, often sticky or pasty, white or cloudy.',
        'Approaching ovulation: increasing amounts, becoming wet, creamy, then slippery and stretchy. The classic ovulatory mucus is clear, slippery, and stretches between two fingers like raw egg white.',
        'After ovulation: drops back to sticky or dry, sometimes white or yellowish, as progesterone takes over.',
        'Late luteal phase: usually dry or scant.',
      ],
    },
    {
      kind: 'p',
      text: 'These changes are described in detail in fertility-awareness method literature and are recognized by major reproductive health bodies as a valid ovulation marker [ACOG].',
    },
    { kind: 'h2', text: 'How to check' },
    {
      kind: 'p',
      text: 'Check at the same time each day, ideally before you have used the bathroom in the morning or after a shower. Use clean fingers or toilet paper to collect a small amount from the vaginal opening. Rate the texture: dry, sticky, creamy, or slippery and stretchy. Log it in your tracker the same way you log other cycle signs.',
    },
    {
      kind: 'callout',
      tone: 'info',
      title: 'Things that can mask the signal',
      text: 'Lubricants, semen, hormonal birth control, certain antihistamines, and vaginal infections can all distort what you see. If a pattern is hard to read, give it a few cycles or pair with another marker.',
    },
    { kind: 'h2', text: 'Why this matters with BBT' },
    {
      kind: 'p',
      text: 'Mucus is forward-looking: it tells you ovulation is coming in the next few days. BBT is backward-looking: it confirms ovulation has happened. Used together, they bracket the fertile window from both sides. Adding LH testing makes the picture even more precise.',
    },
    {
      kind: 'forYou',
      title: 'For you',
      text: 'If you log cervical mucus, your tracker overlays the changes with BBT. Seeing slippery mucus right before a temperature rise is the cleanest read of an ovulatory cycle.',
    },
  ],
  citations: [
    {
      label: 'OWH',
      title: 'Cervical mucus changes',
      url: 'https://www.womenshealth.gov/a-z-topics/cervix',
      publisher: 'Office on Women\'s Health',
    },
    {
      label: 'ACOG',
      title: 'Fertility Awareness-Based Methods of Family Planning',
      url: 'https://www.acog.org/womens-health/faqs/fertility-awareness-based-methods-of-family-planning',
      publisher: 'American College of Obstetricians and Gynecologists',
    },
  ],
  related: ['how-bbt-predicts-ovulation', 'what-lh-tests-really-measure'],
}

export const FERTILITY_AWARENESS_ARTICLES = [
  HOW_BBT_PREDICTS_OVULATION,
  WHAT_LH_TESTS_MEASURE,
  CERVICAL_MUCUS_BY_PHASE,
]
