"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ConsultantMultiSelect from "@/app/components/shared/ConsultantMultiSelect";
import { OKR_TARGETS, okrStatus, type OkrStatus } from "@/app/lib/okr";

interface AgentAverage { id: string; name: string; avgScore: number | null; callCount: number }
interface RateResult { value: number | null; presented: number; notPresented: number; na: number; unknown: number; perfectScoreOverrides: number }

interface OkrData {
  month: string;
  availableMonths: string[];
  quality: { value: number | null; count: number };
  stemCell: RateResult;
  premium: RateResult;
  bottomSellers: { value: number | null; inheritedFrom: string | null; selected: AgentAverage[] };
  pendingCount: number;
  agents: AgentAverage[];
}

const MAX_SELLERS = 5;

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
  const [data, setData] = useState<OkrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classifying, setClassifying] = useState(false);
  const [classifyMsg, setClassifyMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Yarış koruması: yalnızca en son isteğin yanıtı state'e yazılır.
  const reqIdRef = useRef(0);
  // Hata durumunda ay seçicisini ekrandaki veriye geri almak için.
  const dataRef = useRef<OkrData | null>(null);
  // load'un lang'a bağımlı olmaması için: bağımlılık olsaydı dil değişimi
  // mount effect'ini yeniden tetikleyip seçili ayı sıfırlardı.
  const langRef = useRef(lang);
  langRef.current = lang;

  const load = useCallback((m: string) => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError("");
    const qs = m ? `?month=${m}` : "";
    fetch(`/api/okr${qs}`)
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error)))))
      .then((d: OkrData) => {
        // Eskimiş istek: kullanıcı bu arada başka bir ay seçtiyse yanıtı yok say.
        if (reqId !== reqIdRef.current) return;
        dataRef.current = d;
        setData(d);
        setMonth(d.month);
        setDraftIds(d.bottomSellers.selected.map((s) => s.id));
      })
      .catch((e) => {
        if (reqId !== reqIdRef.current) return;
        setError(e.message || (langRef.current === "tr" ? "Yüklenemedi." : "Failed to load."));
        // Seçici ile ekrandaki veri ayrışmasın: başarısız ay seçimini geri al.
        setMonth(dataRef.current?.month ?? "");
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => { load(""); }, [load]);

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
      load(month);
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
      load(month);
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
  ].filter((s) => s === "TAMAMLANDI").length + 1; // +1 = otomasyon (sabit tamamlandı)

  const rateDetail = (r: RateResult) => {
    const parts = [`${r.presented}/${r.presented + r.notPresented} ${lang === "tr" ? "çağrı" : "calls"}`];
    if (r.na > 0) parts.push(`${r.na} N/A`);
    if (r.unknown > 0) parts.push(`${r.unknown} ${lang === "tr" ? "bilinmiyor" : "unknown"}`);
    if (r.perfectScoreOverrides > 0) {
      parts.push(lang === "tr"
        ? `${r.perfectScoreOverrides} kayıt %100 kuralıyla pozitif`
        : `${r.perfectScoreOverrides} counted positive by the 100% rule`);
    }
    return parts.join(" · ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Ay seçici + özet */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <select
          value={month}
          onChange={(e) => { setMonth(e.target.value); load(e.target.value); }}
          style={{ background: "var(--glass-bg)", border: "1px solid var(--rule)", borderRadius: 8, padding: "6px 12px", color: "var(--fg)", fontSize: 13, fontFamily: "inherit" }}
        >
          {data.availableMonths.map((m) => (
            <option key={m} value={m}>{monthLabel(m, lang)}</option>
          ))}
        </select>
        <div style={{ fontSize: 13, color: "var(--fg-dim)" }}>
          {lang === "tr" ? `5 hedeften ${completed} tanesi tamamlandı` : `${completed} of 5 targets complete`}
        </div>
      </div>

      {/* Bekleyen sınıflandırma */}
      {data.pendingCount > 0 && (
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
          detail={`${data.quality.count} ${lang === "tr" ? "değerlendirme" : "evaluations"}`}
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
          <div style={{ fontSize: 30, fontWeight: 600, color: "var(--fg)" }}>%100,00</div>
          <div style={{ height: 6, background: "var(--rule)", borderRadius: 3, margin: "12px 0 10px", overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", background: "#22c55e" }} />
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#22c55e" }}>
            ✅ {lang === "tr" ? "Tamamlandı" : "Complete"}
          </div>
        </div>
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

        {data.bottomSellers.inheritedFrom && (
          <div style={{ fontSize: 11, color: "#eab308", marginBottom: 10 }}>
            {lang === "tr"
              ? `${monthLabel(data.bottomSellers.inheritedFrom, lang)} listesinden devralındı — henüz kaydetmedin.`
              : `Carried over from ${monthLabel(data.bottomSellers.inheritedFrom, lang)} — not saved yet.`}
          </div>
        )}

        {data.bottomSellers.selected.length === 0 && !editing && (
          <div style={{ fontSize: 13, color: "var(--fg-faint)", marginBottom: 10 }}>
            {lang === "tr" ? "Henüz kimse seçilmedi." : "No one selected yet."}
          </div>
        )}

        {data.bottomSellers.selected.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--rule)", fontSize: 13 }}>
            <span style={{ color: "var(--fg)" }}>{s.name}</span>
            <span style={{ color: s.avgScore === null ? "var(--fg-faint)" : "var(--fg-dim)" }}>
              {s.avgScore === null
                ? (lang === "tr" ? "veri yok — ortalamaya katılmadı" : "no data — excluded from average")
                : `${fmt(s.avgScore)} (${s.callCount} ${lang === "tr" ? "çağrı" : "calls"})`}
            </span>
          </div>
        ))}

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {editing ? (
            <>
              <ConsultantMultiSelect
                agents={data.agents.map((a) => ({ id: a.id, name: a.name }))}
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
