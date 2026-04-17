"use client";

import { useState, useRef } from "react";
import { Plus, X, Pencil, Check, XCircle } from "lucide-react";

interface EditableListProps {
  items: string[];
  onSave: (items: string[]) => void | Promise<void>;
  placeholder?: string;
  emptyLabel?: string;
}

// Split an item like "Iron deficiency without anemia (ferritin as low as 10 ng/mL)"
// into { primary, secondary } so the parenthetical reads as supporting detail.
// Also handles " - " subordinate clauses like "Endometriosis - suspected: painful..."
function splitItem(item: string): { primary: string; secondary: string | null } {
  const parenIndex = item.indexOf(" (");
  if (parenIndex > 0) {
    return {
      primary: item.slice(0, parenIndex),
      secondary: item.slice(parenIndex + 1),
    };
  }
  const dashIndex = item.indexOf(" - ");
  if (dashIndex > 0) {
    return {
      primary: item.slice(0, dashIndex),
      secondary: item.slice(dashIndex + 3),
    };
  }
  return { primary: item, secondary: null };
}

export function EditableList({
  items,
  onSave,
  placeholder = "Add item",
  emptyLabel = "Nothing here yet. Add the first one.",
}: EditableListProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(items);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft([...items]);
    setNewItem("");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft([...items]);
    setNewItem("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function addItem() {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setDraft((prev) => [...prev, trimmed]);
    setNewItem("");
    inputRef.current?.focus();
  }

  function removeItem(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  }

  // Read-only view
  if (!editing) {
    return (
      <div>
        {items.length === 0 ? (
          <p
            className="text-sm"
            style={{ color: "var(--text-muted)", lineHeight: 1.5 }}
          >
            {emptyLabel}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item, i) => {
              const { primary, secondary } = splitItem(item);
              return (
                <li
                  key={i}
                  className="text-sm flex items-start gap-2"
                  style={{ color: "var(--text-primary)", lineHeight: 1.5 }}
                >
                  <span
                    className="mt-[7px] h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: "var(--border)" }}
                  />
                  <span>
                    <span>{primary}</span>
                    {secondary && (
                      <span
                        className="text-xs"
                        style={{
                          color: "var(--text-secondary)",
                          display: "block",
                          marginTop: 1,
                          lineHeight: 1.45,
                        }}
                      >
                        {secondary}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
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

  // Edit view
  return (
    <div>
      <ul className="space-y-2">
        {draft.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="flex-1 text-sm px-3 py-2 rounded-lg"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            >
              {item}
            </span>
            <button
              onClick={() => removeItem(i)}
              className="profile-remove-btn press-feedback"
              aria-label={`Remove ${item}`}
              type="button"
            >
              <X size={18} />
            </button>
          </li>
        ))}
      </ul>

      {/* Add new item */}
      <div className="mt-2 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none"
          style={{
            background: "var(--bg-input)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            minHeight: 44,
            transition:
              "border-color var(--duration-fast) var(--ease-standard)",
          }}
        />
        <button
          onClick={addItem}
          disabled={!newItem.trim()}
          className="profile-add-btn press-feedback"
          aria-label="Add item"
          type="button"
          data-active={newItem.trim() ? "true" : "false"}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Save / Cancel buttons */}
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
