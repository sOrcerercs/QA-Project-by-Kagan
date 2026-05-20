"use client";

import { useState, useEffect, useCallback } from "react";

interface CoachingData {
  summary: string;
  actionItems: string[];
  generatedAt: string;
  evalCount: number;
}

const L = {
  tr: {
    title: "Gelişim Özeti",
    focus: "Bu hafta odaklan:",
    basis: (n: number, date: string) => `${n} değerlendirme baz alındı · ${date}`,
    refresh: "Yenile",
    error: "Özet oluşturulamadı.",
    retry: "Tekrar dene",
    generating: "Özet hazırlanıyor…",
    noData: "Yeterli değerlendirme verisi yok.",
  },
  en: {
    title: "Development Summary",
    focus: "Focus this week:",
    basis: (n: number, date: string) => `Based on ${n} evaluations · ${date}`,
    refresh: "Refresh",
    error: "Could not generate summary.",
    retry: "Try again",
    generating: "Generating summary…",
    noData: "Not enough evaluation data.",
  },
};

export default function AgentCoachingSummary({
  agentId,
  lang,
  canRefresh,
}: {
  agentId: string;
  lang: "tr" | "en";
  canRefresh: boolean;
}) {
  const t = L[lang];
  const [data, setData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/scores/coaching-summary?agentId=${encodeURIComponent(agentId)}&lang=${lang}`)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) return Promise.reject(res.status);
        return res.json();
      })
      .then((d: CoachingData | null) => setData(d))
      .catch(() => setError(t.error))
      .finally(() => setLoading(false));
  }, [agentId, lang, t.error]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/scores/coaching-summary/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      load();
    } catch {
      setError(t.error);
    } finally {
      setRefreshing(false);
    }
  };

  const card: React.CSSProperties = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: 16,
    padding: "20px 24px",
    marginTop: 20,
  };

  if (loading) {
    return (
      <div style={card}>
        <div style={{ height: 14, background: "var(--glass-border)", borderRadius: 4, width: "40%", marginBottom: 14 }} />
        <div style={{ height: 11, background: "var(--glass-border)", borderRadius: 4, width: "90%", marginBottom: 7 }} />
        <div style={{ height: 11, background: "var(--glass-border)", borderRadius: 4, width: "80%", marginBottom: 7 }} />
        <div style={{ height: 11, background: "var(--glass-border)", borderRadius: 4, width: "65%", marginBottom: 18 }} />
        <div style={{ height: 9, background: "var(--glass-border)", borderRadius: 4, width: "50%", marginBottom: 7 }} />
        <div style={{ height: 9, background: "var(--glass-border)", borderRadius: 4, width: "45%", marginBottom: 7 }} />
        <div style={{ height: 9, background: "var(--glass-border)", borderRadius: 4, width: "55%", marginBottom: 14 }} />
        <p style={{ fontSize: 11, color: "var(--fg-faint)" }}>{t.generating}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <p style={{ fontSize: 13, color: "#f87171", marginBottom: 10 }}>{error}</p>
        <button
          onClick={load}
          style={{
            fontSize: 12, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.3)",
            color: "var(--accent)",
          }}
        >
          {t.retry}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={card}>
        <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>{t.noData}</p>
      </div>
    );
  }

  const dateStr = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString(
        lang === "tr" ? "tr-TR" : "en-GB",
        { day: "2-digit", month: "short", year: "numeric" }
      )
    : "";

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)", margin: 0 }}>{t.title}</h3>
        {canRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 7,
              cursor: refreshing ? "default" : "pointer",
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--fg-faint)", opacity: refreshing ? 0.5 : 1,
            }}
          >
            {refreshing ? "…" : t.refresh}
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.65, margin: "0 0 16px" }}>
        {data.summary}
      </p>

      {data.actionItems && data.actionItems.length > 0 && (
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, color: "var(--fg-faint)",
            textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px",
          }}>
            {t.focus}
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            {data.actionItems.map((item, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.5 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 14 }}>
        {t.basis(data.evalCount, dateStr)}
      </p>
    </div>
  );
}
