"use client";

import { useState, useEffect, useCallback } from "react";

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

type Preset = "30d" | "3m" | "6m" | "1y" | "custom";
type Lang = "tr" | "en";

const T = {
  tr: {
    title: "Nasıl Gidiyorum?",
    subtitleTeam: "Takım ortalamasıyla karşılaştırma",
    subtitleSolo: "Kendi skorların gösteriliyor.",
    noTeam: "Henüz bir takıma atanmamışsın. Aşağıda yalnızca kendi skorların gösteriliyor.",
    errorMsg: "Veriler yüklenirken bir hata oluştu.",
    errorHint: "Lütfen sayfayı yenileyip tekrar deneyin.",
    noEvalMsg: "Henüz değerlendirme bulunmuyor.",
    noEvalHint: "İlk değerlendirmen tamamlandıktan sonra istatistiklerin burada görünecek.",
    overallScore: "GENEL SKORUN",
    teamAvg: "Takım ortalaması",
    sectionTitle: "Bölüm Skorları — detay için tıkla",
    criteriaCompare: "Kriter bazlı karşılaştırma",
    noCriteriaData: "Bu bölüm için henüz kriter verisi yok.",
    evalCount: "Değerlendirme Sayısı",
    totalEvals: "Toplam değerlendirilen çağrı",
    you: "SEN",
    teamAvgShort: "TAKIM ORT.",
    pts: "puan",
    avg: "ort.",
  },
  en: {
    title: "How Am I Doing?",
    subtitleTeam: "Comparison with team average",
    subtitleSolo: "Showing your own scores.",
    noTeam: "You haven't been assigned to a team yet. Only your own scores are shown below.",
    errorMsg: "An error occurred while loading data.",
    errorHint: "Please refresh the page and try again.",
    noEvalMsg: "No evaluations found yet.",
    noEvalHint: "Your stats will appear here after your first evaluation is completed.",
    overallScore: "YOUR OVERALL SCORE",
    teamAvg: "Team average",
    sectionTitle: "Section Scores — click for details",
    criteriaCompare: "Criterion breakdown",
    noCriteriaData: "No criterion data for this section yet.",
    evalCount: "Evaluation Count",
    totalEvals: "Total evaluated calls",
    you: "YOU",
    teamAvgShort: "TEAM AVG.",
    pts: "pts",
    avg: "avg.",
  },
} as const;

const PRESET_LABELS: Record<Lang, Record<Preset, string>> = {
  tr: { "30d": "Son 30 Gün", "3m": "Son 3 Ay", "6m": "Son 6 Ay", "1y": "Son 1 Yıl", custom: "Özel" },
  en: { "30d": "Last 30 Days", "3m": "Last 3 Months", "6m": "Last 6 Months", "1y": "Last Year", custom: "Custom" },
};

const SECTION_LABELS: Record<Lang, Record<"A" | "B" | "C", string>> = {
  tr: { A: "A · Giriş & Profilleme", B: "B · Çözüm & Otorite", C: "C · Kapanış & Köprü" },
  en: { A: "A · Intro & Profiling", B: "B · Solution & Authority", C: "C · Closing & Bridge" },
};

const SECTION_COLORS = { A: "#818cf8", B: "#facc15", C: "#f87171" } as const;

const PRESETS: Preset[] = ["30d", "3m", "6m", "1y", "custom"];

function getDateRange(preset: Preset, customStart: string, customEnd: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (preset === "custom") return { startDate: customStart || null, endDate: customEnd || null };
  const days = { "30d": 30, "3m": 90, "6m": 180, "1y": 365 }[preset];
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { startDate: start.toISOString().slice(0, 10), endDate: today };
}

function DeltaBadge({ delta, variant, lang }: { delta: number; variant?: "large"; lang: Lang }) {
  const color = delta > 0 ? "#4ade80" : delta < 0 ? "#f87171" : "#94a3b8";
  const bg = delta > 0 ? "rgba(74,222,128,0.1)" : delta < 0 ? "rgba(248,113,113,0.1)" : "rgba(148,163,184,0.1)";
  const t = T[lang];

  if (variant === "large") {
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "";
    const sign = delta > 0 ? "+" : "";
    return (
      <span style={{ background: bg, color, fontSize: 14, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>
        {arrow} {sign}{delta} {t.pts}
      </span>
    );
  }
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
      {delta > 0 ? "+" : ""}{delta}
    </span>
  );
}

function RefBar({ mine, teamAvg, color, avgLabel }: { mine: number; teamAvg: number; color: string; avgLabel: string }) {
  return (
    <div style={{ position: "relative", height: 8, background: "#1e2535", borderRadius: 99, overflow: "visible" }}>
      <div style={{ width: `${Math.min(mine, 100)}%`, height: "100%", background: color, borderRadius: 99 }} />
      <div
        style={{
          position: "absolute", top: -3, left: `${Math.min(teamAvg, 100)}%`,
          width: 2, height: 14, background: "#475569", borderRadius: 2, transform: "translateX(-50%)",
        }}
      >
        <span style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: "#475569", whiteSpace: "nowrap", fontWeight: 600 }}>
          {avgLabel}
        </span>
      </div>
    </div>
  );
}

function SectionCard({ section, mine, team, criteria, lang }: {
  section: "A" | "B" | "C";
  mine: number;
  team: number | null;
  criteria: CriterionBreakdown[];
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const color = SECTION_COLORS[section];
  const label = SECTION_LABELS[lang][section];
  const delta = team !== null ? mine - team : null;
  const t = T[lang];

  return (
    <div onClick={() => setOpen(o => !o)} style={{ background: "#131723", border: "1px solid #1e2535", borderRadius: 14, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{label}</span>
            <span style={{ fontSize: 10, color: "#334155", display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>%{mine}</span>
            {team !== null && (
              <>
                <span style={{ fontSize: 11, color: "#334155" }}>/</span>
                <span style={{ fontSize: 12, color: "#475569" }}>%{team} {t.avg}</span>
              </>
            )}
            {delta !== null && <DeltaBadge delta={delta} lang={lang} />}
          </div>
        </div>
        <RefBar mine={mine} teamAvg={team ?? 0} color={color} avgLabel={t.avg} />
      </div>

      {open && (
        <div style={{ borderTop: "1px solid #1e2535", padding: "12px 16px 14px", background: "#0f1420" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "#334155", marginBottom: 10 }}>
            {t.criteriaCompare}
          </div>
          {criteria.length === 0 ? (
            <p style={{ fontSize: 11, color: "#475569" }}>{t.noCriteriaData}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {criteria.map(c => (
                <div key={c.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{c.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>%{c.mine}</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>/ %{c.teamAvg} {t.avg}</span>
                      <DeltaBadge delta={c.delta} lang={lang} />
                    </div>
                  </div>
                  <div style={{ position: "relative", height: 5, background: "#1e2535", borderRadius: 99 }}>
                    <div style={{ width: `${Math.min(c.mine, 100)}%`, height: "100%", background: color + "88", borderRadius: 99 }} />
                    <div style={{ position: "absolute", top: -2, left: `${Math.min(c.teamAvg, 100)}%`, width: 2, height: 9, background: "#475569", borderRadius: 2, transform: "translateX(-50%)" }} />
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

export default function PeerComparisonView({ agentId, lang = "tr" }: { agentId: string; lang?: Lang }) {
  const [data, setData] = useState<PeerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [preset, setPreset] = useState<Preset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const t = T[lang];

  const fetchData = useCallback(() => {
    if (preset === "custom" && (!customStart || !customEnd)) return;
    const { startDate, endDate } = getDateRange(preset, customStart, customEnd);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    fetch(`/api/scores/peer?${params}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(err => { if (err.name !== "AbortError") { setData(null); setError(true); } })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [agentId, preset, customStart, customEnd]);

  useEffect(() => { const abort = fetchData(); return abort; }, [fetchData]);

  const filterBar = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
        {PRESETS.map(p => (
          <button key={p} onClick={() => setPreset(p)} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: preset === p ? "1px solid #6366f1" : "1px solid #1e2535", background: preset === p ? "rgba(99,102,241,.18)" : "rgba(255,255,255,.04)", color: preset === p ? "#a5b4fc" : "#64748b", transition: "all 0.15s" }}>
            {PRESET_LABELS[lang][p]}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 8, border: "1px solid #1e2535", background: "#0f1420", color: "#94a3b8", outline: "none" }} />
          <span style={{ fontSize: 11, color: "#334155" }}>–</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 8, border: "1px solid #1e2535", background: "#0f1420", color: "#94a3b8", outline: "none" }} />
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 className="font-headline text-3xl font-bold text-white">{t.title}</h1>
          {filterBar}
        </div>
        <div className="py-16 flex justify-center">
          <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="font-headline text-3xl font-bold text-white">{t.title}</h1>
            <p className="text-sm text-slate-400 mt-1">{t.subtitleTeam}</p>
          </div>
          {filterBar}
        </div>
        <div style={{ background: "#131723", border: "1px solid #1e2535", borderRadius: 14, padding: "32px 24px", textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, color: "#334155", display: "block", marginBottom: 12 }}>bar_chart</span>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 6 }}>
            {error ? t.errorMsg : t.noEvalMsg}
          </p>
          <p style={{ fontSize: 12, color: "#334155" }}>
            {error ? t.errorHint : t.noEvalHint}
          </p>
        </div>
      </div>
    );
  }

  const { mine, team, hasTeam } = data;
  const overallDelta = team ? mine.overallAvg - team.overallAvg : null;
  const criteriaForSection = (s: "A" | "B" | "C") => mine.criteriaBreakdown.filter(c => c.section === s);
  const callCountDelta = team ? mine.callCount - team.callCountAvg : null;
  const callBarMine = team && team.callCountAvg > 0 ? Math.min((mine.callCount / (team.callCountAvg * 2)) * 100, 100) : 50;

  return (
    <div className="space-y-6 max-w-2xl">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="font-headline text-3xl font-bold text-white">{t.title}</h1>
          <p className="text-sm text-slate-400 mt-1">{hasTeam ? t.subtitleTeam : t.subtitleSolo}</p>
        </div>
        {filterBar}
      </div>

      {!hasTeam && (
        <div style={{ background: "#131723", border: "1px solid #1e2535", borderRadius: 14, padding: "14px 16px", fontSize: 13, color: "#64748b" }}>
          {t.noTeam}
        </div>
      )}

      {/* Summary banner */}
      <div className="bg-surface-container rounded-3xl p-6 flex items-center gap-5">
        <div style={{ fontSize: 48, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}>%{mine.overallAvg}</div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.5px", marginBottom: 4 }}>
            {t.overallScore}
          </div>
          {overallDelta !== null && <DeltaBadge delta={overallDelta} variant="large" lang={lang} />}
          {team && (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
              {t.teamAvg} <span style={{ color: "#94a3b8" }}>%{team.overallAvg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section cards */}
      {mine.sectionAvg && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#334155", marginBottom: 8 }}>
            {t.sectionTitle}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["A", "B", "C"] as const).map(s => (
              <SectionCard key={s} section={s} mine={mine.sectionAvg![s]} team={team?.sectionAvg?.[s] ?? null} criteria={criteriaForSection(s)} lang={lang} />
            ))}
          </div>
        </div>
      )}

      {/* Call count */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#334155", marginBottom: 8 }}>
          {t.evalCount}
        </div>
        <div className="bg-surface-container rounded-2xl p-5">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{t.totalEvals}</span>
            {callCountDelta !== null && <DeltaBadge delta={callCountDelta} lang={lang} />}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: "#22d3ee" }}>{mine.callCount}</div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 3, fontWeight: 600, letterSpacing: "0.3px" }}>{t.you}</div>
            </div>
            {team && (
              <>
                <div style={{ width: 1, height: 28, background: "#1e2535" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: "#475569" }}>{team.callCountAvg}</div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 3, fontWeight: 600, letterSpacing: "0.3px" }}>{t.teamAvgShort}</div>
                </div>
              </>
            )}
          </div>
          {team && <RefBar mine={callBarMine} teamAvg={50} color="#22d3ee" avgLabel={t.avg} />}
        </div>
      </div>
    </div>
  );
}
