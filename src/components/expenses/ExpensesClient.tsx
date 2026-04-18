"use client";

// Expenses page client component.
// Handles: list view, add form, mark claimed, delete, download FSA receipt.
// Kept intentionally minimal. More polish (edit modal, receipt upload,
// vendor autocomplete) can follow.

import { useState, useEffect, useMemo } from "react";
import type {
  MedicalExpense,
  MedicalExpenseCategory,
} from "@/lib/types";

interface Props {
  initialExpenses: MedicalExpense[];
  defaultPlanYear: number;
}

const CATEGORIES: Array<{ value: MedicalExpenseCategory; label: string }> = [
  { value: "office_visit", label: "Office / Telehealth Visit" },
  { value: "prescription", label: "Prescription" },
  { value: "lab_imaging", label: "Lab / Imaging" },
  { value: "device", label: "Medical Device" },
  { value: "subscription", label: "Health Tracking Subscription" },
  { value: "supplement", label: "Supplement" },
  { value: "therapy", label: "Therapy / Rehab" },
  { value: "dental_vision", label: "Dental / Vision" },
  { value: "travel_medical", label: "Medical Travel" },
  { value: "other", label: "Other" },
];

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function ExpensesClient({
  initialExpenses,
  defaultPlanYear,
}: Props) {
  const [expenses, setExpenses] = useState<MedicalExpense[]>(initialExpenses);
  const [planYear, setPlanYear] = useState<number>(defaultPlanYear);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    service_date: new Date().toISOString().slice(0, 10),
    provider_or_vendor: "",
    description: "",
    amount_usd: "",
    category: "office_visit" as MedicalExpenseCategory,
    notes: "",
  });

  // Filter to selected plan year
  const filtered = useMemo(
    () => expenses.filter((e) => e.plan_year === planYear),
    [expenses, planYear],
  );

  const total = filtered.reduce((s, e) => s + e.amount_cents, 0);
  const unclaimed = filtered
    .filter((e) => !e.claimed)
    .reduce((s, e) => s + e.amount_cents, 0);

  async function refresh() {
    const res = await fetch(`/api/expenses?year=${planYear}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses((prev) => {
        // Merge: keep rows from other years, replace current year
        const otherYears = prev.filter((e) => e.plan_year !== planYear);
        return [...otherYears, ...(data.expenses as MedicalExpense[])];
      });
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planYear]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const amountCents = Math.round(Number(form.amount_usd) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      setError("Amount must be a non-negative number");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_date: form.service_date,
          provider_or_vendor: form.provider_or_vendor,
          description: form.description,
          amount_cents: amountCents,
          category: form.category,
          notes: form.notes || null,
          plan_year: Number(form.service_date.slice(0, 4)),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save");
      }
      setForm({
        service_date: new Date().toISOString().slice(0, 10),
        provider_or_vendor: "",
        description: "",
        amount_usd: "",
        category: "office_visit",
        notes: "",
      });
      setIsAdding(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleClaimed(expense: MedicalExpense) {
    await fetch(`/api/expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimed: !expense.claimed }),
    });
    await refresh();
  }

  async function remove(expense: MedicalExpense) {
    if (!confirm("Delete this expense? This can't be undone.")) return;
    await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
    await refresh();
  }

  const yearOptions = Array.from(
    new Set([
      defaultPlanYear,
      defaultPlanYear - 1,
      defaultPlanYear + 1,
      ...expenses.map((e) => e.plan_year).filter((y): y is number => y !== null),
    ]),
  ).sort((a, b) => b - a);

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Header */}
      <div>
        <h1 className="page-title">Medical expenses</h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            margin: "4px 0 0",
          }}
        >
          Track copays, prescriptions, and subscriptions. Generate an
          itemized FSA or HSA receipt anytime.
        </p>
      </div>

      {/* Plan-year selector + totals */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Plan year{" "}
          <select
            value={planYear}
            onChange={(e) => setPlanYear(Number(e.target.value))}
            style={{
              marginLeft: 6,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          <span>
            Total:{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {dollars(total)}
            </strong>
          </span>
          <span>
            Unclaimed:{" "}
            <strong style={{ color: "#D4A0A0" }}>{dollars(unclaimed)}</strong>
          </span>
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => setIsAdding((v) => !v)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--accent-sage)",
            background: isAdding ? "var(--bg-card)" : "var(--accent-sage)",
            color: isAdding ? "var(--accent-sage)" : "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isAdding ? "Cancel" : "+ Add expense"}
        </button>
        <a
          href={`/api/expenses/receipt?year=${planYear}`}
          download
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #D4A0A0",
            background: "#fff",
            color: "#B57676",
            fontSize: 13,
            fontWeight: 600,
            cursor: filtered.length === 0 ? "not-allowed" : "pointer",
            opacity: filtered.length === 0 ? 0.4 : 1,
            pointerEvents: filtered.length === 0 ? "none" : "auto",
            textDecoration: "none",
          }}
        >
          Download FSA receipt
        </a>
      </div>

      {/* Add form */}
      {isAdding && (
        <form
          onSubmit={handleSave}
          className="card"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Service date
              <input
                type="date"
                required
                value={form.service_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, service_date: e.target.value }))
                }
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Amount (USD)
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.amount_usd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount_usd: e.target.value }))
                }
                style={inputStyle}
                placeholder="0.00"
              />
            </label>
          </div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Provider or vendor
            <input
              type="text"
              required
              value={form.provider_or_vendor}
              onChange={(e) =>
                setForm((f) => ({ ...f, provider_or_vendor: e.target.value }))
              }
              style={inputStyle}
              placeholder="Dr. Kim, CVS, Oura Ring Inc."
            />
          </label>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Description
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              style={inputStyle}
              placeholder="Telehealth visit, Metformin 500mg, annual membership"
            />
          </label>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Category
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as MedicalExpenseCategory,
                }))
              }
              style={inputStyle}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Notes (optional)
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
          {error && (
            <p style={{ color: "#D4A0A0", fontSize: 12, margin: 0 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: saving ? "var(--text-muted)" : "var(--accent-sage)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save expense"}
          </button>
        </form>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          No expenses logged for {planYear}. Add your first one above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((e) => (
            <div
              key={e.id}
              className="card"
              style={{ padding: 14, display: "flex", gap: 12 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {e.provider_or_vendor}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {e.service_date}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginTop: 2,
                  }}
                >
                  {e.description}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {e.category.replace("_", " ")}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {dollars(e.amount_cents)}
                </span>
                <button
                  onClick={() => toggleClaimed(e)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 12,
                    border: `1px solid ${e.claimed ? "#6B9080" : "#D4A0A0"}`,
                    background: e.claimed
                      ? "rgba(107,144,128,0.14)"
                      : "rgba(212,160,160,0.14)",
                    color: e.claimed ? "#6B9080" : "#B57676",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {e.claimed ? "Claimed" : "Unclaimed"}
                </button>
                <button
                  onClick={() => remove(e)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
};
