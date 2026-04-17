/**
 * Profile-scoped style block.
 *
 * Centralizes the interactive-state styling for all Edit / Save / Cancel /
 * Add / Remove buttons across the /profile route. Rendered once inside
 * ProfileClient so every profile component can use the shared utility class
 * names without editing globals.css.
 *
 * Contract: all 6 interactive states per button (resting, hover, active/press,
 * focus, loading, disabled) per design-decisions.md §10.
 */

const PROFILE_CSS = `
/* ── Ghost Edit button (demoted so sage Save can shine) ────────── */
.profile-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--space-3);
  padding: 8px 14px;
  min-height: 36px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
.profile-edit-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.profile-edit-btn:focus-visible {
  outline: 2px solid var(--accent-sage);
  outline-offset: 2px;
}
.profile-edit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* ── Primary Save button (single sage per edited section) ──────── */
.profile-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 18px;
  min-height: 44px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-inverse);
  background: var(--accent-sage);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition:
    background var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
.profile-save-btn:hover {
  background: #5D8071;
}
.profile-save-btn:focus-visible {
  outline: 2px solid var(--accent-sage);
  outline-offset: 2px;
}
.profile-save-btn[data-loading="true"] {
  opacity: 0.75;
  pointer-events: none;
}
.profile-save-btn[data-loading="true"]::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.6),
    transparent
  );
  animation: profile-shimmer 1.5s var(--ease-standard) infinite;
}
.profile-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Neutral Cancel button ─────────────────────────────────────── */
.profile-cancel-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 18px;
  min-height: 44px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}
.profile-cancel-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}
.profile-cancel-btn:focus-visible {
  outline: 2px solid var(--accent-sage);
  outline-offset: 2px;
}

/* ── Row-level Add button (plus icon square) ───────────────────── */
.profile-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  min-height: 44px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  background: var(--bg-elevated);
  color: var(--text-muted);
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}
.profile-add-btn[data-active="true"] {
  background: var(--accent-sage);
  color: var(--text-inverse);
}
.profile-add-btn[data-active="true"]:hover {
  background: #5D8071;
}
.profile-add-btn:focus-visible {
  outline: 2px solid var(--accent-sage);
  outline-offset: 2px;
}
.profile-add-btn:disabled {
  cursor: not-allowed;
}

/* ── Destructive remove (X) button, blush on hover ─────────────── */
.profile-remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}
.profile-remove-btn:hover {
  background: var(--accent-blush-muted);
  color: var(--accent-blush);
}
.profile-remove-btn:focus-visible {
  outline: 2px solid var(--accent-sage);
  outline-offset: 2px;
}

/* ── Tappable collapsible section header ───────────────────────── */
.profile-section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition:
    opacity var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
.profile-section-header:hover {
  opacity: 0.88;
}
.profile-section-header:focus-visible {
  outline: 2px solid var(--accent-sage);
  outline-offset: 4px;
  border-radius: 6px;
}
.profile-section-caret {
  margin-left: auto;
  color: var(--text-muted);
  transition: transform var(--duration-base) var(--ease-standard);
}
.profile-section-header[data-expanded="true"] .profile-section-caret {
  transform: rotate(180deg);
}

/* ── Medical story textarea (warm focus state) ─────────────────── */
.profile-story-textarea {
  width: 100%;
  font-size: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  outline: none;
  background: #FFFBF5;
  border: 1px solid var(--border);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 200px;
  resize: vertical;
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}
.profile-story-textarea:focus-visible {
  border-color: var(--accent-sage);
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-sage-muted);
}

/* ── Completion chip ───────────────────────────────────────────── */
.profile-completion-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border-radius: 999px;
  margin-bottom: var(--space-4);
}
.profile-completion-chip svg {
  color: var(--accent-sage);
}

/* ── Shared shimmer keyframe for save button loading edge ──────── */
@keyframes profile-shimmer {
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
}
`;

export function ProfileStyles() {
  return <style>{PROFILE_CSS}</style>;
}
