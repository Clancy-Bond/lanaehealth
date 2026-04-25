'use client'

/**
 * NRSSlider
 *
 * 0-10 Numeric Rating Scale slider with a color-graded large readout
 * and a verbal severity label. This is the canonical pain primitive.
 *
 * Validation: Hjermstad MJ et al. (2011). "Studies comparing Numerical
 * Rating Scales, Verbal Rating Scales, and Visual Analogue Scales for
 * assessment of pain intensity in adults: a systematic literature
 * review." J Pain Symptom Manage 41(6):1073-1093. The 11-point NRS
 * shows the strongest reliability/responsiveness of the simple scales
 * and is recommended for routine clinical use.
 *
 * Cutpoints (Serlin RC et al. 1995, Pain 61:277-284): 1-3 mild,
 * 4-6 moderate, 7-10 severe. We add a "Settled / Moderate / Flare"
 * verbal label that maps to those cutpoints.
 */
import { painSeverityColor, painSeverityLabel } from '../../_components/SliderSheet'

export interface NRSSliderProps {
  value: number
  onChange: (value: number) => void
}

export default function NRSSlider({ value, onChange }: NRSSliderProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
        <span
          style={{
            fontSize: 'var(--v2-text-3xl)',
            fontWeight: 'var(--v2-weight-bold)',
            color: painSeverityColor(value),
            letterSpacing: 'var(--v2-tracking-tight)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
          {painSeverityLabel(value)}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Pain rating, 0 to 10"
        className="v2-pain-nrs-slider"
        style={{
          width: '100%',
          accentColor: painSeverityColor(value),
          minHeight: 'var(--v2-touch-target-min)',
        }}
      />
      <style>{`
        .v2-pain-nrs-slider { -webkit-appearance: none; appearance: none; background: transparent; }
        .v2-pain-nrs-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 9999px;
          background: var(--v2-border);
        }
        .v2-pain-nrs-slider::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
          background: var(--v2-border);
        }
        .v2-pain-nrs-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          margin-top: -11px;
          border-radius: 9999px;
          background: var(--v2-text-primary);
          border: 2px solid var(--v2-bg-elevated);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          cursor: pointer;
        }
        .v2-pain-nrs-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          background: var(--v2-text-primary);
          border: 2px solid var(--v2-bg-elevated);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          cursor: pointer;
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        <span>None</span>
        <span>Worst imaginable</span>
      </div>
    </div>
  )
}
