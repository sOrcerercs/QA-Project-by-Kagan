"use client";

import { useEffect, useState } from "react";

interface ActivePrompt {
  id: string;
  name: string;
  callType: string;
  content: string;
  version: string;
  updatedAt: string;
}

interface PromptsViewProps {
  lang: "tr" | "en";
}

const CALL_TYPE_LABELS: Record<string, Record<"tr" | "en", string>> = {
  FIRST_CALL:  { tr: "1. Çağrı",  en: "1st Call" },
  SECOND_CALL: { tr: "2. Çağrı",  en: "2nd Call" },
  FOLLOW_UP:   { tr: "Takip",     en: "Follow-up" },
  GENERAL:     { tr: "Genel",     en: "General" },
};

export default function PromptsView({ lang }: PromptsViewProps) {
  const tr = lang === "tr";
  const [prompts, setPrompts] = useState<ActivePrompt[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const res = await fetch(`/api/prompts/active?lang=${lang}`);
        if (!res.ok) throw new Error("fetch_failed");
        const data = await res.json();
        if (!cancelled) {
          setPrompts(data.prompts || []);
          setStatus("done");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  if (status === "loading") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <div style={{
          width: 20, height: 20,
          border: "2px solid rgba(255,255,255,.15)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <p style={{ fontSize: 13, color: "#f87171" }}>
        {tr ? "Promptlar yüklenemedi. Lütfen tekrar deneyin." : "Failed to load prompts. Please try again."}
      </p>
    );
  }

  if (prompts.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>
        {tr ? "Şu an aktif bir değerlendirme promptu bulunmuyor." : "There are no active evaluation prompts."}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "var(--fg-dim)", margin: 0 }}>
        {tr
          ? "Çağrılarınız aşağıdaki güncel değerlendirme kriterlerine göre puanlanır."
          : "Your calls are scored according to the current evaluation criteria below."}
      </p>
      {!tr && (
        <p style={{ fontSize: 11, color: "var(--fg-faint)", margin: 0, fontStyle: "italic" }}>
          AI-translated from Turkish. The original Turkish text is used for scoring.
        </p>
      )}

      {prompts.map(p => {
        const open = expandedId === p.id;
        const typeLabel = CALL_TYPE_LABELS[p.callType]?.[lang] ?? p.callType.replace("_", " ");
        return (
          <div
            key={p.id}
            style={{
              border: "1px solid var(--rule)",
              borderRadius: 12,
              background: "var(--glass-bg)",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setExpandedId(open ? null : p.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                width: "100%", textAlign: "left", cursor: "pointer",
                padding: "14px 16px", border: "none", background: "transparent",
                color: "var(--fg)", fontFamily: "inherit",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                    border: "1px solid var(--accent)", color: "var(--accent)",
                    background: "rgba(59,130,246,.10)", whiteSpace: "nowrap",
                  }}>
                    {typeLabel}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--fg-faint)", marginTop: 4 }}>
                  v{p.version}
                </span>
              </span>
              <span style={{ fontSize: 12, color: "var(--accent)", whiteSpace: "nowrap", fontWeight: 500 }}>
                {open
                  ? (tr ? "Gizle" : "Hide")
                  : (tr ? "Kriterleri Gör" : "View Criteria")}
              </span>
            </button>

            {open && (
              <pre style={{
                margin: 0,
                padding: "0 16px 16px",
                fontSize: 12,
                lineHeight: 1.6,
                color: "var(--fg-dim)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}>
                {p.content}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
