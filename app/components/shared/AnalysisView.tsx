"use client";

import { useEffect, useRef, useState } from "react";
import ConsultantMultiSelect from "@/app/components/shared/ConsultantMultiSelect";
import DateRangePicker from "@/app/components/shared/DateRangePicker";

interface AgentCoverage { agentId: string; agentName: string; pool: number; used: number }

interface Meta {
  poolCount: number;
  usedCount: number;
  truncated: boolean;
  startDate: string;
  endDate: string;
  perAgent?: AgentCoverage[];
  missingAgents?: string[];
  excludedByRole?: number;
}

type Verdict = "EVET" | "HAYIR" | "BELIRSIZ";

interface ScanRow {
  call: number;
  verdict: Verdict;
  evidence: string;
  agentName: string;
  callDate: string;
  customerName: string;
  score: number;
}

interface ScanTally {
  agentId: string;
  agentName: string;
  total: number;
  yes: number;
  no: number;
  unclear: number;
  unanswered: number;
}

interface ScanPayload {
  criterion: string;
  rows: ScanRow[];
  tally: ScanTally[];
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  meta?: Meta;
  scan?: ScanPayload;
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
    perAgent: "Danışman başına incelenen / havuz",
    missing: (names: string[]) =>
      `Bu aralıkta hiç çağrısı olmayan danışman cevaba girmedi: ${names.join(", ")}`,
    excluded: (n: number) =>
      `${n} değerlendirme rolü AGENT/TEAM_LEADER olmadığı için havuza alınmadı`,
    modeChat: "Sohbet",
    modeScan: "Tarama",
    scanPlaceholder: "Tek bir evet/hayır ölçütü yaz: ör. “Danışman telefonda randevu saatini kesinleştirdi mi?”",
    scanSend: "Tara",
    scanning: "Çağrılar tek tek taranıyor…",
    scanEmpty: "Tarama modu: bir ölçüt yazarsın, her çağrı için evet/hayır + kanıt alıntısı ve kişi başına skor çıkar. Sayım programda yapılır, modelde değil.",
    tallyTitle: "Kişi başına sonuç",
    colCall: "#", colAgent: "Danışman", colDate: "Tarih", colVerdict: "Sonuç", colEvidence: "Kanıt",
    unanswered: (n: number) => `${n} çağrı cevapsız kaldı`,
    thinSpread: (avg: number) =>
      `Kişi başına ortalama ${avg} çağrı düştü — bu paydayla kişi başı oranlar güvenilmez. Tarama için 2-6 danışman seçip tekrar deneyin.`,
    moreAgents: (n: number) => `+${n} danışman daha`,
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
    perAgent: "Examined / pool per consultant",
    missing: (names: string[]) =>
      `Consultants with no calls in this range were left out: ${names.join(", ")}`,
    excluded: (n: number) =>
      `${n} evaluations were left out because their role is not AGENT/TEAM_LEADER`,
    modeChat: "Chat",
    modeScan: "Scan",
    scanPlaceholder: "Write one yes/no criterion, e.g. “Did the consultant lock a concrete time on the call?”",
    scanSend: "Scan",
    scanning: "Scanning calls one by one…",
    scanEmpty: "Scan mode: write a criterion and get a yes/no verdict plus a verbatim quote for every call, with per-consultant scores. The counting happens in code, not in the model.",
    tallyTitle: "Per consultant",
    colCall: "#", colAgent: "Consultant", colDate: "Date", colVerdict: "Verdict", colEvidence: "Evidence",
    unanswered: (n: number) => `${n} calls were left unanswered`,
    thinSpread: (avg: number) =>
      `Only ${avg} calls per consultant on average — per-consultant rates are unreliable at that denominator. Pick 2-6 consultants and scan again.`,
    moreAgents: (n: number) => `+${n} more consultants`,
  },
} as const;

type Strings = (typeof T)[keyof typeof T];

// Gemini cevapları markdown yazıyor (**kalın**, madde işaretleri, başlıklar).
// Projede markdown renderer yok ve bunun için bağımlılık eklemeye değmez —
// ihtiyaç duyulan üç işareti burada çeviriyoruz, gerisi düz metin kalıyor.
function renderInline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

function FormattedAnswer({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((raw, i) => {
        const line = raw.replace(/\t/g, "  ");
        const bullet = /^(\s*)[*-]\s+(.*)$/.exec(line);
        if (bullet) {
          const indent = Math.min(Math.floor(bullet[1].length / 2), 3);
          return (
            <div key={i} style={{ display: "flex", gap: 8, paddingLeft: indent * 14 }}>
              <span style={{ opacity: 0.45 }}>•</span>
              <span>{renderInline(bullet[2], String(i))}</span>
            </div>
          );
        }
        const heading = /^#{1,6}\s+(.*)$/.exec(line);
        if (heading) {
          return (
            <div key={i} style={{ fontWeight: 600, marginTop: 8 }}>
              {renderInline(heading[1], String(i))}
            </div>
          );
        }
        if (!line.trim()) return <div key={i} style={{ height: 7 }} />;
        return <div key={i}>{renderInline(line, String(i))}</div>;
      })}
    </>
  );
}

// Payda görünürlüğü: raporlarda olduğu gibi "kim kaç çağrıdan ölçüldü" yazılır.
// Tek toplam sayı, kişi başı oranların doğrulanmasına yetmiyor.
function MetaFootnote({ meta, t }: { meta: Meta; t: Strings }) {
  const perAgent = meta.perAgent ?? [];
  const shown = perAgent.slice(0, 6);
  const rest = perAgent.length - shown.length;
  return (
    <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 5, paddingLeft: 4, lineHeight: 1.7 }}>
      <div>
        {meta.truncated
          ? t.narrowed(meta.poolCount, meta.usedCount)
          : t.examined(meta.usedCount, meta.startDate, meta.endDate)}
      </div>
      {perAgent.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 2 }}>
          <span style={{ opacity: 0.7 }}>{t.perAgent}:</span>
          {shown.map((p) => (
            <span key={p.agentId}>
              {p.agentName} <strong style={{ fontWeight: 600 }}>{p.used}</strong>/{p.pool}
            </span>
          ))}
          {rest > 0 && <span>+{rest}</span>}
        </div>
      )}
      {!!meta.missingAgents?.length && (
        <div style={{ color: "#fbbf24" }}>⚠ {t.missing(meta.missingAgents)}</div>
      )}
      {!!meta.excludedByRole && (
        <div style={{ color: "#fbbf24" }}>⚠ {t.excluded(meta.excludedByRole)}</div>
      )}
    </div>
  );
}

const VERDICT_STYLE: Record<Verdict, { bg: string; fg: string; label: string }> = {
  EVET: { bg: "rgba(34,197,94,0.14)", fg: "#86efac", label: "EVET" },
  HAYIR: { bg: "rgba(239,68,68,0.14)", fg: "#fca5a5", label: "HAYIR" },
  BELIRSIZ: { bg: "rgba(148,163,184,0.14)", fg: "#cbd5e1", label: "BELİRSİZ" },
};

// Tarama sonucu: üstte kişi başına skor (kodda sayıldı), altta çağrı bazında
// karar + birebir kanıt alıntısı.
const MAX_TALLY_ROWS = 10;
// Bu paydanın altında kişi başı oran anlamsız: 26 danışman seçilirse kota
// kişi başına 1-2 çağrı bırakıyor ve "0/1" gibi sonuçlar yanıltıcı görünüyor.
const MIN_CALLS_PER_AGENT = 5;

function ScanResult({ scan, t }: { scan: ScanPayload; t: Strings }) {
  const unanswered = scan.tally.reduce((n, x) => n + x.unanswered, 0);
  const scanned = scan.tally.reduce((n, x) => n + x.total, 0);
  const perAgentAvg = scan.tally.length ? scanned / scan.tally.length : 0;
  const thin = scan.tally.length > 1 && perAgentAvg < MIN_CALLS_PER_AGENT;
  const shownTally = scan.tally.slice(0, MAX_TALLY_ROWS);
  const hiddenTally = scan.tally.length - shownTally.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{scan.criterion}</div>

      <div>
        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {t.tallyTitle}
        </div>
        {thin && (
          <div style={{ fontSize: 11.5, color: "#fbbf24", marginBottom: 8, lineHeight: 1.5 }}>
            ⚠ {t.thinSpread(Math.round(perAgentAvg * 10) / 10)}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {shownTally.map((x) => {
            const decided = x.yes + x.no;
            const pct = decided ? Math.round((100 * x.yes) / decided) : 0;
            return (
              <div key={x.agentId} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                <span style={{ minWidth: 150 }}>{x.agentName}</span>
                <span style={{ minWidth: 62, fontVariantNumeric: "tabular-nums" }}>
                  <strong style={{ fontWeight: 600 }}>{x.yes}</strong>/{x.total}
                </span>
                <span style={{ flex: 1, maxWidth: 200, height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${pct}%`, height: "100%", background: pct >= 50 ? "#22c55e" : "#ef4444", opacity: 0.75 }} />
                </span>
                <span style={{ minWidth: 42, textAlign: "right", color: "var(--fg-faint)", fontVariantNumeric: "tabular-nums" }}>
                  {decided ? `${pct}%` : "—"}
                </span>
                {x.unclear > 0 && (
                  <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>belirsiz {x.unclear}</span>
                )}
              </div>
            );
          })}
        </div>
        {hiddenTally > 0 && (
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 4 }}>{t.moreAgents(hiddenTally)}</div>
        )}
        {unanswered > 0 && (
          <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 6 }}>⚠ {t.unanswered(unanswered)}</div>
        )}
      </div>

      <div style={{ maxHeight: 280, overflowY: "auto", overflowX: "auto", border: "1px solid var(--rule)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "#14161a" }}>
              {[t.colCall, t.colAgent, t.colDate, t.colVerdict, t.colEvidence].map((h, i) => (
                <th key={i} style={{ textAlign: "left", padding: "7px 10px", fontWeight: 500, color: "var(--fg-faint)", fontSize: 11, borderBottom: "1px solid var(--rule)", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scan.rows.map((r) => {
              const v = VERDICT_STYLE[r.verdict];
              return (
                <tr key={r.call} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "6px 10px", color: "var(--fg-faint)", fontVariantNumeric: "tabular-nums" }}>{r.call}</td>
                  <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{r.agentName}</td>
                  <td style={{ padding: "6px 10px", color: "var(--fg-faint)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{r.callDate}</td>
                  <td style={{ padding: "6px 10px" }}>
                    <span style={{ background: v.bg, color: v.fg, padding: "2px 7px", borderRadius: 6, fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {v.label}
                    </span>
                  </td>
                  <td style={{ padding: "6px 10px", color: "var(--fg)", opacity: 0.85, minWidth: 260 }}>{r.evidence || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AnalysisView({ lang = "tr" }: { lang?: "tr" | "en" }) {
  const t = T[lang];

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(isoDaysAgo(7));
  const [endDate, setEndDate] = useState(isoDaysAgo(0));
  const [appliedRange, setAppliedRange] = useState({ startDate: isoDaysAgo(7), endDate: isoDaysAgo(0) });

  const [mode, setMode] = useState<"chat" | "scan">("chat");
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
    const text = input.trim();
    if (!text || loading) return;

    // Tarama durumsuzdur: geçmiş yalnızca sohbet modunda taşınır.
    const history =
      mode === "chat"
        ? messages.filter((m) => !m.error && !m.scan).map((m) => ({ role: m.role, content: m.content }))
        : [];

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(mode === "chat" ? "/api/analysis/chat" : "/api/analysis/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "chat"
            ? {
                question: text,
                history,
                agentIds: selectedIds,
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
              }
            : {
                criterion: text,
                agentIds: selectedIds,
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error ?? t.failed, error: true }]);
      } else if (mode === "scan") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.note ?? "",
            meta: data.meta,
            scan: data.rows?.length ? { criterion: data.criterion, rows: data.rows, tally: data.tally } : undefined,
          },
        ]);
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

      {/* Mod anahtarı */}
      <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--rule)", alignSelf: "flex-start" }}>
        {(["chat", "scan"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: mode === m ? "rgba(255,255,255,0.13)" : "transparent",
              color: mode === m ? "var(--fg)" : "var(--fg-faint)",
              fontSize: 12.5,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {m === "chat" ? t.modeChat : t.modeScan}
          </button>
        ))}
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
            <div style={{ color: "var(--fg-faint)", fontSize: 13, textAlign: "center", padding: "48px 16px", maxWidth: 620, margin: "0 auto", lineHeight: 1.6 }}>
              {mode === "chat" ? t.empty : t.scanEmpty}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: m.scan ? "100%" : "85%", width: m.scan ? "100%" : undefined }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  whiteSpace: m.role === "assistant" && !m.error ? "normal" : "pre-wrap",
                  background: m.error
                    ? "rgba(239,68,68,0.12)"
                    : m.role === "user"
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(255,255,255,0.04)",
                  border: `1px solid ${m.error ? "rgba(239,68,68,0.35)" : "var(--rule)"}`,
                  color: m.error ? "#fca5a5" : "var(--fg)",
                }}
              >
                {m.scan ? (
                  <ScanResult scan={m.scan} t={t} />
                ) : m.role === "assistant" && !m.error ? (
                  <FormattedAnswer text={m.content} />
                ) : (
                  m.content
                )}
              </div>
              {m.meta && <MetaFootnote meta={m.meta} t={t} />}
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, color: "var(--fg-faint)", fontSize: 12.5 }}>
              <span className="animate-spin" style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />
              {mode === "chat" ? t.thinking : t.scanning}
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
            placeholder={mode === "chat" ? t.placeholder : t.scanPlaceholder}
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
            {mode === "chat" ? t.send : t.scanSend}
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
