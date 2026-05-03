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
    copyReport: "Raporu Kopyala",
    copied: "Kopyalandı!",
    edit: "Düzenle",
    transcript: "💬 Konuşma Transkripti",
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
  },
  en: {
    title: "Evaluation Detail",
    consultant: "Consultant",
    team: "Team",
    customer: "Customer",
    duration: "Duration",
    date: "Date",
    copyReport: "Copy Report",
    copied: "Copied!",
    edit: "Edit",
    transcript: "💬 Conversation Transcript",
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
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);

  const t = L[lang];

  useEffect(() => {
    const savedTheme = localStorage.getItem("estenove-theme");
    const dark = savedTheme !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("light", !dark);

    const savedLang = localStorage.getItem("estenove-lang");
    if (savedLang === "en" || savedLang === "tr") setLang(savedLang);

    fetchEvaluation();
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

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok) setCurrentUser(data.user);
    } catch {}
  };

  const fetchEvaluation = async () => {
    try {
      const res = await fetch(`/api/evaluations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Değerlendirme bulunamadı.");
      setEvaluation(data.evaluation);
    } catch (err: any) {
      setError(err.message);
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

  const canEdit = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

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
          {[
            { label: t.consultant, icon: <User className="w-3 h-3" />, value: evaluation.agent?.name || "—" },
            { label: t.team, icon: <User className="w-3 h-3" />, value: evaluation.agent?.team?.name || "—" },
            { label: t.customer, icon: <User className="w-3 h-3" />, value: evaluation.customerName },
            { label: t.duration, icon: <Clock className="w-3 h-3" />, value: evaluation.callDuration },
            { label: t.date, icon: <Calendar className="w-3 h-3" />, value: new Date(evaluation.createdAt).toLocaleDateString("tr-TR") },
          ].map(({ label, icon, value }) => (
            <div key={label} className="bg-surface-container border border-outline-variant rounded-2xl p-4">
              <div className="text-[10px] text-on-surface-variant font-bold uppercase flex items-center gap-1.5 mb-2">
                {icon} {label}
              </div>
              <p className="text-sm font-semibold text-on-surface">{value}</p>
            </div>
          ))}
        </div>

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
            {canEdit && (
              <button
                onClick={() => setFeedbackOpen(true)}
                className="flex items-center gap-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-primary/50 text-on-surface-variant hover:text-on-surface px-4 py-2 rounded-lg text-sm transition-all"
              >
                ✏️ {t.edit}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Split Content */}
      <div className="flex-1 min-h-0 px-6 pb-6 grid grid-cols-2 gap-4">
        {/* Left: Report */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl overflow-y-auto p-6 leading-relaxed">
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
          <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-4">
            {t.transcript}
          </div>
          {evaluation.transcript ? (
            <div className="leading-relaxed">{formatTranscript(evaluation.transcript)}</div>
          ) : (
            <p className="text-outline italic text-sm">{t.noTranscript}</p>
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
