"use client";

import { useState } from "react";
import { Plus, X, Check, Loader2 } from "lucide-react";
import type {
  TimelineEventType,
  EventSignificance,
  MedicalTimelineEvent,
} from "@/lib/types";

const EVENT_TYPES: { value: TimelineEventType; label: string }[] = [
  { value: "diagnosis", label: "Diagnosis" },
  { value: "symptom_onset", label: "Symptom Onset" },
  { value: "test", label: "Test" },
  { value: "medication_change", label: "Medication Change" },
  { value: "appointment", label: "Appointment" },
  { value: "imaging", label: "Imaging" },
  { value: "hospitalization", label: "Hospitalization" },
];

const SIGNIFICANCE_OPTIONS: { value: EventSignificance; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
  { value: "critical", label: "Critical" },
];

interface AddEventFormProps {
  onEventAdded: (event: MedicalTimelineEvent) => void;
}

export function AddEventForm({ onEventAdded }: AddEventFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [eventDate, setEventDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [eventType, setEventType] = useState<TimelineEventType>("appointment");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [significance, setSignificance] =
    useState<EventSignificance>("normal");

  function resetForm() {
    setEventDate(new Date().toISOString().slice(0, 10));
    setEventType("appointment");
    setTitle("");
    setDescription("");
    setSignificance("normal");
    setError(null);
  }

  function handleCancel() {
    resetForm();
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!eventDate) {
      setError("Date is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_date: eventDate,
          event_type: eventType,
          title: title.trim(),
          description: description.trim() || undefined,
          significance,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create event");
      }

      onEventAdded(data.event);
      resetForm();
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 w-full justify-center rounded-xl px-4 py-3 text-sm font-medium transition-colors"
        style={{
          background: "var(--accent-sage)",
          color: "var(--text-inverse)",
          minHeight: 44,
        }}
      >
        <Plus size={16} />
        Add Event
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          New Timeline Event
        </h3>
        <button
          type="button"
          onClick={handleCancel}
          className="touch-target rounded-lg p-1"
          style={{ color: "var(--text-muted)" }}
          aria-label="Cancel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Date */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          Date *
        </label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          required
          className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
          style={{
            background: "var(--bg-input)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            minHeight: 44,
          }}
        />
      </div>

      {/* Event Type */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          Event Type
        </label>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as TimelineEventType)}
          className="w-full text-sm px-3 py-2 rounded-lg border outline-none appearance-none"
          style={{
            background: "var(--bg-input)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            minHeight: 44,
          }}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Blood work results, MRI scan..."
          required
          className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
          style={{
            background: "var(--bg-input)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            minHeight: 44,
          }}
        />
      </div>

      {/* Description */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details, notes, findings..."
          rows={3}
          className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-y"
          style={{
            background: "var(--bg-input)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Significance */}
      <div>
        <label
          className="block text-xs font-medium mb-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          Significance
        </label>
        <div className="flex gap-2">
          {SIGNIFICANCE_OPTIONS.map((opt) => {
            const isActive = significance === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSignificance(opt.value)}
                className="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  background: isActive
                    ? opt.value === "critical"
                      ? "rgba(239, 68, 68, 0.12)"
                      : opt.value === "important"
                        ? "rgba(217, 169, 78, 0.14)"
                        : "var(--accent-sage-muted)"
                    : "var(--bg-elevated)",
                  color: isActive
                    ? opt.value === "critical"
                      ? "#EF4444"
                      : opt.value === "important"
                        ? "#D9A94E"
                        : "var(--accent-sage)"
                    : "var(--text-muted)",
                  border: isActive
                    ? `1px solid ${
                        opt.value === "critical"
                          ? "rgba(239, 68, 68, 0.3)"
                          : opt.value === "important"
                            ? "rgba(217, 169, 78, 0.3)"
                            : "var(--accent-sage-muted)"
                      }`
                    : "1px solid transparent",
                  minHeight: 40,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs" style={{ color: "#EF4444" }}>
          {error}
        </p>
      )}

      {/* Submit / Cancel */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            minHeight: 44,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? "Saving..." : "Save Event"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="flex items-center gap-1.5 text-sm font-medium px-4 rounded-lg touch-target"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            minHeight: 44,
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
