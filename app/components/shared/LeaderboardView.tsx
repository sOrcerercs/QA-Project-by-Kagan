"use client";

import { useState, useEffect } from "react";

interface SectionScores {
  A: number;
  B: number;
  C: number;
}

interface LeaderboardEntry {
  rank: number;
  agentId: string;
  name: string;
  teamName: string | null;
  avgScore: number;
  callCount: number;
  sectionScores: SectionScores | null;
}

interface TeamEntry {
  rank: number;
  teamId: string;
  teamName: string;
  avgScore: number;
  agentCount: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  sectionRankings: {
    A: LeaderboardEntry[];
    B: LeaderboardEntry[];
    C: LeaderboardEntry[];
  };
  teams: TeamEntry[];
  period: string;
  totalAgents: number;
}

type Period = "30d" | "3m" | "all";

const MEDALS = ["🥇", "🥈", "🥉"];

const SECTION_COLORS: Record<keyof SectionScores, string> = {
  A: "#60a5fa",
  B: "#34d399",
  C: "#f97316",
};

const L = {
  tr: {
    title: "Genel Kalite Skoruna Göre Sıralama",
    sectionTitle: (label: string) => `${label} Bölümüne Göre Sıralama`,
    teamsTitle: "Kalite Skoruna Göre Takım Sıralaması",
    period30d: "Son 30 Gün",
    period3m: "Son 3 Ay",
    periodAll: "Tüm Zamanlar",
    calls: "çağrı",
    agents: "danışman",
    among: (n: number) => `${n} danışman arasından`,
    empty: "Henüz yeterli değerlendirme yok.",
    sectionEmpty: "Bu bölüm için yeterli veri yok.",
    teamsEmpty: "Henüz takım verisi yok.",
    error: "Sıralama yüklenemedi.",
    legendTitle: "Gösterge",
    legendAvg: "Seçilen dönemdeki tüm değerlendirmelerin ortalama kalite skoru (0–100).",
    legendSections: "Bölüm tabloları: mavi = Giriş & Profilleme (%20) · yeşil = Çözüm & Otorite (%45) · turuncu = Kapanış & Köprü (%35). Her tablo, ilgili bölümde en yüksek ortalamayı alan danışmanları sıralar.",
    legendTeam: "Takım skoru, o takımdaki tüm danışmanların bireysel ortalama skorlarının ortalamasıdır.",
    sectionLabels: { A: "A — Giriş & Profilleme", B: "B — Çözüm & Otorite", C: "C — Kapanış & Köprü" },
  },
  en: {
    title: "Overall Quality Score Rankings",
    sectionTitle: (label: string) => `${label} Section Rankings`,
    teamsTitle: "Team Rankings by Quality Score",
    period30d: "Last 30 Days",
    period3m: "Last 3 Months",
    periodAll: "All Time",
    calls: "calls",
    agents: "agents",
    among: (n: number) => `Among ${n} agents`,
    empty: "Not enough evaluations yet.",
    sectionEmpty: "Not enough data for this section.",
    teamsEmpty: "No team data yet.",
    error: "Could not load rankings.",
    legendTitle: "Legend",
    legendAvg: "Average quality score across all evaluations in the selected period (0–100).",
    legendSections: "Section tables: blue = Intro & Profiling (20%) · green = Solution & Authority (45%) · orange = Close & Bridge (35%). Each table ranks agents by their highest average score in that section.",
    legendTeam: "Team score is the average of each member's individual average score within the period.",
    sectionLabels: { A: "A — Intro & Profiling", B: "B — Solution & Authority", C: "C — Close & Bridge" },
  },
};

function AgentTable({
  entries,
  loading,
  skeletonCount,
  emptyText,
  errorText,
  error,
  callsLabel,
  periodLabel,
  totalAgents,
  showFooter,
  scoreKey,
}: {
  entries: LeaderboardEntry[];
  loading: boolean;
  skeletonCount: number;
  emptyText: string;
  errorText: string;
  error: boolean;
  callsLabel: string;
  periodLabel: string;
  totalAgents: number;
  showFooter: boolean;
  scoreKey?: keyof SectionScores;
}) {
  const card: React.CSSProperties = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: 16,
    padding: "8px 0",
  };

  const getScore = (entry: LeaderboardEntry) =>
    scoreKey && entry.sectionScores ? entry.sectionScores[scoreKey] : entry.avgScore;

  const scoreColor = (rank: number) =>
    rank === 1 ? "#fbbf24" : rank === 2 ? "#94a3b8" : rank === 3 ? "#b47a3c" : "var(--fg)";

  return (
    <div style={card}>
      {loading ? (
        Array.from({ length: skeletonCount }, (_, i) => i + 1).map((i, _, arr) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              padding: "14px 20px",
              borderBottom: i < arr.length ? "1px solid var(--glass-border)" : "none",
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--glass-border)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, background: "var(--glass-border)", borderRadius: 4, width: "55%", marginBottom: 6 }} />
              <div style={{ height: 9, background: "var(--glass-border)", borderRadius: 4, width: "30%" }} />
            </div>
            <div style={{ width: 36, height: 28, background: "var(--glass-border)", borderRadius: 4 }} />
          </div>
        ))
      ) : error ? (
        <p style={{ fontSize: 13, color: "#f87171", textAlign: "center", padding: "28px 20px" }}>{errorText}</p>
      ) : entries.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--fg-faint)", textAlign: "center", padding: "28px 20px" }}>{emptyText}</p>
      ) : (
        <>
          {entries.map((entry, i) => (
            <div
              key={entry.agentId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 20px",
                borderBottom: i < entries.length - 1 ? "1px solid var(--glass-border)" : "none",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: entry.rank <= 3 ? 18 : 13,
                  fontWeight: 700,
                  color: entry.rank <= 3 ? "var(--fg)" : "var(--fg-faint)",
                  background:
                    entry.rank === 1 ? "rgba(251,191,36,.15)"
                    : entry.rank === 2 ? "rgba(148,163,184,.12)"
                    : entry.rank === 3 ? "rgba(180,120,60,.12)"
                    : "transparent",
                  border: "1px solid var(--glass-border)",
                  flexShrink: 0,
                }}
              >
                {entry.rank <= 3 ? MEDALS[entry.rank - 1] : entry.rank}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {entry.name}
                </div>
                {entry.teamName && (
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>{entry.teamName}</div>
                )}
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor(entry.rank) }}>
                  {getScore(entry)}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 1 }}>
                  {entry.callCount} {callsLabel}
                </div>
              </div>
            </div>
          ))}

          {showFooter && (
            <div
              style={{
                padding: "10px 20px 4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--glass-border)",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                {totalAgents} {callsLabel.replace("çağrı", "danışman").replace("calls", "agents")}
              </span>
              <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{periodLabel}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LeaderboardView({
  lang,
  userRole,
}: {
  lang: "tr" | "en";
  userRole: "AGENT" | "TEAM_LEADER" | "MANAGER" | "ADMIN";
}) {
  const t = L[lang];
  const canChoosePeriod = userRole === "ADMIN" || userRole === "MANAGER";

  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`/api/leaderboard?period=${period}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((d) => setData(d))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period]);

  const periodLabel =
    period === "30d" ? t.period30d : period === "3m" ? t.period3m : t.periodAll;

  const skeletonCount = canChoosePeriod ? 8 : 5;

  const sectionKeys: Array<keyof SectionScores> = ["A", "B", "C"];

  const sectionColors: Record<keyof SectionScores, string> = SECTION_COLORS;

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--fg)",
    margin: "0 0 14px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", margin: 0 }}>
          {lang === "tr" ? "Sıralama" : "Rankings"}
        </h2>
        {canChoosePeriod && (
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12,
              color: "var(--fg)",
              cursor: "pointer",
            }}
          >
            <option value="30d">{t.period30d}</option>
            <option value="3m">{t.period3m}</option>
            <option value="all">{t.periodAll}</option>
          </select>
        )}
      </div>

      {/* 1 — Overall quality score */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-faint)", margin: "0 0 10px", letterSpacing: "0.02em" }}>
        {t.title}
      </h3>
      <AgentTable
        entries={data?.entries ?? []}
        loading={loading}
        skeletonCount={skeletonCount}
        emptyText={t.empty}
        errorText={t.error}
        error={error}
        callsLabel={t.calls}
        periodLabel={periodLabel}
        totalAgents={data?.totalAgents ?? 0}
        showFooter={true}
      />

      {/* 2 — Section A / B / C */}
      {sectionKeys.map((key) => (
        <div key={key} style={{ marginTop: 28 }}>
          <h3 style={sectionHeaderStyle}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: sectionColors[key],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-faint)", letterSpacing: "0.02em" }}>
              {t.sectionTitle(t.sectionLabels[key])}
            </span>
          </h3>
          <AgentTable
            entries={data?.sectionRankings?.[key] ?? []}
            loading={loading}
            skeletonCount={skeletonCount}
            emptyText={t.sectionEmpty}
            errorText={t.error}
            error={error}
            callsLabel={t.calls}
            periodLabel={periodLabel}
            totalAgents={data?.totalAgents ?? 0}
            showFooter={false}
            scoreKey={key}
          />
        </div>
      ))}

      {/* 3 — Team rankings */}
      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-faint)", margin: "0 0 10px", letterSpacing: "0.02em" }}>
          {t.teamsTitle}
        </h3>
        <div
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: 16,
            padding: "8px 0",
          }}
        >
          {loading ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 20px",
                  borderBottom: i < 3 ? "1px solid var(--glass-border)" : "none",
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--glass-border)", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 11, background: "var(--glass-border)", borderRadius: 4, width: "40%", marginBottom: 5 }} />
                  <div style={{ height: 9, background: "var(--glass-border)", borderRadius: 4, width: "20%" }} />
                </div>
                <div style={{ width: 32, height: 22, background: "var(--glass-border)", borderRadius: 4 }} />
              </div>
            ))
          ) : !data || data.teams.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--fg-faint)", textAlign: "center", padding: "20px" }}>{t.teamsEmpty}</p>
          ) : (
            data.teams.map((team, i) => (
              <div
                key={team.teamId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 20px",
                  borderBottom: i < data.teams.length - 1 ? "1px solid var(--glass-border)" : "none",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: team.rank <= 3 ? 14 : 11,
                    fontWeight: 700,
                    color: team.rank <= 3 ? "var(--fg)" : "var(--fg-faint)",
                    background:
                      team.rank === 1 ? "rgba(251,191,36,.15)"
                      : team.rank === 2 ? "rgba(148,163,184,.12)"
                      : team.rank === 3 ? "rgba(180,120,60,.12)"
                      : "transparent",
                    border: "1px solid var(--glass-border)",
                    flexShrink: 0,
                  }}
                >
                  {team.rank <= 3 ? MEDALS[team.rank - 1] : team.rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {team.teamName}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 1 }}>
                    {team.agentCount} {t.agents}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color:
                      team.rank === 1 ? "#fbbf24"
                      : team.rank === 2 ? "#94a3b8"
                      : team.rank === 3 ? "#b47a3c"
                      : "var(--fg)",
                    flexShrink: 0,
                  }}
                >
                  {team.avgScore}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 24,
          padding: "16px 20px",
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-faint)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {t.legendTitle}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", minWidth: 28 }}>
              {lang === "tr" ? "Ort." : "Avg"}
            </span>
            <span style={{ fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.4 }}>{t.legendAvg}</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 4, minWidth: 28, paddingTop: 3 }}>
              {(["A", "B", "C"] as const).map((k) => (
                <div key={k} style={{ width: 6, height: 6, borderRadius: "50%", background: SECTION_COLORS[k] }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.4 }}>{t.legendSections}</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", minWidth: 28 }}>
              {lang === "tr" ? "Takım" : "Team"}
            </span>
            <span style={{ fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.4 }}>{t.legendTeam}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
