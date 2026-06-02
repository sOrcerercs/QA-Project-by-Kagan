"use client";

import { useState, useEffect, useCallback } from "react";
import WeeklyEvaluationReport from "@/components/WeeklyEvaluationReport";
import MIcon from "@/app/components/shared/MIcon";
import DateRangePicker from "@/app/components/shared/DateRangePicker";
import { translations } from "@/app/lib/i18n";

interface ReportsViewProps {
  agentId?: string;
  userRole?: string;
  lang?: "tr" | "en";
}

export default function ReportsView({ agentId, userRole, lang = "tr" }: ReportsViewProps) {
  const t = translations[lang];
  const [autoReportData, setAutoReportData] = useState<any>(null);
  const [autoReportPeriod, setAutoReportPeriod] = useState<any>(null);
  const [autoReportIsDemo, setAutoReportIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [filterAgentId, setFilterAgentId] = useState("");

  const showConsultantFilter = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "TEAM_LEADER";

  useEffect(() => {
    if (!showConsultantFilter) return;
    const url = (userRole === "ADMIN" || userRole === "MANAGER") ? "/api/users" : "/api/team/members";
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const list = (d.users || d.members || [])
          .filter((u: any) => (userRole === "ADMIN" || userRole === "MANAGER") ? u.role === "AGENT" : true)
          .map((u: any) => ({ id: u.id, name: u.name }));
        setAgents(list);
      })
      .catch(() => {});
  }, [userRole, showConsultantFilter]);

  const fetchReport = useCallback(async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      const effectiveAgentId = agentId ?? (filterAgentId || undefined);
      if (effectiveAgentId) params.set("agentId", effectiveAgentId);
      const url = `/api/reports/auto${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        setAutoReportData(result.data);
        setAutoReportPeriod(result.period);
        setAutoReportIsDemo(result.isDemo || false);
      }
    } finally { setLoading(false); }
  }, [agentId, filterAgentId]);

  useEffect(() => { fetchReport(startDate || undefined, endDate || undefined); }, [fetchReport]);

  return (
    <div>
      <div style={{ borderRadius: 20, padding: "20px 24px", marginBottom: 20, background: "var(--glass-bg)", border: "1px solid var(--rule)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", display: "flex", alignItems: "center", gap: 8 }}>
              {startDate || endDate ? t.customDateRange : t.last7Days} — {t.haftalikRapor}
              {autoReportIsDemo && (
                <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 9, fontWeight: 700, background: "rgba(245,158,11,.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.3)" }}>
                  DEMO
                </span>
              )}
            </p>
            {autoReportPeriod && (
              <p style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 4 }}>
                {new Date(autoReportPeriod.start).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")} — {new Date(autoReportPeriod.end).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")}
              </p>
            )}
          </div>
          <button
            onClick={() => { setAutoReportData(null); setStartDate(""); setEndDate(""); fetchReport(); }}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-dim)", background: "none", border: "none", cursor: "pointer", transition: "color 120ms" }}
          >
            <MIcon name="refresh" className="text-lg" /> {t.refresh}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            onApply={() => { setAutoReportData(null); fetchReport(startDate || undefined, endDate || undefined); }}
            lang={lang}
          />
          {showConsultantFilter && agents.length > 0 && (
            <select
              value={filterAgentId}
              onChange={e => { setFilterAgentId(e.target.value); }}
              style={{ padding: "8px 12px", borderRadius: 10, background: "var(--glass-bg)", border: "1px solid var(--rule)", color: "var(--fg)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
            >
              <option value="">{t.allConsultants}</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
      </div>
      {loading ? (
        <div style={{ padding: "64px 0", textAlign: "center" }}>
          <div style={{ width: 20, height: 20, border: "2px solid var(--rule)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
        </div>
      ) : (
        <WeeklyEvaluationReport data={autoReportData} lang={lang} />
      )}
    </div>
  );
}
