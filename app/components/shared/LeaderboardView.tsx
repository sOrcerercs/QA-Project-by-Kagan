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
  teams: TeamEntry[];
  period: string;
  totalAgents: number;
}

type Period = "30d" | "3m" | "all";

const L = {
  tr: {
    title: "Sıralama",
    teamsTitle: "Takım Sıralaması",
    period30d: "Son 30 Gün",
    period3m: "Son 3 Ay",
    periodAll: "Tüm Zamanlar",
    calls: "çağrı",
    agents: "danışman",
    among: (n: number) => `${n} danışman arasından`,
    empty: "Henüz yeterli değerlendirme yok.",
    teamsEmpty: "Henüz takım verisi yok.",
    error: "Sıralama yüklenemedi.",
    sectionA: "Giriş",
    sectionB: "Çözüm",
    sectionC: "Kapanış",
  },
  en: {
    title: "Rankings",
    teamsTitle: "Team Rankings",
    period30d: "Last 30 Days",
    period3m: "Last 3 Months",
    periodAll: "All Time",
    calls: "calls",
    agents: "agents",
    among: (n: number) => `Among ${n} agents`,
    empty: "Not enough evaluations yet.",
    teamsEmpty: "No team data yet.",
    error: "Could not load rankings.",
    sectionA: "Intro",
    sectionB: "Solution",
    sectionC: "Close",
  },
};

const MEDALS = ["🥇", "🥈", "🥉"];

const SECTION_COLORS: Record<keyof SectionScores, string> = {
  A: "#60a5fa",
  B: "#34d399",
  C: "#f97316",
};

function SectionBars({ scores, t }: { scores: SectionScores; t: typeof L["tr"] }) {
  const sections: Array<{ key: keyof SectionScores; label: string }> = [
    { key: "A", label: t.sectionA },
    { key: "B", label: t.sectionB },
    { key: "C", label: t.sectionC },
  ];
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      {sections.map(({ key, label }) => (
        <div key={key} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 48 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 3,
            }}
          >
            <span style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: "0.03em" }}>
              {label}
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, color: SECTION_COLORS[key] }}>
              {scores[key]}
            </span>
          </div>
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: "var(--glass-border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${scores[key]}%`,
                background: SECTION_COLORS[key],
                borderRadius: 2,
                opacity: 0.8,
              }}
            />
          </div>
        </div>
      ))}
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

  const card: React.CSSProperties = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: 16,
    padding: "8px 0",
  };

  const skeletonCount = canChoosePeriod ? 8 : 5;

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", margin: 0 }}>
          {t.title}
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

      {/* Agent leaderboard */}
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
                <div style={{ height: 8, background: "var(--glass-border)", borderRadius: 4, width: "80%", marginBottom: 5 }} />
                <div style={{ height: 3, background: "var(--glass-border)", borderRadius: 2, width: "70%" }} />
              </div>
              <div style={{ width: 36, height: 28, background: "var(--glass-border)", borderRadius: 4 }} />
            </div>
          ))
        ) : error ? (
          <p style={{ fontSize: 13, color: "#f87171", textAlign: "center", padding: "28px 20px" }}>
            {t.error}
          </p>
        ) : !data || data.entries.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--fg-faint)", textAlign: "center", padding: "28px 20px" }}>
            {t.empty}
          </p>
        ) : (
          <>
            {data.entries.map((entry, i) => (
              <div
                key={entry.agentId}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 20px",
                  borderBottom: i < data.entries.length - 1 ? "1px solid var(--glass-border)" : "none",
                }}
              >
                {/* Rank badge */}
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
                    marginTop: 2,
                  }}
                >
                  {entry.rank <= 3 ? MEDALS[entry.rank - 1] : entry.rank}
                </div>

                {/* Name + team + section bars */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--fg)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.name}
                  </div>
                  {entry.teamName && (
                    <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 1 }}>
                      {entry.teamName}
                    </div>
                  )}
                  {entry.sectionScores && (
                    <SectionBars scores={entry.sectionScores} t={t} />
                  )}
                </div>

                {/* Score + calls */}
                <div style={{ textAlign: "right", flexShrink: 0, marginTop: 2 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color:
                        entry.rank === 1 ? "#fbbf24"
                        : entry.rank === 2 ? "#94a3b8"
                        : entry.rank === 3 ? "#b47a3c"
                        : "var(--fg)",
                    }}
                  >
                    {entry.avgScore}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 1 }}>
                    {entry.callCount} {t.calls}
                  </div>
                </div>
              </div>
            ))}

            {/* Footer */}
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
                {t.among(data.totalAgents)}
              </span>
              <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{periodLabel}</span>
            </div>
          </>
        )}
      </div>

      {/* Team leaderboard */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", margin: "0 0 14px" }}>
          {t.teamsTitle}
        </h2>
        <div style={card}>
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
            <p style={{ fontSize: 13, color: "var(--fg-faint)", textAlign: "center", padding: "20px" }}>
              {t.teamsEmpty}
            </p>
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
                {/* Rank badge */}
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

                {/* Team name + agent count */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--fg)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {team.teamName}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 1 }}>
                    {team.agentCount} {t.agents}
                  </div>
                </div>

                {/* Avg score */}
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
          {lang === "tr" ? "Gösterge" : "Legend"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {/* Score */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", minWidth: 28 }}>
              {lang === "tr" ? "Ort." : "Avg"}
            </span>
            <span style={{ fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.4 }}>
              {lang === "tr"
                ? "Seçilen dönemdeki tüm değerlendirmelerin ortalama kalite skoru (0–100)."
                : "Average quality score across all evaluations in the selected period (0–100)."}
            </span>
          </div>
          {/* Section bars */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 4, minWidth: 28, paddingTop: 2 }}>
              {(["A", "B", "C"] as const).map((k) => (
                <div key={k} style={{ width: 6, height: 6, borderRadius: 1, background: SECTION_COLORS[k] }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.4 }}>
              {lang === "tr"
                ? "Bölüm barları: mavi = Giriş & Profilleme (%20) · yeşil = Çözüm & Otorite (%45) · turuncu = Kapanış & Köprü (%35). Her bölümün ortalama skoru, değerlendirme formundaki ağırlıklı puanlara göre hesaplanır."
                : "Section bars: blue = Intro & Profiling (20%) · green = Solution & Authority (45%) · orange = Close & Bridge (35%). Each bar shows the avg score for that section, weighted per the evaluation form."}
            </span>
          </div>
          {/* Team score */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", minWidth: 28 }}>
              {lang === "tr" ? "Takım" : "Team"}
            </span>
            <span style={{ fontSize: 12, color: "var(--fg-faint)", lineHeight: 1.4 }}>
              {lang === "tr"
                ? "Takım skoru, o takımdaki tüm danışmanların bireysel ortalama skorlarının ortalamasıdır."
                : "Team score is the average of each member's individual average score within the period."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
