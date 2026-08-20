"use client";

import { useEffect, useRef, useState } from "react";
import ConsultantMultiSelect from "@/app/components/shared/ConsultantMultiSelect";
import DateRangePicker from "@/app/components/shared/DateRangePicker";

interface Msg {
  role: "user" | "assistant";
  content: string;
  meta?: { poolCount: number; usedCount: number; truncated: boolean; startDate: string; endDate: string };
  error?: boolean;
}

interface AgentOption { id: string; name: string }

const REPORTABLE = ["AGENT", "TEAM_LEADER"];
const UNASSIGNED_EMAIL = "unassigned@estenove.local";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const T = {
  tr: {
    placeholder: "Değerlendirmeler hakkında bir soru yaz… (Enter gönderir, Shift+Enter satır atlar)",
    send: "Gönder",
    thinking: "Transcriptler okunuyor…",
    empty: "Filtreyi ayarla, sonra sorunu yaz. Örnek: “Fiyat itirazına en iyi cevabı kim veriyor?”",
    clear: "Sohbeti temizle",
    examined: (used: number, s: string, e: string) => `${used} çağrı incelendi (${s} – ${e})`,
    narrowed: (pool: number, used: number) =>
      `${pool} çağrıdan soruya en yakın ${used} tanesi incelendi — tam kapsama için tarih veya danışman filtresini daralt`,
    failed: "İstek başarısız oldu.",
  },
  en: {
    placeholder: "Ask a question about the evaluations… (Enter sends, Shift+Enter for a new line)",
    send: "Send",
    thinking: "Reading transcripts…",
    empty: "Set the filters, then ask. Example: “Who handles price objections best?”",
    clear: "Clear chat",
    examined: (used: number, s: string, e: string) => `${used} calls examined (${s} – ${e})`,
    narrowed: (pool: number, used: number) =>
      `${used} most relevant of ${pool} calls examined — narrow the date or consultant filter for full coverage`,
    failed: "Request failed.",
  },
} as const;

export default function AnalysisView({ lang = "tr" }: { lang?: "tr" | "en" }) {
  const t = T[lang];

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(isoDaysAgo(7));
  const [endDate, setEndDate] = useState(isoDaysAgo(0));
  const [appliedRange, setAppliedRange] = useState({ startDate: isoDaysAgo(7), endDate: isoDaysAgo(0) });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/users?includeInactive=1")
      .then((r) => r.json())
      .then((d) => {
        const list: AgentOption[] = (d.users ?? [])
          .filter((u: { role: string; email: string }) => REPORTABLE.includes(u.role) && u.email !== UNASSIGNED_EMAIL)
          .map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }));
        setAgents(list);
      })
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    const history = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/analysis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history,
          agentIds: selectedIds,
          startDate: appliedRange.startDate,
          endDate: appliedRange.endDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error ?? t.failed, error: true }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer, meta: data.meta }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.failed;
      setMessages((prev) => [...prev, { role: "assistant", content: `${t.failed} ${msg}`, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filtreler */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <ConsultantMultiSelect
          agents={agents}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          lang={lang}
        />
        <div style={{ flex: 1, minWidth: 320 }}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            onApply={() => setAppliedRange({ startDate, endDate })}
            lang={lang}
          />
        </div>
      </div>

      {/* Sohbet */}
      <div
        style={{
          border: "1px solid var(--rule)",
          borderRadius: 16,
          background: "var(--glass-bg)",
          display: "flex",
          flexDirection: "column",
          minHeight: 420,
        }}
      >
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: "58vh" }}>
          {messages.length === 0 && !loading && (
            <div style={{ color: "var(--fg-faint)", fontSize: 13, textAlign: "center", padding: "48px 16px" }}>
              {t.empty}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  background: m.error
                    ? "rgba(239,68,68,0.12)"
                    : m.role === "user"
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(255,255,255,0.04)",
                  border: `1px solid ${m.error ? "rgba(239,68,68,0.35)" : "var(--rule)"}`,
                  color: m.error ? "#fca5a5" : "var(--fg)",
                }}
              >
                {m.content}
              </div>
              {m.meta && (
                <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 5, paddingLeft: 4 }}>
                  {m.meta.truncated
                    ? t.narrowed(m.meta.poolCount, m.meta.usedCount)
                    : t.examined(m.meta.usedCount, m.meta.startDate, m.meta.endDate)}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, color: "var(--fg-faint)", fontSize: 12.5 }}>
              <span className="animate-spin" style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />
              {t.thinking}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Girdi */}
        <div style={{ borderTop: "1px solid var(--rule)", padding: 12, display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={t.placeholder}
            rows={2}
            disabled={loading}
            style={{
              flex: 1,
              resize: "vertical",
              background: "var(--glass-bg)",
              border: "1px solid var(--rule)",
              borderRadius: 12,
              padding: "10px 12px",
              color: "var(--fg)",
              fontSize: 13.5,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              border: "1px solid var(--rule)",
              background: loading || !input.trim() ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.14)",
              color: "var(--fg)",
              fontSize: 13,
              fontFamily: "inherit",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            }}
          >
            {t.send}
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <button
          onClick={() => setMessages([])}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--fg-faint)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
        >
          {t.clear}
        </button>
      )}
    </div>
  );
}
