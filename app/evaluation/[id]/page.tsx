"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, User, Clock, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const L = {
  tr: {
    title: "Değerlendirme Detayı",
    consultant: "Danışman",
    team: "Takım",
    customer: "Müşteri",
    duration: "Süre",
    date: "Tarih",
    evaluationDate: "Değerlendirme Tarihi",
    copyReport: "Raporu Kopyala",
    copied: "Kopyalandı!",
    edit: "Düzenle",
    transcript: "💬 Konuşma Transkripti",
    listenOnFireflies: "🎧 Fireflies'ta Dinle",
    noTranscript: "Transkript bulunamadı.",
    editTitle: "✏️ Değerlendirmeyi Yeniden Düzenle",
    editHint: "AI'ya düzeltme talimatı ver — değerlendirme buna göre yeniden üretilecek",
    editPlaceholder: "Örn: Danışman, şirketin adını doğru bir şekilde söylemiştir, pozitif değerlendirebilirsin.",
    reevaluate: "🔄 Yeniden Değerlendir",
    evaluating: "Değerlendiriliyor...",
    notFound: "Değerlendirme bulunamadı.",
    backToDashboard: "Dashboard",
    refineError: "Yeniden değerlendirme başarısız.",
    translating: "Rapor çevriliyor...",
    translateError: "Çeviri başarısız — orijinal rapor gösteriliyor.",
    readTitle: "Değerlendirme Okundu Mu?",
    readBtn: "Evet, Okudum",
    readDone: "Okundu",
    readPending: "Danışman henüz okumadı",
    coachingTitle: "Coaching Yapıldı Mı?",
    coachingBtn: "Evet, Coaching Yaptım",
    coachingDoneLabel: "Coaching Yapıldı",
    coachingPending: "Coaching henüz yapılmadı",
    coachingNotesPlaceholder: "Coaching notlarını buraya yazın...",
    coachingBy: "Koç",
    coachingSave: "Kaydet",
    coachingSaving: "Kaydediliyor...",
    coachingEdit: "Düzenle",
    coachingCards: "Bu Çağrıda Yapılabilecek 3 Şey",
    reclassify: "Yeniden Değerlendir",
    reclassifying: "Değerlendiriliyor...",
    firstCallPrompt: "🔵 First Call Promptu",
    secondCallPrompt: "🟣 Second Call Promptu",
    reclassifyError: "Yeniden değerlendirme başarısız.",
    reassign: "Yeniden Ata",
    reassignSelect: "— Danışman seçin —",
    reassigning: "Atanıyor...",
    reassignDone: "Danışman güncellendi.",
    reassignError: "Yeniden atama başarısız.",
  },
  en: {
    title: "Evaluation Detail",
    consultant: "Consultant",
    team: "Team",
    customer: "Customer",
    duration: "Duration",
    date: "Date",
    evaluationDate: "Evaluation Date",
    copyReport: "Copy Report",
    copied: "Copied!",
    edit: "Edit",
    transcript: "💬 Conversation Transcript",
    listenOnFireflies: "🎧 Listen on Fireflies",
    noTranscript: "Transcript not found.",
    editTitle: "✏️ Re-evaluate",
    editHint: "Give the AI a correction — the evaluation will be regenerated accordingly",
    editPlaceholder: "E.g.: The consultant correctly stated the company name, evaluate it positively.",
    reevaluate: "🔄 Re-evaluate",
    evaluating: "Evaluating...",
    notFound: "Evaluation not found.",
    backToDashboard: "Dashboard",
    refineError: "Re-evaluation failed.",
    translating: "Translating report...",
    translateError: "Translation failed — showing original report.",
    readTitle: "Was the Evaluation Read?",
    readBtn: "Yes, I've Read It",
    readDone: "Read",
    readPending: "Agent hasn't read yet",
    coachingTitle: "Was Coaching Done?",
    coachingBtn: "Yes, I Did Coaching",
    coachingDoneLabel: "Coaching Done",
    coachingPending: "Coaching not yet done",
    coachingNotesPlaceholder: "Enter coaching notes here...",
    coachingBy: "Coach",
    coachingSave: "Save",
    coachingSaving: "Saving...",
    coachingEdit: "Edit",
    coachingCards: "3 Things to Improve This Call",
    reclassify: "Re-evaluate",
    reclassifying: "Evaluating...",
    firstCallPrompt: "🔵 First Call Prompt",
    secondCallPrompt: "🟣 Second Call Prompt",
    reclassifyError: "Re-evaluation failed.",
    reassign: "Reassign",
    reassignSelect: "— Select agent —",
    reassigning: "Assigning...",
    reassignDone: "Agent updated.",
    reassignError: "Reassignment failed.",
  },
};

export default function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState("");
  const [isDark, setIsDark] = useState(true);
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const [translatedReport, setTranslatedReport] = useState<string | null>(null);
  const [translatedWeakCriteria, setTranslatedWeakCriteria] = useState<Array<{ id: string; label: string; score: number; coachingNote: string }> | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);
  const [reclassifyOpen, setReclassifyOpen] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [reclassifyError, setReclassifyError] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignAgentId, setReassignAgentId] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignMsg, setReassignMsg] = useState("");
  const [reassignAgents, setReassignAgents] = useState<{ id: string; name: string }[]>([]);

  const t = L[lang];

  useEffect(() => {
    const savedTheme = localStorage.getItem("estenove-theme");
    const dark = savedTheme !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("light", !dark);

    const savedLang = localStorage.getItem("estenove-lang");
    if (savedLang === "en" || savedLang === "tr") setLang(savedLang);

    fetchEvaluation().then((ev: any) => {
      if (ev?.coachingNotes) setCoachingNotes(ev.coachingNotes);
    });
    fetchCurrentUser();
  }, [id]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("estenove-theme", next ? "dark" : "light");
  };

  const toggleLang = () => {
    const next: "tr" | "en" = lang === "tr" ? "en" : "tr";
    setLang(next);
    localStorage.setItem("estenove-lang", next);
  };

  const translateReport = async (evalId: string) => {
    setIsTranslating(true);
    setTranslateError(false);
    try {
      const res = await fetch(`/api/evaluations/${evalId}/translate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setTranslatedReport(data.report);
      if (Array.isArray(data.weakCriteria)) setTranslatedWeakCriteria(data.weakCriteria);
    } catch {
      setTranslateError(true);
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    if (lang === "en" && evaluation && !translatedReport && !isTranslating) {
      translateReport(evaluation.id);
    }
  }, [lang, evaluation]);

  useEffect(() => {
    if (!reclassifyOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-reclassify-menu]")) {
        setReclassifyOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [reclassifyOpen]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        if (["ADMIN", "MANAGER"].includes(data.user?.role)) {
          const usersRes = await fetch("/api/users");
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            setReassignAgents((usersData.users || []).filter((u: any) => u.role === "AGENT"));
          }
        }
      }
    } catch {}
  };

  const fetchEvaluation = async () => {
    try {
      const res = await fetch(`/api/evaluations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Değerlendirme bulunamadı.");
      setEvaluation(data.evaluation);
      return data.evaluation;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!evaluation) return;
    navigator.clipboard.writeText(evaluation.report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefine = async () => {
    if (!feedback.trim()) return;
    setIsRefining(true);
    setRefineError("");
    try {
      const res = await fetch(`/api/evaluations/${id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.refineError);
      setEvaluation((prev: any) => ({ ...prev, report: data.report, score: data.score }));
      setFeedback("");
      setFeedbackOpen(false);
    } catch (err: any) {
      setRefineError(err.message);
    } finally {
      setIsRefining(false);
    }
  };

  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [coachingExpanded, setCoachingExpanded] = useState(false);
  const [coachingNotes, setCoachingNotes] = useState("");
  const [coachingSaving, setCoachingSaving] = useState(false);

  const handleAcknowledge = async () => {
    if (!evaluation || isAcknowledging) return;
    setIsAcknowledging(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/acknowledge`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setEvaluation((prev: any) => ({ ...prev, agentRead: data.agentRead, agentReadAt: data.agentReadAt }));
    } catch {
      // silent fail
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleCoachingSave = async (done: boolean) => {
    if (!evaluation || coachingSaving) return;
    setCoachingSaving(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/coaching`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done, notes: coachingNotes }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setEvaluation((prev: any) => ({ ...prev, ...data }));
      if (done) setCoachingExpanded(false);
    } catch {
      // silent fail
    } finally {
      setCoachingSaving(false);
    }
  };

  const [isRescoring, setIsRescoring] = useState(false);
  const handleRescore = async () => {
    setIsRescoring(true);
    try {
      const res = await fetch(`/api/evaluations/${id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Skor güncellenemedi.");
      setEvaluation((prev: any) => ({ ...prev, score: data.score }));
    } catch (err: any) {
      setRefineError(err.message);
    } finally {
      setIsRescoring(false);
    }
  };

  const handleReclassify = async (callType: "FIRST_CALL" | "SECOND_CALL") => {
    if (isReclassifying) return;
    setReclassifyOpen(false);
    setIsReclassifying(true);
    setReclassifyError("");
    try {
      const res = await fetch(`/api/evaluations/${id}/re-classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.reclassifyError);
      setEvaluation((prev: any) => ({
        ...prev,
        callType: data.callType,
        report: data.report,
        score: data.score,
        sectionScores: data.sectionScores ?? prev.sectionScores,
        weakCriteria: data.weakCriteria ?? prev.weakCriteria,
      }));
      setTranslatedReport(null);
      setTranslatedWeakCriteria(null);
    } catch (err: any) {
      setReclassifyError(err.message);
    } finally {
      setIsReclassifying(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignAgentId || isReassigning) return;
    setIsReassigning(true);
    setReassignMsg("");
    try {
      const res = await fetch(`/api/evaluations/${id}/reassign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: reassignAgentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.reassignError);
      setEvaluation((prev: any) => ({
        ...prev,
        agentId: reassignAgentId,
        agent: reassignAgents.find(a => a.id === reassignAgentId) ?? prev.agent,
      }));
      setReassignMsg(t.reassignDone);
      setReassignOpen(false);
      setReassignAgentId("");
    } catch (err: any) {
      setReassignMsg(err.message);
    } finally {
      setIsReassigning(false);
    }
  };

  const canEdit = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";
  const canReclassify = currentUser?.role === "ADMIN";

  const scoreColor = (score: number) =>
    score >= 85
      ? "text-emerald-400"
      : score >= 70
      ? "text-primary"
      : score >= 55
      ? "text-amber-400"
      : "text-error";

  const formatReport = (text: string) =>
    text.split("\n").map((line, i) => {
      if (
        line.startsWith("📊") || line.startsWith("📝") || line.startsWith("💰") ||
        line.startsWith("💭") || line.startsWith("🛑") || line.startsWith("🚨") ||
        line.startsWith("📈") || line.startsWith("🔍") || line.startsWith("💡") ||
        line.startsWith("🎯") || line.startsWith("✅")
      ) {
        return (
          <div key={i} className="mt-6 mb-2 text-primary font-bold text-base border-b border-outline-variant pb-2">
            {line}
          </div>
        );
      }
      if (
        line.startsWith("Temsilci:") || line.startsWith("Consultant:") ||
        line.startsWith("Müşteri:") || line.startsWith("Customer:") ||
        line.startsWith("Görüşme") || line.startsWith("Call ") ||
        line.startsWith("Genel Skor:") || line.startsWith("Overall Score:")
      ) {
        return <div key={i} className="text-on-surface text-sm font-medium py-0.5">{line}</div>;
      }
      if (line.startsWith("•") || line.startsWith("-")) {
        return <div key={i} className="text-on-surface text-sm py-1 pl-2">{line}</div>;
      }
      if (line.includes("Kanıt:") || line.includes("Evidence:")) {
        return <div key={i} className="text-emerald-400 text-xs py-0.5 pl-6 font-mono">{line}</div>;
      }
      if (line.includes("Olması Gereken:") || line.includes("Expected:")) {
        return <div key={i} className="text-amber-400 text-xs py-0.5 pl-6">{line}</div>;
      }
      if (line.trim() === "") return <div key={i} className="h-1" />;
      return <div key={i} className="text-on-surface-variant text-sm py-0.5">{line}</div>;
    });

  const formatTranscript = (text: string) =>
    text.split("\n").map((line, i) => {
      const timeMatch = line.match(/^(\[\d{2}:\d{2}\])\s*(.*)/);
      if (timeMatch) {
        const [, time, rest] = timeMatch;
        const isSdr = rest.trimStart().startsWith("SDR:");
        return (
          <div key={i} className="py-0.5">
            <span className="text-outline font-mono text-[11px]">{time} </span>
            <span className={isSdr ? "text-primary text-xs" : "text-emerald-400 text-xs"}>{rest}</span>
          </div>
        );
      }
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return <div key={i} className="text-on-surface-variant text-xs py-0.5">{line}</div>;
    });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center gap-4">
        <p className="text-error">{error || t.notFound}</p>
        <Link href="/" className="text-primary hover:underline text-sm">← {t.backToDashboard}</Link>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface h-screen flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-surface-container-low border-b border-outline-variant px-6 py-4 flex-shrink-0 z-10">
        <div className="flex justify-between items-center">
          <Link
            href="/"
            className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> {t.backToDashboard}
          </Link>
          <h1 className="text-lg font-bold tracking-tight">{t.title}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="h-9 px-3 flex items-center gap-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-all text-xs font-bold tracking-wide"
            >
              <MIcon name="translate" className="text-base" />
              {lang === "tr" ? "TR" : "EN"}
            </button>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-all"
            >
              <MIcon name={isDark ? "light_mode" : "dark_mode"} className="text-xl" />
            </button>
          </div>
        </div>
      </header>

      {/* Meta + Score */}
      <div className="px-6 pt-5 flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
          {/* Danışman kartı — admin/manager için yeniden atama içerir */}
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-4">
            <div className="text-[10px] text-on-surface-variant font-bold uppercase flex items-center gap-1.5 mb-2">
              <User className="w-3 h-3" /> {t.consultant}
            </div>
            {reassignOpen ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <select
                  value={reassignAgentId}
                  onChange={e => { setReassignAgentId(e.target.value); setReassignMsg(""); }}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--outline-variant, #333)",
                    borderRadius: 6,
                    color: "var(--on-surface)",
                    fontSize: 12,
                    padding: "4px 6px",
                    outline: "none",
                    width: "100%",
                  }}
                >
                  <option value="">{t.reassignSelect}</option>
                  {reassignAgents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={handleReassign}
                    disabled={!reassignAgentId || isReassigning}
                    style={{
                      flex: 1,
                      background: "rgba(59,130,246,.2)",
                      border: "1px solid rgba(59,130,246,.4)",
                      borderRadius: 5,
                      color: "var(--accent, #3b82f6)",
                      fontSize: 11,
                      padding: "3px 0",
                      cursor: "pointer",
                      opacity: (!reassignAgentId || isReassigning) ? 0.4 : 1,
                    }}
                  >
                    {isReassigning ? t.reassigning : t.reassign}
                  </button>
                  <button
                    onClick={() => { setReassignOpen(false); setReassignAgentId(""); setReassignMsg(""); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--on-surface-variant)", fontSize: 12 }}
                  >
                    ✕
                  </button>
                </div>
                {reassignMsg && (
                  <span style={{ fontSize: 10, color: reassignMsg === t.reassignDone ? "#34d399" : "#f87171" }}>
                    {reassignMsg}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <p className="text-sm font-semibold text-on-surface">{evaluation.agent?.name || "—"}</p>
                {canEdit && (
                  <button
                    onClick={() => setReassignOpen(true)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--on-surface-variant)",
                      fontSize: 10,
                      padding: "2px 4px",
                      borderRadius: 4,
                      opacity: 0.6,
                    }}
                    title={t.reassign}
                  >
                    ✎
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Diğer kartlar */}
          {[
            { label: t.team, icon: <User className="w-3 h-3" />, value: evaluation.agent?.team?.name || "—" },
            { label: t.customer, icon: <User className="w-3 h-3" />, value: evaluation.customerName },
            { label: t.duration, icon: <Clock className="w-3 h-3" />, value: evaluation.callDuration },
            { label: t.date, icon: <Calendar className="w-3 h-3" />, value: new Date(evaluation.createdAt).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR") },
            { label: t.evaluationDate, icon: <Calendar className="w-3 h-3" />, value: new Date(evaluation.callDate).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR") },
          ].map(({ label, icon, value }) => (
            <div key={label} className="bg-surface-container border border-outline-variant rounded-2xl p-4">
              <div className="text-[10px] text-on-surface-variant font-bold uppercase flex items-center gap-1.5 mb-2">
                {icon} {label}
              </div>
              <p className="text-sm font-semibold text-on-surface">{value}</p>
            </div>
          ))}
        </div>

        {evaluation.source === "KRIKO" && evaluation.recordingUrl && (
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 mb-4">
            <div className="text-[10px] text-on-surface-variant font-bold uppercase flex items-center gap-1.5 mb-3">
              <MIcon name="mic" className="text-primary text-sm" />
              Çağrı Kaydı
            </div>
            <audio
              controls
              preload="none"
              className="w-full"
              src={`/api/evaluations/${evaluation.id}/audio`}
            />
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className={`text-4xl font-black ${scoreColor(evaluation.score)}`}>
              %{evaluation.score}
            </span>
            {evaluation.callType && (
              <span className="px-3 py-1 rounded-lg text-xs font-bold border border-primary/20 bg-primary/10 text-primary">
                {evaluation.callType.replace("_", " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-surface-container hover:bg-surface-container-high text-on-surface-variant px-4 py-2 rounded-lg text-sm transition-all border border-outline-variant"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? t.copied : t.copyReport}
            </button>
            {canEdit && evaluation.score === 0 && (
              <button
                onClick={handleRescore}
                disabled={isRescoring}
                className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                title="Rapor metninden skoru yeniden hesapla"
              >
                {isRescoring ? "..." : "⚡ Skoru Düzelt"}
              </button>
            )}
            {canReclassify && (
              <div className="flex items-center gap-2">
                <div className="relative" data-reclassify-menu>
                  <button
                    onClick={() => !isReclassifying && setReclassifyOpen((o) => !o)}
                    disabled={isReclassifying}
                    className="flex items-center gap-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-secondary/50 text-on-surface-variant hover:text-on-surface px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                  >
                    {isReclassifying ? (
                      <>
                        <span className="w-3 h-3 border border-on-surface-variant/40 border-t-on-surface rounded-full animate-spin" />
                        {t.reclassifying}
                      </>
                    ) : (
                      `↩ ${t.reclassify} ▾`
                    )}
                  </button>
                  {reclassifyOpen && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-surface-container-high border border-outline-variant rounded-xl shadow-xl z-50 overflow-hidden">
                      {(["FIRST_CALL", "SECOND_CALL"] as const).map((ct) => (
                        <button
                          key={ct}
                          onClick={() => handleReclassify(ct)}
                          disabled={evaluation.callType === ct}
                          className={`w-full text-left px-4 py-3 text-sm transition-all ${
                            evaluation.callType === ct
                              ? "text-on-surface-variant/40 cursor-default"
                              : "hover:bg-surface-container text-on-surface"
                          }`}
                        >
                          {ct === "FIRST_CALL" ? t.firstCallPrompt : t.secondCallPrompt}
                          {evaluation.callType === ct && (
                            <span className="ml-2 text-[10px] text-primary/60">✓ mevcut</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {reclassifyError && (
                  <span className="text-error text-xs">{reclassifyError}</span>
                )}
                <button
                  onClick={() => setFeedbackOpen(true)}
                  className="flex items-center gap-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-primary/50 text-on-surface-variant hover:text-on-surface px-4 py-2 rounded-lg text-sm transition-all"
                >
                  ✏️ {t.edit}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Split Content */}
      <div className="flex-1 min-h-0 px-6 pb-2 grid grid-cols-2 gap-4">
        {/* Left: Report */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl overflow-y-auto p-6 leading-relaxed">
          {evaluation.weakCriteria && Array.isArray(evaluation.weakCriteria) && (evaluation.weakCriteria as any[]).length > 0 && (
            <div className="mb-6 bg-surface-container-high border border-primary/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1 rounded-full border border-primary/20 tracking-wide">
                  COACHING
                </span>
                <span className="text-sm font-bold text-on-surface">{t.coachingCards}</span>
              </div>
              <div className="space-y-3">
                {(
                  (lang === "en" && translatedWeakCriteria) ||
                  (evaluation.weakCriteria as Array<{ id: string; label: string; score: number; coachingNote: string }>)
                ).map(
                  (c, idx) => {
                    const palette = [
                      { card: "bg-red-500/10 border-red-500/30", num: "bg-red-500/20 text-red-400", label: "text-red-300" },
                      { card: "bg-orange-500/10 border-orange-500/30", num: "bg-orange-500/20 text-orange-400", label: "text-orange-300" },
                      { card: "bg-yellow-500/10 border-yellow-500/30", num: "bg-yellow-500/20 text-yellow-400", label: "text-yellow-300" },
                    ];
                    const p = palette[idx % palette.length];
                    return (
                      <div key={c.id} className={`flex gap-3 p-3 rounded-xl border ${p.card}`}>
                        <span className={`flex-shrink-0 w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${p.num}`}>
                          {idx + 1}
                        </span>
                        <div>
                          <p className={`text-[11px] font-semibold mb-1 ${p.label}`}>{c.id} — {c.label}</p>
                          <p className="text-[11px] text-on-surface-variant leading-relaxed">{c.coachingNote}</p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
          {isTranslating ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-on-surface-variant">
              <div className="w-5 h-5 border-2 border-outline border-t-primary rounded-full animate-spin" />
              <span className="text-sm">{t.translating}</span>
            </div>
          ) : translateError ? (
            <>
              <p className="text-error text-xs mb-4">{t.translateError}</p>
              {formatReport(evaluation.report)}
            </>
          ) : (
            formatReport(lang === "en" && translatedReport ? translatedReport : evaluation.report)
          )}
        </div>

        {/* Right: Transcript */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
              {t.transcript}
            </div>
            {(() => {
              const fireUrl = evaluation.recordingUrl ||
                (evaluation.source === "FIREFLIES" && evaluation.externalCallId
                  ? `https://app.fireflies.ai/view/${evaluation.externalCallId.replace(/^ff_/, "")}`
                  : null);
              return fireUrl ? (
                <a
                  href={fireUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:opacity-80 transition-opacity font-semibold"
                >
                  {t.listenOnFireflies} ↗
                </a>
              ) : null;
            })()}
          </div>
          {evaluation.transcript ? (
            <div className="leading-relaxed">{formatTranscript(evaluation.transcript)}</div>
          ) : (
            <p className="text-outline italic text-sm">{t.noTranscript}</p>
          )}
        </div>
      </div>

      {/* Agent Read + Coaching Row */}
      <div className="px-6 pb-4 grid grid-cols-2 gap-4 flex-shrink-0">
        {/* Agent Read Section */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <MIcon name="menu_book" className={`text-xl flex-shrink-0 ${evaluation.agentRead ? "text-emerald-400" : "text-slate-500"}`} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.readTitle}</p>
              {evaluation.agentRead ? (
                <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                  ✓ {t.readDone}
                  {evaluation.agentReadAt && (
                    <span className="text-slate-500 font-normal ml-1.5">
                      {new Date(evaluation.agentReadAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">{t.readPending}</p>
              )}
            </div>
          </div>
          {!evaluation.agentRead && currentUser?.id === evaluation.agentId && (
            <button
              onClick={handleAcknowledge}
              disabled={isAcknowledging}
              className="flex-shrink-0 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {isAcknowledging ? "..." : t.readBtn}
            </button>
          )}
        </div>

        {/* Coaching Section */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <MIcon name="psychology" className={`text-xl flex-shrink-0 ${evaluation.coachingDone ? "text-primary" : "text-slate-500"}`} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.coachingTitle}</p>
                {evaluation.coachingDone ? (
                  <p className="text-xs text-primary font-semibold mt-0.5">
                    ✓ {t.coachingDoneLabel}
                    {evaluation.coachingByName && (
                      <span className="text-slate-500 font-normal ml-1.5">— {evaluation.coachingByName}</span>
                    )}
                    {evaluation.coachingDoneAt && (
                      <span className="text-slate-500 font-normal ml-1.5">
                        {new Date(evaluation.coachingDoneAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-0.5">{t.coachingPending}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {evaluation.coachingDone && ["TEAM_LEADER", "ADMIN", "MANAGER"].includes(currentUser?.role) && (
                <button
                  onClick={() => {
                    setCoachingNotes(evaluation.coachingNotes || "");
                    setCoachingExpanded(!coachingExpanded);
                  }}
                  className="text-slate-500 hover:text-on-surface transition-colors text-xs px-2 py-1 rounded-lg hover:bg-surface-container-high"
                >
                  {t.coachingEdit}
                </button>
              )}
              {!evaluation.coachingDone && ["TEAM_LEADER", "ADMIN", "MANAGER"].includes(currentUser?.role) && (
                <button
                  onClick={() => setCoachingExpanded(true)}
                  className="flex-shrink-0 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                >
                  {t.coachingBtn}
                </button>
              )}
            </div>
          </div>

          {/* Notes area — shows when expanded or when coaching is done and there are notes */}
          {(coachingExpanded || (evaluation.coachingDone && evaluation.coachingNotes && !coachingExpanded)) && (
            <div className="mt-3 pt-3 border-t border-outline-variant">
              {coachingExpanded && ["TEAM_LEADER", "ADMIN", "MANAGER"].includes(currentUser?.role) ? (
                <div className="flex gap-2 items-end">
                  <textarea
                    value={coachingNotes}
                    onChange={(e) => setCoachingNotes(e.target.value)}
                    placeholder={t.coachingNotesPlaceholder}
                    rows={2}
                    className="flex-1 bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface resize-none outline-none focus:border-primary placeholder:text-outline transition-colors"
                  />
                  <button
                    onClick={() => handleCoachingSave(true)}
                    disabled={coachingSaving}
                    className="bg-primary hover:opacity-90 disabled:opacity-50 text-on-primary px-3 py-2 rounded-xl text-xs font-semibold h-[52px] whitespace-nowrap transition-all"
                  >
                    {coachingSaving ? t.coachingSaving : t.coachingSave}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">{evaluation.coachingNotes}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feedback Panel */}
      <AnimatePresence>
        {feedbackOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isRefining && setFeedbackOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-surface-container-low border-t border-outline-variant px-6 py-5 z-50"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-bold text-on-surface">{t.editTitle}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">{t.editHint}</div>
                </div>
                {!isRefining && (
                  <button
                    onClick={() => setFeedbackOpen(false)}
                    className="text-on-surface-variant hover:text-on-surface transition-colors text-lg leading-none"
                  >
                    ✕
                  </button>
                )}
              </div>
              {refineError && <p className="text-error text-xs mb-3">{refineError}</p>}
              <div className="flex gap-3 items-end">
                <textarea
                  className="flex-1 bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface resize-none outline-none focus:border-primary placeholder:text-outline min-h-[52px] max-h-[120px] transition-colors"
                  placeholder={t.editPlaceholder}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={2}
                  disabled={isRefining}
                />
                <button
                  onClick={handleRefine}
                  disabled={isRefining || !feedback.trim()}
                  className="bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary px-5 py-3 rounded-xl font-semibold text-sm h-[52px] flex items-center gap-2 whitespace-nowrap transition-all"
                >
                  {isRefining ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      {t.evaluating}
                    </>
                  ) : (
                    t.reevaluate
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
