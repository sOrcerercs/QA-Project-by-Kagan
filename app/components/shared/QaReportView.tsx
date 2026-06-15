"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { translations } from "@/app/lib/i18n";

interface Props { lang?: "tr" | "en" }
interface ReportMeta { id: string; reportDate: string; uploadedByName: string; createdAt: string; _count: { rows: number } }
interface Row {
  id: string; salesOwner: string | null; status: string | null; bookingDate: string | null; crmId: string | null;
  customerName: string | null; dealStage: string | null; contactType: string | null; contactMethod: string | null;
  recentNote: string | null; country: string | null; timeFrame: string | null;
  callRecord: boolean; matchedEvaluationId: string | null; manualOverride: boolean; qaNotes: string | null;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function QaReportView({ lang = "tr" }: Props) {
  const t: any = translations[lang];
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [reportDate, setReportDate] = useState<string>(todayStr());
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const loadReports = useCallback(async () => {
    const res = await fetch("/api/qa-reports");
    if (!res.ok) return;
    const d = await res.json();
    setReports(d.reports || []);
    setSelectedId(prev => prev ?? (d.reports?.[0]?.id ?? null));
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const loadRows = useCallback(async (id: string) => {
    const res = await fetch(`/api/qa-reports/${id}`);
    if (!res.ok) { setRows([]); return; }
    const d = await res.json();
    setRows(d.report?.rows || []);
    setNoteDraft({});
  }, []);

  useEffect(() => { if (selectedId) loadRows(selectedId); }, [selectedId, loadRows]);

  const handleUpload = async () => {
    if (!file) { setMsg(lang === "tr" ? "Dosya seçin." : "Choose a file."); return; }
    setUploading(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("reportDate", reportDate);
      const res = await fetch("/api/qa-reports", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(d.error || (lang === "tr" ? "Yükleme başarısız." : "Upload failed.")); return; }
      setMsg(lang === "tr" ? `Yüklendi: ${d.rowCount} satır.` : `Uploaded: ${d.rowCount} rows.`);
      setFile(null);
      await loadReports();
      setSelectedId(d.reportId);
    } finally { setUploading(false); }
  };

  const patchRow = async (rowId: string, body: { qaNotes?: string; callRecord?: boolean }) => {
    const res = await fetch(`/api/qa-reports/rows/${rowId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) { const d = await res.json(); setRows(prev => prev.map(r => r.id === rowId ? d.row : r)); }
  };

  const fmtDate = (s: string) => new Date(s).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR");

  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 10.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "8px 10px", fontSize: 12.5, color: "var(--fg)", borderTop: "1px solid var(--rule)", verticalAlign: "top" };
  const card: React.CSSProperties = { background: "var(--glass-bg)", border: "1px solid var(--rule)", borderRadius: 14, padding: 16 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
          style={{ background: "var(--glass-bg)", border: "1px solid var(--rule)", borderRadius: 8, padding: "6px 12px", color: "var(--fg)", fontSize: 12, colorScheme: "dark" }} />
        <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] ?? null)}
          style={{ fontSize: 12, color: "var(--fg-dim)" }} />
        <button onClick={handleUpload} disabled={uploading || !file}
          style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid var(--accent)", background: "rgba(var(--accent-rgb, 59,130,246),.15)", color: "var(--accent)", fontSize: 12, cursor: uploading || !file ? "not-allowed" : "pointer", opacity: uploading || !file ? 0.5 : 1 }}>
          {uploading ? t.qaUploading : t.qaUpload}
        </button>
        {msg && <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>{msg}</span>}
      </div>

      {reports.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>{t.qaNoReports}</p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {reports.map(r => (
            <button key={r.id} onClick={() => setSelectedId(r.id)}
              style={{ padding: "6px 12px", borderRadius: 8, border: selectedId === r.id ? "1px solid var(--accent)" : "1px solid var(--rule)", background: selectedId === r.id ? "rgba(var(--accent-rgb, 59,130,246),.15)" : "transparent", color: selectedId === r.id ? "var(--accent)" : "var(--fg-dim)", fontSize: 11.5, cursor: "pointer" }}>
              {fmtDate(r.reportDate)} · {r._count.rows}
            </button>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ ...card, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>{t.qaConsultant}</th>
                <th style={th}>{t.qaCustomer}</th>
                <th style={th}>{t.qaCallRecord}</th>
                <th style={th}>{t.qaNotes}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.salesOwner ?? "—"}</td>
                  <td style={td}>{r.customerName ?? "—"}</td>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => patchRow(r.id, { callRecord: !r.callRecord })}
                        title={r.manualOverride ? "manuel" : "otomatik"}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>
                        {r.callRecord ? "✅" : "❌"}
                      </button>
                      {r.matchedEvaluationId && (
                        <Link href={`/evaluation/${r.matchedEvaluationId}`} style={{ fontSize: 11, color: "var(--accent)" }}>{t.qaView}</Link>
                      )}
                    </div>
                  </td>
                  <td style={{ ...td, minWidth: 240 }}>
                    <textarea
                      value={noteDraft[r.id] ?? r.qaNotes ?? ""}
                      onChange={e => setNoteDraft(prev => ({ ...prev, [r.id]: e.target.value }))}
                      onBlur={() => { const v = noteDraft[r.id]; if (v !== undefined && v !== (r.qaNotes ?? "")) patchRow(r.id, { qaNotes: v }); }}
                      rows={2}
                      style={{ width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid var(--rule)", borderRadius: 6, padding: "6px 8px", color: "var(--fg)", fontSize: 12, fontFamily: "inherit", resize: "vertical" }}
                    />
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
