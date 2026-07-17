"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Occurrence {
  evaluationId: string;
  customerName: string;
  callDate: string;
  score: number;
  criterionScore: number;
}

const LABELS = {
  tr: {
    loading: "Yükleniyor…",
    error: "Liste yüklenemedi.",
    empty: "Bu kriterin geçtiği değerlendirme yok.",
    detail: "Detay",
    critScore: "kriter",
  },
  en: {
    loading: "Loading…",
    error: "Could not load list.",
    empty: "No evaluations flagged for this criterion.",
    detail: "Detail",
    critScore: "criterion",
  },
} as const;

const critColor = (s: number) => (s >= 70 ? "#4ade80" : s >= 55 ? "#facc15" : "#f87171");

export default function CriterionEvaluations({
  agentId,
  criterionId,
  startDate,
  endDate,
  lang = "tr",
}: {
  agentId: string;
  criterionId: string;
  startDate?: string;
  endDate?: string;
  lang?: "tr" | "en";
}) {
  const [items, setItems] = useState<Occurrence[] | null>(null);
  const [error, setError] = useState(false);
  const t = LABELS[lang];

  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    setError(false);
    const params = new URLSearchParams({ agentId, criterionId });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    fetch(`/api/scores/criterion-evaluations?${params}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => setItems(d.occurrences ?? []))
      .catch((err) => { if (err.name !== "AbortError") setError(true); });
    return () => controller.abort();
  }, [agentId, criterionId, startDate, endDate]);

  if (error) return <p style={{ fontSize: 11, color: "#f87171", padding: "8px 0" }}>{t.error}</p>;
  if (items === null) return <p style={{ fontSize: 11, color: "#475569", padding: "8px 0" }}>{t.loading}</p>;
  if (items.length === 0) return <p style={{ fontSize: 11, color: "#475569", padding: "8px 0" }}>{t.empty}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
      {items.map((o) => (
        <div
          key={o.evaluationId}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,.03)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap" }}>
              {new Date(o.callDate).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US")}
            </span>
            <span style={{ fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {o.customerName}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: critColor(o.criterionScore) }}>
              %{o.criterionScore} <span style={{ fontSize: 9, fontWeight: 400, color: "#475569" }}>{t.critScore}</span>
            </span>
            <Link href={`/evaluation/${o.evaluationId}`} style={{ fontSize: 11, color: "#818cf8" }}>
              {t.detail}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
