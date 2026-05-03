"use client";

import { useState, useEffect } from "react";

interface CriterionBreakdown {
  id: string;
  label: string;
  section: string;
  mine: number;
  teamAvg: number;
  delta: number;
}

interface PeerData {
  mine: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCount: number;
    criteriaBreakdown: CriterionBreakdown[];
  };
  team: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCountAvg: number;
  } | null;
  teamSize: number;
  hasTeam: boolean;
}

const SECTION_CONFIG = {
  A: { label: "A · Giriş & Profilleme", color: "#818cf8" },
  B: { label: "B · Çözüm & Otorite", color: "#facc15" },
  C: { label: "C · Kapanış & Köprü", color: "#f87171" },
} as const;

function DeltaBadge({ delta, variant }: { delta: number; variant?: "large" }) {
  const color =
    delta > 0 ? "#4ade80" : delta < 0 ? "#f87171" : "#94a3b8";
  const bg =
    delta > 0
      ? "rgba(74,222,128,0.1)"
      : delta < 0
      ? "rgba(248,113,113,0.1)"
      : "rgba(148,163,184,0.1)";

  if (variant === "large") {
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "";
    const sign = delta > 0 ? "+" : "";
    return (
      <span
        style={{
          background: bg,
          color,
          fontSize: 14,
          fontWeight: 700,
          padding: "4px 12px",
          borderRadius: 20,
        }}
      >
        {arrow} {sign}{delta} puan
      </span>
    );
  }

  return (
    <span
      style={{
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 20,
      }}
    >
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

function RefBar({
  mine,
  teamAvg,
  color,
}: {
  mine: number;
  teamAvg: number;
  color: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        height: 8,
        background: "#1e2535",
        borderRadius: 99,
        overflow: "visible",
      }}
    >
      <div
        style={{
          width: `${Math.min(mine, 100)}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -3,
          left: `${Math.min(teamAvg, 100)}%`,
          width: 2,
          height: 14,
          background: "#475569",
          borderRadius: 2,
          transform: "translateX(-50%)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 8,
            color: "#475569",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}
        >
          ort.
        </span>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  mine,
  team,
  criteria,
}: {
  section: "A" | "B" | "C";
  mine: number;
  team: number | null;
  criteria: CriterionBreakdown[];
}) {
  const [open, setOpen] = useState(false);
  const cfg = SECTION_CONFIG[section];
  const delta = team !== null ? mine - team : null;

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: "#131723",
        border: "1px solid #1e2535",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <div style={{ padding: "14px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>
              {cfg.label}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "#334155",
                display: "inline-block",
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            >
              ▾
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>
              %{mine}
            </span>
            {team !== null && (
              <>
                <span style={{ fontSize: 11, color: "#334155" }}>/</span>
                <span style={{ fontSize: 12, color: "#475569" }}>
                  %{team} ort.
                </span>
              </>
            )}
            {delta !== null && <DeltaBadge delta={delta} />}
          </div>
        </div>
        <RefBar mine={mine} teamAvg={team ?? 0} color={cfg.color} />
      </div>

      {open && (
        <div
          style={{
            borderTop: "1px solid #1e2535",
            padding: "12px 16px 14px",
            background: "#0f1420",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              color: "#334155",
              marginBottom: 10,
            }}
          >
            Kriter bazlı karşılaştırma
          </div>
          {criteria.length === 0 ? (
            <p style={{ fontSize: 11, color: "#475569" }}>
              Bu bölüm için henüz kriter verisi yok.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {criteria.map(c => (
                <div key={c.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {c.label}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#cbd5e1",
                        }}
                      >
                        %{c.mine}
                      </span>
                      <span style={{ fontSize: 10, color: "#475569" }}>
                        / %{c.teamAvg} ort.
                      </span>
                      <DeltaBadge delta={c.delta} />
                    </div>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      height: 5,
                      background: "#1e2535",
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(c.mine, 100)}%`,
                        height: "100%",
                        background: cfg.color + "88",
                        borderRadius: 99,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        left: `${Math.min(c.teamAvg, 100)}%`,
                        width: 2,
                        height: 9,
                        background: "#475569",
                        borderRadius: 2,
                        transform: "translateX(-50%)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PeerComparisonView({ agentId }: { agentId: string }) {
  const [data, setData] = useState<PeerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scores/peer")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { mine, team, hasTeam } = data;
  const overallDelta = team ? mine.overallAvg - team.overallAvg : null;

  const criteriaForSection = (s: "A" | "B" | "C") =>
    mine.criteriaBreakdown.filter(c => c.section === s);

  const callCountDelta = team ? mine.callCount - team.callCountAvg : null;
  const callBarMine =
    team && team.callCountAvg > 0
      ? Math.min((mine.callCount / (team.callCountAvg * 2)) * 100, 100)
      : 50;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-headline text-3xl font-bold text-white">
          Nasıl Gidiyorum?
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {hasTeam
            ? "Takım ortalamasıyla karşılaştırma"
            : "Kendi skorların gösteriliyor."}
        </p>
      </div>

      {!hasTeam && (
        <div
          style={{
            background: "#131723",
            border: "1px solid #1e2535",
            borderRadius: 14,
            padding: "14px 16px",
            fontSize: 13,
            color: "#64748b",
          }}
        >
          Henüz bir takıma atanmamışsın. Aşağıda yalnızca kendi skorların gösteriliyor.
        </div>
      )}

      {/* Summary banner */}
      <div className="bg-surface-container rounded-3xl p-6 flex items-center gap-5">
        <div
          style={{ fontSize: 48, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}
        >
          %{mine.overallAvg}
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              fontWeight: 600,
              letterSpacing: "0.5px",
              marginBottom: 4,
            }}
          >
            GENEL SKORUN
          </div>
          {overallDelta !== null && <DeltaBadge delta={overallDelta} variant="large" />}
          {team && (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
              Takım ortalaması{" "}
              <span style={{ color: "#94a3b8" }}>%{team.overallAvg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section cards */}
      {mine.sectionAvg && (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "#334155",
              marginBottom: 8,
            }}
          >
            Bölüm Skorları — detay için tıkla
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["A", "B", "C"] as const).map(s => (
              <SectionCard
                key={s}
                section={s}
                mine={mine.sectionAvg![s]}
                team={team?.sectionAvg?.[s] ?? null}
                criteria={criteriaForSection(s)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Call count */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "#334155",
            marginBottom: 8,
          }}
        >
          Değerlendirme Sayısı
        </div>
        <div className="bg-surface-container rounded-2xl p-5">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>
              Toplam değerlendirilen çağrı
            </span>
            {callCountDelta !== null && <DeltaBadge delta={callCountDelta} />}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 16,
              marginBottom: 10,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "#22d3ee",
                }}
              >
                {mine.callCount}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#475569",
                  marginTop: 3,
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                SEN
              </div>
            </div>
            {team && (
              <>
                <div
                  style={{ width: 1, height: 28, background: "#1e2535" }}
                />
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      lineHeight: 1,
                      color: "#475569",
                    }}
                  >
                    {team.callCountAvg}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      marginTop: 3,
                      fontWeight: 600,
                      letterSpacing: "0.3px",
                    }}
                  >
                    TAKIM ORT.
                  </div>
                </div>
              </>
            )}
          </div>
          {team && <RefBar mine={callBarMine} teamAvg={50} color="#22d3ee" />}
        </div>
      </div>
    </div>
  );
}
