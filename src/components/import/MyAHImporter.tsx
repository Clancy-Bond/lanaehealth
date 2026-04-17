"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardPaste,
  FileUp,
  FlaskConical,
  CalendarDays,
  Pill,
  FileText,
  AlertCircle,
  Building2,
  RotateCcw,
  ExternalLink,
  Inbox,
} from "lucide-react";

// ── Types ──

type ImportCategory = "labs" | "appointments" | "medications" | "notes";

interface CategoryOption {
  key: ImportCategory;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  instructions: string;
  placeholder: string;
}

type WizardStep = "choose" | "input" | "review" | "done";

interface ParsedRecord {
  raw: string;
  parsed: Record<string, string | number | null>;
}

interface ParseResult {
  category: ImportCategory;
  records: ParsedRecord[];
  warnings: string[];
}

interface ImportResult {
  category: ImportCategory;
  imported: number;
  skipped: number;
  errors: string[];
}

// ── Constants ──

const CATEGORIES: CategoryOption[] = [
  {
    key: "labs",
    label: "Lab Results",
    icon: FlaskConical,
    instructions:
      "In myAH, go to Test Results. Select the results you want to import, then copy the table text.",
    placeholder: `Paste your lab results here. Example format:

03/15/2025  CBC with Differential
  WBC          6.2        x10^3/uL    4.5-11.0
  RBC          4.31       x10^6/uL    4.00-5.50
  Hemoglobin   12.8       g/dL        12.0-16.0
  Hematocrit   38.2       %           36.0-46.0

Or any other format - we will parse it intelligently.`,
  },
  {
    key: "appointments",
    label: "Appointments",
    icon: CalendarDays,
    instructions:
      "In myAH, go to Visits or Appointments. Copy your appointment history list.",
    placeholder: `Paste your appointment history here. Example format:

03/20/2025  Dr. Sarah Chen  - Gastroenterology  - Follow-up
02/10/2025  Dr. James Park  - Primary Care      - Annual Physical
01/05/2025  Dr. Lisa Wong   - OB/GYN            - Consultation

Or any other format - we will parse it intelligently.`,
  },
  {
    key: "medications",
    label: "Medications",
    icon: Pill,
    instructions:
      "In myAH, go to Medications. Copy your current or historical medication list.",
    placeholder: `Paste your medication list here. Example format:

Metformin 500mg - Take 1 tablet twice daily with meals
Vitamin D3 2000 IU - Take 1 capsule daily
Iron Supplement 325mg - Take 1 tablet daily on empty stomach
Omeprazole 20mg - Take 1 capsule daily before breakfast

Or any other format - we will parse it intelligently.`,
  },
  {
    key: "notes",
    label: "Clinical Notes",
    icon: FileText,
    instructions:
      "In myAH, go to Notes or After Visit Summaries. Copy any provider notes you want to save.",
    placeholder: `Paste clinical notes or after-visit summaries here.

These will be stored as medical narrative entries that the AI can reference during conversations about your health history.`,
  },
];

// ── Subcomponents ──

function StepIndicator({
  current,
  steps,
  onStepClick,
}: {
  current: number;
  steps: string[];
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((label, i) => {
        const isActive = i === current;
        const isDone = i < current;
        const canRevisit = isDone && !!onStepClick;

        const pipContent = (
          <>
            <span
              className="flex items-center justify-center rounded-full shrink-0"
              style={{
                width: 24,
                height: 24,
                background:
                  isDone || isActive
                    ? "var(--accent-sage)"
                    : "var(--bg-elevated)",
                border: isActive || isDone ? "none" : "1px solid var(--border)",
                transition: "background 150ms var(--ease-standard)",
              }}
            >
              {isDone ? (
                <Check size={12} style={{ color: "var(--text-inverse)" }} />
              ) : (
                <span
                  className="text-xs font-medium tabular"
                  style={{
                    color: isActive
                      ? "var(--text-inverse)"
                      : "var(--text-muted)",
                  }}
                >
                  {i + 1}
                </span>
              )}
            </span>
            <span
              className="text-xs truncate"
              style={{
                color:
                  isActive || isDone
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {label}
            </span>
          </>
        );

        return (
          <div key={label} className="flex items-center gap-1 flex-1">
            {canRevisit ? (
              <button
                type="button"
                onClick={() => onStepClick?.(i)}
                aria-label={`Go to step ${i + 1}: ${label}`}
                className="press-feedback flex items-center gap-1 flex-1 rounded-md"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "2px 4px",
                  margin: "-2px -4px",
                  cursor: "pointer",
                }}
              >
                {pipContent}
              </button>
            ) : (
              <div className="flex items-center gap-1 flex-1">{pipContent}</div>
            )}
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-px mx-1"
                style={{
                  background: isDone
                    ? "var(--accent-sage)"
                    : "var(--border-light)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CategoryCheckbox({
  option,
  checked,
  onChange,
}: {
  option: CategoryOption;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const Icon = option.icon;

  return (
    <label
      className="press-feedback flex items-start gap-3 rounded-xl p-3 cursor-pointer"
      style={{
        background: checked ? "var(--accent-sage-muted)" : "var(--bg-elevated)",
        border: checked
          ? "1px solid var(--accent-sage-light)"
          : "1px solid var(--border-light)",
        transition:
          "background 150ms var(--ease-standard), border-color 150ms var(--ease-standard)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div
        className="flex items-center justify-center rounded-lg shrink-0 mt-0.5"
        style={{
          width: 36,
          height: 36,
          background: "var(--accent-sage-muted)",
          color: "var(--accent-sage)",
        }}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {option.label}
          </p>
          {checked && (
            <CheckCircle2
              size={14}
              style={{ color: "var(--accent-sage)" }}
              aria-label="Selected"
            />
          )}
        </div>
        <p
          className="text-xs mt-0.5"
          style={{ color: "var(--text-muted)", lineHeight: 1.4 }}
        >
          {option.instructions}
        </p>
      </div>
    </label>
  );
}

// ── Main Component ──

export function MyAHImporter() {
  const [step, setStep] = useState<WizardStep>("choose");
  const [selectedCategories, setSelectedCategories] = useState<Set<ImportCategory>>(
    new Set()
  );
  const [inputMode, setInputMode] = useState<"paste" | "upload">("paste");
  const [pasteTexts, setPasteTexts] = useState<Record<ImportCategory, string>>({
    labs: "",
    appointments: "",
    medications: "",
    notes: "",
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResults, setParseResults] = useState<ParseResult[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current category being edited (for paste mode)
  const [activePasteCategory, setActivePasteCategory] = useState<ImportCategory | null>(null);

  const selectedArray = Array.from(selectedCategories);

  // Step index for indicator
  const stepIndex =
    step === "choose" ? 0 : step === "input" ? 1 : step === "review" ? 2 : 3;

  // ── Handlers ──

  function toggleCategory(key: ImportCategory, checked: boolean) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function goToInput() {
    if (selectedCategories.size === 0) return;
    // Set the first selected category as active for paste
    setActivePasteCategory(selectedArray[0]);
    setStep("input");
  }

  const handleParse = useCallback(async () => {
    setParsing(true);
    setParseError(null);
    setParseResults([]);

    try {
      if (inputMode === "upload" && uploadedFile) {
        // Upload the file
        const formData = new FormData();
        formData.append("file", uploadedFile);
        formData.append("categories", JSON.stringify(selectedArray));

        const res = await fetch("/api/import/myah", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Parse failed (${res.status})`);
        }
        setParseResults(data.results || []);
      } else {
        // Paste mode: send each non-empty category
        const results: ParseResult[] = [];

        for (const cat of selectedArray) {
          const text = pasteTexts[cat]?.trim();
          if (!text) continue;

          const res = await fetch("/api/import/myah", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: cat,
              rawText: text,
              action: "parse",
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(
              data.error || `Parse failed for ${cat} (${res.status})`
            );
          }
          results.push({
            category: cat,
            records: data.records || [],
            warnings: data.warnings || [],
          });
        }

        setParseResults(results);
      }
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Parse failed";
      setParseError(msg);
    } finally {
      setParsing(false);
    }
  }, [inputMode, uploadedFile, selectedArray, pasteTexts]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportError(null);
    setImportResults([]);

    try {
      const results: ImportResult[] = [];

      for (const parseResult of parseResults) {
        if (parseResult.records.length === 0) continue;

        const res = await fetch("/api/import/myah", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: parseResult.category,
            records: parseResult.records.map((r) => r.parsed),
            action: "import",
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error || `Import failed for ${parseResult.category}`
          );
        }

        results.push({
          category: parseResult.category,
          imported: data.imported || 0,
          skipped: data.skipped || 0,
          errors: data.errors || [],
        });
      }

      setImportResults(results);
      setStep("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setImportError(msg);
    } finally {
      setImporting(false);
    }
  }, [parseResults]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  }

  function startOver() {
    setStep("choose");
    setSelectedCategories(new Set());
    setPasteTexts({ labs: "", appointments: "", medications: "", notes: "" });
    setUploadedFile(null);
    setParseResults([]);
    setImportResults([]);
    setParseError(null);
    setImportError(null);
    setActivePasteCategory(null);
  }

  function handleStepClick(index: number) {
    // Only allow revisiting completed steps. Done step is final.
    if (step === "done") return;
    if (index >= stepIndex) return;
    if (index === 0) setStep("choose");
    else if (index === 1) setStep("input");
    else if (index === 2) setStep("review");
  }

  // ── Render ──

  const categoryLabel = (key: ImportCategory) =>
    CATEGORIES.find((c) => c.key === key)?.label ?? key;

  const totalImported = importResults.reduce((sum, r) => sum + r.imported, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
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
          <div className="flex items-center gap-2">
            <Building2
              size={18}
              style={{ color: "var(--text-muted)" }}
              aria-hidden
            />
            <h1
              className="text-xl font-semibold page-title"
              style={{ color: "var(--text-primary)" }}
            >
              Import from myAH
            </h1>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Adventist Health patient portal
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator
        current={stepIndex}
        steps={["Select", "Enter Data", "Review", "Done"]}
        onStepClick={step === "done" ? undefined : handleStepClick}
      />

      {/* Step 1: Choose categories */}
      {step === "choose" && (
        <div>
          <p
            className="text-sm mb-3"
            style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}
          >
            Choose what you want to import from your myAH portal. You will need
            to log in to{" "}
            <a
              href="https://mychart.adventisthealth.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5"
              style={{ color: "var(--accent-sage)", textDecoration: "underline" }}
            >
              mychart.adventisthealth.org
              <ExternalLink size={11} />
            </a>{" "}
            separately and copy the data.
          </p>

          <div className="space-y-2 mb-4">
            {CATEGORIES.map((cat) => (
              <CategoryCheckbox
                key={cat.key}
                option={cat}
                checked={selectedCategories.has(cat.key)}
                onChange={(checked) => toggleCategory(cat.key, checked)}
              />
            ))}
          </div>

          <button
            onClick={goToInput}
            disabled={selectedCategories.size === 0}
            className="press-feedback w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 rounded-xl"
            style={{
              background:
                selectedCategories.size > 0
                  ? "var(--accent-sage)"
                  : "transparent",
              color:
                selectedCategories.size > 0
                  ? "var(--text-inverse)"
                  : "var(--text-muted)",
              border:
                selectedCategories.size > 0
                  ? "1px solid var(--accent-sage)"
                  : "1px solid var(--border-light)",
              minHeight: 48,
              opacity: selectedCategories.size === 0 ? 0.6 : 1,
              cursor:
                selectedCategories.size === 0 ? "not-allowed" : "pointer",
              transition:
                "background 150ms var(--ease-standard), border-color 150ms var(--ease-standard)",
            }}
          >
            Continue
            <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      )}

      {/* Step 2: Input data */}
      {step === "input" && (
        <div>
          {/* Mode toggle */}
          <div
            className="flex rounded-lg overflow-hidden mb-4"
            style={{ border: "1px solid var(--border-light)" }}
            role="tablist"
          >
            <button
              type="button"
              onClick={() => setInputMode("paste")}
              className="press-feedback flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium"
              role="tab"
              aria-selected={inputMode === "paste"}
              style={{
                background:
                  inputMode === "paste"
                    ? "var(--accent-sage-muted)"
                    : "var(--bg-elevated)",
                color:
                  inputMode === "paste"
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                borderBottom:
                  inputMode === "paste"
                    ? "2px solid var(--accent-sage)"
                    : "2px solid transparent",
                transition:
                  "background 150ms var(--ease-standard), color 150ms var(--ease-standard)",
              }}
            >
              <ClipboardPaste size={14} aria-hidden />
              Paste text
            </button>
            <button
              type="button"
              onClick={() => setInputMode("upload")}
              className="press-feedback flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium"
              role="tab"
              aria-selected={inputMode === "upload"}
              style={{
                background:
                  inputMode === "upload"
                    ? "var(--accent-sage-muted)"
                    : "var(--bg-elevated)",
                color:
                  inputMode === "upload"
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                borderBottom:
                  inputMode === "upload"
                    ? "2px solid var(--accent-sage)"
                    : "2px solid transparent",
                transition:
                  "background 150ms var(--ease-standard), color 150ms var(--ease-standard)",
              }}
            >
              <FileUp size={14} aria-hidden />
              Upload PDF
            </button>
          </div>

          {inputMode === "paste" && (
            <div>
              {/* Category tabs */}
              {selectedArray.length > 1 && (
                <div className="flex gap-1 mb-3 overflow-x-auto" role="tablist">
                  {selectedArray.map((cat) => {
                    const isActive = activePasteCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActivePasteCategory(cat)}
                        role="tab"
                        aria-selected={isActive}
                        className="press-feedback px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{
                          background: isActive
                            ? "var(--accent-sage-muted)"
                            : "var(--bg-elevated)",
                          color: isActive
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                          border: isActive
                            ? "1px solid var(--accent-sage-light)"
                            : "1px solid var(--border-light)",
                          transition:
                            "background 150ms var(--ease-standard), border-color 150ms var(--ease-standard)",
                        }}
                      >
                        {categoryLabel(cat)}
                        {pasteTexts[cat]?.trim() && (
                          <span style={{ marginLeft: 4 }} aria-label="Filled">
                            <Check
                              size={10}
                              style={{
                                display: "inline",
                                color: "var(--accent-sage)",
                              }}
                            />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active textarea */}
              {activePasteCategory && (() => {
                const catOption = CATEGORIES.find(
                  (c) => c.key === activePasteCategory
                );
                if (!catOption) return null;

                return (
                  <div>
                    <div
                      className="flex items-center gap-2 mb-2 p-2 rounded-lg"
                      style={{
                        background: "var(--accent-sage-muted)",
                        border: "1px solid var(--border-light)",
                      }}
                    >
                      <catOption.icon size={14} />
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}
                      >
                        {catOption.instructions}
                      </span>
                    </div>
                    <textarea
                      value={pasteTexts[activePasteCategory]}
                      onChange={(e) =>
                        setPasteTexts((prev) => ({
                          ...prev,
                          [activePasteCategory!]: e.target.value,
                        }))
                      }
                      placeholder={catOption.placeholder}
                      className="w-full rounded-xl text-sm resize-none"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: 12,
                        minHeight: 200,
                        lineHeight: 1.5,
                        fontFamily: "var(--font-geist-mono)",
                        fontSize: 12,
                      }}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {inputMode === "upload" && (
            <div>
              <div
                className="flex items-center gap-2 mb-3 p-2 rounded-lg"
                style={{
                  background: "var(--accent-sage-muted)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <FileUp size={14} />
                <span
                  className="text-xs"
                  style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}
                >
                  In myAH, go to Health Summary or any section and download as
                  PDF. Then upload it here.
                </span>
              </div>

              <label
                className="press-feedback flex flex-col items-center justify-center gap-2 rounded-xl p-8 cursor-pointer"
                style={{
                  background: "var(--bg-elevated)",
                  border: "2px dashed var(--border)",
                  minHeight: 160,
                  transition: "border-color 150ms var(--ease-standard)",
                }}
              >
                {uploadedFile ? (
                  <>
                    <FileText
                      size={24}
                      style={{ color: "var(--accent-sage)" }}
                      aria-hidden
                    />
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {uploadedFile.name}
                    </span>
                    <span
                      className="tabular text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {(uploadedFile.size / 1024).toFixed(1)} KB, tap to change
                    </span>
                  </>
                ) : (
                  <>
                    <FileUp
                      size={24}
                      style={{ color: "var(--text-muted)" }}
                      aria-hidden
                    />
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Tap to select a PDF file
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      PDF format from myAH export
                    </span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Error */}
          {parseError && (
            <div
              className="flex items-start gap-2 mt-3 p-2 rounded-lg"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-light)",
              }}
            >
              <AlertCircle
                size={14}
                className="shrink-0 mt-0.5"
                style={{ color: "var(--accent-blush, #D4A0A0)" }}
                aria-hidden
              />
              <span
                className="text-xs"
                style={{ color: "var(--text-primary)" }}
              >
                {parseError}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="press-feedback flex items-center justify-center gap-1.5 text-sm font-medium px-4 rounded-xl"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                minHeight: 48,
                border: "1px solid var(--border-light)",
                transition: "background 150ms var(--ease-standard)",
              }}
            >
              <ArrowLeft size={14} aria-hidden />
              Back
            </button>
            <button
              type="button"
              onClick={handleParse}
              disabled={
                parsing ||
                (inputMode === "paste" &&
                  !selectedArray.some((c) => pasteTexts[c]?.trim())) ||
                (inputMode === "upload" && !uploadedFile)
              }
              className="press-feedback relative flex-1 inline-flex items-center justify-center gap-2 text-sm font-medium px-4 rounded-xl overflow-hidden"
              style={{
                background: "var(--accent-sage)",
                color: "var(--text-inverse)",
                minHeight: 48,
                opacity:
                  parsing ||
                  (inputMode === "paste" &&
                    !selectedArray.some((c) => pasteTexts[c]?.trim())) ||
                  (inputMode === "upload" && !uploadedFile)
                    ? 0.6
                    : 1,
                cursor:
                  parsing ||
                  (inputMode === "paste" &&
                    !selectedArray.some((c) => pasteTexts[c]?.trim())) ||
                  (inputMode === "upload" && !uploadedFile)
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {parsing && (
                <span
                  className="shimmer-bar"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                  }}
                  aria-hidden
                />
              )}
              <span className="relative inline-flex items-center gap-2">
                {parsing ? "Parsing" : "Parse data"}
                {!parsing && <ArrowRight size={16} aria-hidden />}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === "review" && (
        <div>
          <p
            className="text-sm mb-3"
            style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}
          >
            Review the parsed data below. If everything looks correct, click
            Import to save it to your health records.
          </p>

          {parseResults.length === 0 ? (
            <div
              className="empty-state rounded-xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-light)",
              }}
            >
              <Inbox className="empty-state__icon" size={56} aria-hidden />
              <p className="empty-state__title">Nothing to review yet</p>
              <p className="empty-state__hint">
                Go back and paste or upload your data to see parsed records
                here.
              </p>
              <button
                type="button"
                onClick={() => setStep("input")}
                className="press-feedback mt-1 text-sm font-medium"
                style={{
                  color: "var(--accent-sage)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Back to Enter data
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {parseResults.map((result) => {
                const catOption = CATEGORIES.find(
                  (c) => c.key === result.category
                );
                if (!catOption) return null;
                const CatIcon = catOption.icon;

                return (
                  <div
                    key={result.category}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-light)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {/* Category header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2"
                      style={{
                        background: "var(--accent-sage-muted)",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <CatIcon size={14} />
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {catOption.label}
                      </span>
                      <span
                        className="tabular ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--accent-sage-muted)",
                          color: "var(--accent-sage)",
                          border: "1px solid var(--accent-sage-light)",
                        }}
                      >
                        {result.records.length} record
                        {result.records.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Records preview */}
                    <div
                      className="px-3 py-2"
                      style={{ maxHeight: 200, overflowY: "auto" }}
                    >
                      {result.records.slice(0, 10).map((rec, idx) => (
                        <div
                          key={idx}
                          className="py-1.5"
                          style={{
                            borderBottom:
                              idx < Math.min(result.records.length, 10) - 1
                                ? "1px solid var(--border-light)"
                                : "none",
                          }}
                        >
                          {/* Show key fields based on category */}
                          {result.category === "labs" && (
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="text-xs font-medium truncate"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {rec.parsed.test_name || rec.parsed.category || "Unknown test"}
                              </span>
                              <span
                                className="text-xs shrink-0"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {rec.parsed.value}
                                {rec.parsed.unit ? ` ${rec.parsed.unit}` : ""}
                              </span>
                            </div>
                          )}
                          {result.category === "appointments" && (
                            <div>
                              <span
                                className="text-xs font-medium"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {rec.parsed.doctor_name || "Provider"}{" "}
                                {rec.parsed.specialty
                                  ? `- ${rec.parsed.specialty}`
                                  : ""}
                              </span>
                              <span
                                className="text-xs block"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {rec.parsed.date || ""}{" "}
                                {rec.parsed.reason
                                  ? `- ${rec.parsed.reason}`
                                  : ""}
                              </span>
                            </div>
                          )}
                          {result.category === "medications" && (
                            <div>
                              <span
                                className="text-xs font-medium"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {rec.parsed.name || "Unknown medication"}
                              </span>
                              <span
                                className="text-xs block"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {rec.parsed.dose || ""}{" "}
                                {rec.parsed.frequency
                                  ? `- ${rec.parsed.frequency}`
                                  : ""}
                              </span>
                            </div>
                          )}
                          {result.category === "notes" && (() => {
                            const raw = String(
                              rec.parsed.content || rec.parsed.title || ""
                            );
                            return (
                              <p
                                className="text-xs"
                                style={{
                                  color: "var(--text-secondary)",
                                  lineHeight: 1.4,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {raw}
                              </p>
                            );
                          })()}
                        </div>
                      ))}
                      {result.records.length > 10 && (
                        <p
                          className="tabular text-xs py-1 text-center"
                          style={{ color: "var(--text-muted)" }}
                        >
                          plus {result.records.length - 10} more
                        </p>
                      )}
                    </div>

                    {/* Warnings */}
                    {result.warnings.length > 0 && (
                      <div
                        className="px-3 py-2"
                        style={{
                          background: "var(--bg-elevated)",
                          borderTop: "1px solid var(--border-light)",
                        }}
                      >
                        {result.warnings.map((w, i) => (
                          <p
                            key={i}
                            className="text-xs flex items-start gap-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <AlertCircle size={10} className="shrink-0 mt-0.5" />
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Import error */}
          {importError && (
            <div
              className="flex items-start gap-2 mt-3 p-2 rounded-lg"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-light)",
              }}
            >
              <AlertCircle
                size={14}
                className="shrink-0 mt-0.5"
                style={{ color: "var(--accent-blush, #D4A0A0)" }}
                aria-hidden
              />
              <span
                className="text-xs"
                style={{ color: "var(--text-primary)" }}
              >
                {importError}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setStep("input")}
              className="press-feedback flex items-center justify-center gap-1.5 text-sm font-medium px-4 rounded-xl"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                minHeight: 48,
                border: "1px solid var(--border-light)",
                transition: "background 150ms var(--ease-standard)",
              }}
            >
              <ArrowLeft size={14} aria-hidden />
              Back
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={
                importing ||
                parseResults.every((r) => r.records.length === 0)
              }
              className="press-feedback relative flex-1 inline-flex items-center justify-center gap-2 text-sm font-medium px-4 rounded-xl overflow-hidden"
              style={{
                background: "var(--accent-sage)",
                color: "var(--text-inverse)",
                minHeight: 48,
                opacity:
                  importing ||
                  parseResults.every((r) => r.records.length === 0)
                    ? 0.6
                    : 1,
                cursor:
                  importing ||
                  parseResults.every((r) => r.records.length === 0)
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {importing && (
                <span
                  className="shimmer-bar"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                  }}
                  aria-hidden
                />
              )}
              <span className="relative inline-flex items-center gap-2">
                {!importing && <Check size={16} aria-hidden />}
                {importing ? (
                  <>
                    <span>Saving</span>
                    <span className="tabular">
                      {parseResults.reduce((s, r) => s + r.records.length, 0)}
                    </span>
                    <span>records</span>
                  </>
                ) : (
                  <>
                    <span>Import</span>
                    <span className="tabular">
                      {parseResults.reduce((s, r) => s + r.records.length, 0)}
                    </span>
                    <span>records</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && (
        <div>
          <div
            className="flex flex-col items-center text-center py-6 px-4 rounded-xl mb-4"
            style={{
              background: "var(--accent-sage-muted)",
              border: "1px solid var(--border-light)",
            }}
          >
            <div
              className="flex items-center justify-center rounded-full mb-3"
              style={{
                width: 48,
                height: 48,
                background: "var(--accent-sage)",
              }}
            >
              <CheckCircle2
                size={24}
                style={{ color: "var(--text-inverse)" }}
                aria-hidden
              />
            </div>
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Import complete
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="tabular">{totalImported}</span> record
              {totalImported !== 1 ? "s" : ""} saved to your records
            </p>
          </div>

          {/* Breakdown */}
          <div className="space-y-2 mb-4">
            {importResults.map((result) => {
              const catOption = CATEGORIES.find(
                (c) => c.key === result.category
              );
              if (!catOption) return null;
              const CatIcon = catOption.icon;

              return (
                <div
                  key={result.category}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-light)",
                  }}
                >
                  <span
                    style={{ color: "var(--text-muted)" }}
                    aria-hidden
                  >
                    <CatIcon size={16} />
                  </span>
                  <span
                    className="text-sm flex-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {catOption.label}
                  </span>
                  <span
                    className="tabular text-sm font-medium"
                    style={{ color: "var(--accent-sage)" }}
                  >
                    {result.imported} imported
                  </span>
                  {result.skipped > 0 && (
                    <span
                      className="tabular text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ({result.skipped} skipped)
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Link
              href="/records"
              className="press-feedback w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 rounded-xl"
              style={{
                background: "var(--accent-sage)",
                color: "var(--text-inverse)",
                minHeight: 48,
                textDecoration: "none",
                transition: "background 150ms var(--ease-standard)",
              }}
            >
              View your records
              <ArrowRight size={16} aria-hidden />
            </Link>
            <button
              type="button"
              onClick={startOver}
              className="press-feedback w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 rounded-xl"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                minHeight: 48,
                border: "1px solid var(--border-light)",
                transition: "background 150ms var(--ease-standard)",
              }}
            >
              <RotateCcw size={14} aria-hidden />
              Import more data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
