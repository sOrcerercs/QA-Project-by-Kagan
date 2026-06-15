"use client";

import { useState, useEffect, useCallback } from "react";
import EvaluationList from "@/app/components/shared/EvaluationList";
import ConsultantMultiSelect from "@/app/components/shared/ConsultantMultiSelect";
import {
  buildEvaluationHtml,
  downloadPdf,
  downloadDoc,
  downloadAllZip,
  groupByAgent,
  slugifyFilename,
  type ExportEvaluation,
} from "@/app/lib/evaluationExport";

type Preset = "all" | "week" | "month" | "3m" | "custom";

interface Evaluation {
  id: string;
  score: number;
  customerName: string;
  callDuration: string;
  callDate: string;
  createdAt: string;
  callType?: string;
  report: string;
  agent?: { name: string };
}

interface EvaluationsViewProps {
  showAgent?: boolean;
  lang?: "tr" | "en";
  // ADMIN-only: bulk/row delete + selection checkboxes (backend restricts DELETE to ADMIN).
  isAdmin?: boolean;
  // ADMIN or MANAGER: consultant filter + downloads (backend GET allows both full access).
  canFilter?: boolean;
  // Viewer role — TEAM_LEADER also gets the consultant filter, scoped to their team.
  userRole?: string;
}

function presetToDates(preset: Preset): { startDate: string; endDate: string } | null {
  if (preset === "all" || preset === "custom") return null;
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now);
  if (preset === "week") start.setDate(start.getDate() - 7);
  else if (preset === "month") start.setMonth(start.getMonth() - 1);
  else if (preset === "3m") start.setMonth(start.getMonth() - 3);
  return { startDate: start.toISOString().split("T")[0], endDate: end };
}

const PRESETS_TR: { key: Preset; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
  { key: "3m", label: "Son 3 Ay" },
  { key: "custom", label: "Özel" },
];

const PRESETS_EN: { key: Preset; label: string }[] = [
  { key: "all", label: "All" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "3m", label: "Last 3 Months" },
  { key: "custom", label: "Custom" },
];

export default function EvaluationsView({ showAgent = true, lang = "tr", isAdmin = false, canFilter = false, userRole }: EvaluationsViewProps) {
  // ADMIN/MANAGER (canFilter) see all consultants; TEAM_LEADER sees their team only.
  const showFilter = canFilter || userRole === "TEAM_LEADER";
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [currentRange, setCurrentRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [downloading, setDownloading] = useState(false);

  const fetchEvaluations = useCallback(async (startDate?: string, endDate?: string, agentIds?: string[]) => {
    setLoading(true);
    setCurrentRange({ startDate, endDate });
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (agentIds && agentIds.length) params.set("agentIds", agentIds.join(","));
    const qs = params.toString();
    try {
      const res = await fetch(`/api/evaluations${qs ? `?${qs}` : ""}`);
      if (res.ok) setEvaluations((await res.json()).evaluations || []);
    } catch {
      // network error — leave existing list in place
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvaluations();
    if (!showFilter) return;
    // ADMIN/MANAGER pull every consultant; TEAM_LEADER pulls only their team.
    const url = canFilter ? "/api/users" : "/api/team/members";
    fetch(url)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        const list = (d.users || d.members || [])
          // For ADMIN/MANAGER keep evaluatable roles; /api/team/members is already team-scoped.
          .filter((u: any) => (canFilter ? ["AGENT", "TEAM_LEADER", "MANAGER"].includes(u.role) : true))
          .map((u: any) => ({ id: u.id, name: u.name }));
        setAgents(list);
      })
      .catch(() => {
        // agents list unavailable — consultant selector simply won't render
      });
  }, [fetchEvaluations, showFilter, canFilter]);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p === "custom") return;
    const dates = presetToDates(p);
    fetchEvaluations(dates?.startDate, dates?.endDate, selectedAgentIds);
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd || customStart > customEnd) return;
    fetchEvaluations(customStart, customEnd, selectedAgentIds);
  };

  const handleAgentsChange = (ids: string[]) => {
    setSelectedAgentIds(ids);
    fetchEvaluations(currentRange.startDate, currentRange.endDate, ids);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteOne = async (id: string) => {
    if (!window.confirm(lang === "tr" ? "Bu değerlendirmeyi silmek istediğinizden emin misiniz?" : "Are you sure you want to delete this evaluation?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/evaluations/${id}`, { method: "DELETE" });
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      await fetchEvaluations();
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(lang === "tr" ? `${selectedIds.size} değerlendirme silinecek. Emin misiniz?` : `${selectedIds.size} evaluations will be deleted. Are you sure?`)) return;
    setDeleting(true);
    try {
      await fetch("/api/evaluations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selectedIds] }) });
      setSelectedIds(new Set());
      await fetchEvaluations();
    } finally {
      setDeleting(false);
    }
  };

  const handleReassignOne = async (evalId: string, agentId: string) => {
    await fetch(`/api/evaluations/${evalId}/reassign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    await fetchEvaluations();
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(lang === "tr" ? "TÜM değerlendirmeler silinecek. Bu işlem geri alınamaz. Emin misiniz?" : "ALL evaluations will be deleted. This cannot be undone. Are you sure?")) return;
    setDeleting(true);
    try {
      await fetch("/api/evaluations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      setSelectedIds(new Set());
      await fetchEvaluations();
    } finally {
      setDeleting(false);
    }
  };

  const selectedAgentName =
    (selectedAgentIds.length === 1 ? agents.find((a) => a.id === selectedAgentIds[0])?.name : undefined) ??
    (lang === "tr" ? "Danışman" : "Consultant");

  const buildFilename = (name: string) => {
    const r =
      currentRange.startDate || currentRange.endDate
        ? `_${currentRange.startDate ?? ""}_${currentRange.endDate ?? ""}`
        : "";
    return `${slugifyFilename(name)}_degerlendirmeler${r}`;
  };

  const handleDownloadPdf = async () => {
    if (!evaluations.length) return;
    setDownloading(true);
    try {
      await downloadPdf(selectedAgentName, evaluations as ExportEvaluation[], currentRange, lang, buildFilename(selectedAgentName));
    } catch {
      alert(lang === "tr" ? "İndirme başarısız." : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadDoc = () => {
    if (!evaluations.length) return;
    const html = buildEvaluationHtml(selectedAgentName, evaluations as ExportEvaluation[], currentRange, lang);
    downloadDoc(html, buildFilename(selectedAgentName));
  };

  const handleDownloadZip = async () => {
    if (!evaluations.length) {
      alert(lang === "tr" ? "İndirilecek değerlendirme yok." : "No evaluations to download.");
      return;
    }
    setDownloading(true);
    try {
      const groups = groupByAgent(evaluations as ExportEvaluation[]);
      const zipDate = new Date().toISOString().split("T")[0];
      const { skipped } = await downloadAllZip(groups, currentRange, lang, zipDate);
      if (skipped.length) {
        alert((lang === "tr" ? "Atlanan danışmanlar: " : "Skipped consultants: ") + skipped.join(", "));
      }
    } catch {
      alert(lang === "tr" ? "İndirme başarısız." : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const presets = lang === "tr" ? PRESETS_TR : PRESETS_EN;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isAdmin && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0 || deleting}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #f87171",
              background: selectedIds.size > 0 ? "rgba(248,113,113,.15)" : "transparent",
              color: selectedIds.size > 0 ? "#f87171" : "var(--fg-faint)",
              fontSize: 11.5,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: selectedIds.size > 0 ? "pointer" : "not-allowed",
              opacity: deleting ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            {lang === "tr" ? `Seçilenleri Sil${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}` : `Delete Selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={deleting}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #f87171",
              background: "rgba(248,113,113,.1)",
              color: "#f87171",
              fontSize: 11.5,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
              opacity: deleting ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {lang === "tr" ? "Tümünü Sil" : "Delete All"}
          </button>
        </div>
      )}

      {showFilter && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {agents.length > 0 && (
            <ConsultantMultiSelect
              agents={agents}
              selectedIds={selectedAgentIds}
              onChange={handleAgentsChange}
              lang={lang}
            />
          )}
          {selectedAgentIds.length === 1 && (
            <>
              <button
                onClick={handleDownloadPdf}
                disabled={downloading || evaluations.length === 0}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--accent)", background: "rgba(var(--accent-rgb, 59,130,246),.15)", color: "var(--accent)", fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", opacity: downloading || evaluations.length === 0 ? 0.4 : 1, transition: "opacity 0.15s" }}
              >
                {lang === "tr" ? "PDF İndir" : "Download PDF"}
              </button>
              <button
                onClick={handleDownloadDoc}
                disabled={downloading || evaluations.length === 0}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--accent)", background: "rgba(var(--accent-rgb, 59,130,246),.15)", color: "var(--accent)", fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", opacity: downloading || evaluations.length === 0 ? 0.4 : 1, transition: "opacity 0.15s" }}
              >
                {lang === "tr" ? "Word İndir" : "Download Word"}
              </button>
            </>
          )}
          {selectedAgentIds.length !== 1 && (
            <button
              onClick={handleDownloadZip}
              disabled={downloading}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--rule)", background: "transparent", color: "var(--fg-dim)", fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", opacity: downloading ? 0.4 : 1, transition: "opacity 0.15s" }}
            >
              {downloading
                ? lang === "tr" ? "Hazırlanıyor…" : "Preparing…"
                : selectedAgentIds.length === 0
                ? lang === "tr" ? "Tümünü İndir (ZIP)" : "Download All (ZIP)"
                : lang === "tr" ? "Seçilenleri İndir (ZIP)" : "Download Selected (ZIP)"}
            </button>
          )}
        </div>
      )}

      {/* Preset pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {presets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: preset === key ? "1px solid var(--accent)" : "1px solid var(--rule)",
              background: preset === key ? "rgba(var(--accent-rgb, 59,130,246),.15)" : "transparent",
              color: preset === key ? "var(--accent)" : "var(--fg-dim)",
              fontSize: 11.5,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.06em",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s, background 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date inputs — visible only when "custom" preset is active */}
      {preset === "custom" && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {lang === "tr" ? "Başlangıç" : "Start"}
            </label>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--rule)",
                borderRadius: 8,
                padding: "6px 12px",
                color: "var(--fg)",
                fontSize: 12,
                outline: "none",
                colorScheme: "dark",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {lang === "tr" ? "Bitiş" : "End"}
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--rule)",
                borderRadius: 8,
                padding: "6px 12px",
                color: "var(--fg)",
                fontSize: 12,
                outline: "none",
                colorScheme: "dark",
              }}
            />
          </div>
          <button
            onClick={handleApplyCustom}
            disabled={!customStart || !customEnd || customStart > customEnd}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              border: "1px solid var(--accent)",
              background: "rgba(var(--accent-rgb, 59,130,246),.15)",
              color: "var(--accent)",
              fontSize: 11.5,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
              opacity: (!customStart || !customEnd || customStart > customEnd) ? 0.4 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {lang === "tr" ? "Uygula" : "Apply"}
          </button>
        </div>
      )}

      {/* List or spinner */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{
            width: 20, height: 20,
            border: "2px solid rgba(255,255,255,.1)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
        </div>
      ) : (
        <EvaluationList
          evaluations={evaluations}
          showAgent={showAgent}
          lang={lang}
          isAdmin={isAdmin}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onDeleteOne={handleDeleteOne}
          agents={agents}
          onReassignOne={handleReassignOne}
        />
      )}
    </div>
  );
}
