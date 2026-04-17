"use client";

/**
 * PresetPicker
 *
 * Multi-select chooser for diet presets. Lets the user toggle one or more
 * clinical presets (Endo, POTS) on their profile. The component is pure
 * UI: it holds local state, calls back to its parent with the selected
 * keys, and previews the composed effective targets inline so the user
 * sees what will change before they save.
 *
 * This component is intentionally standalone and is NOT mounted in
 * `src/app/settings/page.tsx` by this subagent. Wave 2b brief C3
 * requested deferred mounting to avoid contention with other subagents
 * that may also touch settings. Mount it once the competing branches
 * have landed on main.
 *
 * Warm Modern tokens: cream card background, sage accents, blush highlight
 * on selected chips, no em dashes in copy.
 */

import { useMemo, useState } from "react";
import {
  ENDO_ANTI_INFLAMMATORY_PRESET,
  POTS_PRESET,
  type DietPreset,
} from "@/lib/nutrition/diet-presets";
import { composePresets } from "@/lib/nutrition/preset-composer";

const AVAILABLE_PRESETS: DietPreset[] = [
  ENDO_ANTI_INFLAMMATORY_PRESET,
  POTS_PRESET,
];

export interface PresetPickerProps {
  /** Preset keys currently applied to the patient. */
  initialSelected?: string[];
  /**
   * Fired whenever the selection set changes. Parent is responsible for
   * persisting the choice (via `upsertPresetRows` on save), not this UI.
   */
  onSelectionChange?: (selectedKeys: string[]) => void;
  /**
   * Optional override of the preset list. Exposed for tests. Production
   * callers should omit this and rely on the default registry.
   */
  availablePresets?: DietPreset[];
}

export function PresetPicker({
  initialSelected,
  onSelectionChange,
  availablePresets,
}: PresetPickerProps) {
  const registry = availablePresets ?? AVAILABLE_PRESETS;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected ?? []),
  );

  const activePresets = useMemo(
    () => registry.filter((p) => selected.has(p.key)),
    [registry, selected],
  );

  const composed = useMemo(
    () => composePresets(activePresets),
    [activePresets],
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }

  return (
    <div
      data-testid="preset-picker"
      style={{
        backgroundColor: "var(--bg-card, #FFFFFF)",
        border: "1px solid var(--border, #E5E5DC)",
        borderRadius: 12,
        padding: 20,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 600,
          color: "var(--text-primary, #1A1A2E)",
        }}
      >
        Condition presets
      </h2>
      <p
        style={{
          marginTop: 4,
          marginBottom: 16,
          fontSize: 14,
          color: "var(--text-secondary, #6B7280)",
        }}
      >
        Apply one or more condition specific targets. Multiple presets
        compose, with intake targets taking the higher value when they
        overlap.
      </p>

      <div
        role="group"
        aria-label="Available presets"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {registry.map((preset) => {
          const isActive = selected.has(preset.key);
          return (
            <button
              key={preset.key}
              type="button"
              data-testid={`preset-chip-${preset.key}`}
              data-selected={isActive ? "true" : "false"}
              onClick={() => toggle(preset.key)}
              aria-pressed={isActive}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: isActive
                  ? "1px solid var(--accent-sage, #6B9080)"
                  : "1px solid var(--border, #E5E5DC)",
                backgroundColor: isActive
                  ? "var(--accent-sage-muted, rgba(107, 144, 128, 0.12))"
                  : "var(--bg-input, #F7F7F4)",
                color: "var(--text-primary, #1A1A2E)",
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {preset.displayName}
            </button>
          );
        })}
      </div>

      {activePresets.length > 0 ? (
        <div style={{ marginTop: 20 }}>
          <h3
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary, #1A1A2E)",
            }}
          >
            Composed targets
          </h3>
          <ul
            data-testid="preset-picker-composed"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {composed.map((target) => (
              <li
                key={target.nutrient}
                data-testid={`composed-${target.nutrient}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 12px",
                  borderRadius: 8,
                  backgroundColor: "var(--bg-elevated, #F5F5F0)",
                  fontSize: 14,
                }}
              >
                <span style={{ color: "var(--text-primary, #1A1A2E)" }}>
                  {target.displayName}
                </span>
                <span
                  style={{
                    color: "var(--text-secondary, #6B7280)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {target.amount} {target.unit}
                  <span
                    style={{
                      marginLeft: 8,
                      color: "var(--accent-sage, #6B9080)",
                      fontWeight: 500,
                    }}
                  >
                    {target.sourcePresetName}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p
          data-testid="preset-picker-empty"
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "var(--text-muted, #8B8F96)",
            fontStyle: "italic",
          }}
        >
          Select a preset above to preview composed targets.
        </p>
      )}
    </div>
  );
}

export default PresetPicker;
