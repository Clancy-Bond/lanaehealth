import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";

export const metadata = {
  title: "Import health data - LanaeHealth",
  description: "Bring your medical records into LanaeHealth",
};

export default function ImportLandingPage() {
  return (
    <div
      className="px-4 pt-6 pb-safe route-desktop-wide"
      style={{ maxWidth: 540, margin: "0 auto" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="press-feedback flex items-center justify-center rounded-lg"
          style={{
            width: 36,
            height: 36,
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            textDecoration: "none",
            transition: "background 150ms var(--ease-standard)",
          }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1
            className="text-xl font-semibold page-title"
            style={{ color: "var(--text-primary)" }}
          >
            Bring in your health data
          </h1>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Choose a source to import from
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Link
          href="/import/myah"
          className="press-feedback flex items-start gap-3 rounded-xl p-4"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-sm)",
            textDecoration: "none",
            transition:
              "box-shadow 150ms var(--ease-standard), transform 150ms var(--ease-standard)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{
              width: 40,
              height: 40,
              background: "var(--accent-sage-muted)",
              color: "var(--accent-sage)",
            }}
          >
            <Building2 size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Adventist Health (myAH)
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}
            >
              Paste labs, appointments, medications, or clinical notes from the
              mychart.adventisthealth.org portal.
            </p>
          </div>
          <ArrowRight
            size={18}
            style={{ color: "var(--accent-sage)" }}
            aria-hidden
          />
        </Link>

        <p
          className="text-xs mt-2 px-2"
          style={{ color: "var(--text-muted)", lineHeight: 1.5 }}
        >
          More sources (Apple Health, Natural Cycles, MyNetDiary) are available
          in Settings.
        </p>
      </div>
    </div>
  );
}
