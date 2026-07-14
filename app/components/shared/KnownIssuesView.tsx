"use client";

import { useState, useEffect, useCallback, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { translations } from "@/app/lib/i18n";
import { KNOWN_ISSUE_STATUSES, type KnownIssueStatus } from "@/app/lib/knownIssues";

interface Issue {
  id: string;
  title: string;
  description: string;
  status: KnownIssueStatus;
  createdAt: string;
  updatedAt: string;
}
interface Props { lang?: "tr" | "en"; canEdit?: boolean; onReportProblem?: () => void }

const STATUS_STYLE: Record<KnownIssueStatus, CSSProperties> = {
  INVESTIGATING: { background: "rgba(234,179,8,0.15)", color: "#eab308", border: "1px solid rgba(234,179,8,0.4)" },
  IN_PROGRESS:   { background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.4)" },
  RESOLVED:      { background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.4)" },
};

const badgeBase: CSSProperties = {
  display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
};

interface IssueFormProps {
  form: { title: string; description: string; status: KnownIssueStatus };
  setForm: Dispatch<SetStateAction<{ title: string; description: string; status: KnownIssueStatus }>>;
  onSave: () => void;
  onCancel: () => void;
  t: any;
  statusLabel: (s: KnownIssueStatus) => string;
}

function IssueForm({ form, setForm, onSave, onCancel, t, statusLabel }: IssueFormProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, marginBottom: 12 }}>
      <label style={{ fontSize: 12, opacity: 0.8 }}>{t.kiTitleLabel}</label>
      <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        style={{ padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "inherit" }} />
      <label style={{ fontSize: 12, opacity: 0.8 }}>{t.kiDescLabel}</label>
      <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
        style={{ padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "inherit", resize: "vertical" }} />
      <label style={{ fontSize: 12, opacity: 0.8 }}>{t.kiStatusLabel}</label>
      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as KnownIssueStatus }))}
        style={{ padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "inherit" }}>
        {KNOWN_ISSUE_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
      </select>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} style={{ padding: "6px 14px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>{t.kiSaveBtn}</button>
        <button onClick={onCancel} style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}>{t.kiCancelBtn}</button>
      </div>
    </div>
  );
}

export default function KnownIssuesView({ lang = "tr", canEdit = false, onReportProblem }: Props) {
  const t: any = translations[lang];
  const statusLabel = useCallback((s: KnownIssueStatus) =>
    s === "INVESTIGATING" ? t.kiStatusInvestigating : s === "IN_PROGRESS" ? t.kiStatusInProgress : t.kiStatusResolved, [t.kiStatusInvestigating, t.kiStatusInProgress, t.kiStatusResolved]);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; status: KnownIssueStatus }>(
    { title: "", description: "", status: "INVESTIGATING" }
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/known-issues");
    if (!res.ok) { setMsg(t.kiLoadError); return; }
    const d = await res.json();
    setIssues(d.issues || []);
  }, [t.kiLoadError]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm({ title: "", description: "", status: "INVESTIGATING" }); setAdding(false); setEditingId(null); setMsg(""); };

  const submitCreate = async () => {
    const res = await fetch("/api/known-issues", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || t.kiSaveError); return; }
    resetForm(); await load();
  };

  const submitEdit = async (id: string) => {
    const res = await fetch(`/api/known-issues/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || t.kiSaveError); return; }
    resetForm(); await load();
  };

  const remove = async (id: string) => {
    if (!window.confirm(t.kiDeleteConfirm)) return;
    const res = await fetch(`/api/known-issues/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error || t.kiSaveError); return; }
    await load();
  };

  const startEdit = (it: Issue) => {
    setEditingId(it.id); setAdding(false);
    setForm({ title: it.title, description: it.description, status: it.status });
  };

  const fmtDate = (s: string) => new Date(s).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB");

  return (
    <div>
      {msg && <div style={{ marginBottom: 12, color: "#f87171", fontSize: 13 }}>{msg}</div>}

      {onReportProblem && (
        <button
          onClick={onReportProblem}
          style={{ padding: "8px 16px", borderRadius: 8, fontWeight: 600, marginBottom: 16, cursor: "pointer", border: "1px solid var(--accent)", background: "rgba(var(--accent-rgb, 59,130,246),.12)", color: "var(--accent)" }}
        >
          {t.kiReportBtn}
        </button>
      )}

      {canEdit && !adding && editingId === null && (
        <button onClick={() => { setAdding(true); setForm({ title: "", description: "", status: "INVESTIGATING" }); }}
          style={{ padding: "8px 16px", borderRadius: 8, fontWeight: 600, marginBottom: 16, cursor: "pointer" }}>
          + {t.kiAddBtn}
        </button>
      )}

      {canEdit && adding && (
        <IssueForm form={form} setForm={setForm} onSave={submitCreate} onCancel={resetForm} t={t} statusLabel={statusLabel} />
      )}

      {issues.length === 0 && !adding && (
        <div style={{ opacity: 0.7, padding: 24, textAlign: "center" }}>{t.kiEmpty}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {issues.map(it => (
          <div key={it.id} style={{ padding: 16, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}>
            {canEdit && editingId === it.id ? (
              <IssueForm form={form} setForm={setForm} onSave={() => submitEdit(it.id)} onCancel={resetForm} t={t} statusLabel={statusLabel} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{it.title}</h3>
                  <span style={{ ...badgeBase, ...STATUS_STYLE[it.status] }}>{statusLabel(it.status)}</span>
                </div>
                {it.description && <p style={{ margin: "8px 0 0", opacity: 0.85, whiteSpace: "pre-wrap" }}>{it.description}</p>}
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>{t.kiUpdatedAt}: {fmtDate(it.updatedAt)}</div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => startEdit(it)} style={{ padding: "4px 12px", borderRadius: 8, cursor: "pointer" }}>{t.kiEditBtn}</button>
                    <button onClick={() => remove(it.id)} style={{ padding: "4px 12px", borderRadius: 8, color: "#f87171", cursor: "pointer" }}>{t.kiDeleteBtn}</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
