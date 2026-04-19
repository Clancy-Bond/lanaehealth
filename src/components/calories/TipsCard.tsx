/**
 * TipsCard - MyNetDiary parity (GAP #2)
 *
 * Rotating condition-aware advice card mirroring MFN's dashboard
 * article teaser. Deterministic by date so the tip is stable per
 * day but changes tomorrow.
 */

import { format } from "date-fns";

interface Tip {
  category: "POTS" | "Endo" | "Migraine" | "Cycle" | "General";
  title: string;
  body: string;
  readMoreHref: string;
  readMoreLabel: string;
  accent: string;
}

const TIPS: Tip[] = [
  { category: "POTS", title: "Sodium for blood volume", body: "POTS patients typically need 3,000-10,000 mg sodium per day to support blood volume. Salt tabs, olives, pickles, broth, and electrolyte drinks get you there faster than shaker-salt alone.", readMoreHref: "/topics/orthostatic", readMoreLabel: "Orthostatic tracker", accent: "var(--accent-sage)" },
  { category: "Endo", title: "Iron-rich foods on menstrual days", body: "Heme iron (red meat, dark poultry, fish) absorbs 2-3x better than non-heme (spinach, lentils, fortified cereals). Pair non-heme with vitamin C (citrus, peppers, strawberries) to boost absorption up to 4x.", readMoreHref: "/calories/search?view=search&q=liver", readMoreLabel: "Search iron foods", accent: "var(--accent-blush-light)" },
  { category: "Migraine", title: "Common dietary triggers", body: "Aged cheese, cured meats, chocolate, red wine, MSG, and caffeine withdrawal are the most common dietary migraine triggers. Log before you eat, flag after a headache, and look for 24-48 hour patterns in /patterns.", readMoreHref: "/topics/migraine", readMoreLabel: "Migraine tracker", accent: "var(--accent-blush)" },
  { category: "Cycle", title: "Luteal-phase cravings", body: "The 7-10 days before your period, serotonin dips and insulin sensitivity shifts. Magnesium (dark chocolate, pumpkin seeds, leafy greens) and complex carbs at dinner help mood and sleep without over-shooting calories.", readMoreHref: "/cycle", readMoreLabel: "Cycle today", accent: "var(--phase-luteal)" },
  { category: "General", title: "Fiber and gut health", body: "25-30g fiber per day supports regularity, glucose stability, and gut microbiome diversity. Endo and IBS overlap often means tolerating fiber is tough at first; build up 2-3g per week.", readMoreHref: "/calories/search?view=search&q=beans", readMoreLabel: "Search high-fiber", accent: "var(--accent-sage)" },
  { category: "POTS", title: "Small frequent meals", body: "Large meals divert blood to the gut for digestion, worsening orthostatic symptoms. 4-6 smaller meals across the day keeps blood pressure steadier than 3 big ones.", readMoreHref: "/calories", readMoreLabel: "Meal log", accent: "var(--accent-sage)" },
  { category: "Migraine", title: "Hydration beats triggers", body: "Dehydration is the most common pre-migraine state. Aim for pale-yellow urine and a glass of water with each meal. Caffeine counts toward fluid intake but watch for withdrawal headaches.", readMoreHref: "/calories", readMoreLabel: "Water tile", accent: "var(--accent-blush)" },
];

export function TipsCard({ date }: { date: string }) {
  const days = Math.floor(new Date(date + "T00:00:00").getTime() / 86400000);
  const tip = TIPS[days % TIPS.length];
  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "14px 16px", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border-light)", borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: tip.accent, boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: tip.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>{tip.category} tip</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{format(new Date(date + "T00:00:00"), "MMM d")}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{tip.title}</div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{tip.body}</p>
        <a href={tip.readMoreHref} style={{ fontSize: 11, fontWeight: 700, color: tip.accent, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {tip.readMoreLabel} &rarr;
        </a>
      </div>
    </div>
  );
}
