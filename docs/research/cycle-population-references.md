# Cycle Population Reference Values

Source values used by `src/lib/cycle/cycle-insights.ts` to compare an
individual cycler's metrics against published population data. NC
shows the same shape ("My luteal phase length 15 plus/minus 2 days vs
all cyclers 12 plus/minus 2 days") in the Cycle Insights panel.

All values are population means with one-sigma standard deviations.
Citations include sample size and study design so the user-facing
caption can name the source ("Bull et al., n=124,648").

## Cycle length

| Stat | Value | Source |
| --- | --- | --- |
| Mean | 28.6 days | Bull JR, et al. "Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles." NPJ Digit Med. 2019 Aug 27;2:83. |
| SD | 4.5 days | Same. |
| n | 124,648 women, 612,613 cycles | Same, Section "Results, Cohort". |
| Notes | App-tracked self-report data, primarily reproductive-aged users (median age 30). Excluded cycles outside 10-90 days. |

## Luteal phase length

| Stat | Value | Source |
| --- | --- | --- |
| Mean | 12.4 days | Lenton EA, Landgren BM, Sexton L. "Normal variation in the length of the luteal phase of the menstrual cycle: identification of the short luteal phase." Br J Obstet Gynaecol. 1984 Jul;91(7):685-9. |
| SD | 2.0 days | Same. |
| n | 60 women, 327 cycles | Same. |
| Notes | Hormone-confirmed ovulation date. Modern Bull (2019) data agrees within 0.5 day. |

## Follicular phase length

| Stat | Value | Source |
| --- | --- | --- |
| Mean | 16.2 days | Lenton EA, et al. (1984) companion paper, "Normal variation in the length of the follicular phase of the menstrual cycle: effect of chronological age." Br J Obstet Gynaecol. 1984 Jul;91(7):681-4. |
| SD | 4.5 days | Same. |
| n | 65 women, 263 cycles | Same. |
| Notes | Follicular variability is the dominant driver of cycle-length variability; luteal is comparatively stable. |

## Period duration (menstrual flow days)

| Stat | Value | Source |
| --- | --- | --- |
| Mean | 4.5 days | Bull et al. (2019). |
| SD | 1.7 days | Same. |
| n | 124,648 women | Same. |
| Notes | Counts only days with logged bleeding above spotting. |

## Fertile window length

| Stat | Value | Source |
| --- | --- | --- |
| Mean | 6 days | Wilcox AJ, Weinberg CR, Baird DD. "Timing of sexual intercourse in relation to ovulation. Effects on the probability of conception, survival of the pregnancy, and sex of the baby." N Engl J Med. 1995 Dec 7;333(23):1517-21. |
| SD | (fixed window, not a sampled distribution) | Same. |
| n | 221 healthy women | Same. |
| Notes | 5 sperm-survival days plus the day of ovulation. Identical model to NC's published method. |

## Application

`computeCycleInsights(userCycles)` consumes the user's cycle history
and emits a `CycleInsight[]` per metric, each with a NC-voice
interpretation ("Your luteal phase is on the longer side, this is
normal and means a longer time between ovulation and period").

The "honest-with-context" rule (G3) applies: when the user's sample
size is small, the insight states the confidence level explicitly
("Based on 2 cycles so far, this can shift as more cycles complete").
