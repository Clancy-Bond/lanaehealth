"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  User,
  Stethoscope,
  HelpCircle,
  Pill,
  Leaf,
  AlertTriangle,
  Users,
  FileText,
  Pencil,
  Check,
  XCircle,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import { EditableList } from "./EditableList";
import { ProfileStyles } from "./ProfileStyles";

// ── Types for health_profile JSONB shapes ────────────────────────────

interface PersonalInfo {
  full_name: string;
  age: number;
  sex: string;
  blood_type: string;
  height_cm: number;
  weight_kg: number;
  location: string;
}

interface MedicationItem {
  name: string;
  dose?: string;
  frequency?: string;
  status?: string;
}

interface MedicationContent {
  as_needed?: MedicationItem[];
  daily?: MedicationItem[];
  [key: string]: MedicationItem[] | undefined;
}

interface NarrativeRow {
  id: string;
  section_title: string;
  content: string;
  section_order: number;
  updated_at: string;
}

// ── Props ────────────────────────────────────────────────────────────

interface ProfileClientProps {
  profileSections: Record<string, unknown>;
  narrativeRows: NarrativeRow[];
}

// ── Helper: save a health_profile section via server API ─────────────

async function saveSection(section: string, content: unknown) {
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, content }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to save profile section");
  }
}

// ── Section card wrapper (optionally collapsible) ────────────────────

function SectionCard({
  icon: Icon,
  title,
  collapsible = false,
  defaultOpen = true,
  id,
  children,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  id?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = collapsible ? open : true;

  const header = (
    <>
      <div
        className="flex items-center justify-center rounded-lg"
        style={{
          width: 32,
          height: 32,
          background: "var(--accent-sage-muted)",
          flexShrink: 0,
        }}
      >
        <Icon size={16} />
      </div>
      <h2
        className="text-base font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h2>
      {collapsible && (
        <ChevronDown className="profile-section-caret" size={18} />
      )}
    </>
  );

  return (
    <div
      id={id}
      className="card"
      style={{
        background: "var(--bg-card)",
        borderRadius: "1rem",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
        padding: "var(--space-4)",
        scrollMarginTop: "80px",
      }}
    >
      {collapsible ? (
        <button
          type="button"
          className="profile-section-header press-feedback"
          data-expanded={expanded ? "true" : "false"}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={expanded}
        >
          {header}
        </button>
      ) : (
        <div className="flex items-center gap-2">{header}</div>
      )}

      {expanded && (
        <div style={{ marginTop: "var(--space-3)" }}>{children}</div>
      )}
    </div>
  );
}

// ── Personal Info Editor ─────────────────────────────────────────────

function PersonalInfoEditor({ data }: { data: PersonalInfo }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PersonalInfo>(data);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft({ ...data });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft({ ...data });
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSection("personal", draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof PersonalInfo, value: string | number) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  // Numeric fields that should render with tabular-nums
  const numericFields = new Set<keyof PersonalInfo>([
    "age",
    "height_cm",
    "weight_kg",
  ]);

  const fields: Array<{
    key: keyof PersonalInfo;
    label: string;
    type: "text" | "number";
  }> = [
    { key: "full_name", label: "Full Name", type: "text" },
    { key: "age", label: "Age", type: "number" },
    { key: "sex", label: "Sex", type: "text" },
    { key: "blood_type", label: "Blood Type", type: "text" },
    { key: "height_cm", label: "Height (cm)", type: "number" },
    { key: "weight_kg", label: "Weight (kg)", type: "number" },
    { key: "location", label: "Location", type: "text" },
  ];

  if (!editing) {
    return (
      <div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <p
                className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {label}
              </p>
              <p
                className={`text-sm ${numericFields.has(key) ? "tabular" : ""}`}
                style={{ color: "var(--text-primary)" }}
              >
                {String(data[key] ?? "-")}
              </p>
            </div>
          ))}
        </div>
        <button
          onClick={startEdit}
          className="profile-edit-btn press-feedback"
          type="button"
        >
          <Pencil size={14} />
          Edit
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {fields.map(({ key, label, type }) => (
          <div key={key}>
            <label
              className="text-xs font-medium block mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              {label}
            </label>
            <input
              type={type}
              value={String(draft[key] ?? "")}
              onChange={(e) =>
                updateField(
                  key,
                  type === "number"
                    ? parseFloat(e.target.value) || 0
                    : e.target.value
                )
              }
              className={`w-full text-sm px-3 py-2 rounded-lg border outline-none ${
                type === "number" ? "tabular" : ""
              }`}
              style={{
                background: "var(--bg-input)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
                minHeight: 44,
                transition:
                  "border-color var(--duration-fast) var(--ease-standard)",
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="profile-save-btn press-feedback"
          type="button"
          data-loading={saving ? "true" : "false"}
        >
          <Check size={14} />
          {saving ? "Saving" : "Save"}
        </button>
        <button
          onClick={cancelEdit}
          className="profile-cancel-btn press-feedback"
          type="button"
        >
          <XCircle size={14} />
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Medications Editor ───────────────────────────────────────────────

function MedicationsEditor({ data }: { data: MedicationContent }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MedicationItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");
  const [newFreq, setNewFreq] = useState("");

  // Flatten all medication arrays into one list
  const allMeds: MedicationItem[] = Object.values(data)
    .flat()
    .filter((m): m is MedicationItem => !!m && typeof m === "object" && "name" in m);

  function startEdit() {
    setDraft([...allMeds]);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setNewName("");
    setNewDose("");
    setNewFreq("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSection("medications", { as_needed: draft });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function addMed() {
    if (!newName.trim()) return;
    setDraft((prev) => [
      ...prev,
      {
        name: newName.trim(),
        dose: newDose.trim() || undefined,
        frequency: newFreq.trim() || undefined,
      },
    ]);
    setNewName("");
    setNewDose("");
    setNewFreq("");
  }

  function removeMed(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  if (!editing) {
    return (
      <div>
        {allMeds.length === 0 ? (
          <p
            className="text-sm"
            style={{ color: "var(--text-muted)", lineHeight: 1.5 }}
          >
            No medications on file. Add one to share with your doctor.
          </p>
        ) : (
          <div className="space-y-2">
            {allMeds.map((med, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm"
                style={{ color: "var(--text-primary)", lineHeight: 1.5 }}
              >
                <span
                  className="mt-[7px] h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "var(--border)" }}
                />
                <div>
                  <span className="font-medium">{med.name}</span>
                  {med.dose && (
                    <span
                      className="text-xs tabular"
                      style={{
                        color: "var(--text-secondary)",
                        display: "block",
                        marginTop: 1,
                      }}
                    >
                      {med.dose}
                      {med.frequency ? ` · ${med.frequency}` : ""}
                    </span>
                  )}
                  {!med.dose && med.frequency && (
                    <span
                      className="text-xs"
                      style={{
                        color: "var(--text-secondary)",
                        display: "block",
                        marginTop: 1,
                      }}
                    >
                      {med.frequency}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={startEdit}
          className="profile-edit-btn press-feedback"
          type="button"
        >
          <Pencil size={14} />
          Edit
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {draft.map((med, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="flex-1 text-sm px-3 py-2 rounded-lg"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            >
              <span className="font-medium">{med.name}</span>
              {(med.dose || med.frequency) && (
                <span
                  className="text-xs tabular"
                  style={{
                    color: "var(--text-secondary)",
                    display: "block",
                    marginTop: 1,
                  }}
                >
                  {med.dose ?? ""}
                  {med.dose && med.frequency ? " · " : ""}
                  {med.frequency ?? ""}
                </span>
              )}
            </div>
            <button
              onClick={() => removeMed(i)}
              className="profile-remove-btn press-feedback"
              aria-label={`Remove ${med.name}`}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new medication */}
      <div className="mt-3 space-y-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Medication name"
          className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
          style={{
            background: "var(--bg-input)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            minHeight: 44,
          }}
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={newDose}
            onChange={(e) => setNewDose(e.target.value)}
            placeholder="Dose (e.g. 200mg)"
            className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none tabular"
            style={{
              background: "var(--bg-input)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              minHeight: 44,
            }}
          />
          <input
            type="text"
            value={newFreq}
            onChange={(e) => setNewFreq(e.target.value)}
            placeholder="Frequency"
            className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none"
            style={{
              background: "var(--bg-input)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              minHeight: 44,
            }}
          />
        </div>
        <button
          onClick={addMed}
          disabled={!newName.trim()}
          className="profile-add-btn press-feedback"
          data-active={newName.trim() ? "true" : "false"}
          style={{ width: "auto", padding: "0 16px" }}
          type="button"
        >
          <Plus size={16} />
          <span style={{ marginLeft: 6, fontSize: 14, fontWeight: 500 }}>
            Add Medication
          </span>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="profile-save-btn press-feedback"
          type="button"
          data-loading={saving ? "true" : "false"}
        >
          <Check size={14} />
          {saving ? "Saving" : "Save"}
        </button>
        <button
          onClick={cancelEdit}
          className="profile-cancel-btn press-feedback"
          type="button"
        >
          <XCircle size={14} />
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Medical Story Editor ─────────────────────────────────────────────

function MedicalStoryEditor({ rows }: { rows: NarrativeRow[] }) {
  const firstRow = rows[0];
  const [text, setText] = useState(firstRow?.content ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNarrative = useCallback(
    async (content: string) => {
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/narrative", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section_title: "My Story",
            content,
            section_order: 0,
          }),
        });
        if (!res.ok) {
          throw new Error("Save failed");
        }
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    },
    []
  );

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNarrative(val);
    }, 1500);
  }

  function handleBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveNarrative(text);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div>
      <p
        className="text-xs mb-2"
        style={{ color: "var(--text-muted)", lineHeight: 1.5 }}
      >
        Write what does not fit into the structured fields.
      </p>
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Write in your own words."
        rows={8}
        className="profile-story-textarea"
      />
      {saveStatus !== "idle" && (
        <p
          className="mt-1 text-xs flex items-center gap-1"
          style={{
            color:
              saveStatus === "saving"
                ? "var(--text-muted)"
                : "var(--accent-sage)",
          }}
        >
          {saveStatus === "saving" ? (
            "Saving"
          ) : (
            <>
              <Check size={12} />
              Saved
            </>
          )}
        </p>
      )}
    </div>
  );
}

// ── Completion chip (small, quiet, above first section) ──────────────

function CompletionChip({
  filled,
  total,
  nextMissing,
}: {
  filled: number;
  total: number;
  nextMissing?: { label: string; id: string } | null;
}) {
  if (nextMissing) {
    return (
      <a
        href={`#${nextMissing.id}`}
        className="profile-completion-chip tabular press-feedback"
        aria-label={`${filled} of ${total} sections filled. Next: add ${nextMissing.label}.`}
        style={{ textDecoration: "none", cursor: "pointer" }}
      >
        <Check size={12} />
        {filled} of {total} filled
        <span style={{ opacity: 0.7 }}>
          {" · Add "}
          {nextMissing.label}
          {" \u2192"}
        </span>
      </a>
    );
  }
  return (
    <div
      className="profile-completion-chip tabular"
      aria-label={`All ${total} sections filled`}
    >
      <Check size={12} />
      {filled} of {total} filled
    </div>
  );
}

// ── Main ProfileClient ───────────────────────────────────────────────

export function ProfileClient({
  profileSections,
  narrativeRows,
}: ProfileClientProps) {
  // Extract typed data from profile sections
  const personal = (profileSections.personal ?? {
    full_name: "",
    age: 0,
    sex: "",
    blood_type: "",
    height_cm: 0,
    weight_kg: 0,
    location: "",
  }) as PersonalInfo;

  const diagnoses = (profileSections.confirmed_diagnoses ?? []) as string[];
  const suspected = (profileSections.suspected_conditions ?? []) as string[];
  const medications = (profileSections.medications ?? {}) as MedicationContent;
  const supplements = (profileSections.supplements ?? []) as string[];
  const allergies = (profileSections.allergies ?? []) as string[];
  const familyHistory = (profileSections.family_history ?? []) as string[];

  // List section save helpers
  async function saveDiagnoses(items: string[]) {
    await saveSection("confirmed_diagnoses", items);
  }
  async function saveSuspected(items: string[]) {
    await saveSection("suspected_conditions", items);
  }
  async function saveSupplements(items: string[]) {
    await saveSection("supplements", items);
  }
  async function saveAllergies(items: string[]) {
    await saveSection("allergies", items);
  }
  async function saveFamilyHistory(items: string[]) {
    await saveSection("family_history", items);
  }

  // Completion counter: 8 sections total. Personal info counts if full_name.
  const medsCount = Object.values(medications)
    .flat()
    .filter((m) => !!m && typeof m === "object" && "name" in (m as object))
    .length;
  const narrativeFilled = (narrativeRows[0]?.content ?? "").trim().length > 0;
  const PROFILE_SECTIONS: Array<{ id: string; label: string; filled: boolean }> = [
    { id: "section-personal", label: "personal info", filled: !!personal.full_name },
    { id: "section-diagnoses", label: "confirmed diagnoses", filled: diagnoses.length > 0 },
    { id: "section-suspected", label: "suspected conditions", filled: suspected.length > 0 },
    { id: "section-medications", label: "medications", filled: medsCount > 0 },
    { id: "section-supplements", label: "supplements", filled: (Array.isArray(supplements) ? supplements.length : 0) > 0 },
    { id: "section-allergies", label: "allergies", filled: allergies.length > 0 },
    { id: "section-family", label: "family history", filled: familyHistory.length > 0 },
    { id: "section-narrative", label: "medical story", filled: narrativeFilled },
  ];
  const sectionsFilled = PROFILE_SECTIONS.filter((s) => s.filled).length;
  const nextMissing = PROFILE_SECTIONS.find((s) => !s.filled) ?? null;

  // Group 1: primary doctor-visit content (left column on desktop)
  const primaryColumn = (
    <div className="space-y-4">
      <SectionCard icon={User} title="Personal Info" id="section-personal">
        <PersonalInfoEditor data={personal} />
      </SectionCard>

      <SectionCard icon={Stethoscope} title="Confirmed Diagnoses" id="section-diagnoses">
        <EditableList
          items={diagnoses}
          onSave={saveDiagnoses}
          placeholder="Add diagnosis"
          emptyLabel="No diagnoses here yet. Add confirmed ones so your doctor sees them first."
        />
      </SectionCard>

      <SectionCard icon={HelpCircle} title="Suspected Conditions" id="section-suspected">
        <EditableList
          items={suspected}
          onSave={saveSuspected}
          placeholder="Add condition"
          emptyLabel="Nothing suspected yet. Add a hunch or a doctor's comment here."
        />
      </SectionCard>

      <SectionCard icon={Pill} title="Medications" id="section-medications">
        <MedicationsEditor data={medications} />
      </SectionCard>

      <SectionCard icon={Leaf} title="Supplements" id="section-supplements">
        <EditableList
          items={
            Array.isArray(supplements)
              ? supplements.map((s) =>
                  typeof s === "string" ? s : (s as { name: string }).name
                )
              : []
          }
          onSave={saveSupplements}
          placeholder="Add supplement"
          emptyLabel="No supplements on file. Add the ones you take regularly."
        />
      </SectionCard>

      <SectionCard icon={AlertTriangle} title="Allergies" id="section-allergies">
        <EditableList
          items={allergies}
          onSave={saveAllergies}
          placeholder="Add allergy"
          emptyLabel="No known allergies recorded. Tap Edit to add any."
        />
      </SectionCard>

      <SectionCard
        icon={Users}
        title="Family History"
        collapsible
        defaultOpen={false}
        id="section-family"
      >
        <EditableList
          items={familyHistory}
          onSave={saveFamilyHistory}
          placeholder="Add family history item"
          emptyLabel="No family history yet. Add relatives' conditions you think matter."
        />
      </SectionCard>
    </div>
  );

  // Group 2: the reading/story column (right column on desktop, collapsed on mobile)
  const storyColumn = (
    <div className="space-y-4">
      <SectionCard
        icon={FileText}
        title="My Medical Story"
        collapsible
        defaultOpen={false}
        id="section-narrative"
      >
        <MedicalStoryEditor rows={narrativeRows} />
      </SectionCard>
    </div>
  );

  return (
    <>
      <ProfileStyles />

      {/* Mobile / tablet stack: narrow reading column */}
      <div
        className="lg:hidden"
        style={{ maxWidth: 640, margin: "0 auto" }}
      >
        <CompletionChip filled={sectionsFilled} total={8} nextMissing={nextMissing} />
        <div className="space-y-4">
          {primaryColumn}
          {storyColumn}
        </div>
      </div>

      {/* Desktop 1024+ : split layout, story pinned on the right */}
      <div className="hidden lg:block">
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <CompletionChip filled={sectionsFilled} total={8} nextMissing={nextMissing} />
        </div>
        <div className="route-desktop-split">
          <div>{primaryColumn}</div>
          <div
            style={{
              position: "sticky",
              top: "var(--space-6)",
              alignSelf: "start",
            }}
          >
            <DesktopMedicalStory rows={narrativeRows} />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Desktop variant of Medical Story (always expanded, prominent) ────

function DesktopMedicalStory({ rows }: { rows: NarrativeRow[] }) {
  return (
    <div
      className="card"
      style={{
        background: "var(--bg-card)",
        borderRadius: "1rem",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
        padding: "var(--space-4)",
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: "var(--space-3)" }}>
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 32,
            height: 32,
            background: "var(--accent-sage-muted)",
            flexShrink: 0,
          }}
        >
          <FileText size={16} />
        </div>
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          My Medical Story
        </h2>
      </div>
      <MedicalStoryEditor rows={rows} />
    </div>
  );
}
