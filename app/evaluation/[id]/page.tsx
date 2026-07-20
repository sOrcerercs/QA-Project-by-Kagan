"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check, User, Clock, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { POSITIVE_COACHING, composePositiveFeedback } from "@/app/lib/positiveCoaching";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

function ClampedPanel({
  maxHeight,
  onReadMore,
  readMoreLabel,
  children,
}: {
  maxHeight: number;
  onReadMore: () => void;
  readMoreLabel: string;
  children: React.ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const check = () => setOverflow(el.offsetHeight > maxHeight + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxHeight]);
  return (
    <div className="relative">
      <div style={{ maxHeight }} className="overflow-hidden">
        <div ref={innerRef}>{children}</div>
      </div>
      {overflow && (
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
          <div className="pointer-events-none w-full h-16 bg-gradient-to-t from-surface-container to-transparent" />
          <button
            onClick={onReadMore}
            className="mb-1 -mt-3 bg-surface-container-high hover:bg-surface-container border border-outline-variant text-primary text-xs font-semibold px-4 py-1.5 rounded-full transition-all shadow-sm"
          >
            {readMoreLabel} ↓
          </button>
        </div>
      )}
    </div>
  );
}

const L = {
  tr: {
    title: "Değerlendirme Detayı",
    consultant: "Danışman",
    team: "Takım",
    customer: "Müşteri",
    duration: "Süre",
    date: "Tarih",
    evaluationDate: "Değerlendirme Tarihi",
    callDateLabel: "Görüşme Tarihi",
    copyReport: "Raporu Kopyala",
    copied: "Kopyalandı!",
    edit: "Düzenle",
    transcript: "💬 Konuşma Transkripti",
    readMore: "Devamını Oku",
    reportTitle: "📋 Değerlendirme Raporu",
    listenOnFireflies: "🎧 Fireflies'ta Dinle",
    noTranscript: "Transkript bulunamadı.",
    editTitle: "✏️ Değerlendirmeyi Yeniden Düzenle",
    editHint: "AI'ya düzeltme talimatı ver — değerlendirme buna göre yeniden üretilecek",
    editPlaceholder: "Örn: Danışman, şirketin adını doğru bir şekilde söylemiştir, pozitif değerlendirebilirsin.",
    reevaluate: "🔄 Yeniden Değerlendir",
    evaluating: "Değerlendiriliyor...",
    notFound: "Değerlendirme bulunamadı.",
    backToDashboard: "Dashboard",
    back: "Geri",
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
    coachingModalTitle: "Coaching Notları",
    coachingReadHint: "Takım liderinin bu çağrı için bıraktığı notlar",
    coachingEmpty: "Henüz coaching notu girilmemiş.",
    coachingCards: "Bu Çağrıda Yapılabilecek 3 Şey",
    positiveCoachingTitle: "Öne çıkanları seç (Positive Coaching)",
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
    afTitle: "Danışman Geri Bildirimi",
    afWrite: "Feedback Yaz",
    afEdit: "Düzenle",
    afPending: "Henüz geri bildirim yazmadınız",
    afModalTitle: "Danışman Geri Bildirimi",
    afPlaceholder: "Değerlendirme hakkındaki geri bildiriminizi yazın...",
    afReadHint: "Danışmanın bu değerlendirme için yazdığı geri bildirim",
    afEmpty: "Henüz geri bildirim yok.",
    afSave: "Kaydet",
    afSaving: "Kaydediliyor...",
    objTitle: "İtiraz",
    objBtn: "İtiraz Et",
    objEdit: "İtirazı Düzenle",
    objPending: "İtiraz yok",
    objDone: "İtiraz edildi",
    objModalTitle: "Değerlendirmeye İtiraz",
    objPlaceholder: "Neye itiraz ediyorsunuz, nelerin değişmesi gerektiğini yazın...",
    objReadHint: "Danışmanın bu değerlendirmeye itirazı (admin ve takım liderine bildirildi)",
    objSend: "Gönder",
    objSending: "Gönderiliyor...",
    objEmpty: "İtiraz metni yok.",
  },
  en: {
    title: "Evaluation Detail",
    consultant: "Consultant",
    team: "Team",
    customer: "Customer",
    duration: "Duration",
    date: "Date",
    evaluationDate: "Evaluation Date",
    callDateLabel: "Call Date",
    copyReport: "Copy Report",
    copied: "Copied!",
    edit: "Edit",
    transcript: "💬 Conversation Transcript",
    readMore: "Read More",
    reportTitle: "📋 Evaluation Report",
    listenOnFireflies: "🎧 Listen on Fireflies",
    noTranscript: "Transcript not found.",
    editTitle: "✏️ Re-evaluate",
    editHint: "Give the AI a correction — the evaluation will be regenerated accordingly",
    editPlaceholder: "E.g.: The consultant correctly stated the company name, evaluate it positively.",
    reevaluate: "🔄 Re-evaluate",
    evaluating: "Evaluating...",
    notFound: "Evaluation not found.",
    backToDashboard: "Dashboard",
    back: "Back",
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
    coachingModalTitle: "Coaching Notes",
    coachingReadHint: "Notes your team leader left for this call",
    coachingEmpty: "No coaching notes yet.",
    coachingCards: "3 Things to Improve This Call",
    positiveCoachingTitle: "Select highlights (Positive Coaching)",
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
    afTitle: "Consultant Feedback",
    afWrite: "Write Feedback",
    afEdit: "Edit",
    afPending: "You haven't written feedback yet",
    afModalTitle: "Consultant Feedback",
    afPlaceholder: "Write your feedback about the evaluation...",
    afReadHint: "The consultant's feedback for this evaluation",
    afEmpty: "No feedback yet.",
    afSave: "Save",
    afSaving: "Saving...",
    objTitle: "Objection",
    objBtn: "Object",
    objEdit: "Edit Objection",
    objPending: "No objection",
    objDone: "Objection filed",
    objModalTitle: "Object to Evaluation",
    objPlaceholder: "What do you object to, what should change...",
    objReadHint: "The consultant's objection (notified to admin and team leader)",
    objSend: "Send",
    objSending: "Sending...",
    objEmpty: "No objection.",
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
  const router = useRouter();
  // Return to the page the user came from, not always the dashboard. Fall back
  // to home only when there's no in-app history (e.g. opened via direct URL).
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };
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
  const [readMore, setReadMore] = useState<null | "report" | "transcript">(null);

  const t = L[lang];

  useEffect(() => {
    if (!readMore) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setReadMore(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [readMore]);

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
            setReassignAgents((usersData.users || []).filter((u: any) => ["AGENT", "MANAGER"].includes(u.role)));
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
    // Ekranda gösterilen metni kopyala: EN seçiliyse ve çeviri hazırsa çeviriyi, yoksa orijinali.
    const reportText = lang === "en" && translatedReport ? translatedReport : evaluation.report;
    navigator.clipboard.writeText(reportText);
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
  const [coachingModalOpen, setCoachingModalOpen] = useState(false);
  const [coachingModalMode, setCoachingModalMode] = useState<"edit" | "read">("read");
  const [coachingNotes, setCoachingNotes] = useState("");
  const [coachingSaving, setCoachingSaving] = useState(false);
  const [positiveKeys, setPositiveKeys] = useState<Set<string>>(new Set());
  const [afModalOpen, setAfModalOpen] = useState(false);
  const [afModalMode, setAfModalMode] = useState<"edit" | "read">("read");
  const [afText, setAfText] = useState("");
  const [afSaving, setAfSaving] = useState(false);
  const [objModalOpen, setObjModalOpen] = useState(false);
  const [objModalMode, setObjModalMode] = useState<"edit" | "read">("read");
  const [objText, setObjText] = useState("");
  const [objSaving, setObjSaving] = useState(false);

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
      if (done) setCoachingModalOpen(false);
    } catch {
      // silent fail
    } finally {
      setCoachingSaving(false);
    }
  };

  const togglePositive = (k: string) => {
    const next = new Set(positiveKeys);
    if (next.has(k)) next.delete(k); else next.add(k);
    setPositiveKeys(next);
    setCoachingNotes(composePositiveFeedback([...next], lang));
  };

  const handleAgentFeedbackSave = async () => {
    if (!evaluation || afSaving || !afText.trim()) return;
    setAfSaving(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/agent-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: afText }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setEvaluation((prev: any) => ({ ...prev, ...data }));
      setAfModalOpen(false);
    } catch {
      // silent fail
    } finally {
      setAfSaving(false);
    }
  };

  const handleObjectionSave = async () => {
    if (!evaluation || objSaving || !objText.trim()) return;
    setObjSaving(true);
    try {
      const res = await fetch(`/api/evaluations/${id}/objection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: objText }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setEvaluation((prev: any) => ({ ...prev, ...data }));
      setObjModalOpen(false);
    } catch {
      // silent fail
    } finally {
      setObjSaving(false);
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
      // Any line starting with an emoji is a section heading. Matching all
      // pictographs (not a fixed list) keeps every heading on the same style
      // even as the prompt's heading emoji set changes.
      if (/^\p{Extended_Pictographic}/u.test(line)) {
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

  const reportBody = isTranslating ? (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-on-surface-variant">
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
  );

  const transcriptBody = evaluation.transcript ? (
    <div className="leading-relaxed">{formatTranscript(evaluation.transcript)}</div>
  ) : (
    <p className="text-outline italic text-sm">{t.noTranscript}</p>
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="bg-surface-container-low border-b border-outline-variant px-6 py-4 flex-shrink-0 z-10">
        <div className="flex justify-between items-center">
          <button
            onClick={goBack}
            className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-2 text-sm bg-transparent border-none cursor-pointer p-0"
          >
            <ArrowLeft className="w-4 h-4" /> {t.back}
          </button>
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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-5">
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
            { label: t.callDateLabel, icon: <Calendar className="w-3 h-3" />, value: new Date(evaluation.callDate).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR") },
            { label: t.evaluationDate, icon: <Calendar className="w-3 h-3" />, value: new Date(evaluation.createdAt).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR") },
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
      <div className="px-6 pb-2 grid grid-cols-2 gap-4 items-start">
        {/* Left: Report */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-6 leading-relaxed">
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
          <ClampedPanel maxHeight={260} onReadMore={() => setReadMore("report")} readMoreLabel={t.readMore}>
            {reportBody}
          </ClampedPanel>
        </div>

        {/* Right: Transcript */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-6">
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
          <ClampedPanel maxHeight={360} onReadMore={() => setReadMore("transcript")} readMoreLabel={t.readMore}>
            {transcriptBody}
          </ClampedPanel>
        </div>
      </div>

      {/* Agent Read + Coaching Row */}
      <div className="px-6 pb-4 grid grid-cols-2 gap-4 flex-shrink-0 items-start">
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
        {(() => {
          const isCoach = ["TEAM_LEADER", "ADMIN", "MANAGER"].includes(currentUser?.role);
          const canRead = !!(evaluation.coachingDone && evaluation.coachingNotes);
          const openEdit = () => {
            setCoachingNotes(evaluation.coachingNotes || "");
            setPositiveKeys(new Set());
            setCoachingModalMode("edit");
            setCoachingModalOpen(true);
          };
          const openRead = () => {
            setCoachingModalMode("read");
            setCoachingModalOpen(true);
          };
          return (
            <div
              onClick={canRead ? openRead : undefined}
              className={`bg-surface-container border border-outline-variant rounded-2xl px-5 py-4 flex items-center justify-between gap-4 ${canRead ? "cursor-pointer hover:bg-surface-container-high transition-colors" : ""}`}
            >
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
                {evaluation.coachingDone && isCoach && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(); }}
                    className="text-slate-500 hover:text-on-surface transition-colors text-xs px-2 py-1 rounded-lg hover:bg-surface-container-high"
                  >
                    {t.coachingEdit}
                  </button>
                )}
                {!evaluation.coachingDone && isCoach && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(); }}
                    className="flex-shrink-0 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                  >
                    {t.coachingBtn}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Danışman Yanıtı — yalnızca TL feedback'inden (coachingDone) sonra */}
      {evaluation.coachingDone && (() => {
        const isAgent = currentUser?.id === evaluation.agentId;
        const openAfEdit = () => { setAfText(evaluation.agentFeedback || ""); setAfModalMode("edit"); setAfModalOpen(true); };
        const openAfRead = () => { setAfModalMode("read"); setAfModalOpen(true); };
        const openObjEdit = () => { setObjText(evaluation.objectionText || ""); setObjModalMode("edit"); setObjModalOpen(true); };
        const openObjRead = () => { setObjModalMode("read"); setObjModalOpen(true); };
        const hasAf = !!evaluation.agentFeedback;
        const hasObj = !!evaluation.objectionText;
        return (
          <div className="px-6 pb-4 grid grid-cols-2 gap-4 flex-shrink-0 items-start">
            {/* Danışman Feedback kartı */}
            <div
              onClick={hasAf ? openAfRead : undefined}
              className={`bg-surface-container border border-outline-variant rounded-2xl px-5 py-4 flex items-center justify-between gap-4 ${hasAf ? "cursor-pointer hover:bg-surface-container-high transition-colors" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <MIcon name="rate_review" className={`text-xl flex-shrink-0 ${hasAf ? "text-emerald-400" : "text-slate-500"}`} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.afTitle}</p>
                  {hasAf ? (
                    <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                      ✓
                      {evaluation.agentFeedbackAt && (
                        <span className="text-slate-500 font-normal ml-1.5">
                          {new Date(evaluation.agentFeedbackAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-0.5">{t.afPending}</p>
                  )}
                </div>
              </div>
              {isAgent && (
                <button
                  onClick={(e) => { e.stopPropagation(); openAfEdit(); }}
                  className="flex-shrink-0 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                >
                  {hasAf ? t.afEdit : t.afWrite}
                </button>
              )}
            </div>

            {/* İtiraz kartı */}
            <div
              onClick={hasObj ? openObjRead : undefined}
              className={`bg-surface-container border border-outline-variant rounded-2xl px-5 py-4 flex items-center justify-between gap-4 ${hasObj ? "cursor-pointer hover:bg-surface-container-high transition-colors" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <MIcon name="gavel" className={`text-xl flex-shrink-0 ${hasObj ? "text-amber-400" : "text-slate-500"}`} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.objTitle}</p>
                  {hasObj ? (
                    <p className="text-xs text-amber-400 font-semibold mt-0.5">
                      ✓ {t.objDone}
                      {evaluation.objectionAt && (
                        <span className="text-slate-500 font-normal ml-1.5">
                          {new Date(evaluation.objectionAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-0.5">{t.objPending}</p>
                  )}
                </div>
              </div>
              {isAgent && (
                <button
                  onClick={(e) => { e.stopPropagation(); openObjEdit(); }}
                  className="flex-shrink-0 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                >
                  {hasObj ? t.objEdit : t.objBtn}
                </button>
              )}
            </div>
          </div>
        );
      })()}

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

      {/* Coaching Notes Modal */}
      <AnimatePresence>
        {coachingModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !coachingSaving && setCoachingModalOpen(false)}
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
                  <div className="text-sm font-bold text-on-surface">{t.coachingModalTitle}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    {coachingModalMode === "edit" ? t.coachingNotesPlaceholder : t.coachingReadHint}
                  </div>
                </div>
                {!coachingSaving && (
                  <button
                    onClick={() => setCoachingModalOpen(false)}
                    className="text-on-surface-variant hover:text-on-surface transition-colors text-lg leading-none"
                  >
                    ✕
                  </button>
                )}
              </div>
              {coachingModalMode === "edit" ? (
                <div className="flex flex-col gap-3">
                  {evaluation.score >= 90 && (
                    <div className="max-h-[32vh] overflow-y-auto flex flex-col gap-3 pr-1">
                      <div className="text-xs font-bold text-on-surface">{t.positiveCoachingTitle}</div>
                      {POSITIVE_COACHING.map((cat) => (
                        <div key={cat.key}>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-1">{cat.label[lang]}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {cat.items.map((item) => {
                              const k = `${cat.key}.${item.key}`;
                              const on = positiveKeys.has(k);
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  title={item.text[lang]}
                                  onClick={() => togglePositive(k)}
                                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${on ? "bg-primary/15 border-primary text-primary" : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-on-surface"}`}
                                >
                                  {item.label[lang]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3 items-end">
                    <textarea
                      className="flex-1 bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface resize-none outline-none focus:border-primary placeholder:text-outline min-h-[52px] max-h-[160px] transition-colors"
                      placeholder={t.coachingNotesPlaceholder}
                      value={coachingNotes}
                      onChange={(e) => setCoachingNotes(e.target.value)}
                      rows={3}
                      disabled={coachingSaving}
                      autoFocus
                    />
                    <button
                      onClick={() => handleCoachingSave(true)}
                      disabled={coachingSaving || !coachingNotes.trim()}
                      className="bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary px-5 py-3 rounded-xl font-semibold text-sm h-[52px] flex items-center gap-2 whitespace-nowrap transition-all"
                    >
                      {coachingSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                          {t.coachingSaving}
                        </>
                      ) : (
                        t.coachingSave
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-h-[40vh] overflow-y-auto">
                  {evaluation.coachingByName && (
                    <p className="text-xs text-on-surface-variant mb-2">
                      {t.coachingBy}: <span className="text-on-surface font-semibold">{evaluation.coachingByName}</span>
                    </p>
                  )}
                  <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                    {evaluation.coachingNotes || t.coachingEmpty}
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Danışman Feedback Modalı */}
      <AnimatePresence>
        {afModalOpen && (
          <>
            <motion.div className="fixed inset-0 bg-black/60 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !afSaving && setAfModalOpen(false)} />
            <motion.div className="fixed bottom-0 left-0 right-0 bg-surface-container-low border-t border-outline-variant px-6 py-5 z-50" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-bold text-on-surface">{t.afModalTitle}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">{afModalMode === "edit" ? t.afPlaceholder : t.afReadHint}</div>
                </div>
                {!afSaving && (
                  <button onClick={() => setAfModalOpen(false)} className="text-on-surface-variant hover:text-on-surface transition-colors text-lg leading-none">✕</button>
                )}
              </div>
              {afModalMode === "edit" ? (
                <div className="flex gap-3 items-end">
                  <textarea
                    className="flex-1 bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface resize-none outline-none focus:border-primary placeholder:text-outline min-h-[52px] max-h-[160px] transition-colors"
                    placeholder={t.afPlaceholder}
                    value={afText}
                    onChange={(e) => setAfText(e.target.value)}
                    rows={3}
                    disabled={afSaving}
                    autoFocus
                  />
                  <button
                    onClick={handleAgentFeedbackSave}
                    disabled={afSaving || !afText.trim()}
                    className="bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-on-primary px-5 py-3 rounded-xl font-semibold text-sm h-[52px] flex items-center gap-2 whitespace-nowrap transition-all"
                  >
                    {afSaving ? t.afSaving : t.afSave}
                  </button>
                </div>
              ) : (
                <div className="max-h-[40vh] overflow-y-auto">
                  <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{evaluation.agentFeedback || t.afEmpty}</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* İtiraz Modalı */}
      <AnimatePresence>
        {objModalOpen && (
          <>
            <motion.div className="fixed inset-0 bg-black/60 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !objSaving && setObjModalOpen(false)} />
            <motion.div className="fixed bottom-0 left-0 right-0 bg-surface-container-low border-t border-outline-variant px-6 py-5 z-50" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-bold text-on-surface">{t.objModalTitle}</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">{objModalMode === "edit" ? t.objPlaceholder : t.objReadHint}</div>
                </div>
                {!objSaving && (
                  <button onClick={() => setObjModalOpen(false)} className="text-on-surface-variant hover:text-on-surface transition-colors text-lg leading-none">✕</button>
                )}
              </div>
              {objModalMode === "edit" ? (
                <div className="flex gap-3 items-end">
                  <textarea
                    className="flex-1 bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface resize-none outline-none focus:border-primary placeholder:text-outline min-h-[52px] max-h-[160px] transition-colors"
                    placeholder={t.objPlaceholder}
                    value={objText}
                    onChange={(e) => setObjText(e.target.value)}
                    rows={3}
                    disabled={objSaving}
                    autoFocus
                  />
                  <button
                    onClick={handleObjectionSave}
                    disabled={objSaving || !objText.trim()}
                    className="bg-amber-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-black px-5 py-3 rounded-xl font-semibold text-sm h-[52px] flex items-center gap-2 whitespace-nowrap transition-all"
                  >
                    {objSaving ? t.objSending : t.objSend}
                  </button>
                </div>
              ) : (
                <div className="max-h-[40vh] overflow-y-auto">
                  <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{evaluation.objectionText || t.objEmpty}</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Read More Popup (Report / Transcript) */}
      <AnimatePresence>
        {readMore && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReadMore(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                className="pointer-events-auto w-full max-w-3xl max-h-[85vh] flex flex-col bg-surface-container-low border border-outline-variant rounded-2xl shadow-2xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant flex-shrink-0">
                  <div className="text-sm font-bold text-on-surface">
                    {readMore === "report" ? t.reportTitle : t.transcript}
                  </div>
                  <button
                    onClick={() => setReadMore(null)}
                    className="text-on-surface-variant hover:text-on-surface transition-colors text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>
                <div className="overflow-y-auto px-6 py-5 leading-relaxed">
                  {readMore === "report" ? reportBody : transcriptBody}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
