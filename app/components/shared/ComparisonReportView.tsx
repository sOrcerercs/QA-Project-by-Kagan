"use client";

import { useState, useEffect, useCallback } from "react";
import ConsultantMultiSelect from "@/app/components/shared/ConsultantMultiSelect";
import DateRangePicker from "@/app/components/shared/DateRangePicker";
import { translations } from "@/app/lib/i18n";
import { downloadComparisonPdf } from "@/app/lib/reportExport";

interface Props { userRole?: string; lang?: "tr" | "en" }
type Mode = "delta" | "trend";
interface Bucket { label: string; start: string; end: string; data: any }
interface Result { mode: Mode; periods: Bucket[] }

const pct = (cur: number, prev: number): string => {
  if (prev === 0) return cur === 0 ? "0%" : "+∞";
  const d = Math.round(((cur - prev) / prev) * 100);
  return `${d > 0 ? "+" : ""}${d}%`;
};
const deltaColor = (cur: number, prev: number) =>
  cur > prev ? "#34d399" : cur < prev ? "#f87171" : "var(--fg-dim)";

const card: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--rule)",
  borderRadius: 14,
  padding: 16,
};
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 10.5,
  color: "var(--fg-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 12.5,
  color: "var(--fg)",
  borderTop: "1px solid var(--rule)",
};
const tdR: React.CSSProperties = { ...td, textAlign: "right" };

const sectionHeading: React.CSSProperties = {
  fontSize: 11,
  color: "var(--fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "0 0 10px 2px",
  fontFamily: "'JetBrains Mono', monospace",
};

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function lastMonth(): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Delta View ────────────────────────────────────────────────────────────

function DeltaView({ result, t }: { result: Result; t: any }) {
  const [cur, prev] = result.periods;
  const lang = (t === translations["tr"] ? "tr" : "en") as "tr" | "en";

  const heading = (tr: string, en: string) => (
    <p style={sectionHeading}>{lang === "tr" ? tr : en}</p>
  );

  // ── 1. Summary ──────────────────────────────────────────────────────────
  const cs = cur.data.summary;
  const ps = prev?.data?.summary ?? { totalEvaluations: 0, totalSecondCalls: 0, avgScore: 0, highPotential: 0, atRisk: 0 };
  const summaryRows: { label: string; c: number; p: number; fmtC?: string; fmtP?: string }[] = [
    { label: t.totalEval, c: cs.totalEvaluations, p: ps.totalEvaluations },
    { label: lang === "tr" ? "2. Çağrı" : "Second Call", c: cs.totalSecondCalls, p: ps.totalSecondCalls },
    { label: t.avgScoreLbl, c: cs.avgScore, p: ps.avgScore, fmtC: `%${cs.avgScore}`, fmtP: `%${ps.avgScore}` },
    { label: t.highPotential, c: cs.highPotential, p: ps.highPotential },
    { label: t.atRisk, c: cs.atRisk, p: ps.atRisk },
  ];

  // ── 2. Consultant Performance ───────────────────────────────────────────
  const prevCpMap = new Map<string, any>();
  (prev?.data?.consultantPerformance ?? []).forEach((r: any) => prevCpMap.set(r.agentId, r));
  const curCp: any[] = cur.data.consultantPerformance ?? [];
  const cpRows = [...curCp]
    .sort((a, b) => b.healthScore - a.healthScore)
    .map((r) => {
      const p2 = prevCpMap.get(r.agentId);
      const prevScore = p2 ? p2.healthScore : 0;
      return { name: r.name, curScore: r.healthScore, prevScore };
    });
  // Include prev-only rows (absent in cur)
  const curCpIds = new Set(curCp.map((r: any) => r.agentId));
  (prev?.data?.consultantPerformance ?? []).forEach((r: any) => {
    if (!curCpIds.has(r.agentId)) {
      cpRows.push({ name: r.name, curScore: 0, prevScore: r.healthScore });
    }
  });

  // ── 3. Call Durations ───────────────────────────────────────────────────
  const prevDurMap = new Map<string, any>();
  (prev?.data?.callDurations ?? []).forEach((r: any) => prevDurMap.set(r.name, r));
  const curDur: any[] = cur.data.callDurations ?? [];
  const durRows = curDur.map((r) => {
    const p2 = prevDurMap.get(r.name);
    return { name: r.name, curCalls: r.calls, prevCalls: p2 ? p2.calls : 0, curAvg: r.avgDuration, prevAvg: p2 ? p2.avgDuration : "—" };
  });
  const curDurNames = new Set(curDur.map((r: any) => r.name));
  (prev?.data?.callDurations ?? []).forEach((r: any) => {
    if (!curDurNames.has(r.name)) {
      durRows.push({ name: r.name, curCalls: 0, prevCalls: r.calls, curAvg: "—", prevAvg: r.avgDuration });
    }
  });

  // ── 4. Team Distribution ────────────────────────────────────────────────
  const prevTeamMap = new Map<string, any>();
  (prev?.data?.teamDistribution ?? []).forEach((r: any) => prevTeamMap.set(r.team, r));
  const curTeam: any[] = cur.data.teamDistribution ?? [];
  const teamRows = curTeam.map((r) => {
    const p2 = prevTeamMap.get(r.team);
    return { team: r.team, curTotal: r.totalCalls, prevTotal: p2 ? p2.totalCalls : 0 };
  });
  const curTeamNames = new Set(curTeam.map((r: any) => r.team));
  (prev?.data?.teamDistribution ?? []).forEach((r: any) => {
    if (!curTeamNames.has(r.team)) {
      teamRows.push({ team: r.team, curTotal: 0, prevTotal: r.totalCalls });
    }
  });

  // ── 5. Consultant Call Distribution ────────────────────────────────────
  const prevCcdMap = new Map<string, any>();
  (prev?.data?.consultantCallDistribution ?? []).forEach((r: any) => prevCcdMap.set(r.name, r));
  const curCcd: any[] = cur.data.consultantCallDistribution ?? [];
  const ccdRows = curCcd.map((r) => {
    const p2 = prevCcdMap.get(r.name);
    return { name: r.name, curTotal: r.totalCalls, prevTotal: p2 ? p2.totalCalls : 0 };
  });
  const curCcdNames = new Set(curCcd.map((r: any) => r.name));
  (prev?.data?.consultantCallDistribution ?? []).forEach((r: any) => {
    if (!curCcdNames.has(r.name)) {
      ccdRows.push({ name: r.name, curTotal: 0, prevTotal: r.totalCalls });
    }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. Summary */}
      <div style={card}>
        {heading("Özet", "Summary")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>{lang === "tr" ? "Metrik" : "Metric"}</th>
              <th style={thR}>{cur.label}</th>
              <th style={thR}>{prev?.label ?? t.cmpPrevious}</th>
              <th style={thR}>{t.cmpDelta}</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => (
              <tr key={row.label}>
                <td style={td}>{row.label}</td>
                <td style={tdR}>{row.fmtC ?? row.c}</td>
                <td style={tdR}>{row.fmtP ?? row.p}</td>
                <td style={{ ...tdR, color: deltaColor(row.c, row.p), fontFamily: "'JetBrains Mono', monospace" }}>
                  {pct(row.c, row.p)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. Consultant Performance */}
      {cpRows.length > 0 && (
        <div style={card}>
          {heading("Danışman Performansı", "Consultant Performance")}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t.consultant}</th>
                <th style={thR}>{cur.label}</th>
                <th style={thR}>{prev?.label ?? t.cmpPrevious}</th>
                <th style={thR}>{t.cmpDelta}</th>
              </tr>
            </thead>
            <tbody>
              {cpRows.map((row) => (
                <tr key={row.name}>
                  <td style={td}>{row.name}</td>
                  <td style={tdR}>{row.curScore > 0 ? `%${row.curScore}` : "—"}</td>
                  <td style={tdR}>{row.prevScore > 0 ? `%${row.prevScore}` : "—"}</td>
                  <td style={{ ...tdR, color: deltaColor(row.curScore, row.prevScore), fontFamily: "'JetBrains Mono', monospace" }}>
                    {pct(row.curScore, row.prevScore)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Call Durations */}
      {durRows.length > 0 && (
        <div style={card}>
          {heading("Çağrı Süreleri", "Call Durations")}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t.consultant}</th>
                <th style={thR}>{cur.label} {t.callsCol}</th>
                <th style={thR}>{prev?.label ?? t.cmpPrevious} {t.callsCol}</th>
                <th style={thR}>{t.cmpDelta}</th>
                <th style={thR}>{cur.label} {t.avgDurationCol}</th>
                <th style={thR}>{prev?.label ?? t.cmpPrevious} {t.avgDurationCol}</th>
              </tr>
            </thead>
            <tbody>
              {durRows.map((row) => (
                <tr key={row.name}>
                  <td style={td}>{row.name}</td>
                  <td style={tdR}>{row.curCalls}</td>
                  <td style={tdR}>{row.prevCalls}</td>
                  <td style={{ ...tdR, color: deltaColor(row.curCalls, row.prevCalls), fontFamily: "'JetBrains Mono', monospace" }}>
                    {pct(row.curCalls, row.prevCalls)}
                  </td>
                  <td style={tdR}>{row.curAvg}</td>
                  <td style={tdR}>{row.prevAvg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Team Distribution */}
      {teamRows.length > 0 && (
        <div style={card}>
          {heading("Takım Dağılımı", "Team Distribution")}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t.teamCol}</th>
                <th style={thR}>{cur.label}</th>
                <th style={thR}>{prev?.label ?? t.cmpPrevious}</th>
                <th style={thR}>{t.cmpDelta}</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((row) => (
                <tr key={row.team}>
                  <td style={td}>{row.team}</td>
                  <td style={tdR}>{row.curTotal}</td>
                  <td style={tdR}>{row.prevTotal}</td>
                  <td style={{ ...tdR, color: deltaColor(row.curTotal, row.prevTotal), fontFamily: "'JetBrains Mono', monospace" }}>
                    {pct(row.curTotal, row.prevTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Consultant Call Distribution */}
      {ccdRows.length > 0 && (
        <div style={card}>
          {heading("Çağrı Dağılımı", "Call Distribution")}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t.consultant}</th>
                <th style={thR}>{cur.label}</th>
                <th style={thR}>{prev?.label ?? t.cmpPrevious}</th>
                <th style={thR}>{t.cmpDelta}</th>
              </tr>
            </thead>
            <tbody>
              {ccdRows.map((row) => (
                <tr key={row.name}>
                  <td style={td}>{row.name}</td>
                  <td style={tdR}>{row.curTotal}</td>
                  <td style={tdR}>{row.prevTotal}</td>
                  <td style={{ ...tdR, color: deltaColor(row.curTotal, row.prevTotal), fontFamily: "'JetBrains Mono', monospace" }}>
                    {pct(row.curTotal, row.prevTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Trend View ────────────────────────────────────────────────────────────

function TrendView({ result, t }: { result: Result; t: any }) {
  const periods = result.periods;
  const lang = (t === translations["tr"] ? "tr" : "en") as "tr" | "en";

  const heading = (tr: string, en: string) => (
    <p style={sectionHeading}>{lang === "tr" ? tr : en}</p>
  );

  const periodHeaders = periods.map((p) => (
    <th key={p.label} style={thR}>{p.label}</th>
  ));

  // ── 1. Summary (avgScore + totalEvaluations) ────────────────────────────
  const summaryMetrics = [
    {
      label: t.avgScoreLbl,
      vals: periods.map((p) => `%${p.data.summary?.avgScore ?? 0}`),
    },
    {
      label: t.totalEval,
      vals: periods.map((p) => String(p.data.summary?.totalEvaluations ?? 0)),
    },
  ];

  // ── 2. Consultant Performance ───────────────────────────────────────────
  // Build union of all names across all periods
  const cpNameSet = new Set<string>();
  periods.forEach((p) =>
    (p.data.consultantPerformance ?? []).forEach((r: any) => cpNameSet.add(r.name))
  );
  const cpNames = Array.from(cpNameSet);
  const cpRowsData = cpNames.map((name) => ({
    name,
    vals: periods.map((p) => {
      const found = (p.data.consultantPerformance ?? []).find((r: any) => r.name === name);
      return found ? `%${found.healthScore}` : "—";
    }),
  }));

  // ── 3. Team Distribution ────────────────────────────────────────────────
  const teamNameSet = new Set<string>();
  periods.forEach((p) =>
    (p.data.teamDistribution ?? []).forEach((r: any) => teamNameSet.add(r.team))
  );
  const teamNames = Array.from(teamNameSet);
  const teamRowsData = teamNames.map((team) => ({
    name: team,
    vals: periods.map((p) => {
      const found = (p.data.teamDistribution ?? []).find((r: any) => r.team === team);
      return found ? String(found.totalCalls) : "—";
    }),
  }));

  // ── 4. Consultant Call Distribution ────────────────────────────────────
  const ccdNameSet = new Set<string>();
  periods.forEach((p) =>
    (p.data.consultantCallDistribution ?? []).forEach((r: any) => ccdNameSet.add(r.name))
  );
  const ccdNames = Array.from(ccdNameSet);
  const ccdRowsData = ccdNames.map((name) => ({
    name,
    vals: periods.map((p) => {
      const found = (p.data.consultantCallDistribution ?? []).find((r: any) => r.name === name);
      return found ? String(found.totalCalls) : "—";
    }),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. Summary */}
      <div style={card}>
        {heading("Özet", "Summary")}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>{lang === "tr" ? "Metrik" : "Metric"}</th>
              {periodHeaders}
            </tr>
          </thead>
          <tbody>
            {summaryMetrics.map((row) => (
              <tr key={row.label}>
                <td style={td}>{row.label}</td>
                {row.vals.map((v, i) => (
                  <td key={i} style={tdR}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. Consultant Performance */}
      {cpRowsData.length > 0 && (
        <div style={card}>
          {heading("Danışman Performansı", "Consultant Performance")}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t.consultant}</th>
                {periodHeaders}
              </tr>
            </thead>
            <tbody>
              {cpRowsData.map((row) => (
                <tr key={row.name}>
                  <td style={td}>{row.name}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} style={tdR}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Team Distribution */}
      {teamRowsData.length > 0 && (
        <div style={card}>
          {heading("Takım Dağılımı", "Team Distribution")}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t.teamCol}</th>
                {periodHeaders}
              </tr>
            </thead>
            <tbody>
              {teamRowsData.map((row) => (
                <tr key={row.name}>
                  <td style={td}>{row.name}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} style={tdR}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Consultant Call Distribution */}
      {ccdRowsData.length > 0 && (
        <div style={card}>
          {heading("Çağrı Dağılımı", "Call Distribution")}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t.consultant}</th>
                {periodHeaders}
              </tr>
            </thead>
            <tbody>
              {ccdRowsData.map((row) => (
                <tr key={row.name}>
                  <td style={td}>{row.name}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} style={tdR}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────

export default function ComparisonReportView({ userRole, lang = "tr" }: Props) {
  const t: any = translations[lang];
  const [mode, setMode] = useState<Mode>("delta");
  const [months, setMonths] = useState<3 | 6>(3);
  const [monthParam, setMonthParam] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const showFilter =
    userRole === "ADMIN" || userRole === "MANAGER" || userRole === "TEAM_LEADER";

  useEffect(() => {
    if (!showFilter) return;
    const url =
      userRole === "ADMIN" || userRole === "MANAGER"
        ? "/api/users"
        : "/api/team/members";
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const list = (d.users || d.members || [])
          .filter((u: any) =>
            userRole === "ADMIN" || userRole === "MANAGER"
              ? ["AGENT", "TEAM_LEADER"].includes(u.role)
              : true
          )
          .map((u: any) => ({ id: u.id, name: u.name }));
        setAgents(list);
      })
      .catch(() => {});
  }, [userRole, showFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ mode, lang });
      if (selectedAgentIds.length) p.set("agentIds", selectedAgentIds.join(","));
      if (mode === "trend") p.set("months", String(months));
      else {
        if (monthParam) p.set("month", monthParam);
        else {
          if (startDate) p.set("start", startDate);
          if (endDate) p.set("end", endDate);
        }
      }
      const res = await fetch(`/api/reports/comparison?${p}`);
      if (!res.ok) return;
      if (!(res.headers.get("content-type") || "").includes("application/json")) return;
      setResult(await res.json());
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, [mode, months, monthParam, startDate, endDate, selectedAgentIds, lang]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 8,
    border: active ? "1px solid var(--accent)" : "1px solid var(--rule)",
    background: active
      ? "rgba(var(--accent-rgb, 59,130,246),.15)"
      : "transparent",
    color: active ? "var(--accent)" : "var(--fg-dim)",
    fontSize: 11.5,
    fontFamily: "'JetBrains Mono', monospace",
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Mode Toggle */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={pill(mode === "delta")} onClick={() => setMode("delta")}>
          {t.cmpModeDelta}
        </button>
        <button style={pill(mode === "trend")} onClick={() => setMode("trend")}>
          {t.cmpModeTrend}
        </button>
      </div>

      {/* Period / Range Selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {mode === "trend" ? (
          <>
            <button style={pill(months === 3)} onClick={() => setMonths(3)}>
              {t.cmpLast3}
            </button>
            <button style={pill(months === 6)} onClick={() => setMonths(6)}>
              {t.cmpLast6}
            </button>
          </>
        ) : (
          <>
            <button
              style={pill(monthParam === thisMonth())}
              onClick={() => {
                setMonthParam(thisMonth());
                setStartDate("");
                setEndDate("");
              }}
            >
              {t.cmpThisMonth}
            </button>
            <button
              style={pill(monthParam === lastMonth())}
              onClick={() => {
                setMonthParam(lastMonth());
                setStartDate("");
                setEndDate("");
              }}
            >
              {t.cmpLastMonth}
            </button>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartChange={(v: string) => {
                setStartDate(v);
                setMonthParam("");
              }}
              onEndChange={(v: string) => {
                setEndDate(v);
                setMonthParam("");
              }}
              onApply={fetchData}
              lang={lang}
            />
          </>
        )}
        {showFilter && agents.length > 0 && (
          <ConsultantMultiSelect
            agents={agents}
            selectedIds={selectedAgentIds}
            onChange={setSelectedAgentIds}
            lang={lang}
          />
        )}
        {result && (
          <button
            style={pill(false)}
            onClick={() => { downloadComparisonPdf(result, lang); }}
          >
            {t.cmpDownloadPdf}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", padding: 40 }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              border: "2px solid rgba(255,255,255,.1)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      ) : result ? (
        result.mode === "delta" ? (
          <DeltaView result={result} t={t} />
        ) : (
          <TrendView result={result} t={t} />
        )
      ) : null}
    </div>
  );
}
