"use client";

import { useState, useEffect, useCallback } from "react";

interface AgentResult {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  overallAvg: number;
  sectionAvg: { A: number; B: number; C: number } | null;
  callCount: number;
}

interface CompareData {
  agents: AgentResult[];
  aggregate: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCountAvg: number;
    agentCount: number;
  };
  teams: Array<{ id: string; name: string; memberCount: number }>;
}

function scoreColor(s: number): string {
  return s >= 85
    ? "#4ade80"
    : s >= 70
    ? "#818cf8"
    : s >= 55
    ? "#facc15"
    : "#f87171";
}

export default function ManagementComparisonView() {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  const fetchData = useCallback((teamIds: string[]) => {
    setLoading(true);
    const params =
      teamIds.length > 0 ? `?teamIds=${teamIds.join(",")}` : "";
    fetch(`/api/scores/compare${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData([]);
  }, [fetchData]);

  const toggleTeam = (id: string) => {
    const next = selectedTeamIds.includes(id)
      ? selectedTeamIds.filter(t => t !== id)
      : [...selectedTeamIds, id];
    setSelectedTeamIds(next);
    fetchData(next);
  };

  const selectAll = () => {
    setSelectedTeamIds([]);
    fetchData([]);
  };

  const isAllSelected = selectedTeamIds.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold text-white">
          Karşılaştırma
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Takım ve danışman performans karşılaştırması
        </p>
      </div>

      {/* Team filter */}
      {data && (
        <div className="bg-surface-container rounded-2xl p-4">
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "#334155",
              marginBottom: 10,
            }}
          >
            Takım Filtresi
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              onClick={selectAll}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: isAllSelected ? "#6c63ff22" : "#1e2535",
                color: isAllSelected ? "#818cf8" : "#64748b",
                border: `1px solid ${isAllSelected ? "#6c63ff44" : "#1e2535"}`,
              }}
            >
              Tüm Takımlar
            </button>
            {data.teams.map(t => {
              const active = selectedTeamIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTeam(t.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: active ? "#6c63ff22" : "#1e2535",
                    color: active ? "#818cf8" : "#64748b",
                    border: `1px solid ${active ? "#6c63ff44" : "#1e2535"}`,
                  }}
                >
                  {t.name}{" "}
                  <span style={{ opacity: 0.5 }}>({t.memberCount})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-24 flex justify-center">
          <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Aggregate cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "GENEL ORT.",
                value: `%${data.aggregate.overallAvg}`,
                color: "#818cf8",
              },
              {
                label: "DANIŞMAN SAYISI",
                value: String(data.aggregate.agentCount),
                color: "#22d3ee",
              },
              {
                label: "ORT. DEĞERLENDİRME",
                value: String(data.aggregate.callCountAvg),
                color: "#4ade80",
              },
            ].map(card => (
              <div
                key={card.label}
                className="bg-surface-container rounded-2xl p-5 text-center"
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "#334155",
                    marginBottom: 8,
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: card.color,
                  }}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Agent list */}
          {data.agents.length === 0 ? (
            <div className="bg-surface-container rounded-2xl p-10 text-center">
              <p style={{ color: "#475569", fontSize: 14 }}>
                Bu takımda henüz danışman bulunmuyor.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.agents.map((agent, i) => (
                <div
                  key={agent.id}
                  style={{
                    background: "#131723",
                    border: "1px solid #1e2535",
                    borderRadius: 14,
                    padding: "14px 16px",
                    display: "grid",
                    gridTemplateColumns: "32px 160px 1fr 64px 48px 48px 48px",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#334155",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    #{i + 1}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: "#1e2535",
                        color: "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#cbd5e1",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {agent.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#475569" }}>
                        {agent.teamName}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      height: 6,
                      background: "#1e2535",
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        width: `${agent.overallAvg}%`,
                        height: "100%",
                        background: scoreColor(agent.overallAvg),
                        borderRadius: 99,
                      }}
                    />
                    {data.aggregate.overallAvg > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: -2,
                          left: `${data.aggregate.overallAvg}%`,
                          width: 2,
                          height: 10,
                          background: "#475569",
                          borderRadius: 2,
                          transform: "translateX(-50%)",
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 800,
                      color: scoreColor(agent.overallAvg),
                    }}
                  >
                    %{agent.overallAvg}
                  </div>
                  {(["A", "B", "C"] as const).map(s => (
                    <div key={s} style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 9,
                          color: "#334155",
                          fontWeight: 700,
                          marginBottom: 2,
                        }}
                      >
                        {s}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#64748b",
                        }}
                      >
                        {agent.sectionAvg
                          ? `%${agent.sectionAvg[s]}`
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
