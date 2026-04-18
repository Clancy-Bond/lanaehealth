/**
 * /all - site index
 *
 * Every route in LanaeHealth organized by category. Useful as a
 * one-page map, especially after the overnight build shipped 16
 * new routes. Linked from the footer and from the command palette
 * ('index' keyword).
 */

import Link from "next/link";

export const metadata = {
  title: "All pages - LanaeHealth",
};

interface RouteGroup {
  title: string;
  blurb: string;
  routes: Array<{ href: string; label: string; desc: string }>;
}

const GROUPS: RouteGroup[] = [
  {
    title: "Today",
    blurb: "Daily-use surfaces.",
    routes: [
      { href: "/", label: "Home", desc: "Greeting, check-in CTA, vitals, smart cards, year-in-pixels" },
      { href: "/log", label: "Log", desc: "Full check-in form for pain, mood, symptoms, food, cycle" },
    ],
  },
  {
    title: "Calories",
    blurb: "MyNetDiary-equivalent calorie and macro tracking.",
    routes: [
      { href: "/calories", label: "Dashboard", desc: "Apple-ring calorie budget + meal buckets + macros + 30-day strip" },
      { href: "/calories/food", label: "Food log", desc: "Dense 9-column meal table with daily totals + left-vs-target" },
      { href: "/calories/search", label: "Food search", desc: "USDA + Custom + Recipes navigator (9 views)" },
      { href: "/calories/photo", label: "Snap a meal", desc: "AI meal photo identification (Claude Vision)" },
      { href: "/calories/custom-foods/new", label: "New custom food", desc: "Enter a nutrition label for foods not in USDA" },
      { href: "/calories/recipes/new", label: "New recipe", desc: "Build a recipe from ingredients, totals per-serving" },
      { href: "/calories/plan", label: "Plan", desc: "Calorie + macro + weight goals (POTS-tuned sodium)" },
      { href: "/calories/analysis", label: "Daily analysis", desc: "Pattern-based insights keyed off your conditions" },
      { href: "/calories/health/weight", label: "Weight", desc: "Weigh-in form + lb/kg converter + trend chart" },
    ],
  },
  {
    title: "Cycle",
    blurb: "Natural Cycles-equivalent + Stardust hormone layer.",
    routes: [
      { href: "/cycle", label: "Today", desc: "Fertility status + 30-day strip + BBT log + period projection" },
      { href: "/topics/cycle", label: "Phases explainer", desc: "Menstrual, follicular, ovulatory, luteal mechanics" },
      { href: "/topics/cycle/hormones", label: "Hormone log", desc: "9 hormones, lab + self + wearable sources, sparklines" },
    ],
  },
  {
    title: "Conditions",
    blurb: "POTS + migraine + broader condition pages.",
    routes: [
      { href: "/topics/orthostatic", label: "Orthostatic", desc: "POTS diagnostic progress (3x14d rule) + trend" },
      { href: "/topics/migraine", label: "Migraine", desc: "ICHD-3 chronic threshold + cycle correlation" },
    ],
  },
  {
    title: "Records & Labs",
    blurb: "Clinical history and trends.",
    routes: [
      { href: "/labs", label: "Lab trends", desc: "Abnormal flags at top + per-test sparklines" },
      { href: "/records", label: "Records browser", desc: "Labs, imaging, appointments, timeline" },
      { href: "/imaging", label: "Imaging viewer", desc: "PACS/DICOM viewer with presets" },
      { href: "/timeline", label: "Medical timeline", desc: "Chronological event list" },
    ],
  },
  {
    title: "Doctor mode",
    blurb: "Visit prep and clinical summaries.",
    routes: [
      { href: "/doctor", label: "Doctor dashboard", desc: "Clinical summary, red flags, follow-through, KB" },
      { href: "/doctor/care-card", label: "Care card", desc: "One-page visit summary with print + share" },
      { href: "/doctor/cycle-report", label: "Cycle report", desc: "Cycle-focused summary for OB/GYN visits" },
      { href: "/doctor/post-visit", label: "Post-visit capture", desc: "Log action items from a recent appointment" },
      { href: "/emergency", label: "Emergency wallet card", desc: "Credit-card-sized print for EMS / ER" },
    ],
  },
  {
    title: "Intelligence",
    blurb: "AI + analytics surfaces.",
    routes: [
      { href: "/patterns", label: "Patterns", desc: "Food / sleep / symptom correlations" },
      { href: "/intelligence", label: "Intelligence", desc: "What the AI knows, structured" },
      { href: "/intelligence/readiness", label: "Morning Signal detail", desc: "Oura contributors + condition context" },
      { href: "/chat", label: "Ask Lanae", desc: "Chat with your own data" },
    ],
  },
  {
    title: "Account & Help",
    blurb: "Profile, settings, reference.",
    routes: [
      { href: "/profile", label: "Health profile", desc: "Diagnoses, meds, history, allergies" },
      { href: "/settings", label: "Settings", desc: "Devices, data export, modules" },
      { href: "/help/keyboard", label: "Keyboard shortcuts", desc: "Cmd+K cheat sheet" },
      { href: "/all", label: "Site index", desc: "You are here" },
    ],
  },
];

export default function SiteIndexPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 16,
        maxWidth: 920,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Site index</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
          Every page, organized. LanaeHealth grew quickly after the
          2026-04-17 overnight build; this map is the fast way to see
          what exists. Tip: <kbd style={kbd}>{"\u2318"}</kbd>{" "}
          <kbd style={kbd}>K</kbd> opens the command palette from
          anywhere.
        </p>
      </div>

      {GROUPS.map((g) => (
        <section key={g.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {g.title}
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>
              {g.blurb}
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 8,
            }}
          >
            {g.routes.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="press-feedback"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-light)",
                  boxShadow: "var(--shadow-sm)",
                  textDecoration: "none",
                  color: "var(--text-primary)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {r.desc}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--accent-sage)",
                    fontFamily: "var(--font-geist-mono), monospace",
                    marginTop: 2,
                  }}
                >
                  {r.href}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const kbd: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 4,
  background: "var(--bg-card)",
  border: "1px solid var(--border-light)",
  fontSize: 11,
  fontFamily: "var(--font-geist-mono), monospace",
  fontWeight: 600,
};
