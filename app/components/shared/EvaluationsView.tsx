"use client";

import { useState, useEffect } from "react";
import EvaluationList from "@/app/components/shared/EvaluationList";

type Preset = "all" | "week" | "month" | "3m" | "custom";

interface Evaluation {
  id: string;
  score: number;
  customerName: string;
  callDuration: string;
  createdAt: string;
  agent?: { name: string };
}

interface EvaluationsViewProps {
  showAgent?: boolean;
  lang?: "tr" | "en";
}

function presetToDates(preset: Preset): { startDate: string; endDate: string } | null {
  if (preset === "all" || preset === "custom") return null;
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now);
  if (preset === "week") start.setDate(start.getDate() - 7);
  else if (preset === "month") start.setMonth(start.getMonth() - 1);
  else if (preset === "3m") start.setMonth(start.getMonth() - 3);
  return { startDate: start.toISOString().split("T")[0], endDate: end };
}

const PRESETS_TR: { key: Preset; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
  { key: "3m", label: "Son 3 Ay" },
  { key: "custom", label: "Özel" },
];

const PRESETS_EN: { key: Preset; label: string }[] = [
  { key: "all", label: "All" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "3m", label: "Last 3 Months" },
  { key: "custom", label: "Custom" },
];

export default function EvaluationsView({ showAgent = true, lang = "tr" }: EvaluationsViewProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchEvaluations = async (startDate?: string, endDate?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const qs = params.toString();
    const res = await fetch(`/api/evaluations${qs ? `?${qs}` : ""}`);
    if (res.ok) setEvaluations((await res.json()).evaluations || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvaluations(); }, []);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p === "custom") return;
    const dates = presetToDates(p);
    fetchEvaluations(dates?.startDate, dates?.endDate);
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd || customStart > customEnd) return;
    fetchEvaluations(customStart, customEnd);
  };

  const presets = lang === "tr" ? PRESETS_TR : PRESETS_EN;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Preset pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {presets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: preset === key ? "1px solid var(--accent)" : "1px solid var(--rule)",
              background: preset === key ? "rgba(var(--accent-rgb, 59,130,246),.15)" : "transparent",
              color: preset === key ? "var(--accent)" : "var(--fg-dim)",
              fontSize: 11.5,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.06em",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s, background 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date inputs — visible only when "custom" preset is active */}
      {preset === "custom" && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {lang === "tr" ? "Başlangıç" : "Start"}
            </label>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--rule)",
                borderRadius: 8,
                padding: "6px 12px",
                color: "var(--fg)",
                fontSize: 12,
                outline: "none",
                colorScheme: "dark",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {lang === "tr" ? "Bitiş" : "End"}
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--rule)",
                borderRadius: 8,
                padding: "6px 12px",
                color: "var(--fg)",
                fontSize: 12,
                outline: "none",
                colorScheme: "dark",
              }}
            />
          </div>
          <button
            onClick={handleApplyCustom}
            disabled={!customStart || !customEnd || customStart > customEnd}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              border: "1px solid var(--accent)",
              background: "rgba(var(--accent-rgb, 59,130,246),.15)",
              color: "var(--accent)",
              fontSize: 11.5,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
              opacity: (!customStart || !customEnd || customStart > customEnd) ? 0.4 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {lang === "tr" ? "Uygula" : "Apply"}
          </button>
        </div>
      )}

      {/* List or spinner */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{
            width: 20, height: 20,
            border: "2px solid rgba(255,255,255,.1)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
        </div>
      ) : (
        <EvaluationList evaluations={evaluations} showAgent={showAgent} lang={lang} />
      )}
    </div>
  );
}
