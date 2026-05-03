"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import KPISummary from "@/app/components/shared/KPISummary";
import EvaluationList from "@/app/components/shared/EvaluationList";
import ScoreView from "@/app/components/shared/ScoreView";
import ReportsView from "@/app/components/shared/ReportsView";
import TeamMemberPicker from "@/app/components/shared/TeamMemberPicker";
import DateRangePicker from "@/app/components/shared/DateRangePicker";
import MIcon from "@/app/components/shared/MIcon";
import { translations } from "@/app/lib/i18n";
import UserMenu from "@/app/components/shared/UserMenu";
import NotificationBell from "@/app/components/shared/NotificationBell";

interface TeamLeaderDashboardProps {
  user: { id: string; name: string; role: string; email: string };
  isDark: boolean;
  lang: "tr" | "en";
  initialTab?: string;
  onToggleTheme: () => void;
  onToggleLang: () => void;
  onLogout: () => void;
}

export default function TeamLeaderDashboard({ user, isDark, lang, initialTab = "home", onToggleTheme, onToggleLang, onLogout }: TeamLeaderDashboardProps) {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState(initialTab);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [scoresData, setScoresData] = useState<any>(null);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [navSearch, setNavSearch] = useState("");

  // Feedback state
  const [fbCategory, setFbCategory] = useState<"system" | "evaluation" | "">("");
  const [fbComment, setFbComment] = useState("");
  const [fbStatus, setFbStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  // Team tab state
  const [members, setMembers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teamEvals, setTeamEvals] = useState<any[]>([]);
  const [teamEvalsLoading, setTeamEvalsLoading] = useState(false);
  const [selectedMemberScore, setSelectedMemberScore] = useState<any>(null);
  const [memberScoreLoading, setMemberScoreLoading] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberScoreError, setMemberScoreError] = useState("");

  // Reports tab filter
  const [reportMemberId, setReportMemberId] = useState("");

  useEffect(() => {
    fetch("/api/evaluations").then(r => r.json()).then(d => setEvaluations(d.evaluations || []));
    fetch("/api/team/members").then(r => r.json()).then(d => setMembers(d.members || []));
  }, []);

  const fetchScores = async () => {
    setScoresLoading(true);
    const res = await fetch("/api/scores");
    if (res.ok) setScoresData(await res.json());
    setScoresLoading(false);
  };

  const fetchTeamEvals = async () => {
    setTeamEvalsLoading(true);
    const params = new URLSearchParams();
    if (selectedIds.length) params.set("agentIds", selectedIds.join(","));
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const res = await fetch(`/api/evaluations?${params}`);
    if (res.ok) setTeamEvals((await res.json()).evaluations || []);
    setTeamEvalsLoading(false);
  };

  const openMemberDetail = async (memberId: string) => {
    setMemberScoreLoading(true);
    setMemberModalOpen(true);
    setSelectedMemberScore(null);
    setMemberScoreError("");
    const params = new URLSearchParams({ agentId: memberId });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    try {
      const res = await fetch(`/api/scores?${params}`);
      if (res.ok) {
        setSelectedMemberScore(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setMemberScoreError(data.error || "Veri yüklenemedi.");
      }
    } catch {
      setMemberScoreError("Bağlantı hatası.");
    } finally {
      setMemberScoreLoading(false);
    }
  };

  const avgScore = evaluations.length ? Math.round(evaluations.reduce((a, e) => a + e.score, 0) / evaluations.length) : 0;
  const highestScore = evaluations.length ? Math.max(...evaluations.map(e => e.score)) : 0;
  const teamAvgScore = teamEvals.length ? Math.round(teamEvals.reduce((a, e) => a + e.score, 0) / teamEvals.length) : 0;
  const teamHighest = teamEvals.length ? Math.max(...teamEvals.map(e => e.score)) : 0;

  const FB_LABELS = {
    tr: { title: "Geri Bildirim", subtitle: "Görüşlerinizi bizimle paylaşın.", catSystem: "Sistem", catSystemSub: "Arayüz, kullanım, genel", catEval: "Değerlendirme", catEvalSub: "Puanlama, rapor, analiz", comment: "Yorumunuz", placeholder: "Görüşlerinizi buraya yazın...", send: "Gönder", sending: "Gönderiliyor...", success: "Geri bildiriminiz iletildi, teşekkürler!", error: "Gönderme başarısız, tekrar deneyin." },
    en: { title: "Feedback", subtitle: "Share your thoughts with us.", catSystem: "System", catSystemSub: "Interface, usability, general", catEval: "Evaluation", catEvalSub: "Scoring, reports, analysis", comment: "Your Comment", placeholder: "Write your thoughts here...", send: "Send", sending: "Sending...", success: "Your feedback has been sent, thank you!", error: "Sending failed, please try again." },
  };
  const fb = FB_LABELS[lang];

  const handleSendFeedback = async () => {
    if (!fbCategory || !fbComment.trim()) return;
    setFbStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: fbCategory, comment: fbComment.trim() }),
      });
      if (!res.ok) throw new Error();
      setFbStatus("success");
      setTimeout(() => { setFbStatus("idle"); setFbCategory(""); setFbComment(""); }, 2000);
    } catch {
      setFbStatus("error");
      setTimeout(() => setFbStatus("idle"), 2500);
    }
  };

  const navItems = [
    { key: "home", icon: "home", label: t.nav_home },
    { key: "calls", icon: "call", label: t.nav_myCalls },
    { key: "scores", icon: "star", label: t.nav_scores },
    { key: "reports", icon: "assessment", label: t.nav_myReports },
    { key: "team", icon: "group", label: t.nav_myTeam },
    { key: "feedback", icon: "feedback", label: fb.title },
  ];

  const visibleMembers = selectedIds.length === 0 ? members : members.filter(m => selectedIds.includes(m.id));

  return (
    <div className="flex min-h-screen bg-surface text-on-surface font-sans">
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 overflow-y-auto bg-surface-container-low shadow-[0px_24px_48px_rgba(0,27,60,0.2)] flex flex-col py-8 px-4 justify-between z-50">
        <div>
          <div className="flex flex-col items-center mb-10">
            <div className="animate-3d-rotate w-16 h-16 mb-4">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-tertiary opacity-80" />
            </div>
            <div className="font-headline text-2xl font-extrabold tracking-tighter text-primary drop-shadow-lg">Estenove</div>
            <div className="text-xs text-slate-400 tracking-widest uppercase mt-1">{t.salesPerformance}</div>
          </div>

          <div className="relative mb-3">
            <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none" />
            <input type="text" value={navSearch} onChange={(e) => setNavSearch(e.target.value)} placeholder={t.search}
              className="w-full bg-surface-container rounded-xl pl-9 pr-8 py-2 text-xs text-on-surface placeholder-slate-500 border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
          </div>

          <nav className="space-y-1">
            {navItems.filter(i => i.label.toLowerCase().includes(navSearch.toLowerCase())).map(item => (
              <a key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  setNavSearch("");
                  if (item.key === "scores" && !scoresData) fetchScores();
                  if (item.key === "team" && teamEvals.length === 0) fetchTeamEvals();
                }}
                className={`flex items-center gap-3 py-3 px-4 transition-all duration-300 font-sans text-sm cursor-pointer rounded-xl ${
                  activeTab === item.key
                    ? "text-primary border-l-2 border-primary bg-gradient-to-r from-primary/10 to-transparent font-semibold"
                    : "text-slate-400 hover:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <MIcon name={item.icon} /> {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-outline-variant">
          <a onClick={onLogout} className="flex items-center gap-3 py-3 px-4 text-slate-400 hover:text-on-surface transition-colors font-sans text-sm cursor-pointer">
            <MIcon name="logout" /> {t.logout}
          </a>
          <div className="mt-4 p-3 bg-surface-bright rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-xs font-bold">
              {user.name?.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-semibold truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400">{t.role_teamLeader}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 min-h-screen">
        <header className="flex items-center justify-end px-10 py-6 w-full sticky top-0 z-40 backdrop-blur-lg bg-surface/80 gap-3">
          <button onClick={onToggleLang}
            className="h-10 px-3 flex items-center gap-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-slate-400 hover:text-primary transition-all text-xs font-bold tracking-wide">
            <MIcon name="translate" className="text-base" />{lang === "tr" ? "TR" : "EN"}
          </button>
          <button onClick={onToggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-slate-400 hover:text-primary transition-all">
            <MIcon name={isDark ? "light_mode" : "dark_mode"} className="text-xl" />
          </button>
          <NotificationBell lang={lang} />
          <UserMenu user={user} lang={lang} onLogout={onLogout} />
        </header>

        <div className="px-10 pb-12 space-y-8">
          {/* HOME */}
          {activeTab === "home" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">{t.greeting(user.name.split(" ")[0])}</h1>
                <p className="text-sm text-slate-400 mt-1">{t.ownPerfSummary}</p>
              </motion.div>
              <KPISummary avgScore={avgScore} totalCalls={evaluations.length} highestScore={highestScore} lang={lang} />
              <div className="bg-surface-container rounded-3xl p-10">
                <h3 className="font-headline text-2xl font-bold mb-6">{t.recentEvaluations}</h3>
                <EvaluationList evaluations={evaluations.slice(0, 4)} showAgent={false} />
              </div>
            </>
          )}

          {/* CALLS */}
          {activeTab === "calls" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">{t.nav_myCalls}</h1>
              </motion.div>
              <EvaluationList evaluations={evaluations} showAgent={false} />
            </>
          )}

          {/* SCORES */}
          {activeTab === "scores" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">{t.nav_scores}</h1>
              </motion.div>
              {scoresLoading ? (
                <div className="py-24 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : scoresData ? (
                <ScoreView data={scoresData} lang={lang} />
              ) : (
                <div className="py-24 text-center">
                  <MIcon name="star" className="text-6xl opacity-10 block mx-auto mb-4" />
                  <p className="text-slate-500">{t.clickForScores}</p>
                </div>
              )}
            </>
          )}

          {/* REPORTS */}
          {activeTab === "reports" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">{t.nav_myReports}</h1>
              </motion.div>
              <div className="bg-surface-container rounded-2xl px-5 py-4 flex items-center gap-4">
                <MIcon name="person_search" className="text-slate-500 text-xl shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">{lang === "tr" ? "Danışman Filtresi" : "Agent Filter"}</span>
                  <select
                    value={reportMemberId}
                    onChange={(e) => setReportMemberId(e.target.value)}
                    className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
                  >
                    <option value="">{lang === "tr" ? "Tüm Takım" : "Whole Team"}</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <ReportsView agentId={reportMemberId || undefined} lang={lang} />
            </>
          )}

          {/* TEAM */}
          {activeTab === "team" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">{t.nav_myTeam}</h1>
                <p className="text-sm text-slate-400 mt-1">{t.myTeamSub}</p>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  <TeamMemberPicker members={members} selectedIds={selectedIds} onChange={setSelectedIds} lang={lang} />
                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onStartChange={setStartDate}
                    onEndChange={setEndDate}
                    onApply={fetchTeamEvals}
                    lang={lang}
                  />
                </div>

                <div className="lg:col-span-2 space-y-6">
                  {teamEvals.length > 0 && (
                    <KPISummary
                      avgScore={teamAvgScore}
                      totalCalls={teamEvals.length}
                      highestScore={teamHighest}
                      lang={lang}
                      labels={{ avgScore: t.teamAvgLabel, performance: t.teamPerformanceLabel, calls: t.totalCallsLabel }}
                    />
                  )}

                  <div className="bg-surface-container rounded-3xl p-6">
                    <h3 className="font-headline text-lg font-bold text-white mb-4">{t.consultantScores}</h3>
                    {teamEvals.length === 0 && (
                      <p className="text-xs text-slate-500 mb-3">{t.applyFilterToLoad}</p>
                    )}
                    <div className="space-y-2">
                      {visibleMembers.map((m, i) => {
                        const memberEvals = teamEvals.filter(e => e.agentId === m.id);
                        const mAvg = memberEvals.length
                          ? Math.round(memberEvals.reduce((a, e) => a + e.score, 0) / memberEvals.length)
                          : null;
                        return (
                          <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                            onClick={() => openMemberDetail(m.id)}
                            className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-high transition-colors cursor-pointer group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary font-bold group-hover:scale-110 transition-transform">
                                {m.name.charAt(0)}
                              </div>
                              <p className="text-sm font-semibold">{m.name}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              {mAvg !== null ? (
                                <span className={`font-headline text-xl font-black ${mAvg >= 85 ? "text-emerald-400" : mAvg >= 70 ? "text-primary" : mAvg >= 55 ? "text-amber-400" : "text-error"}`}>%{mAvg}</span>
                              ) : (
                                <span className="text-slate-500 text-sm">—</span>
                              )}
                              <MIcon name="chevron_right" className="text-slate-500 group-hover:text-primary transition-colors" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {teamEvalsLoading ? (
                    <div className="py-12 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
                  ) : (
                    <EvaluationList evaluations={teamEvals} showAgent={true} emptyMessage={t.applyFilterHint} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Member Detail Modal */}
      <AnimatePresence>
        {memberModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm"
            onClick={() => setMemberModalOpen(false)}>
            <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full max-w-2xl bg-surface overflow-y-auto p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-headline text-2xl font-bold text-white">{t.consultantDetail}</h2>
                <button onClick={() => setMemberModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <MIcon name="close" className="text-2xl" />
                </button>
              </div>
              {memberScoreLoading ? (
                <div className="py-24 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : selectedMemberScore ? (
                <ScoreView data={selectedMemberScore} lang={lang} />
              ) : (
                <div className="py-24 text-center">
                  <MIcon name="error_outline" className="text-5xl text-slate-600 block mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">{memberScoreError || "Veri bulunamadı."}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

          {activeTab === "feedback" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg space-y-6">
              <div>
                <h1 className="font-headline text-3xl font-bold text-white">{fb.title}</h1>
                <p className="text-sm text-slate-400 mt-1">{fb.subtitle}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {([
                  { key: "system" as const, icon: "settings", title: fb.catSystem, sub: fb.catSystemSub },
                  { key: "evaluation" as const, icon: "assessment", title: fb.catEval, sub: fb.catEvalSub },
                ]).map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setFbCategory(cat.key)}
                    className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all text-center ${
                      fbCategory === cat.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/40 hover:bg-surface-container-high"
                    }`}
                  >
                    <MIcon name={cat.icon} className="text-3xl" />
                    <div>
                      <p className="text-sm font-bold">{cat.title}</p>
                      <p className="text-xs mt-0.5 opacity-70">{cat.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">{fb.comment}</label>
                <textarea
                  value={fbComment}
                  onChange={(e) => { setFbComment(e.target.value); setFbStatus("idle"); }}
                  placeholder={fb.placeholder}
                  rows={5}
                  disabled={fbStatus === "sending"}
                  className="w-full bg-surface-container rounded-2xl px-4 py-3 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                />
              </div>

              {fbStatus === "success" && <p className="text-emerald-400 text-sm font-medium">{fb.success}</p>}
              {fbStatus === "error" && <p className="text-error text-sm">{fb.error}</p>}

              <button
                onClick={handleSendFeedback}
                disabled={fbStatus === "sending" || !fbCategory || !fbComment.trim()}
                className="flex items-center gap-2 bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-on-primary px-6 py-3 rounded-xl text-sm font-bold transition-all"
              >
                {fbStatus === "sending" ? (
                  <><div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />{fb.sending}</>
                ) : (
                  <><MIcon name="send" className="text-base" />{fb.send}</>
                )}
              </button>
            </motion.div>
          )}
    </div>
  );
}
