"use client";

import { useState, useRef } from "react";
import { Plus, X, Pencil, Check, XCircle } from "lucide-react";

interface EditableListProps {
  items: string[];
  onSave: (items: string[]) => void | Promise<void>;
  placeholder?: string;
  emptyLabel?: string;
}

export function EditableList({
  items,
  onSave,
  placeholder = "Add item...",
  emptyLabel = "None documented",
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
    // Focus the input after render
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
            className="text-sm italic"
            style={{ color: "var(--text-muted)" }}
          >
            {emptyLabel}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li
                key={i}
                className="text-sm flex items-start gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "var(--accent-sage)" }}
                />
                {item}
              </li>
            ))}
          </ul>
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
              className="touch-target shrink-0"
              style={{ color: "var(--text-muted)" }}
              aria-label={`Remove ${item}`}
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
          }}
        />
        <button
          onClick={addItem}
          disabled={!newItem.trim()}
          className="touch-target shrink-0 rounded-lg"
          style={{
            background: newItem.trim()
              ? "var(--accent-sage)"
              : "var(--bg-elevated)",
            color: newItem.trim()
              ? "var(--text-inverse)"
              : "var(--text-muted)",
            minHeight: 44,
            minWidth: 44,
          }}
          aria-label="Add item"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Save / Cancel buttons */}
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
