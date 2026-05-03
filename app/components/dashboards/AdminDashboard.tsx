"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { translations, type Lang } from "@/app/lib/i18n";
import UserMenu from "@/app/components/shared/UserMenu";
import NotificationBell from "@/app/components/shared/NotificationBell";
import {
  Home, Phone, Activity, Upload, FileText, Info,
  MessageSquare, CreditCard, Mail, Linkedin, LogIn,
  Search, ArrowUpRight, ExternalLink, LayoutGrid,
  Rss, Layers, Briefcase, ShoppingBag, LogOut,
  Users, Mic, ScrollText, Trophy, Target, TrendingUp, TrendingDown, Star, Award, Calendar, CheckCircle, BarChart3, AlertTriangle, Clock, Trash2
} from "lucide-react";
import { motion } from "motion/react";
import WeeklyEvaluationReport from "@/components/WeeklyEvaluationReport";
import ManagementComparisonView from "@/app/components/shared/ManagementComparisonView";

// Material icon helper
const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const EvalItem = ({ ev, index, detailLabel = "Detay", isAdmin, onDelete }: { ev: any; index: number; detailLabel?: string; isAdmin?: boolean; onDelete?: (id: string) => void }) => {
  const scoreColor = (score: number) =>
    score >= 85 ? "text-emerald-400" :
    score >= 70 ? "text-primary" :
    score >= 55 ? "text-amber-400" : "text-error";

  const handleDelete = () => {
    if (window.confirm(`"${ev.agent?.name}" adlı danışmanın bu değerlendirmesini silmek istediğinize emin misiniz?`)) {
      onDelete?.(ev.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-high transition-colors cursor-pointer group"
    >
      <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
        <MIcon name="description" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-on-surface">{ev.agent?.name}</div>
        <div className="text-xs text-slate-500">{ev.customerName} · {ev.callDuration}</div>
      </div>
      <div className="text-right flex items-center gap-4">
        <p className="text-xs text-slate-500">{new Date(ev.createdAt).toLocaleDateString("tr-TR")}</p>
        <div className={`font-bold ${scoreColor(ev.score)}`}>%{ev.score}</div>
        <Link href={`/evaluation/${ev.id}`}>
          <div className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-primary transition-colors">
            {detailLabel} <ArrowUpRight size={12} />
          </div>
        </Link>
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className="text-slate-700 hover:text-error transition-colors opacity-0 group-hover:opacity-100"
            title="Sil"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

interface AdminDashboardProps {
  user: any;
  initialTab?: string;
}

export default function AdminDashboard({ user: initialUser, initialTab = "home" }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentUser] = useState<any>(initialUser);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [prompts, setPrompts] = useState<any[]>([]);
  const [batchMode, setBatchMode] = useState<"csv" | "docx">("csv");
  const [batchCalls, setBatchCalls] = useState<any[]>([]);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<any>(null);
  const [batchMsg, setBatchMsg] = useState("");
  const [docxRows, setDocxRows] = useState<{ fileName: string; transcript: string; agentId: string; customerName: string; callDuration: string; promptId: string }[]>([]);
  const [docxLoading, setDocxLoading] = useState(false);
  const [applyAllAgentId, setApplyAllAgentId] = useState("");
  const [applyAllPromptId, setApplyAllPromptId] = useState("");
  const [scoresData, setScoresData] = useState<any>(null);
  const [selectedScoreAgent, setSelectedScoreAgent] = useState("");
  const [scoresLoading, setScoresLoading] = useState(false);
  const [reportsSubTab, setReportsSubTab] = useState("weekly");
  const [reportType, setReportType] = useState("WEEKLY");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [autoReportData, setAutoReportData] = useState<any>(null);
  const [autoReportLoading, setAutoReportLoading] = useState(false);
  const [autoReportPeriod, setAutoReportPeriod] = useState<any>(null);
  const [autoReportIsDemo, setAutoReportIsDemo] = useState(false);
  const [customReportStart, setCustomReportStart] = useState("");
  const [customReportEnd, setCustomReportEnd] = useState("");
  const [isDark, setIsDark] = useState(true);
  const [lang, setLang] = useState<Lang>("tr");
  const [navSearch, setNavSearch] = useState("");

  const t = translations[lang];

  useEffect(() => {
    const savedTheme = localStorage.getItem("estenove-theme");
    const dark = savedTheme !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("light", !dark);

    const savedLang = localStorage.getItem("estenove-lang") as Lang | null;
    if (savedLang === "en" || savedLang === "tr") setLang(savedLang);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("estenove-theme", next ? "dark" : "light");
  };

  const toggleLang = () => {
    const next: Lang = lang === "tr" ? "en" : "tr";
    setLang(next);
    localStorage.setItem("estenove-lang", next);
  };

  useEffect(() => {
    if (currentUser) {
      fetchEvaluations();
      fetchSavedReports();
      if (["ADMIN", "MANAGER"].includes(currentUser.role)) {
        fetchUsers(); fetchPrompts();
      }
    }
  }, [currentUser]);

  const fetchEvaluations = async () => { const res = await fetch("/api/evaluations"); const data = await res.json(); setEvaluations(data.evaluations || []); };
  const fetchUsers = async () => { const res = await fetch("/api/users"); const data = await res.json(); setUsers(data.users || []); };
  const fetchPrompts = async () => { const res = await fetch("/api/prompts"); const data = await res.json(); setPrompts(data.prompts || []); };

  const fetchSavedReports = async () => { const res = await fetch("/api/reports"); const data = await res.json(); setSavedReports(data.reports || []); };
  const fetchAutoReport = async (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate && autoReportData) return;
    setAutoReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      const url = `/api/reports/auto${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (res.ok) { const result = await res.json(); setAutoReportData(result.data); setAutoReportPeriod(result.period); setAutoReportIsDemo(result.isDemo || false); }
    } finally { setAutoReportLoading(false); }
  };
  const handleGenerateReport = async () => {
    if (!reportStartDate || !reportEndDate) { setReportMsg("Tarih araligi secin."); return; }
    setIsGeneratingReport(true); setReportMsg("");
    try { const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: reportType, startDate: reportStartDate, endDate: reportEndDate }) });
      const result = await res.json(); if (!res.ok) { setReportMsg(result.error || "Rapor olusturulamadi."); return; }
      setReportData(result.report.data); setReportMsg("Rapor olusturuldu!"); fetchSavedReports();
    } catch { setReportMsg("Rapor olusturulurken hata."); } finally { setIsGeneratingReport(false); }
  };
  const handleLoadReport = async (id: string) => { const res = await fetch(`/api/reports/${id}`); const result = await res.json(); if (res.ok) setReportData(result.report.data); };

  const parseDocxHeader = (text: string) => {
    const lines = text.split("\n").slice(0, 10);
    const result: { agentName?: string; customerName?: string; duration?: string } = {};
    for (const line of lines) {
      const m1 = line.match(/^Dan[ıi]şman[:\s]+(.+)/i);
      const m2 = line.match(/^M[üu]şteri[:\s]+(.+)/i);
      const m3 = line.match(/^S[üu]re[:\s]+(.+)/i);
      if (m1) result.agentName = m1[1].trim();
      if (m2) result.customerName = m2[1].trim();
      if (m3) result.duration = m3[1].trim();
    }
    return result;
  };

  const parseDocxTranscript = (text: string) => {
    const sep = text.indexOf("---");
    return sep > 0 ? text.slice(sep + 3).trim() : text;
  };

  const handleDocxFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBatchResults(null);
    setBatchMsg("");
    setDocxLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mammothPkg = await import("mammoth" as any);
      const mammoth: any = mammothPkg.default ?? mammothPkg;
      const rows = await Promise.all(
        files.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          const fullText = (result.value as string).trim();
          const header = parseDocxHeader(fullText);
          const transcript = parseDocxTranscript(fullText);
          const matchedUser = header.agentName
            ? users.find((u: any) => u.name.toLowerCase().includes(header.agentName!.toLowerCase()))
            : null;
          return {
            fileName: file.name,
            transcript,
            agentId: matchedUser ? (matchedUser as any).id : "",
            customerName: header.customerName || "",
            callDuration: header.duration || "",
            promptId: "",
          };
        })
      );
      setDocxRows(rows);
      setBatchMsg(`${rows.length} dosya yüklendi.`);
    } catch {
      setBatchMsg("DOCX okuma hatası.");
    } finally {
      setDocxLoading(false);
    }
  };

  const updateDocxRow = (idx: number, field: string, value: string) => {
    setDocxRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const applyToAllDocxRows = (field: string, value: string) => {
    if (!value) return;
    setDocxRows(prev => prev.map(row => ({ ...row, [field]: value })));
  };

  const handleDocxBatchStart = async () => {
    const invalid = docxRows.filter(r => !r.agentId || !r.promptId || r.transcript.length < 50);
    if (invalid.length > 0) { setBatchMsg(`${invalid.length} satırda eksik alan (danışman, prompt veya transkript çok kısa).`); return; }
    setBatchLoading(true); setBatchResults(null); setBatchMsg("Analiz ediliyor...");
    try {
      const calls = docxRows.map(r => ({
        transcript: r.transcript,
        agentId: r.agentId,
        customerName: r.customerName || "Belirtilmedi",
        callDuration: r.callDuration || "Belirtilmedi",
        promptId: r.promptId,
      }));
      const res = await fetch("/api/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calls }) });
      const data = await res.json();
      if (!res.ok) { setBatchMsg(data.error || "Batch başarısız."); return; }
      setBatchResults(data);
      setBatchMsg(`Tamamlandı: ${data.success} başarılı, ${data.failed} başarısız.`);
      fetchEvaluations();
    } catch { setBatchMsg("Batch sırasında hata."); } finally { setBatchLoading(false); }
  };

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBatchFile(file); setBatchResults(null); setBatchMsg("");
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string; const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { setBatchMsg("CSV en az 2 satir icermeli."); return; }
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const transcriptIdx = headers.indexOf("transcript"); const agentIdx = headers.indexOf("agentname");
      const customerIdx = headers.indexOf("customername"); const durationIdx = headers.indexOf("callduration"); const typeIdx = headers.indexOf("calltype");
      if (transcriptIdx === -1) { setBatchMsg("CSV'de 'transcript' kolonu bulunamadi."); return; }
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        return { transcript: cols[transcriptIdx] || "", agentName: agentIdx >= 0 ? cols[agentIdx] : "", customerName: customerIdx >= 0 ? cols[customerIdx] : "", callDuration: durationIdx >= 0 ? cols[durationIdx] : "", callType: typeIdx >= 0 ? cols[typeIdx] : "AUTO" };
      }).filter(c => c.transcript.length >= 50);
      setBatchCalls(parsed); setBatchMsg(`${parsed.length} cagri basariyla parse edildi.`);
    };
    reader.readAsText(file);
  };
  const handleBatchStart = async () => {
    if (batchCalls.length === 0) return; setBatchLoading(true); setBatchResults(null); setBatchMsg("Analiz ediliyor...");
    try { const res = await fetch("/api/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calls: batchCalls }) });
      const data = await res.json(); if (!res.ok) { setBatchMsg(data.error || "Batch basarisiz."); return; }
      setBatchResults(data); setBatchMsg(`Tamamlandi: ${data.success} basarili, ${data.failed} basarisiz.`); fetchEvaluations();
    } catch { setBatchMsg("Batch sirasinda hata."); } finally { setBatchLoading(false); }
  };

  const fetchScores = async (agentId?: string) => { setScoresLoading(true); const url = agentId ? `/api/scores?agentId=${agentId}` : "/api/scores"; const res = await fetch(url); if (res.ok) { const data = await res.json(); setScoresData(data); } setScoresLoading(false); };
  const handleDeleteEvaluation = async (id: string) => {
    const res = await fetch(`/api/evaluations/${id}`, { method: "DELETE" });
    if (res.ok) setEvaluations((prev) => prev.filter((ev) => ev.id !== id));
  };
  const handleLogout = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; };
  const roleLabel = (role: string) => ({ AGENT: "Danışman", TEAM_LEADER: "Takım Lideri", MANAGER: "Müdür", ADMIN: "Admin" }[role] || role);

  const topAgent = evaluations.length ? evaluations.reduce((best, e) => (!best || e.score > best.score ? e : best), null) : null;
  const topTeam = users.filter(u => u.role === "TEAM_LEADER")[0];
  const filteredEvals = evaluations.filter(ev =>
    ev.agent?.name?.toLowerCase().includes(search.toLowerCase()) || ev.customerName?.toLowerCase().includes(search.toLowerCase())
  );
  const avgScore = evaluations.length ? Math.round(evaluations.reduce((a, e) => a + e.score, 0) / evaluations.length) : 0;
  const secondCallCount = evaluations.filter(e => e.callType === "SECOND_CALL" || !e.callType).length;

  const isAdmin = ["ADMIN", "MANAGER"].includes(currentUser?.role);

  // Sidebar navigation items
  const navItems = [
    { key: "home", icon: "home", label: t.nav_home },
    { key: "calls", icon: "call", label: t.nav_calls },
    { key: "status", icon: "analytics", label: t.nav_status },
    { key: "reports", icon: "assessment", label: t.nav_reports },
    { key: "scores", icon: "star", label: t.nav_scores },
    { key: "compare", icon: "compare_arrows", label: "Karşılaştırma" },
  ];

  return (
    <div className="flex min-h-screen bg-surface text-on-surface font-sans">

      {/* ── SIDEBAR ── */}
      <aside className="h-screen w-64 fixed left-0 top-0 overflow-y-auto bg-surface-container-low shadow-[0px_24px_48px_rgba(0,27,60,0.2)] flex flex-col py-8 px-4 justify-between z-50">
        <div>
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <div className="animate-3d-rotate w-16 h-16 mb-4">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-tertiary opacity-80" />
            </div>
            <div className="font-headline text-2xl font-extrabold tracking-tighter text-primary drop-shadow-lg">Estenove</div>
            <div className="text-xs text-slate-400 tracking-widest uppercase mt-1">{t.salesPerformance}</div>
          </div>

          {/* Nav Search */}
          <div className="relative mb-3">
            <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none" />
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder={t.search}
              className="w-full bg-surface-container rounded-xl pl-9 pr-8 py-2 text-xs text-on-surface placeholder-slate-500 border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
            {navSearch && (
              <button onClick={() => setNavSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-on-surface transition-colors">
                <MIcon name="close" className="text-base" />
              </button>
            )}
          </div>

          {/* Nav */}
          <nav className="space-y-1">
            {(() => {
              const q = navSearch.toLowerCase();
              const filtered = navItems.filter(i => i.label.toLowerCase().includes(q));
              const adminItems = [
                { key: "batch", icon: "upload_file", label: t.nav_batch },
              ];
              const filteredAdmin = adminItems.filter(i => i.label.toLowerCase().includes(q));
              const noResults = filtered.length === 0 && (!isAdmin || filteredAdmin.length === 0);

              return (
                <>
                  {filtered.map((item) => (
                    <a key={item.key}
                      onClick={() => { setActiveTab(item.key); setNavSearch(""); if (item.key === "scores" && !scoresData) fetchScores(); if (item.key === "reports") fetchAutoReport(); }}
                      className={`flex items-center gap-3 py-3 px-4 transition-all duration-300 font-sans text-sm cursor-pointer rounded-xl ${
                        activeTab === item.key
                          ? "text-primary border-l-2 border-primary bg-gradient-to-r from-primary/10 to-transparent font-semibold"
                          : "text-slate-400 hover:text-on-surface hover:bg-surface-container-highest"
                      }`}
                    >
                      <MIcon name={item.icon} /> {item.label}
                    </a>
                  ))}

                  {isAdmin && filteredAdmin.length > 0 && (
                    <>
                      {!navSearch && (
                        <div className="pt-4 mt-4 border-t border-outline-variant">
                          <div className="px-4 mb-2 text-[10px] font-bold tracking-widest text-slate-600 uppercase">{t.management}</div>
                        </div>
                      )}
                      {navSearch && filtered.length > 0 && <div className="my-1 border-t border-outline-variant/40" />}
                      {filteredAdmin.map((item) => (
                        <a key={item.key}
                          onClick={() => { setActiveTab(item.key); setNavSearch(""); }}
                          className={`flex items-center gap-3 py-3 px-4 transition-all duration-300 font-sans text-sm cursor-pointer rounded-xl ${
                            activeTab === item.key
                              ? "text-primary border-l-2 border-primary bg-gradient-to-r from-primary/10 to-transparent font-semibold"
                              : "text-slate-400 hover:text-on-surface hover:bg-surface-container-highest"
                          }`}
                        >
                          <MIcon name={item.icon} /> {item.label}
                        </a>
                      ))}
                    </>
                  )}

                  {noResults && (
                    <div className="py-6 text-center text-xs text-slate-600">
                      <MIcon name="search_off" className="block mx-auto mb-1 text-2xl opacity-40" />
                      {t.noResults}
                    </div>
                  )}
                </>
              );
            })()}
          </nav>
        </div>

        {/* Bottom */}
        <div className="pt-6 border-t border-outline-variant">
          {isAdmin && (
            <a onClick={() => { window.location.href = "/settings/admin"; }} className="flex items-center gap-3 py-3 px-4 text-slate-400 hover:text-white transition-colors font-sans text-sm cursor-pointer">
              <MIcon name="settings" /> {t.adminSettings}
            </a>
          )}
          <a onClick={handleLogout} className="flex items-center gap-3 py-3 px-4 text-slate-400 hover:text-on-surface transition-colors font-sans text-sm cursor-pointer">
            <MIcon name="logout" /> {t.logout}
          </a>
          <div className="mt-4 p-3 bg-surface-bright rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-xs font-bold">
              {currentUser?.name?.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-semibold truncate">{currentUser?.name}</div>
              <div className="text-[10px] text-slate-400">{roleLabel(currentUser?.role)}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="ml-64 flex-1 min-h-screen">
        {/* Top Header */}
        <header className="flex items-center justify-between px-10 py-6 w-full sticky top-0 z-40 backdrop-blur-lg bg-surface/80">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-container-lowest border-none rounded-full py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                placeholder={t.searchPlaceholder}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLang}
              title={lang === "tr" ? "Switch to English" : "Türkçe'ye Geç"}
              className="h-10 px-3 flex items-center gap-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-slate-400 hover:text-primary transition-all text-xs font-bold tracking-wide"
            >
              <MIcon name="translate" className="text-base" />
              {lang === "tr" ? "TR" : "EN"}
            </button>
            <button
              onClick={toggleTheme}
              title={isDark ? t.lightMode : t.darkMode}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-slate-400 hover:text-primary transition-all"
            >
              <MIcon name={isDark ? "light_mode" : "dark_mode"} className="text-xl" />
            </button>
            {isAdmin && (
              <Link href="/call/1">
                <button className="bg-gradient-to-r from-primary to-tertiary px-6 py-2.5 rounded-full text-on-primary font-bold text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
                  <MIcon name="mic" className="text-lg" /> {t.newAnalysis}
                </button>
              </Link>
            )}
            <NotificationBell lang={lang} />
            {currentUser && (
              <UserMenu user={currentUser} lang={lang} onLogout={handleLogout} />
            )}
          </div>
        </header>

        <div className="px-10 pb-12 space-y-12">

          {/* ═══ HOME ═══ */}
          {activeTab === "home" && (
            <>
              {/* Hero */}
              <section data-bg="dark" className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1A5799] to-[#092F64] p-12 min-h-[400px] flex flex-col justify-center">
                <div className="absolute right-0 top-0 w-1/2 h-full opacity-20 pointer-events-none">
                  <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />
                </div>
                <div className="relative z-10 max-w-2xl">
                  <h1 className="font-headline text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
                    {t.heroTitle} <br /> {t.heroTitle2}
                  </h1>
                  <p className="text-secondary-fixed text-lg leading-relaxed mb-8 opacity-90">
                    {t.heroSubtitle}
                  </p>
                  <div className="flex gap-4">
                    <button onClick={() => setActiveTab("calls")} className="px-8 py-4 bg-white text-[#092F64] font-bold rounded-xl hover:bg-secondary-fixed transition-colors active:scale-95">
                      {t.callsBtn}
                    </button>
                    {isAdmin && (
                      <Link href="/call/1">
                        <button className="px-8 py-4 glass-panel text-white font-bold rounded-xl border border-white/10 hover:bg-white/20 transition-colors active:scale-95 flex items-center gap-2">
                          <MIcon name="mic" /> {t.newAnalysis}
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              </section>

              {/* KPI Metrics Bento */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-surface-container rounded-3xl p-8 flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-slate-400 text-sm font-semibold tracking-wider">{t.automatedAuditScore}</div>
                      <MIcon name="verified_user" className="text-primary" />
                    </div>
                    <div className="font-headline text-6xl font-black text-white">{avgScore}<span className="text-2xl text-primary">%</span></div>
                  </div>
                  <div className="flex items-center gap-2 text-secondary-fixed-dim text-sm mt-4">
                    <MIcon name="trending_up" className="text-sm" />
                    <span>{t.avgQualityScore}</span>
                  </div>
                </div>
                <div className="bg-surface-container rounded-3xl p-8 flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-slate-400 text-sm font-semibold tracking-wider">{t.consultantPerformance}</div>
                      <MIcon name="insights" className="text-primary" />
                    </div>
                    <div className="font-headline text-6xl font-black text-white">{(avgScore / 10).toFixed(1)}<span className="text-2xl text-primary">/10</span></div>
                  </div>
                  <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden mt-4">
                    <div className="bg-primary h-full transition-all" style={{ width: `${avgScore}%` }} />
                  </div>
                </div>
                <div className="bg-surface-container rounded-3xl p-8 flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-slate-400 text-sm font-semibold tracking-wider">{t.secondCallCount}</div>
                      <MIcon name="call" className="text-primary" />
                    </div>
                    <div className="font-headline text-6xl font-black text-white">{secondCallCount}</div>
                  </div>
                  <div className="flex items-center gap-2 text-secondary-fixed-dim text-sm mt-4">
                    <MIcon name="call" className="text-sm" />
                    <span>{t.totalEvaluations(evaluations.length)}</span>
                  </div>
                </div>
              </section>

              {/* BESTS */}
              {topAgent && (
                <section>
                  <div className="flex items-end justify-between mb-8">
                    <div>
                      <h2 className="font-headline text-3xl font-bold text-white">{t.bests}</h2>
                      <p className="text-slate-400 mt-2">{t.topPerformers}</p>
                    </div>
                    <a onClick={() => setActiveTab("scores")} className="text-primary font-bold hover:underline flex items-center gap-2 cursor-pointer">
                      {t.viewRankings} <MIcon name="arrow_forward" />
                    </a>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="group relative overflow-hidden rounded-3xl bg-surface-container-high hover:-translate-y-2 transition-transform duration-500 p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center text-on-primary text-2xl font-black">
                          {topAgent.agent?.name?.charAt(0)}
                        </div>
                        <div>
                          <div className="bg-primary text-on-primary font-black px-3 py-1 rounded-full text-xs inline-block mb-1">#1</div>
                          <div className="font-headline text-xl font-bold text-white">{topAgent.agent?.name}</div>
                          <div className="text-slate-400 text-sm">{t.bestSalesAdvisor}</div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="bg-surface-container-highest px-2 py-1 rounded">{t.score}: {topAgent.score}</span>
                        <span className="text-primary font-bold">{evaluations.filter(e => e.agentId === topAgent.agentId).length} Calls</span>
                      </div>
                    </div>
                    {topTeam && (
                      <div className="group relative overflow-hidden rounded-3xl bg-surface-container-high hover:-translate-y-2 transition-transform duration-500 p-6">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-16 h-16 rounded-2xl bg-secondary-container flex items-center justify-center text-secondary text-2xl font-black">
                            {topTeam.name?.charAt(0)}
                          </div>
                          <div>
                            <div className="bg-surface-container-highest text-white font-black px-3 py-1 rounded-full text-xs inline-block mb-1">#1</div>
                            <div className="font-headline text-xl font-bold text-white">{topTeam.name}</div>
                            <div className="text-slate-400 text-sm">{t.bestSalesTeam}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Recent Evaluations + Quality Trend */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-surface-container rounded-3xl p-10">
                  <h3 className="font-headline text-2xl font-bold mb-6">{t.recentEvaluations}</h3>
                  <div className="space-y-4">
                    {evaluations.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-8">{t.noEvaluationsYet}</p>
                    ) : (
                      evaluations.slice(0, 4).map((ev, i) => (
                        <EvalItem key={ev.id} ev={ev} index={i} detailLabel={t.detail} isAdmin={isAdmin} onDelete={handleDeleteEvaluation} />
                      ))
                    )}
                  </div>
                  {evaluations.length > 0 && (
                    <div className="pt-4 text-center">
                      <button onClick={() => setActiveTab("calls")} className="text-primary font-bold text-sm hover:underline flex items-center gap-1 mx-auto">
                        {t.seeAll} <ArrowUpRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="bg-surface-container rounded-3xl p-10 flex flex-col">
                  <h3 className="font-headline text-2xl font-bold mb-2">{t.qualityTrend}</h3>
                  <p className="text-slate-400 text-sm mb-8">{t.qualityTrendSub}</p>
                  <div className="flex-1 flex items-end gap-3 min-h-[200px]">
                    {t.days.map((day, i) => {
                      const heights = [65, 85, 75, 95, 80];
                      return (
                        <div key={day} className="flex-1 bg-surface-container-lowest rounded-t-xl relative group" style={{ height: `${heights[i]}%` }}>
                          <div className="absolute inset-x-0 bottom-0 bg-primary/20 rounded-t-xl h-full group-hover:bg-primary/40 transition-all" />
                          <div className="absolute -bottom-8 inset-x-0 text-center text-xs text-slate-500">{day}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ═══ CALLS ═══ */}
          {activeTab === "calls" && (
            <div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h1 className="font-headline text-3xl font-bold text-white">{t.callsTitle}</h1>
                <p className="text-sm text-slate-400 mt-1">{t.callsSub}</p>
              </motion.div>
              {filteredEvals.length === 0 ? (
                <div className="py-24 text-center"><MIcon name="call" className="text-6xl opacity-10 block mx-auto mb-4" /><p className="text-slate-500">{t.noEvals}</p></div>
              ) : (
                <div className="bg-surface-container rounded-3xl p-6 space-y-2">
                  {filteredEvals.map((ev, i) => <EvalItem key={ev.id} ev={ev} index={i} detailLabel={t.detail} isAdmin={isAdmin} onDelete={handleDeleteEvaluation} />)}
                </div>
              )}
            </div>
          )}

          {/* ═══ CALLS STATUS ═══ */}
          {activeTab === "status" && (
            <div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h1 className="font-headline text-3xl font-bold text-white">{t.callsStatusTitle}</h1>
                <p className="text-sm text-slate-400 mt-1">{t.callsStatusSub}</p>
              </motion.div>
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: t.totalCalls, value: evaluations.length, icon: "call", color: "text-primary" },
                  { label: t.avgScore, value: evaluations.length ? `%${avgScore}` : "—", icon: "insights", color: "text-emerald-400" },
                  { label: t.highest, value: evaluations.length ? `%${Math.max(...evaluations.map(e => e.score))}` : "—", icon: "emoji_events", color: "text-amber-400" },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="bg-surface-container rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-slate-400 text-sm font-semibold tracking-wider">{stat.label.toUpperCase()}</div>
                      <MIcon name={stat.icon} className="text-primary" />
                    </div>
                    <p className={`font-headline text-5xl font-black ${stat.color}`}>{stat.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SKORLARIM ═══ */}
          {activeTab === "scores" && (
            <div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h1 className="font-headline text-3xl font-bold text-white">{t.scoresTitle}</h1>
                <p className="text-sm text-slate-400 mt-1">{t.scoresSub}</p>
              </motion.div>
              {currentUser?.role !== "AGENT" && (
                <div className="bg-surface-container rounded-3xl p-6 mb-6">
                  <select value={selectedScoreAgent} onChange={(e) => { setSelectedScoreAgent(e.target.value); fetchScores(e.target.value || undefined); }}
                    className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary transition-all">
                    <option value="">{t.myOwnScores}</option>
                    {users.filter(u => u.role === "AGENT").map(u => (<option key={u.id} value={u.id}>{u.name} ({u.team?.name || t.noTeam})</option>))}
                  </select>
                </div>
              )}
              {scoresLoading ? (
                <div className="py-24 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : scoresData ? (
                <div className="space-y-6">
                  <div className="bg-surface-container rounded-3xl p-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-xl font-black">{scoresData.agent.name.charAt(0)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-white">{scoresData.agent.name}</h2>
                          {scoresData.isDemo && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">DEMO</span>}
                        </div>
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-primary/20 bg-primary/10 text-primary">{scoresData.agent.team}</span>
                          <span className="flex items-center gap-1"><MIcon name="emoji_events" className="text-amber-400 text-sm" /> #{scoresData.rank} / {scoresData.totalAgents}</span>
                        </p>
                      </div>
                    </div>
                    <div className={`font-headline text-6xl font-black ${scoresData.stats.avgScore >= 85 ? "text-emerald-400" : scoresData.stats.avgScore >= 70 ? "text-primary" : scoresData.stats.avgScore >= 55 ? "text-amber-400" : "text-error"}`}>%{scoresData.stats.avgScore}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    {[{ label: t.totalCalls, value: scoresData.stats.totalCalls, color: "text-primary" }, { label: t.avgScore, value: `%${scoresData.stats.avgScore}`, color: "text-emerald-400" }, { label: t.highest, value: `%${scoresData.stats.highestScore}`, color: "text-amber-400" }].map(s => (
                      <div key={s.label} className="bg-surface-container rounded-3xl p-6"><p className="text-slate-400 text-sm font-semibold tracking-wider mb-2">{s.label.toUpperCase()}</p><p className={`font-headline text-4xl font-black ${s.color}`}>{s.value}</p></div>
                    ))}
                  </div>
                  <div className="bg-surface-container rounded-3xl p-8">
                    <h3 className="font-headline text-lg font-bold mb-6 flex items-center gap-2"><MIcon name="trending_up" className="text-emerald-400" /> {t.weeklyProgress}</h3>
                    <div className="space-y-4">
                      {scoresData.weeklyProgress.map((week: any, idx: number) => {
                        const prev = idx > 0 ? scoresData.weeklyProgress[idx - 1].score : week.score;
                        const change = week.score - prev;
                        return (
                          <div key={week.week} className="flex items-center justify-between">
                            <div className="flex items-center gap-3"><MIcon name="calendar_today" className="text-slate-500 text-sm" /><span className="text-sm text-slate-400">{week.week}</span><span className="text-[10px] text-slate-600">({week.calls} {t.calls})</span></div>
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-2 bg-surface-container-lowest rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${week.score}%` }} /></div>
                              <span className={`font-bold text-sm ${week.score >= 85 ? "text-emerald-400" : week.score >= 70 ? "text-primary" : week.score >= 55 ? "text-amber-400" : "text-error"}`}>%{week.score}</span>
                              {idx > 0 && change !== 0 && (<span className={`text-xs flex items-center ${change > 0 ? "text-emerald-400" : "text-error"}`}>{change > 0 ? "+" : ""}{change}</span>)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-surface-container rounded-3xl p-6 space-y-2">
                    <h3 className="font-headline text-lg font-bold px-4 py-2 flex items-center gap-2"><MIcon name="call" className="text-primary" /> {t.recentCalls}</h3>
                    {scoresData.recentCalls.map((call: any, i: number) => (
                      <div key={call.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-high transition-colors">
                        <div className="flex items-center gap-4"><span className="text-xs text-slate-500">{call.date}</span><span className="text-sm font-medium">{call.customer}</span></div>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold ${call.score >= 85 ? "text-emerald-400" : call.score >= 70 ? "text-primary" : call.score >= 55 ? "text-amber-400" : "text-error"}`}>%{call.score}</span>
                          {!call.id.startsWith("demo-") && <Link href={`/evaluation/${call.id}`}><span className="text-xs text-slate-500 hover:text-primary transition-colors">{t.detailLink}</span></Link>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (<div className="py-24 text-center"><MIcon name="star" className="text-6xl opacity-10 block mx-auto mb-4" /><p className="text-slate-500">{t.loadingScores}</p></div>)}
            </div>
          )}

          {/* ═══ REPORTS ═══ */}
          {activeTab === "reports" && (
            <div className="flex gap-6">
              <div className="w-48 shrink-0 space-y-1">
                {[
                  { key: "weekly", label: t.weeklyReport, icon: "description" },
                  { key: "overview", label: t.overview, icon: "bar_chart" },
                  { key: "agent", label: t.agentPerformance, icon: "target" },
                  { key: "monthly", label: t.monthlyTracker, icon: "calendar_month" },
                  { key: "lost", label: t.lostDeals, icon: "warning" },
                ].map((item) => (
                  <div key={item.key} onClick={() => setReportsSubTab(item.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${reportsSubTab === item.key ? "bg-primary/10 text-primary font-bold" : "text-slate-500 hover:bg-surface-container-high hover:text-slate-300"}`}>
                    <MIcon name={item.icon} className="text-lg" /> {item.label}
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                  <h1 className="font-headline text-3xl font-bold text-white">{t.reportsTitle}</h1>
                  <p className="text-sm text-slate-400 mt-1">{t.reportsSub}</p>
                </motion.div>
                {reportsSubTab === "weekly" && (
                  <>
                    {autoReportLoading ? (
                      <div className="py-24 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /><p className="text-slate-500 mt-4 text-sm">{t.loadingReport}</p></div>
                    ) : (
                      <>
                        <div className="bg-surface-container rounded-3xl p-6 mb-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm font-semibold text-white flex items-center gap-2">
                                {customReportStart || customReportEnd ? t.customDateRange : t.last7Days} — {t.haftalikRapor}
                                {autoReportIsDemo && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">DEMO</span>}
                              </p>
                              {autoReportPeriod && (
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(autoReportPeriod.start).toLocaleDateString("tr-TR")} — {new Date(autoReportPeriod.end).toLocaleDateString("tr-TR")}
                                </p>
                              )}
                            </div>
                            <button onClick={() => { setAutoReportData(null); setCustomReportStart(""); setCustomReportEnd(""); fetchAutoReport(); }}
                              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                              <MIcon name="refresh" className="text-lg" /> {t.refresh}
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">{t.startDate}</label>
                              <input type="date" value={customReportStart}
                                onChange={(e) => setCustomReportStart(e.target.value)}
                                className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">{t.endDate}</label>
                              <input type="date" value={customReportEnd}
                                onChange={(e) => setCustomReportEnd(e.target.value)}
                                className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary" />
                            </div>
                            <div className="pt-4">
                              <button onClick={() => { setAutoReportData(null); fetchAutoReport(customReportStart || undefined, customReportEnd || undefined); }}
                                className="bg-gradient-to-r from-primary to-tertiary text-on-primary font-bold px-5 py-2 rounded-xl text-sm hover:shadow-lg transition-all">
                                {t.apply}
                              </button>
                            </div>
                          </div>
                        </div>
                        <WeeklyEvaluationReport data={autoReportData} />
                      </>
                    )}
                  </>
                )}
                {reportsSubTab === "overview" && (
                  <div className="space-y-8">
                    {autoReportData?.summary ? (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {[
                            { label: t.totalEval, value: autoReportData.summary.totalEvaluations, icon: "call", color: "text-primary" },
                            { label: t.secondCall, value: autoReportData.summary.totalSecondCalls, icon: "repeat", color: "text-emerald-400" },
                            { label: t.avgScoreLbl, value: `%${autoReportData.summary.avgScore}`, icon: "insights", color: "text-amber-400" },
                            { label: t.highPotential, value: autoReportData.summary.highPotential, icon: "trending_up", color: "text-emerald-400" },
                            { label: t.atRisk, value: autoReportData.summary.atRisk, icon: "warning", color: "text-error" },
                          ].map((s) => (
                            <div key={s.label} className="bg-surface-container rounded-3xl p-6">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-slate-400 text-[10px] font-semibold tracking-wider uppercase">{s.label}</p>
                                <MIcon name={s.icon} className={`${s.color} opacity-30`} />
                              </div>
                              <p className={`font-headline text-3xl font-black ${s.color}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                        {autoReportData.consultantPerformance?.length > 0 && (
                          <div>
                            <h3 className="font-headline text-lg font-bold text-white mb-4">{t.consultantPerfTitle(7)}</h3>
                            <div className="bg-surface-container rounded-3xl overflow-hidden">
                              <table className="w-full text-sm text-left">
                                <thead className="border-b border-outline-variant text-[10px] text-slate-500 uppercase tracking-widest">
                                  <tr><th className="px-6 py-3">{t.consultant}</th><th className="px-6 py-3 text-right">{t.callsCol}</th><th className="px-6 py-3 text-right">{t.scoreCol}</th></tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant">
                                  {autoReportData.consultantPerformance.map((c: any, i: number) => (
                                    <tr key={i} className="hover:bg-surface-container-high transition-colors">
                                      <td className="px-6 py-3 font-semibold">{c.name}</td>
                                      <td className="px-6 py-3 text-right text-slate-500">{c.calls}</td>
                                      <td className={`px-6 py-3 text-right font-black text-lg ${c.healthScore >= 80 ? "text-emerald-400" : c.healthScore >= 70 ? "text-primary" : c.healthScore >= 60 ? "text-amber-400" : "text-error"}`}>%{c.healthScore}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-16 text-center"><MIcon name="bar_chart" className="text-6xl opacity-10 block mx-auto mb-4" /><p className="text-slate-500">{t.loadingData}</p></div>
                    )}
                  </div>
                )}
                {reportsSubTab === "agent" && (
                  <div className="space-y-6">
                    {/* Danismaan Secici */}
                    <div className="bg-surface-container rounded-3xl p-6">
                      <div className="flex items-center gap-4">
                        <MIcon name="person_search" className="text-primary text-2xl" />
                        <select
                          onChange={(e) => { if (e.target.value) fetchScores(e.target.value); else setScoresData(null); }}
                          className="flex-1 bg-surface-container-lowest border-none rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-primary"
                        >
                          <option value="">{t.selectConsultant}</option>
                          {users.filter(u => u.role === "AGENT").map(u => (
                            <option key={u.id} value={u.id}>{u.name} {u.team ? `(${u.team.name})` : ""}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {scoresLoading ? (
                      <div className="py-16 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
                    ) : scoresData ? (
                      <>
                        {/* Profil Header */}
                        <div className="bg-surface-container rounded-3xl p-8">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-on-primary text-3xl font-black">
                                {scoresData.agent.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <h2 className="font-headline text-2xl font-bold text-white">{scoresData.agent.name}</h2>
                                  {scoresData.isDemo && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">DEMO</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="px-3 py-1 rounded-lg text-xs font-bold border border-primary/20 bg-primary/10 text-primary">{scoresData.agent.team}</span>
                                  <span className="flex items-center gap-1 text-sm text-slate-400">
                                    <MIcon name="emoji_events" className="text-amber-400 text-base" />
                                    {t.rankingLabel} #{scoresData.rank} / {scoresData.totalAgents}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-headline text-6xl font-black ${
                                scoresData.stats.avgScore >= 85 ? "text-emerald-400" :
                                scoresData.stats.avgScore >= 70 ? "text-primary" :
                                scoresData.stats.avgScore >= 55 ? "text-amber-400" : "text-error"
                              }`}>%{scoresData.stats.avgScore}</div>
                              <p className="text-xs text-slate-500 mt-1">{t.overallPerformance}</p>
                            </div>
                          </div>
                        </div>

                        {/* KPI Kartlari */}
                        <div className="grid grid-cols-4 gap-4">
                          {[
                            { label: t.totalCalls, value: scoresData.stats.totalCalls, icon: "call", color: "text-primary" },
                            { label: t.avgScore, value: `%${scoresData.stats.avgScore}`, icon: "insights", color: "text-emerald-400" },
                            { label: t.highestScore, value: `%${scoresData.stats.highestScore}`, icon: "emoji_events", color: "text-amber-400" },
                            { label: t.ranking, value: `#${scoresData.rank}`, icon: "leaderboard", color: "text-purple-400" },
                          ].map((s) => (
                            <div key={s.label} className="bg-surface-container rounded-2xl p-5">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-slate-400 text-[10px] font-semibold tracking-wider uppercase">{s.label}</p>
                                <MIcon name={s.icon} className={`${s.color} opacity-30 text-lg`} />
                              </div>
                              <p className={`font-headline text-3xl font-black ${s.color}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Haftalik Gelisim */}
                        <div className="bg-surface-container rounded-3xl p-8">
                          <h3 className="font-headline text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <MIcon name="trending_up" className="text-emerald-400" /> {t.weeklyProgress}
                          </h3>
                          <div className="space-y-4">
                            {scoresData.weeklyProgress.map((week: any, idx: number) => {
                              const prev = idx > 0 ? scoresData.weeklyProgress[idx - 1].score : week.score;
                              const change = week.score - prev;
                              return (
                                <div key={week.week} className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <MIcon name="calendar_today" className="text-slate-500 text-sm" />
                                    <span className="text-sm text-slate-400">{week.week}</span>
                                    <span className="text-[10px] text-slate-600">({week.calls} {t.calls})</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-32 h-2.5 bg-surface-container-lowest rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${
                                        week.score >= 85 ? "bg-emerald-500" :
                                        week.score >= 70 ? "bg-primary" :
                                        week.score >= 55 ? "bg-amber-500" : "bg-red-500"
                                      }`} style={{ width: `${week.score}%` }} />
                                    </div>
                                    <span className={`font-bold text-sm w-10 text-right ${
                                      week.score >= 85 ? "text-emerald-400" :
                                      week.score >= 70 ? "text-primary" :
                                      week.score >= 55 ? "text-amber-400" : "text-error"
                                    }`}>%{week.score}</span>
                                    {idx > 0 && change !== 0 && (
                                      <span className={`text-xs flex items-center gap-0.5 w-10 ${change > 0 ? "text-emerald-400" : "text-error"}`}>
                                        <MIcon name={change > 0 ? "arrow_upward" : "arrow_downward"} className="text-xs" />
                                        {Math.abs(change)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Son Cagrilar */}
                        <div className="bg-surface-container rounded-3xl p-6">
                          <h3 className="font-headline text-lg font-bold text-white mb-4 flex items-center gap-2 px-2">
                            <MIcon name="call" className="text-primary" /> {t.recentCalls}
                          </h3>
                          <div className="space-y-2">
                            {scoresData.recentCalls.length === 0 ? (
                              <p className="text-slate-500 text-sm text-center py-8">{t.noCallEvals}</p>
                            ) : (
                              scoresData.recentCalls.map((call: any, i: number) => (
                                <motion.div key={call.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                  className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-high transition-colors group">
                                  <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                    <MIcon name="description" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-semibold text-on-surface">{call.customer}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                      {call.date} · {call.duration}
                                      {call.callType && <span className="px-1.5 py-0.5 rounded text-[9px] border border-outline-variant text-slate-500">{call.callType.replace("_", " ")}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className={`font-headline text-xl font-black ${
                                      call.score >= 85 ? "text-emerald-400" :
                                      call.score >= 70 ? "text-primary" :
                                      call.score >= 55 ? "text-amber-400" : "text-error"
                                    }`}>%{call.score}</span>
                                    {!call.id.startsWith("demo-") && (
                                      <Link href={`/evaluation/${call.id}`}>
                                        <span className="text-xs text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
                                          {t.detailLink} <MIcon name="arrow_forward" className="text-sm" />
                                        </span>
                                      </Link>
                                    )}
                                  </div>
                                </motion.div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Danismaan secilmeden once tum danismanlarin listesi */
                      <div className="bg-surface-container rounded-3xl p-6">
                        <h3 className="font-headline text-lg font-bold text-white mb-4 px-2">{t.allConsultants}</h3>
                        <div className="space-y-2">
                          {users.filter(u => u.role === "AGENT").length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-8">{t.noConsultantsYet}</p>
                          ) : (
                            users.filter(u => u.role === "AGENT").map((u, i) => (
                              <motion.div key={u.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                                onClick={() => fetchScores(u.id)}
                                className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-high transition-colors cursor-pointer group">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary text-lg font-bold group-hover:scale-110 transition-transform">
                                    {u.name?.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-on-surface">{u.name}</p>
                                    <p className="text-xs text-slate-500">{u.team?.name || t.noTeam} · {u.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-slate-500 group-hover:text-primary transition-colors">
                                  <span className="text-sm">{t.viewDetails}</span>
                                  <MIcon name="chevron_right" className="text-lg" />
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {reportsSubTab === "monthly" && (<div className="py-16 text-center"><MIcon name="calendar_month" className="text-6xl opacity-10 block mx-auto mb-4" /><p className="text-slate-500">{t.monthlyTrackerSoon}</p></div>)}
                {reportsSubTab === "lost" && (<div className="py-16 text-center"><MIcon name="warning" className="text-6xl opacity-10 block mx-auto mb-4" /><p className="text-slate-500">{t.lostDealsSoon}</p></div>)}
              </div>
            </div>
          )}

          {activeTab === "compare" && (
            <ManagementComparisonView />
          )}

          {/* ═══ BATCH ═══ */}
          {activeTab === "batch" && isAdmin && (
            <div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h1 className="font-headline text-3xl font-bold text-white">{t.batchTitle}</h1>
                <p className="text-sm text-slate-400 mt-1">{t.batchSub}</p>
              </motion.div>

              {/* Mode tabs */}
              <div className="flex gap-2 mb-6">
                {(["csv", "docx"] as const).map(mode => (
                  <button key={mode} onClick={() => { setBatchMode(mode); setBatchResults(null); setBatchMsg(""); }}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${batchMode === mode ? "bg-primary text-on-primary" : "bg-surface-container text-slate-400 hover:text-white"}`}>
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* ── CSV mode ── */}
              {batchMode === "csv" && (
                <div className="bg-surface-container rounded-3xl p-8 mb-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">{t.uploadCSV}</h3>
                  <p className="text-xs text-slate-500 mb-4">{t.expectedColumns} <code className="text-slate-400">transcript</code> ({t.required}), <code className="text-slate-400">agentName</code>, <code className="text-slate-400">customerName</code>, <code className="text-slate-400">callDuration</code>, <code className="text-slate-400">callType</code></p>
                  <label className="flex flex-col items-center justify-center w-full h-32 bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-2xl cursor-pointer hover:border-primary/40 transition-all mb-4">
                    <MIcon name="upload_file" className="text-3xl text-slate-500 mb-2" />
                    <span className="text-sm text-slate-500">{batchFile ? batchFile.name : t.dropCSV}</span>
                    <input type="file" accept=".csv" onChange={handleBatchFileChange} className="hidden" />
                  </label>
                  {batchCalls.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs text-slate-500 font-bold uppercase mb-2">{t.preview(batchCalls.length)}</h4>
                      <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="border-b border-outline-variant text-[10px] text-slate-500 uppercase tracking-widest"><tr><th className="px-4 py-2">#</th><th className="px-4 py-2">{t.colAgent}</th><th className="px-4 py-2">{t.colCustomer}</th><th className="px-4 py-2">{t.colDuration}</th><th className="px-4 py-2">{t.colTranscript}</th></tr></thead>
                          <tbody className="divide-y divide-outline-variant">
                            {batchCalls.slice(0, 5).map((c, i) => (<tr key={i} className="text-slate-400"><td className="px-4 py-2 text-slate-500">{i + 1}</td><td className="px-4 py-2">{c.agentName || "—"}</td><td className="px-4 py-2">{c.customerName || "—"}</td><td className="px-4 py-2">{c.callDuration || "—"}</td><td className="px-4 py-2 truncate max-w-[200px]">{c.transcript.slice(0, 60)}...</td></tr>))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <button onClick={handleBatchStart} disabled={batchLoading || batchCalls.length === 0} className="bg-gradient-to-r from-primary to-tertiary text-on-primary font-bold px-6 py-2.5 rounded-xl text-sm hover:shadow-lg transition-all disabled:opacity-50">{batchLoading ? t.analyzing : t.analyzeNCalls(batchCalls.length)}</button>
                    {batchMsg && <p className={`text-sm ${batchMsg.includes("hata") || batchMsg.includes("basarisiz") || batchMsg.includes("eksik") ? "text-error" : "text-emerald-400"}`}>{batchMsg}</p>}
                  </div>
                </div>
              )}

              {/* ── DOCX mode ── */}
              {batchMode === "docx" && (
                <div className="bg-surface-container rounded-3xl p-8 mb-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">DOCX Yükle</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Her dosya = 1 çağrı. İsteğe bağlı başlık bloğu (belgenin ilk satırlarında):
                    <code className="ml-1 text-slate-400">Danışman: Ad Soyad</code>
                    <code className="ml-2 text-slate-400">Müşteri: Ad</code>
                    <code className="ml-2 text-slate-400">Süre: 14:30</code>
                    <span className="ml-2">ardından</span>
                    <code className="ml-1 text-slate-400">---</code>
                  </p>

                  <label className="flex flex-col items-center justify-center w-full h-32 bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-2xl cursor-pointer hover:border-primary/40 transition-all mb-6">
                    {docxLoading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                    ) : (
                      <>
                        <MIcon name="description" className="text-3xl text-slate-500 mb-2" />
                        <span className="text-sm text-slate-500">{docxRows.length > 0 ? `${docxRows.length} dosya yüklendi` : "DOCX dosyalarını seçin veya sürükleyin"}</span>
                        <span className="text-xs text-slate-600 mt-1">Birden fazla dosya seçilebilir</span>
                      </>
                    )}
                    <input type="file" accept=".docx" multiple onChange={handleDocxFilesChange} className="hidden" />
                  </label>

                  {docxRows.length > 0 && (
                    <>
                      {/* Apply-to-all row */}
                      <div className="flex flex-wrap gap-3 mb-4 p-4 bg-surface-container-lowest rounded-2xl">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-widest self-center">Tümüne Uygula:</span>
                        <div className="flex items-center gap-2">
                          <select value={applyAllAgentId} onChange={e => setApplyAllAgentId(e.target.value)}
                            className="bg-surface-container border-none rounded-xl px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary">
                            <option value="">— Danışman seç —</option>
                            {users.filter((u) => ["AGENT", "TEAM_LEADER"].includes(u.role)).map((u) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                          <button onClick={() => applyToAllDocxRows("agentId", applyAllAgentId)}
                            disabled={!applyAllAgentId}
                            className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-xl hover:bg-primary/30 transition-all disabled:opacity-40">
                            Danışmanı Uygula
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <select value={applyAllPromptId} onChange={e => setApplyAllPromptId(e.target.value)}
                            className="bg-surface-container border-none rounded-xl px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary">
                            <option value="">— Prompt seç —</option>
                            {prompts.filter((p) => p.isActive).map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.callType.replace("_", " ")})</option>
                            ))}
                          </select>
                          <button onClick={() => applyToAllDocxRows("promptId", applyAllPromptId)}
                            disabled={!applyAllPromptId}
                            className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-xl hover:bg-primary/30 transition-all disabled:opacity-40">
                            Promptu Uygula
                          </button>
                        </div>
                      </div>

                      {/* Editable rows table */}
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full text-sm text-left">
                          <thead className="border-b border-outline-variant text-[10px] text-slate-500 uppercase tracking-widest">
                            <tr>
                              <th className="px-3 py-2 w-8">#</th>
                              <th className="px-3 py-2">Dosya</th>
                              <th className="px-3 py-2">Transkript</th>
                              <th className="px-3 py-2 min-w-[160px]">Danışman *</th>
                              <th className="px-3 py-2 min-w-[130px]">Müşteri</th>
                              <th className="px-3 py-2 min-w-[100px]">Süre</th>
                              <th className="px-3 py-2 min-w-[180px]">Prompt *</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant">
                            {docxRows.map((row, i) => {
                              const missing = !row.agentId || !row.promptId || row.transcript.length < 50;
                              return (
                                <tr key={i} className={missing ? "bg-error/5" : ""}>
                                  <td className="px-3 py-2 text-slate-500 text-xs">{i + 1}</td>
                                  <td className="px-3 py-2 text-xs text-slate-400 max-w-[120px] truncate" title={row.fileName}>{row.fileName}</td>
                                  <td className="px-3 py-2 text-xs text-slate-500 max-w-[180px]" title={row.transcript}>
                                    <span className="truncate block">{row.transcript.slice(0, 55)}{row.transcript.length > 55 ? "…" : ""}</span>
                                    <span className={`text-[10px] ${row.transcript.length < 50 ? "text-error" : "text-slate-600"}`}>{row.transcript.length} kar.</span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <select value={row.agentId} onChange={e => updateDocxRow(i, "agentId", e.target.value)}
                                      className={`w-full bg-surface-container-lowest border-none rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary ${!row.agentId ? "ring-1 ring-error/50" : ""}`}>
                                      <option value="">— Seç —</option>
                                      {users.filter((u) => ["AGENT", "TEAM_LEADER"].includes(u.role)).map((u) => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input type="text" value={row.customerName} onChange={e => updateDocxRow(i, "customerName", e.target.value)}
                                      placeholder="Müşteri adı"
                                      className="w-full bg-surface-container-lowest border-none rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-primary" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input type="text" value={row.callDuration} onChange={e => updateDocxRow(i, "callDuration", e.target.value)}
                                      placeholder="14:30"
                                      className="w-full bg-surface-container-lowest border-none rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-primary" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select value={row.promptId} onChange={e => updateDocxRow(i, "promptId", e.target.value)}
                                      className={`w-full bg-surface-container-lowest border-none rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary ${!row.promptId ? "ring-1 ring-error/50" : ""}`}>
                                      <option value="">— Seç —</option>
                                      {prompts.filter((p) => p.isActive).map((p) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.callType.replace("_", " ")})</option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-4">
                    <button onClick={handleDocxBatchStart} disabled={batchLoading || docxRows.length === 0}
                      className="bg-gradient-to-r from-primary to-tertiary text-on-primary font-bold px-6 py-2.5 rounded-xl text-sm hover:shadow-lg transition-all disabled:opacity-50">
                      {batchLoading ? t.analyzing : t.analyzeNCalls(docxRows.length)}
                    </button>
                    {batchMsg && <p className={`text-sm ${batchMsg.includes("hata") || batchMsg.includes("başarısız") || batchMsg.includes("eksik") ? "text-error" : "text-emerald-400"}`}>{batchMsg}</p>}
                  </div>
                </div>
              )}

              {/* Results */}
              {batchResults && (
                <div className="bg-surface-container rounded-3xl p-8">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">{t.results}</h3>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-surface-container-lowest rounded-xl p-4 text-center"><p className="text-[10px] text-slate-500 uppercase mb-1">{t.total}</p><p className="text-2xl font-black text-white">{batchResults.total}</p></div>
                    <div className="bg-surface-container-lowest rounded-xl p-4 text-center"><p className="text-[10px] text-slate-500 uppercase mb-1">{t.successful}</p><p className="text-2xl font-black text-emerald-400">{batchResults.success}</p></div>
                    <div className="bg-surface-container-lowest rounded-xl p-4 text-center"><p className="text-[10px] text-slate-500 uppercase mb-1">{t.failed}</p><p className="text-2xl font-black text-error">{batchResults.failed}</p></div>
                  </div>
                  {batchResults.results?.filter((r: any) => !r.success).length > 0 && (
                    <div className="mb-6">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Başarısız Çağrılar</p>
                      <div className="space-y-2">
                        {batchResults.results.filter((r: any) => !r.success).map((r: any) => (
                          <div key={r.index} className="flex items-start gap-3 bg-error/10 rounded-xl px-4 py-2.5 text-xs">
                            <span className="text-slate-400 shrink-0">#{r.index + 1}{docxRows[r.index]?.fileName ? ` — ${docxRows[r.index].fileName}` : ""}</span>
                            <span className="text-error">{r.error || "Bilinmeyen hata"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => setActiveTab("calls")} className="text-sm text-primary hover:underline flex items-center gap-1">{t.viewEvals} <ArrowUpRight size={14} /></button>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
