"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Stethoscope, FileDown, ClipboardCopy, Check, Printer } from "lucide-react";
import { TalkingPoints } from "./TalkingPoints";
import { UpcomingAppointments } from "./UpcomingAppointments";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { DataFindings } from "./DataFindings";
import { QuickTimeline } from "./QuickTimeline";
import { SpecialistToggle } from "./SpecialistToggle";
import { SinceLastVisit } from "./SinceLastVisit";
import { HypothesesPanel } from "./HypothesesPanel";
import { OutstandingTests } from "./OutstandingTests";
import { CIENextActions } from "./CIENextActions";
import { ChallengerPanel } from "./ChallengerPanel";
import { ResearchContextPanel } from "./ResearchContextPanel";
import { CrossAppointmentOverlay } from "./CrossAppointmentOverlay";
import { WeeklyNarrative } from "./WeeklyNarrative";
import { RedFlagsBanner } from "./RedFlagsBanner";
import { MedicationDeltas } from "./MedicationDeltas";
import { CyclePhaseFindings } from "./CyclePhaseFindings";
import { CompletenessFooter } from "./CompletenessFooter";
import { FollowThroughList } from "./FollowThroughList";
import { StaleTestsPanel } from "./StaleTestsPanel";
import { WrongModalityPanel } from "./WrongModalityPanel";
import { bucketVisible, type SpecialistView } from "@/lib/doctor/specialist-config";
import type { DoctorPageData } from "@/app/doctor/page";

interface DoctorClientProps {
  data: DoctorPageData;
  initialView?: SpecialistView;
}

export function DoctorClient({ data, initialView = "pcp" }: DoctorClientProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const talkingPointsRef = useRef<HTMLDivElement>(null);
  const executiveSummaryRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<SpecialistView>(initialView);

  const handleViewChange = (v: SpecialistView) => {
    setView(v);
    const url = new URL(window.location.href);
    url.searchParams.set("v", v);
    window.history.replaceState({}, "", url.toString());
  };

  const handlePrint = () => window.print();

  // Hide bottom nav when Doctor Mode is active
  useEffect(() => {
    const nav = document.querySelector('nav[aria-label="Main navigation"]');
    const overlay = nav?.previousElementSibling?.previousElementSibling;
    const morePanel = nav?.previousElementSibling;

    if (nav instanceof HTMLElement) nav.style.display = "none";
    if (overlay instanceof HTMLElement) overlay.style.display = "none";
    if (morePanel instanceof HTMLElement) morePanel.style.display = "none";

    // Also remove bottom padding from main
    const main = document.querySelector("main");
    if (main) {
      main.style.paddingBottom = "0";
    }

    return () => {
      if (nav instanceof HTMLElement) nav.style.display = "";
      if (overlay instanceof HTMLElement) overlay.style.display = "";
      if (morePanel instanceof HTMLElement) morePanel.style.display = "";
      if (main) main.style.paddingBottom = "";
    };
  }, []);

  const handleExportPDF = async () => {
    if (!contentRef.current) return;

    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");

      // Capture the content area
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#FAFAF7",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const today = new Date().toISOString().split("T")[0];
      pdf.save(`LanaeHealth-DoctorReport-${today}.pdf`);
    } catch {
      // Fallback: print the page
      window.print();
    }
  };

  const handleCopySummary = async () => {
    const parts: string[] = [];

    // Extract text from Talking Points section
    if (talkingPointsRef.current) {
      const heading = "WHAT TO TELL THE DOCTOR";
      const items = talkingPointsRef.current.querySelectorAll("li");
      const bullets: string[] = [];
      items.forEach((li) => {
        const text = li.textContent?.trim();
        if (text) bullets.push(`- ${text}`);
      });
      if (bullets.length > 0) {
        parts.push(`${heading}\n${bullets.join("\n")}`);
      }
    }

    // Extract text from Executive Summary section
    if (executiveSummaryRef.current) {
      const heading = "EXECUTIVE SUMMARY";
      const text = executiveSummaryRef.current.innerText?.trim();
      if (text) {
        parts.push(`${heading}\n${text}`);
      }
    }

    const fullText = parts.join("\n\n---\n\n");

    if (!fullText) return;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = fullText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
      }}
    >
      {/* Sticky header bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--accent-sage)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Stethoscope
            size={20}
            style={{ color: "var(--accent-sage)" }}
          />
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Doctor Mode
          </span>
        </div>

        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handlePrint}
            aria-label="Print or save as PDF"
            title="Print or save as PDF (clean, text-based output)"
            className="press-feedback"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all var(--duration-fast) var(--ease-standard)",
            }}
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
          <button
            onClick={handleCopySummary}
            aria-label="Copy summary to clipboard"
            className="press-feedback"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${copied ? "var(--accent-sage)" : "var(--border)"}`,
              background: copied ? "var(--accent-sage-muted)" : "transparent",
              color: copied ? "var(--accent-sage)" : "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all var(--duration-fast) var(--ease-standard)",
            }}
          >
            {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            onClick={handleExportPDF}
            aria-label="Export PDF image"
            className="press-feedback"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all var(--duration-fast) var(--ease-standard)",
            }}
          >
            <FileDown size={16} />
            <span>PDF</span>
          </button>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/reports/doctor');
                if (res.ok) {
                  const report = await res.json();
                  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `lanaehealth-clinical-report-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              } catch { /* silently fail */ }
            }}
            aria-label="Download structured clinical report as JSON"
            className="press-feedback"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--accent-sage)",
              background: "var(--accent-sage)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all var(--duration-fast) var(--ease-standard)",
            }}
          >
            <Stethoscope size={16} />
            <span>Clinical Report</span>
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <div
        ref={contentRef}
        className="doctor-brief route-desktop-wide"
        data-specialist={view}
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "var(--space-5) var(--space-4) var(--space-10)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <SpecialistToggle view={view} onChange={handleViewChange} />

        {/* Red flags banner (top priority, only when present) */}
        <RedFlagsBanner flags={data.redFlags} />

        {/* Follow-through tracker (overdue/upcoming action items) */}
        <FollowThroughList items={data.followThrough} />

        {/* Stale pending tests (ordered but never resulted) */}
        <StaleTestsPanel tests={data.staleTests} />

        {/* Imaging modality mismatch */}
        <WrongModalityPanel flags={data.wrongModalityFlags} />

        {/* Section 0: What to Tell the Doctor */}
        <div ref={talkingPointsRef}>
          <TalkingPoints data={data} view={view} />
        </div>

        {/* Since last visit diff */}
        <SinceLastVisit data={data} />

        {/* Hypotheses + single test recommendation */}
        <HypothesesPanel data={data} view={view} />

        {/* Challenger: the opposition case (anti-anchoring) */}
        <ChallengerPanel payload={data.kbChallenger} view={view} />

        {/* Cross-appointment coverage (who evaluates what) */}
        <CrossAppointmentOverlay data={data} currentView={view} />

        {/* CIE Next Best Actions (from the Clinical Intelligence Engine) */}
        <CIENextActions payload={data.kbActions} view={view} />

        {/* Outstanding tests (deterministic; complements CIE actions) */}
        <OutstandingTests data={data} view={view} />

        {/* Cycle-phase correlation findings */}
        <CyclePhaseFindings findings={data.cyclePhaseFindings} />

        {/* Medication-delta correlations */}
        <MedicationDeltas deltas={data.medicationDeltas} />

        {/* Upcoming Appointments */}
        {data.upcomingAppointments.length > 0 && (
          <UpcomingAppointments appointments={data.upcomingAppointments} />
        )}

        {/* Executive Summary */}
        <div ref={executiveSummaryRef}>
          <ExecutiveSummary data={data} view={view} />
        </div>

        {/* Data & Findings */}
        <DataFindings
          data={data}
          lastAppointmentDate={data.lastAppointmentDate}
          view={view}
        />

        {/* Quick Timeline */}
        {bucketVisible(view, "activeProblems") && (
          <QuickTimeline events={data.timelineEvents} />
        )}

        {/* Research context (evidence-graded study cards) */}
        <ResearchContextPanel payload={data.kbResearch} view={view} />

        {/* Weekly narrative (per-specialist variant) */}
        <WeeklyNarrative view={view} />

        {/* Data completeness footer (always visible so hypotheses are honest) */}
        <CompletenessFooter report={data.completeness} />

        {/* Footer timestamp */}
        <p
          className="tabular"
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          Generated {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" "}| LanaeHealth | View: {view.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
