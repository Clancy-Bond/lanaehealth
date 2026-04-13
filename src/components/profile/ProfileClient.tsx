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
} from "lucide-react";
import { EditableList } from "./EditableList";
import { supabase } from "@/lib/supabase";

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

// ── Helper: save a health_profile section ────────────────────────────

async function saveSection(section: string, content: unknown) {
  const { error } = await supabase.from("health_profile").upsert(
    {
      section,
      content: JSON.stringify(content),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "section" }
  );
  if (error) throw error;
}

// ── Section card wrapper ─────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card p-4"
      style={{
        background: "var(--bg-card)",
        borderRadius: "1rem",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 32,
            height: 32,
            background: "var(--accent-sage-muted)",
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
      </div>
      {children}
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
                className="text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                {String(data[key] ?? "-")}
              </p>
            </div>
          ))}
        </div>
        <button
          onClick={startEdit}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium touch-target"
          style={{ color: "var(--accent-sage)", minHeight: 44 }}
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
              className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
              style={{
                background: "var(--bg-input)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
                minHeight: 44,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            minHeight: 44,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Check size={14} />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={cancelEdit}
          className="flex items-center gap-1.5 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            minHeight: 44,
          }}
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
            className="text-sm italic"
            style={{ color: "var(--text-muted)" }}
          >
            None documented
          </p>
        ) : (
          <div className="space-y-2">
            {allMeds.map((med, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "var(--accent-sage)" }}
                />
                <div>
                  <span className="font-medium">{med.name}</span>
                  {med.dose && (
                    <span style={{ color: "var(--text-secondary)" }}>
                      {" "}
                      - {med.dose}
                    </span>
                  )}
                  {med.frequency && (
                    <span style={{ color: "var(--text-muted)" }}>
                      {" "}
                      ({med.frequency})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={startEdit}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium touch-target"
          style={{ color: "var(--accent-sage)", minHeight: 44 }}
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
              {med.dose && (
                <span style={{ color: "var(--text-secondary)" }}>
                  {" "}
                  - {med.dose}
                </span>
              )}
              {med.frequency && (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}
                  ({med.frequency})
                </span>
              )}
            </div>
            <button
              onClick={() => removeMed(i)}
              className="touch-target shrink-0"
              style={{ color: "var(--text-muted)" }}
              aria-label={`Remove ${med.name}`}
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
            className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none"
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
          className="flex items-center gap-1.5 text-sm font-medium px-3 rounded-lg touch-target"
          style={{
            background: newName.trim()
              ? "var(--accent-sage-muted)"
              : "var(--bg-elevated)",
            color: newName.trim()
              ? "var(--accent-sage)"
              : "var(--text-muted)",
            minHeight: 44,
          }}
        >
          <Plus size={14} />
          Add Medication
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            minHeight: 44,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Check size={14} />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={cancelEdit}
          className="flex items-center gap-1.5 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            minHeight: 44,
          }}
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
        if (firstRow) {
          await supabase
            .from("medical_narrative")
            .update({
              content,
              updated_at: new Date().toISOString(),
            })
            .eq("id", firstRow.id);
        } else {
          await supabase.from("medical_narrative").insert({
            section_title: "My Medical Story",
            content,
            section_order: 0,
            updated_at: new Date().toISOString(),
          });
        }
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
      }
    },
    [firstRow]
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
        This is your medical story in your own words. Share context that does
        not fit into structured fields.
      </p>
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Write your medical story here..."
        rows={6}
        className="w-full text-sm px-3 py-3 rounded-lg border outline-none resize-y"
        style={{
          background: "var(--bg-input)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
          lineHeight: 1.6,
          minHeight: 120,
        }}
      />
      {saveStatus !== "idle" && (
        <p
          className="mt-1 text-xs"
          style={{
            color:
              saveStatus === "saving"
                ? "var(--text-muted)"
                : "var(--accent-sage)",
          }}
        >
          {saveStatus === "saving" ? "Saving..." : "Saved"}
        </p>
      )}
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

  return (
    <div className="space-y-4">
      {/* Personal Info */}
      <SectionCard icon={User} title="Personal Info">
        <PersonalInfoEditor data={personal} />
      </SectionCard>

      {/* Confirmed Diagnoses */}
      <SectionCard icon={Stethoscope} title="Confirmed Diagnoses">
        <EditableList
          items={diagnoses}
          onSave={saveDiagnoses}
          placeholder="Add diagnosis..."
          emptyLabel="No diagnoses documented"
        />
      </SectionCard>

      {/* Suspected Conditions */}
      <SectionCard icon={HelpCircle} title="Suspected Conditions">
        <EditableList
          items={suspected}
          onSave={saveSuspected}
          placeholder="Add condition..."
          emptyLabel="No suspected conditions"
        />
      </SectionCard>

      {/* Medications */}
      <SectionCard icon={Pill} title="Medications">
        <MedicationsEditor data={medications} />
      </SectionCard>

      {/* Supplements */}
      <SectionCard icon={Leaf} title="Supplements">
        <EditableList
          items={
            Array.isArray(supplements)
              ? supplements.map((s) =>
                  typeof s === "string" ? s : (s as { name: string }).name
                )
              : []
          }
          onSave={saveSupplements}
          placeholder="Add supplement..."
          emptyLabel="No supplements documented"
        />
      </SectionCard>

      {/* Allergies */}
      <SectionCard icon={AlertTriangle} title="Allergies">
        <EditableList
          items={allergies}
          onSave={saveAllergies}
          placeholder="Add allergy..."
          emptyLabel="None documented"
        />
      </SectionCard>

      {/* Family History */}
      <SectionCard icon={Users} title="Family History">
        <EditableList
          items={familyHistory}
          onSave={saveFamilyHistory}
          placeholder="Add family history item..."
          emptyLabel="No family history documented"
        />
      </SectionCard>

      {/* Medical Story */}
      <SectionCard icon={FileText} title="Medical Story">
        <MedicalStoryEditor rows={narrativeRows} />
      </SectionCard>
    </div>
  );
}
