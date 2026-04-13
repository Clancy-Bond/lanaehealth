"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Stethoscope, FileDown, ClipboardCopy, Check } from "lucide-react";
import { TalkingPoints } from "./TalkingPoints";
import { UpcomingAppointments } from "./UpcomingAppointments";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { DataFindings } from "./DataFindings";
import { QuickTimeline } from "./QuickTimeline";
import type { DoctorPageData } from "@/app/doctor/page";

interface DoctorClientProps {
  data: DoctorPageData;
}

export function DoctorClient({ data }: DoctorClientProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const talkingPointsRef = useRef<HTMLDivElement>(null);
  const executiveSummaryRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

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

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleCopySummary}
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
              transition: "all 0.2s ease",
            }}
          >
            {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            onClick={handleExportPDF}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--accent-sage)",
              background: "transparent",
              color: "var(--accent-sage)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <FileDown size={16} />
            <span>PDF</span>
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <div
        ref={contentRef}
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "20px 16px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Section 0: What to Tell the Doctor */}
        <div ref={talkingPointsRef}>
          <TalkingPoints data={data} />
        </div>

        {/* Section 0.5: Upcoming Appointments */}
        {data.upcomingAppointments.length > 0 && (
          <UpcomingAppointments appointments={data.upcomingAppointments} />
        )}

        {/* Section 1: Executive Summary */}
        <div ref={executiveSummaryRef}>
          <ExecutiveSummary data={data} />
        </div>

        {/* Section 2: Data & Findings */}
        <DataFindings data={data} lastAppointmentDate={data.lastAppointmentDate} />

        {/* Section 3: Quick Timeline */}
        <QuickTimeline events={data.timelineEvents} />

        {/* Footer timestamp */}
        <p
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
          {" "}| LanaeHealth
        </p>
      </div>
    </div>
  );
}
