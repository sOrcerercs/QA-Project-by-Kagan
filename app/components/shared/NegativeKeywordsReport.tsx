"use client";

import React, { useState, useEffect } from "react";
import DateRangePicker from "@/app/components/shared/DateRangePicker";

interface Keyword {
  id: string;
  word: string;
  createdAt: string;
}

interface Match {
  evaluationId: string;
  agentName: string;
  callDate: string;
  snippet: string;
}

interface KeywordResult {
  keywordId: string;
  word: string;
  callCount: number;
  totalHits: number;
  agentNames: string[];
  matches: Match[];
}

interface ReportData {
  results: KeywordResult[];
  totalEvaluationsScanned: number;
  dateRange: { start: string | null; end: string | null };
}

const L = {
  tr: {
    title: "Negatif Kelime Raporu",
    subtitle: "Çağrı transkriptlerinde negatif kelime kullanımını izle",
    kwSection: "Keyword Yönetimi",
    kwEmpty: "Henüz keyword eklenmedi.",
    kwPlaceholder: "Yeni keyword...",
    kwAdd: "Ekle",
    kwDuplicate: "Bu kelime zaten mevcut.",
    kwError: "Eklenemedi.",
    filterSection: "Tarih Aralığı",
    runReport: "Raporu Çalıştır",
    running: "Taranıyor...",
    noKeywords: "Rapor çalıştırmak için en az bir keyword ekleyin.",
    resultsSection: "Sonuçlar",
    scanned: (n: number) => `${n} çağrı tarandı`,
    colKeyword: "Keyword",
    colCalls: "Çağrı",
    colHits: "Geçiş",
    colAgents: "Danışmanlar",
    noResults: "Hiçbir keyword eşleşmedi.",
    agent: "Danışman",
    date: "Tarih",
    snippet: "Alıntı",
    goToEval: "Değerlendirmeye git →",
  },
  en: {
    title: "Negative Keyword Report",
    subtitle: "Track negative keyword usage across call transcripts",
    kwSection: "Keyword Management",
    kwEmpty: "No keywords added yet.",
    kwPlaceholder: "New keyword...",
    kwAdd: "Add",
    kwDuplicate: "This keyword already exists.",
    kwError: "Could not add.",
    filterSection: "Date Range",
    runReport: "Run Report",
    running: "Scanning...",
    noKeywords: "Add at least one keyword to run the report.",
    resultsSection: "Results",
    scanned: (n: number) => `${n} calls scanned`,
    colKeyword: "Keyword",
    colCalls: "Calls",
    colHits: "Hits",
    colAgents: "Agents",
    noResults: "No keyword matched.",
    agent: "Agent",
    date: "Date",
    snippet: "Excerpt",
    goToEval: "Go to evaluation →",
  },
};

function highlightWord(text: string, word: string): React.ReactNode {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(word.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(239,68,68,.25)", color: "inherit", borderRadius: 2, padding: "0 2px" }}>
        {text.slice(idx, idx + word.length)}
      </mark>
      {text.slice(idx + word.length)}
    </>
  );
}

export default function NegativeKeywordsReport({ lang }: { lang: "tr" | "en" }) {
  const t = L[lang];

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newWord, setNewWord] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);

  useEffect(() => { fetchKeywords(); }, []);

  const fetchKeywords = async () => {
    const res = await fetch("/api/negative-keywords");
    if (res.ok) {
      const d = await res.json();
      setKeywords(d.keywords || []);
    }
  };

  const addKeyword = async () => {
    const word = newWord.trim().toLowerCase();
    if (!word) return;
    setAddLoading(true);
    setAddError("");
    const res = await fetch("/api/negative-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });
    if (res.ok) {
      const d = await res.json();
      setKeywords(prev => [...prev, d.keyword]);
      setNewWord("");
    } else {
      setAddError(res.status === 409 ? t.kwDuplicate : t.kwError);
    }
    setAddLoading(false);
  };

  const deleteKeyword = async (id: string) => {
    const res = await fetch(`/api/negative-keywords/${id}`, { method: "DELETE" });
    if (res.ok) setKeywords(prev => prev.filter(k => k.id !== id));
  };

  const runReport = async () => {
    setReportLoading(true);
    setReportData(null);
    setExpandedKeyword(null);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const res = await fetch(`/api/reports/negative-keywords?${params}`);
    if (res.ok) {
      setReportData(await res.json());
    }
    setReportLoading(false);
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", margin: 0 }}>{t.title}</h1>
        <p style={{ fontSize: 13, color: "var(--fg-faint)", marginTop: 4 }}>{t.subtitle}</p>
      </div>

      {/* Section 1: Keyword Management */}
      <div style={cardStyle}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
          {t.kwSection}
        </p>

        {keywords.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--fg-faint)", marginBottom: 14 }}>{t.kwEmpty}</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {keywords.map(kw => (
              <span
                key={kw.id}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.25)",
                  borderRadius: 20, padding: "4px 10px 4px 12px",
                  fontSize: 12, fontWeight: 600, color: "#f87171",
                }}
              >
                {kw.word}
                <button
                  onClick={() => deleteKeyword(kw.id)}
                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={newWord}
            onChange={e => { setNewWord(e.target.value); setAddError(""); }}
            onKeyDown={e => e.key === "Enter" && addKeyword()}
            placeholder={t.kwPlaceholder}
            style={{
              flex: 1, background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--fg)",
              outline: "none",
            }}
          />
          <button
            onClick={addKeyword}
            disabled={addLoading || !newWord.trim()}
            style={{
              background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", opacity: (addLoading || !newWord.trim()) ? 0.5 : 1,
            }}
          >
            {t.kwAdd}
          </button>
        </div>
        {addError && <p style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>{addError}</p>}
      </div>

      {/* Section 2: Date Filter + Run */}
      <div style={{ marginBottom: 16 }}>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onApply={runReport}
          lang={lang}
        />
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={runReport}
            disabled={reportLoading || keywords.length === 0}
            style={{
              background: "linear-gradient(to right, var(--accent), #8b5cf6)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "9px 22px", fontSize: 13, fontWeight: 700,
              cursor: "pointer", opacity: (reportLoading || keywords.length === 0) ? 0.5 : 1,
            }}
          >
            {reportLoading ? t.running : t.runReport}
          </button>
          {keywords.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>{t.noKeywords}</span>
          )}
        </div>
      </div>

      {/* Section 3: Results */}
      {reportData && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
              {t.resultsSection}
            </p>
            <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>{t.scanned(reportData.totalEvaluationsScanned)}</span>
          </div>

          {reportData.results.length === 0 || reportData.results.every(r => r.callCount === 0) ? (
            <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>{t.noResults}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                    {[t.colKeyword, t.colCalls, t.colHits, t.colAgents].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.results.map(r => (
                    <React.Fragment key={r.keywordId}>
                      <tr
                        onClick={() => r.callCount > 0 && setExpandedKeyword(expandedKeyword === r.keywordId ? null : r.keywordId)}
                        style={{ cursor: r.callCount > 0 ? "pointer" : "default", borderBottom: "1px solid var(--glass-border)", transition: "background 0.1s" }}
                        onMouseEnter={e => r.callCount > 0 && ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.03)")}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "")}
                      >
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: r.callCount > 0 ? "#f87171" : "var(--fg-faint)", fontWeight: 600 }}>{r.word}</span>
                            {r.callCount > 0 && (
                              <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                                {expandedKeyword === r.keywordId ? "▲" : "▼"}
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", color: r.callCount > 0 ? "var(--fg)" : "var(--fg-faint)", fontWeight: r.callCount > 0 ? 700 : 400 }}>
                          {r.callCount}
                        </td>
                        <td style={{ padding: "10px 10px", color: r.totalHits > 0 ? "#fb923c" : "var(--fg-faint)" }}>
                          {r.totalHits}
                        </td>
                        <td style={{ padding: "10px 10px", color: "var(--fg-dim)", fontSize: 12 }}>
                          {r.agentNames.join(", ") || "—"}
                        </td>
                      </tr>

                      {expandedKeyword === r.keywordId && r.matches.length > 0 && (
                        <tr key={`${r.keywordId}-expand`}>
                          <td colSpan={4} style={{ padding: "0 10px 10px 10px", background: "rgba(239,68,68,.04)" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 4 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                                  <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--fg-faint)", fontWeight: 600 }}>{t.agent}</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--fg-faint)", fontWeight: 600 }}>{t.date}</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--fg-faint)", fontWeight: 600 }}>{t.snippet}</th>
                                  <th style={{ padding: "4px 8px" }} />
                                </tr>
                              </thead>
                              <tbody>
                                {r.matches.map((m, i) => (
                                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                                    <td style={{ padding: "6px 8px", color: "var(--fg)", whiteSpace: "nowrap" }}>{m.agentName}</td>
                                    <td style={{ padding: "6px 8px", color: "var(--fg-dim)", whiteSpace: "nowrap" }}>
                                      {new Date(m.callDate).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB")}
                                    </td>
                                    <td style={{ padding: "6px 8px", color: "var(--fg-dim)", fontStyle: "italic", lineHeight: 1.5 }}>
                                      {highlightWord(m.snippet, r.word)}
                                    </td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                      <a href={`/evaluation/${m.evaluationId}`} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>
                                        {t.goToEval}
                                      </a>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
