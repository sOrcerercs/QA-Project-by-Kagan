"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ConsultantMultiSelect from "@/app/components/shared/ConsultantMultiSelect";
import {
  OKR_TARGETS, okrStatus, upsellGaps, ALL_MONTHS,
  type OkrStatus, type OkrCallType, type UpsellFocus,
} from "@/app/lib/okr";
import type { UpsellStatus } from "@/app/lib/upsellClassify";

interface AgentAverage { id: string; name: string; avgScore: number | null; callCount: number }
interface RateResult { value: number | null; presented: number; notPresented: number; na: number; unknown: number; perfectScoreOverrides: number }

interface OkrData {
  month: string;
  isAll: boolean;
  /** Sistem öncesi ay: değerler elle girilmiş sabitten geliyor, hesaplanmadı. */
  isManual: boolean;
  history?: { evaCount: number; qualityAgents: number };
  callType: OkrCallType;
  agentIds: string[];
  availableMonths: string[];
  quality: { value: number | null; count: number };
  stemCell: RateResult;
  premium: RateResult;
  bottomSellers: {
    value: number | null;
    inheritedFrom: string | null;
    selected: AgentAverage[];
    monthly: { month: string; value: number | null }[];
  };
  gapCount: number;
  pendingCount: number;
  agents: AgentAverage[];
  filterAgents: { id: string; name: string }[];
  inactiveIds: string[];
}

interface GapRow {
  evaluationId: string;
  callDate: string;
  agentName: string;
  customerName: string;
  score: number;
  stemCell: UpsellStatus;
  premium: UpsellStatus;
  reportLine: string | null;
}

interface Filters { month: string; callType: OkrCallType; agentIds: string[] }

const FOCUS_OPTIONS: { value: UpsellFocus; tr: string; en: string }[] = [
  { value: "ALL", tr: "Tümü", en: "All" },
  { value: "stemCell", tr: "Stem Cell eksik", en: "Stem Cell missing" },
  { value: "premium", tr: "Premium eksik", en: "Premium missing" },
];

function dayLabel(iso: string, lang: "tr" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric", month: "short", timeZone: "Europe/Istanbul",
  });
}

const MAX_SELLERS = 5;

const CALL_TYPES: { value: OkrCallType; tr: string; en: string }[] = [
  { value: "ALL", tr: "Tüm Çağrılar", en: "All Calls" },
  { value: "FIRST_CALL", tr: "1. Çağrı", en: "First Call" },
  { value: "SECOND_CALL", tr: "2. Çağrı", en: "Second Call" },
];

const selectStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--rule)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "var(--fg)",
  fontSize: 13,
  fontFamily: "inherit",
};

const card: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--rule)",
  borderRadius: 16,
  padding: 20,
};

const STATUS_META: Record<OkrStatus, { icon: string; color: string; tr: string; en: string }> = {
  TAMAMLANDI: { icon: "✅", color: "#22c55e", tr: "Tamamlandı", en: "Complete" },
  YOLUNDA: { icon: "🟡", color: "#eab308", tr: "Yolunda", en: "On track" },
  RISKLI: { icon: "🔴", color: "#ef4444", tr: "Riskli", en: "At risk" },
  VERI_YOK: { icon: "—", color: "var(--fg-faint)", tr: "Veri yok", en: "No data" },
};

function monthLabel(month: string, lang: "tr" | "en"): string {
  if (month === ALL_MONTHS) return lang === "tr" ? "Tüm Aylar" : "All Months";
  const [y, m] = month.split("-").map(Number);
  const names = lang === "tr"
    ? ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[m - 1]} ${y}`;
}

const fmt = (v: number | null): string => (v === null ? "—" : `%${v.toFixed(2).replace(".", ",")}`);

function OkrCard({ title, value, target, detail, lang }: {
  title: string; value: number | null; target: number; detail: string; lang: "tr" | "en";
}) {
  const status = okrStatus(value, target);
  const meta = STATUS_META[status];
  const pct = value === null ? 0 : Math.min(100, (value / target) * 100);

  return (
    <div style={card}>
      <div style={{ fontSize: 13, color: "var(--fg-dim)", marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: "var(--fg)" }}>{fmt(value)}</div>
        <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>
          {lang === "tr" ? "hedef" : "target"} {fmt(target)}
        </div>
      </div>
      <div style={{ height: 6, background: "var(--rule)", borderRadius: 3, margin: "12px 0 10px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: meta.color, transition: "width .3s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
        <span style={{ color: "var(--fg-faint)" }}>{detail}</span>
        <span style={{ color: meta.color, whiteSpace: "nowrap" }}>
          {meta.icon} {lang === "tr" ? meta.tr : meta.en}
        </span>
      </div>
    </div>
  );
}

export default function OkrView({ lang = "tr" }: { lang?: "tr" | "en" }) {
  const [month, setMonth] = useState<string>("");
  const [callType, setCallType] = useState<OkrCallType>("ALL");
  const [filterIds, setFilterIds] = useState<string[]>([]);
  const [data, setData] = useState<OkrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classifying, setClassifying] = useState(false);
  const [classifyMsg, setClassifyMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [gaps, setGaps] = useState<GapRow[] | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState("");
  const [focus, setFocus] = useState<UpsellFocus>("ALL");

  // Yarış koruması: yalnızca en son isteğin yanıtı state'e yazılır.
  const reqIdRef = useRef(0);
  // Hata durumunda ay seçicisini ekrandaki veriye geri almak için.
  const dataRef = useRef<OkrData | null>(null);
  // load'un lang'a bağımlı olmaması için: bağımlılık olsaydı dil değişimi
  // mount effect'ini yeniden tetikleyip seçili ayı sıfırlardı.
  const langRef = useRef(lang);
  langRef.current = lang;

  // load'un state'e bağımlı olmaması için seçili filtreler ref'te tutulur;
  // çağıran yalnızca değişen alanı geçer.
  const filtersRef = useRef<Filters>({ month: "", callType: "ALL", agentIds: [] });

  // Eksik listesi: panel açıkken filtre değişirse yenilenmeli, kapalıyken
  // istek atılmamalı (rapor metinleri ağır).
  const gapsOpenRef = useRef(false);
  const gapsReqRef = useRef(0);

  const loadGaps = useCallback(() => {
    const f = filtersRef.current;
    const reqId = ++gapsReqRef.current;
    setGapsLoading(true);
    setGapsError("");
    const params = new URLSearchParams();
    if (f.month) params.set("month", f.month);
    if (f.agentIds.length > 0) params.set("agentIds", f.agentIds.join(","));
    const qs = params.toString();
    fetch(`/api/okr/gaps${qs ? `?${qs}` : ""}`)
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error)))))
      .then((d: { rows: GapRow[] }) => {
        if (reqId !== gapsReqRef.current) return;
        setGaps(d.rows);
      })
      .catch((e) => {
        if (reqId !== gapsReqRef.current) return;
        setGapsError(e.message || (langRef.current === "tr" ? "Liste yüklenemedi." : "Failed to load list."));
      })
      .finally(() => {
        if (reqId === gapsReqRef.current) setGapsLoading(false);
      });
  }, []);

  const load = useCallback((next: Partial<Filters>) => {
    const f = { ...filtersRef.current, ...next };
    filtersRef.current = f;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (f.month) params.set("month", f.month);
    if (f.callType !== "ALL") params.set("callType", f.callType);
    if (f.agentIds.length > 0) params.set("agentIds", f.agentIds.join(","));
    const qs = params.toString();
    fetch(`/api/okr${qs ? `?${qs}` : ""}`)
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error)))))
      .then((d: OkrData) => {
        // Eskimiş istek: kullanıcı bu arada başka bir filtre seçtiyse yanıtı yok say.
        if (reqId !== reqIdRef.current) return;
        dataRef.current = d;
        setData(d);
        setMonth(d.month);
        // Sunucu etkin filtreleri yankılıyor; geçmiş aylarda ikisini de
        // sıfırlıyor. Ekrandaki seçicilerle yanıt ayrışmasın diye buradan sync.
        setCallType(d.callType);
        setFilterIds(d.agentIds);
        filtersRef.current = { month: d.month, callType: d.callType, agentIds: d.agentIds };
        setDraftIds(d.bottomSellers.selected.map((s) => s.id));
        // Tüm Aylar'da alt-5 listesi düzenlenemez (ayın listesi yok).
        if (d.isAll) setEditing(false);
        // Filtre değişti: eldeki eksik listesi artık geçersiz.
        setGaps(null);
        setGapsError("");
        if (gapsOpenRef.current) loadGaps();
      })
      .catch((e) => {
        if (reqId !== reqIdRef.current) return;
        setError(e.message || (langRef.current === "tr" ? "Yüklenemedi." : "Failed to load."));
        // Seçiciler ile ekrandaki veri ayrışmasın: başarısız seçimi geri al.
        const prev = dataRef.current;
        const reverted: Filters = prev
          ? { month: prev.month, callType: prev.callType, agentIds: prev.agentIds }
          : { month: "", callType: "ALL", agentIds: [] };
        filtersRef.current = reverted;
        setMonth(reverted.month);
        setCallType(reverted.callType);
        setFilterIds(reverted.agentIds);
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false);
      });
  }, [loadGaps]);

  useEffect(() => { load({}); }, [load]);

  const runClassify = async () => {
    setClassifying(true);
    setClassifyMsg("");
    let guard = 0;
    let lastRemaining = Infinity;
    try {
      for (;;) {
        const res = await fetch("/api/okr/classify", { method: "POST" });
        if (!res.ok) throw new Error((await res.json()).error);
        const d = await res.json();
        setClassifyMsg(lang === "tr" ? `${d.remaining} kayıt kaldı...` : `${d.remaining} left...`);
        if (d.remaining === 0) break;
        // İlerleme durduysa (hepsi başarısız oluyorsa) sonsuz döngüyü kes.
        if (d.remaining >= lastRemaining || ++guard > 50) {
          setClassifyMsg(lang === "tr"
            ? `${d.remaining} kayıt sınıflandırılamadı — sonra tekrar deneyebilirsin.`
            : `${d.remaining} could not be classified — try again later.`);
          break;
        }
        lastRemaining = d.remaining;
      }
      load({});
    } catch (e) {
      setClassifyMsg(e instanceof Error ? e.message : (lang === "tr" ? "Sınıflandırma başarısız." : "Classification failed."));
    } finally {
      setClassifying(false);
    }
  };

  const saveSellers = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/okr/bottom-sellers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, userIds: draftIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(false);
      load({});
    } catch (e) {
      setError(e instanceof Error ? e.message : (lang === "tr" ? "Kaydedilemedi." : "Save failed."));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return <div style={{ color: "var(--fg-dim)", fontSize: 13 }}>{lang === "tr" ? "Yükleniyor..." : "Loading..."}</div>;
  }
  if (error && !data) {
    return <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>;
  }
  if (!data) return null;

  const completed = [
    okrStatus(data.quality.value, OKR_TARGETS.quality),
    okrStatus(data.stemCell.value, OKR_TARGETS.stemCell),
    okrStatus(data.bottomSellers.value, OKR_TARGETS.bottomSellers),
    okrStatus(data.premium.value, OKR_TARGETS.premium),
  ].filter((s) => s === "TAMAMLANDI").length
    // +1 = otomasyon. Elle girilen aylarda sayılmıyor: bu program o tarihte
    // henüz yoktu, "puanlama otomasyonu tamamlandı" demek yanlış olurdu.
    + (data.isManual ? 0 : 1);

  // Pasif hesaplar hem filtrede hem alt-5 seçicisinde duruyor (ayrıldığı ay
  // hâlâ ekipteydi); etiket olmadan kimin ayrıldığı görünmez.
  const inactiveSet = new Set(data.inactiveIds);
  const nameOf = (id: string, name: string) =>
    inactiveSet.has(id) ? `${name} ${lang === "tr" ? "(pasif)" : "(inactive)"}` : name;

  const rateDetail = (r: RateResult) => {
    if (data.isManual) {
      return lang === "tr"
        ? `${r.presented}/${r.presented + r.notPresented} · payda: tüm değerlendirmeler`
        : `${r.presented}/${r.presented + r.notPresented} · denominator: all evaluations`;
    }
    const parts = [`${r.presented}/${r.presented + r.notPresented} ${lang === "tr" ? "çağrı" : "calls"}`];
    if (r.na > 0) parts.push(`${r.na} N/A`);
    if (r.unknown > 0) parts.push(`${r.unknown} ${lang === "tr" ? "bilinmiyor" : "unknown"}`);
    if (r.perfectScoreOverrides > 0) {
      parts.push(lang === "tr"
        ? `${r.perfectScoreOverrides} kayıt %100 kuralıyla pozitif`
        : `${r.perfectScoreOverrides} counted positive by the 100% rule`);
    }
    // Bu iki paket yapısı gereği hep ikinci görüşmede sunulur → çağrı tipi
    // filtresi bilerek uygulanmıyor; kullanıcı sayının neden değişmediğini görsün.
    if (data.callType !== "ALL") {
      parts.push(lang === "tr" ? "çağrı tipi filtresinden etkilenmez" : "not affected by call type filter");
    }
    return parts.join(" · ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filtreler + özet */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); load({ month: e.target.value }); }}
            style={selectStyle}
          >
            {data.availableMonths.map((m) => (
              <option key={m} value={m}>{monthLabel(m, lang)}</option>
            ))}
          </select>
          <select
            value={callType}
            disabled={data.isManual}
            title={data.isManual ? (lang === "tr" ? "Elle girilen aylarda çağrı kaydı yok" : "No call records for manually entered months") : undefined}
            onChange={(e) => {
              const value = e.target.value as OkrCallType;
              setCallType(value);
              load({ callType: value });
            }}
            style={{ ...selectStyle, opacity: data.isManual ? 0.45 : 1, cursor: data.isManual ? "not-allowed" : "pointer" }}
          >
            {CALL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{lang === "tr" ? t.tr : t.en}</option>
            ))}
          </select>
          {data.isManual ? (
            <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
              {lang === "tr"
                ? "çağrı kaydı olmadığı için filtreler uygulanamıyor"
                : "filters unavailable — no call records"}
            </span>
          ) : (
            <ConsultantMultiSelect
              agents={data.filterAgents.map((a) => ({ id: a.id, name: nameOf(a.id, a.name) }))}
              selectedIds={filterIds}
              onChange={(ids) => { setFilterIds(ids); load({ agentIds: ids }); }}
              lang={lang}
            />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {data.isManual && (
            <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#eab30822", border: "1px solid #eab30855", color: "#eab308" }}>
              {lang === "tr" ? "elle girildi" : "manually entered"}
            </span>
          )}
          <div style={{ fontSize: 13, color: "var(--fg-dim)" }}>
            {data.isAll
              ? (lang === "tr"
                  ? `Kümülatif — 5 hedeften ${completed} tanesi tamamlandı`
                  : `Cumulative — ${completed} of 5 targets complete`)
              : (lang === "tr"
                  ? `5 hedeften ${completed} tanesi tamamlandı`
                  : `${completed} of 5 targets complete`)}
          </div>
        </div>
      </div>

      {data.isAll && (
        <div style={{ ...card, padding: "12px 20px", fontSize: 11, color: "var(--fg-faint)" }}>
          {lang === "tr"
            ? "Kümülatif yalnızca programda çağrı kaydı bulunan ayları havuzlar. Elle girilen aylar (Şubat, Mart 2026) paydası farklı hesaplandığı için bu değere katılmaz — onları ay seçicisinden tek tek görebilirsin."
            : "The cumulative figure pools only months with call records. Manually entered months (February, March 2026) use a different denominator and are excluded — view them individually from the month selector."}
        </div>
      )}

      {/* Bekleyen sınıflandırma — elle girilen ayda çağrı yok */}
      {!data.isManual && data.pendingCount > 0 && (
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--fg-dim)" }}>
            ⏳ {lang === "tr"
              ? `${data.pendingCount} çağrı sınıflandırılmayı bekliyor`
              : `${data.pendingCount} calls awaiting classification`}
            {classifyMsg && <span style={{ color: "var(--fg-faint)", marginLeft: 8 }}>{classifyMsg}</span>}
          </span>
          <button
            onClick={runClassify}
            disabled={classifying}
            style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 13, fontFamily: "inherit", cursor: classifying ? "default" : "pointer", opacity: classifying ? 0.6 : 1 }}
          >
            {classifying ? (lang === "tr" ? "Sınıflandırılıyor..." : "Classifying...") : (lang === "tr" ? "Sınıflandır" : "Classify")}
          </button>
        </div>
      )}

      {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}

      {/* OKR kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <OkrCard
          title={lang === "tr" ? "Kalite Skoru" : "Quality Score"}
          value={data.quality.value}
          target={OKR_TARGETS.quality}
          detail={data.isManual
            ? (lang === "tr"
                ? `${data.quality.count} danışmanın ortalaması — çağrı ağırlıklı değil`
                : `average of ${data.quality.count} consultants — not call-weighted`)
            : `${data.quality.count} ${lang === "tr" ? "değerlendirme" : "evaluations"}`}
          lang={lang}
        />
        <OkrCard
          title={lang === "tr" ? "Stem Cell Paket Tanıtımı" : "Stem Cell Package Pitch"}
          value={data.stemCell.value}
          target={OKR_TARGETS.stemCell}
          detail={rateDetail(data.stemCell)}
          lang={lang}
        />
        <OkrCard
          title={lang === "tr" ? "Premium Paket Tanıtımı" : "Premium Package Pitch"}
          value={data.premium.value}
          target={OKR_TARGETS.premium}
          detail={rateDetail(data.premium)}
          lang={lang}
        />
        <div style={card}>
          <div style={{ fontSize: 13, color: "var(--fg-dim)", marginBottom: 12 }}>
            {lang === "tr" ? "Görüşme Puanlama Otomasyonu" : "Call Scoring Automation"}
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: "var(--fg)" }}>
            {data.isManual ? "—" : "%100,00"}
          </div>
          <div style={{ height: 6, background: "var(--rule)", borderRadius: 3, margin: "12px 0 10px", overflow: "hidden" }}>
            <div style={{ width: data.isManual ? "0%" : "100%", height: "100%", background: "#22c55e" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
            <span style={{ color: "var(--fg-faint)" }}>
              {data.isManual
                ? (lang === "tr" ? "bu tarihte program henüz yoktu" : "the system did not exist yet")
                : ""}
            </span>
            <span style={{ color: data.isManual ? "var(--fg-faint)" : "#22c55e", whiteSpace: "nowrap" }}>
              {data.isManual
                ? `— ${lang === "tr" ? "Veri yok" : "No data"}`
                : `✅ ${lang === "tr" ? "Tamamlandı" : "Complete"}`}
            </span>
          </div>
        </div>
      </div>

      {/* Tanıtım yapılmayan çağrılar — varsayılan kapalı, satırlar açılınca yüklenir.
          Elle girilen aylarda gizli: altında çağrı kaydı yok. */}
      <div style={{ ...card, display: data.isManual ? "none" : "block" }}>
        <button
          onClick={() => {
            const next = !gapsOpen;
            setGapsOpen(next);
            gapsOpenRef.current = next;
            if (next && gaps === null && !gapsLoading) loadGaps();
          }}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", padding: 0, color: "var(--fg-dim)", fontSize: 13, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}
        >
          <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>{gapsOpen ? "▼" : "▶"}</span>
          <span>
            {lang === "tr" ? "Tanıtım yapılmayan çağrılar" : "Calls without a pitch"}
            {" "}
            <span style={{ color: "var(--fg-faint)" }}>({data.gapCount})</span>
          </span>
        </button>

        {gapsOpen && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <select value={focus} onChange={(e) => setFocus(e.target.value as UpsellFocus)} style={selectStyle}>
                {FOCUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{lang === "tr" ? o.tr : o.en}</option>
                ))}
              </select>
              {gaps && (
                <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                  {upsellGaps(gaps, focus).length} {lang === "tr" ? "çağrı" : "calls"}
                </span>
              )}
            </div>

            {gapsLoading && (
              <div style={{ fontSize: 13, color: "var(--fg-dim)" }}>
                {lang === "tr" ? "Yükleniyor..." : "Loading..."}
              </div>
            )}
            {gapsError && <div style={{ fontSize: 13, color: "#ef4444" }}>{gapsError}</div>}

            {gaps && upsellGaps(gaps, focus).length === 0 && !gapsLoading && (
              <div style={{ fontSize: 13, color: "var(--fg-faint)" }}>
                {lang === "tr" ? "Bu filtrede eksik tanıtım yok." : "No missing pitches for this filter."}
              </div>
            )}

            {gaps && (
              <div style={{ maxHeight: 440, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {upsellGaps(gaps, focus).map((r) => (
                  <div
                    key={r.evaluationId}
                    style={{ padding: "8px 0", borderBottom: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
                  >
                    <div style={{ minWidth: 240, flex: 1 }}>
                      <div style={{ fontSize: 13, color: "var(--fg)" }}>
                        {dayLabel(r.callDate, lang)} · {r.agentName} · {r.customerName}
                        <span style={{ color: "var(--fg-faint)" }}> · {r.score}</span>
                      </div>
                      {r.reportLine && (
                        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 3, fontStyle: "italic" }}>
                          “{r.reportLine}”
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, whiteSpace: "nowrap" }}>
                      <span style={{ color: r.stemCell === "SUNULMADI" ? "#ef4444" : "var(--fg-faint)" }}>
                        Stem Cell: {r.stemCell}
                      </span>
                      <span style={{ color: r.premium === "SUNULMADI" ? "#ef4444" : "var(--fg-faint)" }}>
                        Premium: {r.premium}
                      </span>
                      <a
                        href={`/evaluation/${r.evaluationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--accent)", textDecoration: "none" }}
                      >
                        {lang === "tr" ? "Çağrıyı aç ↗" : "Open call ↗"}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* En düşük 5 satışçı */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "var(--fg-dim)" }}>
            {lang === "tr" ? "En Düşük 5 Satışçı Kalite Skoru" : "Bottom 5 Sellers Quality Score"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 24, fontWeight: 600, color: "var(--fg)" }}>{fmt(data.bottomSellers.value)}</span>
            <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>
              {lang === "tr" ? "hedef" : "target"} {fmt(OKR_TARGETS.bottomSellers)}
            </span>
            <span style={{ fontSize: 12, color: STATUS_META[okrStatus(data.bottomSellers.value, OKR_TARGETS.bottomSellers)].color }}>
              {STATUS_META[okrStatus(data.bottomSellers.value, OKR_TARGETS.bottomSellers)].icon}
            </span>
          </div>
        </div>

        {data.isManual && (
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginBottom: 10 }}>
            {lang === "tr"
              ? "Bu ay için seçilmiş 5 kişi listesi yok — Excel'de böyle bir liste bulunmuyordu."
              : "No selected list of 5 for this month — the spreadsheet did not contain one."}
          </div>
        )}

        {data.isAll && (
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginBottom: 10 }}>
            {lang === "tr"
              ? "Her ayın kendi listesi olduğu için bu değer aylık sonuçların ortalamasıdır; yalnızca listesi kaydedilmiş aylar sayılır."
              : "Each month has its own list, so this is the average of the monthly results; only months with a saved list are counted."}
          </div>
        )}

        {data.bottomSellers.inheritedFrom && (
          <div style={{ fontSize: 11, color: "#eab308", marginBottom: 10 }}>
            {lang === "tr"
              ? `${monthLabel(data.bottomSellers.inheritedFrom, lang)} listesinden devralındı — henüz kaydetmedin.`
              : `Carried over from ${monthLabel(data.bottomSellers.inheritedFrom, lang)} — not saved yet.`}
          </div>
        )}

        {!data.isAll && !data.isManual && data.bottomSellers.selected.length === 0 && !editing && (
          <div style={{ fontSize: 13, color: "var(--fg-faint)", marginBottom: 10 }}>
            {lang === "tr" ? "Henüz kimse seçilmedi." : "No one selected yet."}
          </div>
        )}

        {data.isAll && data.bottomSellers.monthly.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--fg-faint)", marginBottom: 10 }}>
            {lang === "tr" ? "Hiçbir ay için liste kaydedilmemiş." : "No list saved for any month."}
          </div>
        )}

        {data.isAll && data.bottomSellers.monthly.map((m) => (
          <div key={m.month} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--rule)", fontSize: 13 }}>
            <span style={{ color: "var(--fg)" }}>{monthLabel(m.month, lang)}</span>
            <span style={{ color: m.value === null ? "var(--fg-faint)" : "var(--fg-dim)" }}>
              {m.value === null
                ? (lang === "tr" ? "veri yok — ortalamaya katılmadı" : "no data — excluded from average")
                : fmt(m.value)}
            </span>
          </div>
        ))}

        {data.bottomSellers.selected.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--rule)", fontSize: 13 }}>
            <span style={{ color: "var(--fg)" }}>{nameOf(s.id, s.name)}</span>
            <span style={{ color: s.avgScore === null ? "var(--fg-faint)" : "var(--fg-dim)" }}>
              {s.avgScore === null
                ? (lang === "tr" ? "veri yok — ortalamaya katılmadı" : "no data — excluded from average")
                : `${fmt(s.avgScore)} (${s.callCount} ${lang === "tr" ? "çağrı" : "calls"})`}
            </span>
          </div>
        ))}

        {/* Liste ay bazında kaydedilir; Tüm Aylar görünümünde düzenlenecek tek bir ay yok. */}
        <div style={{ marginTop: 12, display: data.isAll || data.isManual ? "none" : "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {editing ? (
            <>
              <ConsultantMultiSelect
                agents={data.agents.map((a) => ({ id: a.id, name: nameOf(a.id, a.name) }))}
                selectedIds={draftIds}
                onChange={(ids) => setDraftIds(ids.slice(0, MAX_SELLERS))}
                lang={lang}
              />
              <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                {draftIds.length}/{MAX_SELLERS}
              </span>
              <button
                onClick={saveSellers}
                disabled={saving}
                style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 13, fontFamily: "inherit", cursor: "pointer", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? (lang === "tr" ? "Kaydediliyor..." : "Saving...") : (lang === "tr" ? "Kaydet" : "Save")}
              </button>
              <button
                onClick={() => { setEditing(false); setDraftIds(data.bottomSellers.selected.map((s) => s.id)); }}
                style={{ background: "transparent", border: "1px solid var(--rule)", borderRadius: 8, padding: "8px 16px", color: "var(--fg-dim)", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
              >
                {lang === "tr" ? "Vazgeç" : "Cancel"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{ background: "transparent", border: "1px solid var(--rule)", borderRadius: 8, padding: "8px 16px", color: "var(--fg-dim)", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}
            >
              {data.bottomSellers.selected.length === 0
                ? (lang === "tr" ? "5 kişi seç" : "Select 5 people")
                : (lang === "tr" ? "Listeyi düzenle" : "Edit list")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
