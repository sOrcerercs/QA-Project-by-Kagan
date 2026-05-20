"use client";

import { useState, useEffect } from "react";

interface LeaderboardEntry {
  rank: number;
  agentId: string;
  name: string;
  teamName: string | null;
  avgScore: number;
  callCount: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  period: string;
  totalAgents: number;
}

type Period = "30d" | "3m" | "all";

const L = {
  tr: {
    title: "Sıralama",
    period30d: "Son 30 Gün",
    period3m: "Son 3 Ay",
    periodAll: "Tüm Zamanlar",
    calls: "çağrı",
    among: (n: number) => `${n} danışman arasından`,
    empty: "Henüz yeterli değerlendirme yok.",
    error: "Sıralama yüklenemedi.",
  },
  en: {
    title: "Rankings",
    period30d: "Last 30 Days",
    period3m: "Last 3 Months",
    periodAll: "All Time",
    calls: "calls",
    among: (n: number) => `Among ${n} agents`,
    empty: "Not enough evaluations yet.",
    error: "Could not load rankings.",
  },
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardView({
  lang,
  userRole,
}: {
  lang: "tr" | "en";
  userRole: string;
}) {
  const t = L[lang];
  const canChoosePeriod = userRole === "ADMIN" || userRole === "MANAGER";

  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch(`/api/leaderboard?period=${period}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((d) => { if (active) setData(d); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  const periodLabel =
    period === "30d" ? t.period30d : period === "3m" ? t.period3m : t.periodAll;

  const card: React.CSSProperties = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: 16,
    padding: "8px 0",
  };

  return (
    <div style={{ maxWidth: 520 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--fg)",
            margin: 0,
          }}
        >
          {t.title}
        </h1>
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

      <div style={card}>
        {loading ? (
          /* Skeleton */
          [1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                padding: "14px 20px",
                borderBottom:
                  i < 5 ? "1px solid var(--glass-border)" : "none",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--glass-border)",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 12,
                    background: "var(--glass-border)",
                    borderRadius: 4,
                    width: "55%",
                    marginBottom: 6,
                  }}
                />
                <div
                  style={{
                    height: 10,
                    background: "var(--glass-border)",
                    borderRadius: 4,
                    width: "30%",
                  }}
                />
              </div>
              <div
                style={{
                  width: 36,
                  height: 28,
                  background: "var(--glass-border)",
                  borderRadius: 4,
                }}
              />
            </div>
          ))
        ) : error ? (
          <p
            style={{
              fontSize: 13,
              color: "#f87171",
              textAlign: "center",
              padding: "28px 20px",
            }}
          >
            {t.error}
          </p>
        ) : !data || data.entries.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              color: "var(--fg-faint)",
              textAlign: "center",
              padding: "28px 20px",
            }}
          >
            {t.empty}
          </p>
        ) : (
          <>
            {data.entries.map((entry, i) => (
              <div
                key={entry.agentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 20px",
                  borderBottom:
                    i < data.entries.length - 1
                      ? "1px solid var(--glass-border)"
                      : "none",
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
                      entry.rank === 1
                        ? "rgba(251,191,36,.15)"
                        : entry.rank === 2
                        ? "rgba(148,163,184,.12)"
                        : entry.rank === 3
                        ? "rgba(180,120,60,.12)"
                        : "transparent",
                    border: "1px solid var(--glass-border)",
                    flexShrink: 0,
                  }}
                >
                  {entry.rank <= 3 ? MEDALS[entry.rank - 1] : entry.rank}
                </div>

                {/* Name + team */}
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
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--fg-faint)",
                        marginTop: 2,
                      }}
                    >
                      {entry.teamName}
                    </div>
                  )}
                </div>

                {/* Score + calls */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color:
                        entry.rank === 1
                          ? "#fbbf24"
                          : entry.rank === 2
                          ? "#94a3b8"
                          : entry.rank === 3
                          ? "#b47a3c"
                          : "var(--fg)",
                    }}
                  >
                    {entry.avgScore}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--fg-faint)",
                      marginTop: 1,
                    }}
                  >
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
              <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                {periodLabel}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
