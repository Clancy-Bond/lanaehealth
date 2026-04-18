"use client";

/**
 * Client-side flow for meal photo identification.
 *
 * 1. User picks a file (camera on mobile via `capture="environment"`).
 * 2. We base64-encode and POST to /api/food/identify.
 * 3. Show detected items; each has a "Add to [meal]" button that POSTs
 *    to /api/food/log with the USDA fdcId the server resolved.
 */

import { useCallback, useState } from "react";

interface Detected {
  name: string;
  estimatedCalories: number;
  estimatedGrams: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  fdcId?: number | null;
  nutrients?: {
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
  };
}

interface IdentifyResponse {
  foods: Detected[];
  mealDescription?: string;
  error?: string;
}

const MEALS: Array<"breakfast" | "lunch" | "dinner" | "snack"> = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Unexpected FileReader result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read error"));
    reader.readAsDataURL(file);
  });
}

export default function PhotoClient() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [detected, setDetected] = useState<Detected[] | null>(null);
  const [mealDescription, setMealDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = useCallback(async (file: File) => {
    setError(null);
    setDetected(null);
    setMealDescription(null);
    setLoading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      setImageDataUrl(dataUrl);
      const mediaType = file.type || "image/jpeg";
      const res = await fetch("/api/food/identify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl, mediaType }),
      });
      const body = (await res.json()) as IdentifyResponse;
      if (!res.ok || body.error) {
        setError(body.error ?? `Identify failed (${res.status})`);
        setLoading(false);
        return;
      }
      setDetected(body.foods ?? []);
      setMealDescription(body.mealDescription ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Identify failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Upload */}
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px dashed var(--border-light)",
          textAlign: "center",
        }}
      >
        <input
          id="photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
          style={{ display: "none" }}
        />
        <label
          htmlFor="photo-input"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 20px",
            borderRadius: 10,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            fontSize: 14,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            cursor: "pointer",
          }}
        >
          <span aria-hidden>{"\u{1F4F7}"}</span>
          {loading ? "Identifying..." : imageDataUrl ? "Upload another" : "Choose a meal photo"}
        </label>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
          Works on desktop or mobile. Mobile opens the camera by default.
        </div>
      </div>

      {imageDataUrl && (
        <div style={{ textAlign: "center" }}>
          <img
            src={imageDataUrl}
            alt="Uploaded meal"
            style={{
              maxWidth: "100%",
              maxHeight: 320,
              borderRadius: 10,
              boxShadow: "var(--shadow-sm)",
            }}
          />
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--accent-blush-muted)",
            border: "1px solid var(--accent-blush)",
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          {error}
        </div>
      )}

      {mealDescription && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "0 4px" }}>
          <strong>Description:</strong> {mealDescription}
        </div>
      )}

      {detected && detected.length === 0 && !loading && (
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>No foods detected</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Try a different angle, better lighting, or plate isolation.
          </p>
        </div>
      )}

      {detected && detected.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Detected foods
          </div>
          {detected.map((d, i) => (
            <DetectedRow key={`${d.name}-${i}`} item={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DetectedRow({ item }: { item: Detected }) {
  const [meal, setMeal] = useState(item.mealType);
  const [servings, setServings] = useState(1);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const onAdd = async () => {
    if (!item.fdcId) {
      setStatus("error");
      setErrMsg("No USDA match found. Use search to add manually.");
      return;
    }
    setStatus("saving");
    setErrMsg(null);
    try {
      const res = await fetch("/api/food/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fdcId: item.fdcId,
          meal_type: meal,
          servings,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus("error");
        setErrMsg(body.error ?? `Log failed (${res.status})`);
        return;
      }
      setStatus("saved");
    } catch (e) {
      setStatus("error");
      setErrMsg(e instanceof Error ? e.message : "Log failed.");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          ~{item.estimatedGrams}g &middot; {item.estimatedCalories} cal
          {item.fdcId ? ` \u00B7 USDA ${item.fdcId}` : " \u00B7 no USDA match"}
        </div>
      </div>
      <select
        value={meal}
        onChange={(e) => setMeal(e.target.value as Detected["mealType"])}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-light)",
          fontSize: 12,
        }}
      >
        {MEALS.map((m) => (
          <option key={m} value={m}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </option>
        ))}
      </select>
      <input
        type="number"
        min="0.25"
        max="20"
        step="0.25"
        value={servings}
        onChange={(e) => setServings(Math.max(0.25, Math.min(20, Number(e.target.value))))}
        style={{
          width: 60,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-light)",
          fontSize: 12,
        }}
      />
      <button
        onClick={onAdd}
        disabled={status === "saving" || status === "saved"}
        style={{
          padding: "6px 14px",
          borderRadius: 8,
          background:
            status === "saved" ? "var(--accent-sage-muted)" : "var(--accent-sage)",
          color: status === "saved" ? "var(--text-primary)" : "var(--text-inverse)",
          fontSize: 11,
          fontWeight: 700,
          border: "none",
          cursor: status === "saving" || status === "saved" ? "default" : "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {status === "saved"
          ? "Added"
          : status === "saving"
            ? "Saving..."
            : "Add"}
      </button>
      {status === "error" && errMsg && (
        <div style={{ flex: "1 1 100%", fontSize: 11, color: "var(--accent-blush)" }}>
          {errMsg}
        </div>
      )}
    </div>
  );
}
