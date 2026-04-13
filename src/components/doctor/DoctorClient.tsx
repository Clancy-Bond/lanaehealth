"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Stethoscope, FileDown } from "lucide-react";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { DataFindings } from "./DataFindings";
import { QuickTimeline } from "./QuickTimeline";
import type { DoctorPageData } from "@/app/doctor/page";

interface DoctorClientProps {
  data: DoctorPageData;
}

export function DoctorClient({ data }: DoctorClientProps) {
  const contentRef = useRef<HTMLDivElement>(null);

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
      </header>

      {/* Scrollable content */}
      <div
        ref={contentRef}
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "20px 16px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Section 1: Executive Summary */}
        <ExecutiveSummary data={data} />

        {/* Section 2: Data & Findings */}
        <DataFindings data={data} />

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
