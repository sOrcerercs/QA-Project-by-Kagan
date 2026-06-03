"use client";

import { useState } from "react";

interface Agent {
  id: string;
  name: string;
}

interface ConsultantMultiSelectProps {
  agents: Agent[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  lang?: "tr" | "en";
}

export default function ConsultantMultiSelect({ agents, selectedIds, onChange, lang = "tr" }: ConsultantMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const allSelected = agents.length > 0 && selectedIds.length === agents.length;
  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const toggleAll = () => onChange(allSelected ? [] : agents.map((a) => a.id));

  const label =
    selectedIds.length === 0
      ? lang === "tr" ? "Tüm Danışmanlar" : "All Consultants"
      : lang === "tr" ? `${selectedIds.length} danışman seçili` : `${selectedIds.length} selected`;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ padding: "8px 12px", borderRadius: 10, background: "var(--glass-bg)", border: "1px solid var(--rule)", color: "var(--fg)", fontSize: 13, fontFamily: "inherit", outline: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 41,
              minWidth: 240, maxHeight: 300, overflowY: "auto",
              background: "var(--glass-bg)", backdropFilter: "blur(12px)",
              border: "1px solid var(--rule)", borderRadius: 12, padding: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,.3)",
            }}
          >
            <button
              onClick={toggleAll}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", borderRadius: 8, border: "none", background: "transparent", color: "var(--accent)", fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer" }}
            >
              {allSelected ? (lang === "tr" ? "Temizle" : "Clear") : (lang === "tr" ? "Tümünü Seç" : "Select All")}
            </button>
            <div style={{ height: 1, background: "var(--rule)", margin: "4px 0" }} />
            {agents.map((a) => (
              <label
                key={a.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--fg)" }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(a.id)}
                  onChange={() => toggle(a.id)}
                  style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }}
                />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
