"use client";

import { useState, useCallback, useEffect } from "react";
import DateRangePicker from "@/app/components/shared/DateRangePicker";
import { translations } from "@/app/lib/i18n";

interface EvalRow {
  id: string;
  customerName: string;
  callDate: string;
  score: number;
  agentRead: boolean;
  agentReadAt: string | null;
  coachingDone: boolean;
  coachingDoneAt: string | null;
  coachingNotes: string | null;
  coachingByName: string | null;
}

interface AgentRow {
  agentId: string;
  agentName: string;
  teamName: string | null;
  totalEvals: number;
  readCount: number;
  coachingDoneCount: number;
  evaluations: EvalRow[];
}

interface Summary {
  totalEvaluations: number;
  agentReadCount: number;
  coachingDoneCount: number;
}

interface CoachingTrackingViewProps {
  lang?: "tr" | "en";
}

function PercentBar({ value, total }: { value: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 4, borderRadius: 99, background: "var(--rule)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--accent)",
            borderRadius: 99,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: "var(--fg-dim)", marginTop: 3, display: "block" }}>
        {value} / {total} ({pct}%)
      </span>
    </div>
  );
}

function SummaryCard({ label, value, total }: { label: string; value: number; total?: number }) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 16,
        padding: "16px 20px",
        background: "var(--glass-bg)",
        border: "1px solid var(--rule)",
      }}
    >
      <p style={{ fontSize: 11, color: "var(--fg-dim)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 700, color: "var(--fg)", marginTop: 4 }}>{value}</p>
      {total !== undefined && <PercentBar value={value} total={total} />}
    </div>
  );
}

function StatusBadge({ done, doneLabel, notDoneLabel }: { done: boolean; doneLabel: string; notDoneLabel: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 99,
        background: done ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.1)",
        color: done ? "#22c55e" : "#ef4444",
        border: `1px solid ${done ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.2)"}`,
        whiteSpace: "nowrap" as const,
      }}
    >
      {done ? "✓" : "✗"} {done ? doneLabel : notDoneLabel}
    </span>
  );
}

export default function CoachingTrackingView({ lang = "tr" }: CoachingTrackingViewProps) {
  const t = translations[lang];
  const [summary, setSummary] = useState<Summary | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [teamLeaders, setTeamLeaders] = useState<{ id: string; name: string; teamName: string }[]>([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState("");

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTeamLeaders(
          (d.teams || [])
            .filter((tm: any) => tm.leader)
            .map((tm: any) => ({ id: tm.leader.id, name: tm.leader.name, teamName: tm.name }))
        );
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (start?: string, end?: string, leaderId?: string) => {
    setLoading(true);
    setFetchError(false);
    setSummary(null);
    setAgents([]);
    try {
      const params = new URLSearchParams();
      if (start) params.set("startDate", start);
      if (end) params.set("endDate", end);
      if (leaderId) params.set("leaderId", leaderId);
      const res = await fetch(`/api/reports/coaching-tracking${params.toString() ? `?${params}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setAgents(data.agents);
        setFetched(true);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleAgent = (agentId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  const notePreview = (notes: string | null) => {
    if (!notes) return null;
    return notes.length > 40 ? notes.slice(0, 40) + "…" : notes;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)" }}>{t.coachingTrackingTitle}</h1>
        <p style={{ fontSize: 13, color: "var(--fg-dim)", marginTop: 4 }}>{t.coachingTrackingSub}</p>
      </div>

      {/* Date range picker */}
      <div style={{ borderRadius: 20, padding: "20px 24px", marginBottom: 20, background: "var(--glass-bg)", border: "1px solid var(--rule)", display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onApply={() => fetchData(startDate || undefined, endDate || undefined, selectedLeaderId || undefined)}
          lang={lang}
        />
        <select
          value={selectedLeaderId}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedLeaderId(v);
            fetchData(startDate || undefined, endDate || undefined, v || undefined);
          }}
          style={{ background: "var(--glass-bg)", border: "1px solid var(--rule)", borderRadius: 8, padding: "8px 12px", color: "var(--fg)", fontSize: 12, colorScheme: "dark" }}
        >
          <option value="">{lang === "tr" ? "Tüm Takımlar" : "All Teams"}</option>
          {teamLeaders.map((tl) => (
            <option key={tl.id} value={tl.id}>{tl.name}{tl.teamName ? ` — ${tl.teamName}` : ""}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <SummaryCard label={t.ctTotalEvals} value={summary.totalEvaluations} />
          <SummaryCard label={t.ctAgentRead} value={summary.agentReadCount} total={summary.totalEvaluations} />
          <SummaryCard label={t.ctCoachingDone} value={summary.coachingDoneCount} total={summary.totalEvaluations} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: "64px 0", textAlign: "center" }}>
          <div style={{ width: 20, height: 20, border: "2px solid var(--rule)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
        </div>
      )}

      {/* Error state */}
      {!loading && fetchError && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "#ef4444", fontSize: 14 }}>
          {t.ctFetchError}
        </div>
      )}

      {/* Empty state */}
      {!loading && fetched && agents.length === 0 && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--fg-dim)", fontSize: 14 }}>
          {t.ctNoEvals}
        </div>
      )}

      {/* Prompt to apply filter */}
      {!loading && !fetched && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--fg-dim)", fontSize: 14 }}>
          {t.ctApplyPrompt}
        </div>
      )}

      {/* Accordion table */}
      {!loading && agents.length > 0 && (
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--rule)" }}>
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 80px 90px 100px",
              padding: "10px 16px",
              background: "var(--glass-bg)",
              borderBottom: "1px solid var(--rule)",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--fg-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span>{t.ctAgent}</span>
            <span>{t.ctTeam}</span>
            <span style={{ textAlign: "center" }}>{t.ctEvals}</span>
            <span style={{ textAlign: "center" }}>{t.ctRead}</span>
            <span style={{ textAlign: "center" }}>{t.ctCoaching}</span>
          </div>

          {agents.map((agent, idx) => {
            const isExpanded = expandedIds.has(agent.agentId);
            const isLast = idx === agents.length - 1;
            return (
              <div key={agent.agentId} style={{ borderBottom: isLast ? "none" : "1px solid var(--rule)" }}>
                {/* Agent row */}
                <button
                  onClick={() => toggleAgent(agent.agentId)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 80px 90px 100px",
                    padding: "12px 16px",
                    background: isExpanded ? "rgba(59,130,246,.06)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 120ms",
                    alignItems: "center",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                    <span style={{ fontSize: 9, color: "var(--fg-faint)", display: "inline-block", transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                    {agent.agentName}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>{agent.teamName ?? t.ctNoTeam}</span>
                  <span style={{ fontSize: 12, color: "var(--fg-dim)", textAlign: "center" }}>{agent.totalEvals}</span>
                  <span style={{ fontSize: 12, textAlign: "center" }}>
                    <span style={{ color: agent.readCount === agent.totalEvals ? "#22c55e" : "var(--fg-dim)" }}>
                      {agent.readCount}/{agent.totalEvals}
                    </span>
                  </span>
                  <span style={{ fontSize: 12, textAlign: "center" }}>
                    <span style={{ color: agent.coachingDoneCount === agent.totalEvals ? "#22c55e" : "var(--fg-dim)" }}>
                      {agent.coachingDoneCount}/{agent.totalEvals}
                    </span>
                  </span>
                </button>

                {/* Expanded eval rows */}
                {isExpanded && (
                  <div style={{ background: "rgba(0,0,0,.12)" }}>
                    {/* Sub-header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 60px 1fr 2fr",
                        padding: "6px 32px",
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--fg-faint)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        borderBottom: "1px solid var(--rule)",
                      }}
                    >
                      <span>{t.ctCustomer}</span>
                      <span>{t.ctDate}</span>
                      <span>{t.ctScore}</span>
                      <span>{t.ctRead}</span>
                      <span>{t.ctCoaching}</span>
                    </div>

                    {agent.evaluations.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 60px 1fr 2fr",
                          padding: "8px 32px",
                          fontSize: 12,
                          color: "var(--fg)",
                          borderBottom: "1px solid var(--rule)",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "var(--fg-dim)" }}>{ev.customerName}</span>
                        <span style={{ color: "var(--fg-dim)" }}>{fmtDate(ev.callDate)}</span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: ev.score >= 75 ? "#22c55e" : ev.score >= 50 ? "#f59e0b" : "#ef4444",
                          }}
                        >
                          {ev.score}
                        </span>

                        {/* Read status */}
                        <div>
                          <StatusBadge done={ev.agentRead} doneLabel={t.ctReadLabel} notDoneLabel={t.ctNotReadLabel} />
                          {ev.agentRead && ev.agentReadAt && (
                            <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>
                              {fmtDate(ev.agentReadAt)}
                            </div>
                          )}
                        </div>

                        {/* Coaching status */}
                        <div>
                          <StatusBadge done={ev.coachingDone} doneLabel={t.ctCoachingDoneLabel} notDoneLabel={t.ctCoachingNotDoneLabel} />
                          {ev.coachingDone && ev.coachingDoneAt && (
                            <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>
                              {fmtDate(ev.coachingDoneAt)}
                              {ev.coachingByName && ` · ${ev.coachingByName}`}
                            </div>
                          )}
                          {ev.coachingDone && ev.coachingNotes && (
                            <div
                              title={ev.coachingNotes}
                              style={{
                                fontSize: 10,
                                color: "var(--fg-dim)",
                                marginTop: 2,
                                cursor: "help",
                                fontStyle: "italic",
                              }}
                            >
                              &ldquo;{notePreview(ev.coachingNotes)}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
