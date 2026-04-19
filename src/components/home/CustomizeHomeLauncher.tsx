"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import {
  CustomizeHomeSheet,
  type RegisteredWidgetMeta,
} from "./CustomizeHomeSheet";

interface CustomizeHomeLauncherProps {
  registeredWidgets: readonly RegisteredWidgetMeta[];
}

export function CustomizeHomeLauncher({
  registeredWidgets,
}: CustomizeHomeLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Customize home"
        title="Customize home"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 600,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          color: "var(--text-secondary)",
          cursor: "pointer",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Settings2 size={13} strokeWidth={2.25} />
        <span>Customize</span>
      </button>
      <CustomizeHomeSheet
        open={open}
        onClose={() => setOpen(false)}
        registeredWidgets={registeredWidgets}
      />
    </>
  );
}
