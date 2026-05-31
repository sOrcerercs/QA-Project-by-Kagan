"use client";

import { useState, useEffect } from "react";
import AdminPanel from "@/app/components/shared/AdminPanel";
import styles from "./LandingPage.module.css";
import EvaluationList from "@/app/components/shared/EvaluationList";
import EvaluationsView from "@/app/components/shared/EvaluationsView";
import ScoreView from "@/app/components/shared/ScoreView";
import ReportsView from "@/app/components/shared/ReportsView";
import DateRangePicker from "@/app/components/shared/DateRangePicker";
import TeamMemberPicker from "@/app/components/shared/TeamMemberPicker";
import NotificationBell from "@/app/components/shared/NotificationBell";
import PeerComparisonView from "@/app/components/shared/PeerComparisonView";
import NegativeKeywordsReport from "@/app/components/shared/NegativeKeywordsReport";
import LeaderboardView from "@/app/components/shared/LeaderboardView";
import CoachingTrackingView from "@/app/components/shared/CoachingTrackingView";
import SearchView from "@/app/components/shared/SearchView";

/* ── Theme tokens ── */
const DARK_THEME = {
  "--bg": "#08090b", "--fg": "#ffffff",
  "--fg-dim": "rgba(255,255,255,.62)", "--fg-faint": "rgba(255,255,255,.4)",
  "--accent": "#3b82f6", "--rule": "rgba(255,255,255,.14)",
  "--glass-bg": "rgba(12,14,18,.32)", "--glass-border": "rgba(255,255,255,.12)",
} as const;

const LIGHT_THEME = {
  "--bg": "#faf9f5", "--fg": "#1a1814",
  "--fg-dim": "rgba(26,24,20,.72)", "--fg-faint": "rgba(26,24,20,.5)",
  "--accent": "#b8542a", "--rule": "rgba(26,24,20,.1)",
  "--glass-bg": "rgba(255,253,248,.72)", "--glass-border": "rgba(26,24,20,.08)",
} as const;

/* ── Nav config ── */
const NAV_LABELS: Record<"tr" | "en", Record<string, string>> = {
  tr: {
    home: "Ana Sayfa", evaluations: "Değerlendirmeler", scores: "Skorlarım",
    reports: "Raporlarım", teamreports: "Raporlar", team: "Takımım",
    feedback: "Geri Bildirim", status: "Çağrı Durumu",
    batch: "Toplu Analiz", admin: "Ayarlar", peer: "Nasıl Gidiyorum?",
    feedbacks: "Geri Bildirimler", sync: "Senkronizasyon",
    recentCalls: "Son Çağrılar",
    negKeywords: "Negatif Kelimeler",
    coachingTracking: "Coaching Takibi",
    leaderboard: "Sıralama",
    advisor: "Danışman Paneli",
    search: "Arama",
  },
  en: {
    home: "Home", evaluations: "Evaluations", scores: "My Scores",
    reports: "My Reports", teamreports: "Reports", team: "My Team",
    feedback: "Feedback", status: "Calls Status",
    batch: "Bulk Analysis", admin: "Settings", peer: "How Am I Doing?",
    feedbacks: "Feedbacks", sync: "Synchronization",
    recentCalls: "Recent Calls",
    negKeywords: "Negative Keywords",
    coachingTracking: "Coaching Tracking",
    leaderboard: "Rankings",
    advisor: "Advisor Dashboard",
    search: "Search",
  },
};

/* ── Icons ── */
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 1.5,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home": return <svg {...p}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>;
    case "phone": return <svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>;
    case "list": return <svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
    case "doc": return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M9 14h6M9 17h4"/></svg>;
    case "star": return <svg {...p}><path d="M12 3l2.6 5.7L21 9.5l-4.5 4.4 1.1 6.4L12 17.7 6.4 20.3l1.1-6.4L3 9.5l6.4-.8L12 3z"/></svg>;
    case "spark": return <svg {...p}><path d="M5 12l4-2 2-4 2 4 4 2-4 2-2 4-2-4z"/></svg>;
    case "gear": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>;
    case "logout": return <svg {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
    case "search": return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case "plus": return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case "bell": return <svg {...p}><path d="M18 16v-5a6 6 0 10-12 0v5l-2 3h16z"/><path d="M10 21a2 2 0 004 0"/></svg>;
    case "globe": return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>;
    case "arrowRight": return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "chevron": return <svg {...p}><path d="M9 18l6-6-6-6"/></svg>;
    case "flag": return <svg {...p}><path d="M4 21V4M4 4h12l-2 4 2 4H4"/></svg>;
    case "users": return <svg {...p}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/></svg>;
    case "trendUp": return <svg {...p}><path d="M3 17l6-6 4 4 8-8M14 7h7v7"/></svg>;
    case "upload": return <svg {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>;
    case "chartBar": return <svg {...p}><path d="M3 3v18h18M7 16v-5M11 16v-9M15 16v-3M19 16v-7"/></svg>;
    case "sun": return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
    case "moon": return <svg {...p}><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>;
    case "compare": return <svg {...p}><path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/></svg>;
    case "inbox": return <svg {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>;
    case "sync": return <svg {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>;
    case "trophy": return <svg {...p}><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2M6 2h12v7a6 6 0 11-12 0V2zM12 15v7M8 22h8"/></svg>;
    default: return null;
  }
}

/* ── Aurora ── */
function AuroraBG() {
  return (
    <div className={styles.aurora}>
      <div className={styles.auroraSky} />
      <div className={styles.auroraStars} />
      <div className={`${styles.auroraBand} ${styles.auroraBand1}`} />
      <div className={`${styles.auroraBand} ${styles.auroraBand2}`} />
      <div className={`${styles.auroraBand} ${styles.auroraBand3}`} />
      <div className={`${styles.auroraBand} ${styles.auroraBand4}`} />
      <div className={styles.auroraHaze} />
    </div>
  );
}

/* ── Meta rail (clock) ── */
function MetaRail() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <aside className={styles.metaRail}>
      <div className={styles.railBlock}>
        <div className={styles.railK}>REC · 4K</div>
        <div className={styles.railV}>{time} GMT+3</div>
      </div>
      <div className={styles.railBlock}>
        <div className={styles.railK}>Take</div>
        <div className={`${styles.railV} ${styles.railTake}`}>042</div>
      </div>
      <div className={styles.railBlock}>
        <div className={styles.railK}>Loc</div>
        <div className={styles.railV}>Istanbul · TR</div>
      </div>
    </aside>
  );
}

/* ── Props ── */
interface LandingPageProps {
  user: { id: string; name: string; role: string; email: string };
  lang: "tr" | "en";
  onLogout: () => void;
}

/* ── Main component ── */
export default function LandingPage({ user, lang: initialLang, onLogout }: LandingPageProps) {
  /* ── Theme ── */
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("estenove-theme") as "dark" | "light") || "dark";
    }
    return "dark";
  });
  const toggleTheme = () => setTheme(t => {
    const next = t === "dark" ? "light" : "dark";
    localStorage.setItem("estenove-theme", next);
    return next;
  });
  const isLight = theme === "light";

  // Sync html.light class so globals.css and shared components detect the theme correctly
  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [isLight]);

  /* ── Language (managed internally) ── */
  const [lang, setLang] = useState<"tr" | "en">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("estenove-lang");
      if (stored === "tr" || stored === "en") return stored;
    }
    return initialLang;
  });

  const toggleLang = () => {
    const next = lang === "tr" ? "en" : "tr";
    setLang(next);
    if (typeof window !== "undefined") localStorage.setItem("estenove-lang", next);
  };

  const navLabels = NAV_LABELS[lang];

  /* ── State ── */
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "home";
    return new URLSearchParams(window.location.search).get("tab") || "home";
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [evaluations, setEvaluations] = useState<any[]>([]);

  /* status page filters */
  const [statusFilter, setStatusFilter] = useState<"all" | "month" | "3m" | "6m" | "1y">("all");
  const [statusMonth, setStatusMonth] = useState<string>("");
  const [statusStart, setStatusStart] = useState<string>("");
  const [statusEnd, setStatusEnd] = useState<string>("");

  /* scores */
  const [scoresData, setScoresData] = useState<any>(null);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresAgent, setScoresAgent] = useState("");

  /* admin */
  const [users, setUsers] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);

  /* team leader */
  const [members, setMembers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teamEvals, setTeamEvals] = useState<any[]>([]);
  const [teamEvalsLoading, setTeamEvalsLoading] = useState(false);
  const [teamMemberScores, setTeamMemberScores] = useState<Record<string, any>>({});
  const [teamScoresLoading, setTeamScoresLoading] = useState(false);

  /* feedback */
  const [fbCat, setFbCat] = useState<"system" | "evaluation" | "">("");
  const [fbComment, setFbComment] = useState("");
  const [fbStatus, setFbStatus] = useState<"idle" | "sending" | "success" | "error">("idle");


  /* team reports */
  const [teamReportLeaderId, setTeamReportLeaderId] = useState("");
  const [teamReportMembers, setTeamReportMembers] = useState<any[]>([]);
  const [teamReportMembersLoading, setTeamReportMembersLoading] = useState(false);
  const [teamReportSelectedIds, setTeamReportSelectedIds] = useState<string[]>([]);
  const [teamReportStartDate, setTeamReportStartDate] = useState("");
  const [teamReportEndDate, setTeamReportEndDate] = useState("");
  const [teamReportEvals, setTeamReportEvals] = useState<any[]>([]);
  const [teamReportLoading, setTeamReportLoading] = useState(false);
  const [teamReportScores, setTeamReportScores] = useState<Record<string, any>>({});
  const [teamReportScoresLoading, setTeamReportScoresLoading] = useState(false);
  const [teamReportMode, setTeamReportMode] = useState<"list" | "compare">("list");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareCurrentData, setCompareCurrentData] = useState<Record<string, any>>({});
  const [comparePrevData, setComparePrevData] = useState<Record<string, any>>({});
  const [compareLoading, setCompareLoading] = useState(false);

  /* advisor dashboard */
  const [advisorTLs, setAdvisorTLs] = useState<{ id: string; name: string; teamName: string }[]>([]);
  const [advisorSelectedTLId, setAdvisorSelectedTLId] = useState<string | null>(null);
  const [advisorMembers, setAdvisorMembers] = useState<{ id: string; name: string }[]>([]);
  const [advisorSelectedAgentId, setAdvisorSelectedAgentId] = useState<string | null>(null);
  const [advisorScoreData, setAdvisorScoreData] = useState<any>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorTLsLoading, setAdvisorTLsLoading] = useState(false);
  const [advisorMembersLoading, setAdvisorMembersLoading] = useState(false);

  /* batch (admin) */
  const [batchMode, setBatchMode] = useState<"csv" | "docx">("csv");
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchCalls, setBatchCalls] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<any>(null);
  const [batchMsg, setBatchMsg] = useState("");
  const [docxRows, setDocxRows] = useState<any[]>([]);
  const [docxLoading, setDocxLoading] = useState(false);
  const [applyAllAgentId, setApplyAllAgentId] = useState("");
  const [applyAllPromptId, setApplyAllPromptId] = useState("");

  /* reports sidebar group */
  const [reportsOpen, setReportsOpen] = useState(
    () => activeTab === "reports" || activeTab === "negKeywords" || activeTab === "coachingTracking"
  );

  /* ── Effects ── */
  useEffect(() => {
    fetchEvaluations();
    if (user.role === "TEAM_LEADER") { fetchMembers(); fetchTeamReportMembers(); }
    if (user.role === "ADMIN" || user.role === "MANAGER") fetchUsers();
    if (user.role === "ADMIN") { fetchPrompts(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Fetchers ── */
  const fetchEvaluations = () =>
    fetch("/api/evaluations").then(r => r.json()).then(d => setEvaluations(d.evaluations || []));

  const fetchScores = async (agentId?: string) => {
    setScoresLoading(true);
    const params = agentId ? `?agentId=${agentId}` : "";
    const res = await fetch(`/api/scores${params}`);
    if (res.ok) setScoresData(await res.json());
    setScoresLoading(false);
  };

  const fetchMembers = () =>
    fetch("/api/team/members").then(r => r.json()).then(d => setMembers(d.members || []));

  const fetchUsers = () =>
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []));

  const fetchPrompts = () =>
    fetch("/api/prompts").then(r => r.json()).then(d => setPrompts(d.prompts || []));

  const fetchTeamEvals = async () => {
    setTeamEvalsLoading(true);
    setTeamScoresLoading(true);
    const params = new URLSearchParams();
    if (selectedIds.length) params.set("agentIds", selectedIds.join(","));
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const [evalsRes] = await Promise.all([
      fetch(`/api/evaluations?${params}`),
    ]);
    if (evalsRes.ok) setTeamEvals((await evalsRes.json()).evaluations || []);
    setTeamEvalsLoading(false);

    if (selectedIds.length > 0) {
      const scores: Record<string, any> = {};
      await Promise.all(selectedIds.map(async (agentId) => {
        const sp = new URLSearchParams({ agentId });
        if (startDate) sp.set("startDate", startDate);
        if (endDate) sp.set("endDate", endDate);
        const r = await fetch(`/api/scores?${sp}`);
        if (r.ok) scores[agentId] = await r.json();
      }));
      setTeamMemberScores(scores);
    } else {
      setTeamMemberScores({});
    }
    setTeamScoresLoading(false);
  };

  /* ── Tarayıcı geri/ileri tuşu senkronizasyonu ── */
  useEffect(() => {
    const onPopState = () => {
      const tab = new URLSearchParams(window.location.search).get("tab") || "home";
      setActiveTab(tab);
      if (tab === "reports" || tab === "negKeywords" || tab === "coachingTracking") setReportsOpen(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* ── Tab change ── */
  const handleTab = (tab: string) => {
    setDrawerOpen(false);
    setActiveTab(tab);
    const url = tab === "home" ? window.location.pathname : `${window.location.pathname}?tab=${tab}`;
    window.history.pushState({ tab }, "", url);
    if (tab === "scores" && !scoresData && !scoresLoading) fetchScores(scoresAgent || undefined);
    if (tab === "advisor") {
      if (isManagerLike && advisorTLs.length === 0) fetchAdvisorTLs();
      if (user.role === "TEAM_LEADER" && advisorMembers.length === 0) fetchAdvisorMembers();
    }
    if (tab === "reports" || tab === "negKeywords" || tab === "coachingTracking") setReportsOpen(true);
    if (tab !== "home") {
      fetch("/api/activity/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: tab }),
      }).catch(() => {});
    }
  };

  /* ── Feedback ── */
  const handleFeedback = async () => {
    if (!fbCat || !fbComment.trim()) return;
    setFbStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: fbCat, comment: fbComment.trim() }),
      });
      if (!res.ok) throw new Error();
      setFbStatus("success");
      setTimeout(() => { setFbStatus("idle"); setFbCat(""); setFbComment(""); }, 2500);
    } catch {
      setFbStatus("error");
      setTimeout(() => setFbStatus("idle"), 2500);
    }
  };

  /* ── Team reports ── */
  const fetchTeamReportMembers = async (leaderId?: string) => {
    setTeamReportMembersLoading(true);
    const url = leaderId ? `/api/team/members?leaderId=${leaderId}` : "/api/team/members";
    const res = await fetch(url);
    if (res.ok) setTeamReportMembers((await res.json()).members || []);
    setTeamReportMembersLoading(false);
  };

  const fetchAdvisorTLs = async () => {
    setAdvisorTLsLoading(true);
    try {
      const res = await fetch("/api/teams");
      if (!res.ok) return;
      const data = await res.json();
      setAdvisorTLs(
        (data.teams || [])
          .filter((t: any) => t.leader)
          .map((t: any) => ({ id: t.leader.id, name: t.leader.name, teamName: t.name }))
      );
    } finally {
      setAdvisorTLsLoading(false);
    }
  };

  const fetchAdvisorMembers = async (leaderId?: string) => {
    setAdvisorMembersLoading(true);
    try {
      const url = leaderId ? `/api/team/members?leaderId=${leaderId}` : "/api/team/members";
      const res = await fetch(url);
      if (res.ok) setAdvisorMembers((await res.json()).members || []);
    } finally {
      setAdvisorMembersLoading(false);
    }
  };

  const fetchAdvisorScore = async (agentId: string) => {
    setAdvisorLoading(true);
    setAdvisorScoreData(null);
    try {
      const res = await fetch(`/api/scores?agentId=${agentId}`);
      if (res.ok) setAdvisorScoreData(await res.json());
    } finally {
      setAdvisorLoading(false);
    }
  };

  const fetchTeamReportEvals = async () => {
    setTeamReportLoading(true);
    setTeamReportScoresLoading(true);
    const params = new URLSearchParams();
    if (teamReportSelectedIds.length) params.set("agentIds", teamReportSelectedIds.join(","));
    if (teamReportStartDate) params.set("startDate", teamReportStartDate);
    if (teamReportEndDate) params.set("endDate", teamReportEndDate);
    const res = await fetch(`/api/evaluations?${params}`);
    if (res.ok) setTeamReportEvals((await res.json()).evaluations || []);
    setTeamReportLoading(false);

    const scores: Record<string, any> = {};
    await Promise.all(teamReportSelectedIds.map(async (agentId) => {
      const sp = new URLSearchParams({ agentId });
      if (teamReportStartDate) sp.set("startDate", teamReportStartDate);
      if (teamReportEndDate) sp.set("endDate", teamReportEndDate);
      const r = await fetch(`/api/scores?${sp}`);
      if (r.ok) scores[agentId] = await r.json();
    }));
    setTeamReportScores(scores);
    setTeamReportScoresLoading(false);
  };

  const getPrevPeriodDates = () => {
    if (!teamReportStartDate || !teamReportEndDate) return null;
    const startMs = new Date(teamReportStartDate).getTime();
    const endMs = new Date(teamReportEndDate).getTime();
    const duration = endMs - startMs;
    const prevEndMs = startMs - 86400000;
    const prevStartMs = prevEndMs - duration;
    return {
      startDate: new Date(prevStartMs).toISOString().split("T")[0],
      endDate: new Date(prevEndMs).toISOString().split("T")[0],
    };
  };

  const fetchCompareData = async (ids?: string[]) => {
    const targetIds = ids ?? compareIds;
    if (targetIds.length === 0) return;
    setCompareLoading(true);
    const prevPeriod = getPrevPeriodDates();
    const currentResults: Record<string, any> = {};
    const prevResults: Record<string, any> = {};
    await Promise.all(targetIds.map(async (agentId) => {
      const curParams = new URLSearchParams({ agentId });
      if (teamReportStartDate) curParams.set("startDate", teamReportStartDate);
      if (teamReportEndDate) curParams.set("endDate", teamReportEndDate);
      const curRes = await fetch(`/api/scores?${curParams}`);
      if (curRes.ok) currentResults[agentId] = await curRes.json();
      if (prevPeriod) {
        const prevParams = new URLSearchParams({ agentId, startDate: prevPeriod.startDate, endDate: prevPeriod.endDate });
        const prevRes = await fetch(`/api/scores?${prevParams}`);
        if (prevRes.ok) prevResults[agentId] = await prevRes.json();
      }
    }));
    setCompareCurrentData(currentResults);
    setComparePrevData(prevPeriod ? prevResults : {});
    setCompareLoading(false);
  };

  /* ── Batch (CSV) ── */
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBatchFile(file); setBatchResults(null); setBatchMsg("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { setBatchMsg("CSV en az 2 satır içermeli."); return; }
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const ti = headers.indexOf("transcript"), ai = headers.indexOf("agentname");
      const ci = headers.indexOf("customername"), di = headers.indexOf("callduration"), ki = headers.indexOf("calltype");
      if (ti === -1) { setBatchMsg("'transcript' kolonu bulunamadı."); return; }
      const parsed = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        return {
          transcript: cols[ti] || "", agentName: ai >= 0 ? cols[ai] : "",
          customerName: ci >= 0 ? cols[ci] : "", callDuration: di >= 0 ? cols[di] : "",
          callType: ki >= 0 ? cols[ki] : "AUTO",
        };
      }).filter(c => c.transcript.length >= 50);
      setBatchCalls(parsed);
      setBatchMsg(`${parsed.length} çağrı parse edildi.`);
    };
    reader.readAsText(file);
  };

  const handleDocxChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBatchResults(null); setBatchMsg(""); setDocxLoading(true);
    try {
      const mammothPkg = await import("mammoth" as any);
      const mammoth: any = mammothPkg.default ?? mammothPkg;
      const parseHeader = (text: string) => {
        const lines = text.split("\n").slice(0, 10);
        const r: any = {};
        for (const l of lines) {
          const m1 = l.match(/^Dan[ıi]şman[:\s]+(.+)/i); if (m1) r.agentName = m1[1].trim();
          const m2 = l.match(/^M[üu]şteri[:\s]+(.+)/i); if (m2) r.customerName = m2[1].trim();
          const m3 = l.match(/^S[üu]re[:\s]+(.+)/i); if (m3) r.duration = m3[1].trim();
        }
        return r;
      };
      const rows = await Promise.all(files.map(async (file) => {
        const ab = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
        const fullText = (value as string).trim();
        const hdr = parseHeader(fullText);
        const sep = fullText.indexOf("---");
        const transcript = sep > 0 ? fullText.slice(sep + 3).trim() : fullText;
        const matched = hdr.agentName
          ? users.find((u: any) => u.name.toLowerCase().includes(hdr.agentName.toLowerCase()))
          : null;
        return {
          fileName: file.name, transcript,
          agentId: matched ? (matched as any).id : "",
          customerName: hdr.customerName || "",
          callDuration: hdr.duration || "", promptId: "",
        };
      }));
      setDocxRows(rows);
      setBatchMsg(`${rows.length} dosya yüklendi.`);
    } catch {
      setBatchMsg("DOCX okuma hatası.");
    } finally {
      setDocxLoading(false);
    }
  };

  const updateDocxRow = (idx: number, field: string, value: string) =>
    setDocxRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const handleBatchStart = async () => {
    const calls = batchMode === "csv"
      ? batchCalls.map(c => {
          const agent = c.agentName
            ? users.find((u: any) => u.name.toLowerCase().includes(c.agentName.toLowerCase()))
            : null;
          return {
            transcript: c.transcript,
            agentId: agent ? (agent as any).id : undefined,
            customerName: c.customerName || "Belirtilmedi",
            callDuration: c.callDuration || "Belirtilmedi",
            callType: c.callType,
          };
        })
      : docxRows.map(r => ({
          transcript: r.transcript, agentId: r.agentId,
          customerName: r.customerName || "Belirtilmedi",
          callDuration: r.callDuration || "Belirtilmedi",
          promptId: r.promptId,
        }));
    setBatchLoading(true); setBatchResults(null); setBatchMsg("Analiz ediliyor...");
    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calls }),
      });
      const data = await res.json();
      if (!res.ok) { setBatchMsg(data.error || "Batch başarısız."); return; }
      setBatchResults(data);
      setBatchMsg(`Tamamlandı: ${data.success} başarılı, ${data.failed} başarısız.`);
      fetchEvaluations();
    } catch {
      setBatchMsg("Hata oluştu.");
    } finally {
      setBatchLoading(false);
    }
  };

  /* ── Derived ── */
  const avgScore = evaluations.length
    ? Math.round(evaluations.reduce((a, e) => a + e.score, 0) / evaluations.length)
    : 0;
  const highestScore = evaluations.length ? Math.max(...evaluations.map(e => e.score)) : 0;

  /* ── Role label ── */
  const ROLE_LABELS: Record<string, Record<"tr" | "en", string>> = {
    ADMIN:       { tr: "Admin",        en: "Admin" },
    MANAGER:     { tr: "Müdür",        en: "Manager" },
    TEAM_LEADER: { tr: "Takım Lideri", en: "Team Leader" },
    AGENT:       { tr: "Danışman",     en: "Agent" },
  };
  const roleLabel = (ROLE_LABELS[user.role]?.[lang]) ?? user.role;

  /* ── Nav items ── */
  const isManagerLike = user.role === "ADMIN" || user.role === "MANAGER";
  const selectedTL = isManagerLike && teamReportLeaderId ? (users as any[]).find((u: any) => u.id === teamReportLeaderId) ?? null : null;
  const mainNavItems: { key: string; icon: string }[] = [
    { key: "home", icon: "home" },
  ];
  mainNavItems.push({ key: "evaluations", icon: "list" });
  mainNavItems.push({ key: "reports", icon: "doc" });
  if (!isManagerLike) mainNavItems.push({ key: "scores", icon: "star" });
  if (isManagerLike || user.role === "TEAM_LEADER") {
    mainNavItems.push({ key: "teamreports", icon: "chartBar" });
  }
  if (isManagerLike || user.role === "TEAM_LEADER") {
    mainNavItems.push({ key: "status", icon: "trendUp" });
  }
  if (user.role === "TEAM_LEADER") {
    mainNavItems.push({ key: "team", icon: "users" });
  }
  if (user.role === "AGENT" || user.role === "TEAM_LEADER") {
    mainNavItems.push({ key: "peer", icon: "compare" });
  }
  mainNavItems.push({ key: "leaderboard", icon: "trophy" });
  mainNavItems.push({ key: "search", icon: "search" });
  if (isManagerLike || user.role === "TEAM_LEADER") {
    mainNavItems.push({ key: "advisor", icon: "users" });
  }
  if (user.role !== "ADMIN") {
    mainNavItems.push({ key: "feedback", icon: "flag" });
  }

  /* ── Trend bar data (static visual) ── */
  const trendData = [
    { h: 55, label: "M" }, { h: 70, label: "T" }, { h: 62, label: "W" },
    { h: 80, label: "T" }, { h: 74, label: "F" }, { h: 88, label: "S" },
    { h: 92, label: "S" },
  ];

  /* ── Score color helper ── */
  const scoreColor = (s: number) =>
    s >= 75 ? styles.scoreHigh : s >= 50 ? styles.scoreMid : styles.scoreLow;

  /* ── Landing nav items (top header) ── */
  const landingNav = (() => {
    const t = lang === "tr";
    const base = [
      { key: "home",    label: t ? "Genel Bakış"   : "Overview"    },
      { key: "evaluations", label: t ? "Değerlendirmeler" : "Evaluations" },
      { key: "reports", label: t ? "İçgörüler"     : "Insights"    },
      { key: "teamreports", label: t ? "Raporlar" : "Reports" },
    ];
    if (user.role !== "ADMIN" && user.role !== "MANAGER") base.push({ key: "feedback", label: t ? "İletişim" : "Contact" });
    return base;
  })();

  /* ── Render ── */
  return (
    <div
      className={`${styles.app}${isLight ? ` ${styles.lightMode}` : ""}`}
      {...(activeTab !== "home" ? { "data-inapp": "1" } : {})}
      style={(isLight ? LIGHT_THEME : DARK_THEME) as React.CSSProperties}
    >
      {/* Aurora background — always present */}
      <div className={styles.bg}>
        <AuroraBG />
        <div className={`${styles.tint} ${styles.tintBase}`} />
        <div className={`${styles.tint} ${styles.tintVignette}`} />
        <div className={`${styles.tint} ${styles.tintGrain}`} />
      </div>

      {/* ══════════════════════════════════════════════════
          HOME TAB — Full-screen cinematic landing
          ══════════════════════════════════════════════════ */}
      {activeTab === "home" && (
        <div style={{ position: "relative", zIndex: 10 }}>
          {/* Fixed header */}
          <header className={styles.landingHdr}>
            <div className={styles.landingHdrInner}>
              {/* Logo */}
              <button className={styles.mark} onClick={() => handleTab("home")}>
                <img src="/estenove-mark.png" alt="Estenove" className={styles.markIcon} />
                <span className={styles.markWord}>Estenove</span>
              </button>
              {/* Hamburger — mobile only, shown via CSS */}
              <button
                className={styles.hamburger}
                onClick={() => setDrawerOpen(v => !v)}
                aria-label="Menu"
              >
                <span /><span /><span />
              </button>

              {/* Numbered nav */}
              <nav className={styles.landingNav}>
                {landingNav.map((item, i) => (
                  <button
                    key={item.key}
                    onClick={() => handleTab(item.key)}
                    className={styles.navBtn}
                  >
                    <span className={styles.navBtnNum}>{String(i + 1).padStart(2, "0")}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              {/* Right controls */}
              <div className={styles.landingHdrRight}>
                <div className={styles.hdrMetaWrap}>
                  <span className={styles.hdrMetaDot} />
                  <span>QA · LIVE</span>
                </div>
                <button className={styles.themeToggle} onClick={toggleTheme} title={isLight ? "Dark mode" : "Light mode"}>
                  <Icon name={isLight ? "moon" : "sun"} size={13} />
                </button>
                <button className={styles.langBtn} onClick={toggleLang}>
                  <Icon name="globe" size={11} />
                  {lang.toUpperCase()}
                </button>
                <button
                  className={styles.openConsoleBtn}
                  onClick={() => handleTab("evaluations")}
                >
                  {lang === "tr" ? "Konsola Gir" : "Open the console"} →
                </button>
              </div>
            </div>
          </header>

          {/* Stage */}
          <div className={styles.stage}>
            <MetaRail />

            {/* Hero — bottom-left */}
            <section className={styles.hero}>
              <div className={styles.heroEyebrow}>
                <span className={styles.accentDot} />
                <span>Sales Quality Assurance · 2026</span>
              </div>
              <h1 className={styles.heroH1}>
                <span className={`${styles.heroLine} ${styles.heroLineItalic}`} style={{ animationDelay: "0.1s" }}>
                  {lang === "tr" ? "Her çağrı." : "Every call."}
                </span>
                <span className={styles.heroLine} style={{ animationDelay: "0.22s" }}>
                  {lang === "tr" ? "En yüksek standarda" : "Measured against"}
                </span>
                <span className={styles.heroLine} style={{ animationDelay: "0.34s" }}>
                  {lang === "tr" ? "göre ölçülür." : "the highest standard."}
                </span>
              </h1>
              <p className={styles.heroLede}>
                {lang === "tr"
                  ? "Estenove satış ekipleri için özgün değerlendirme konsolu. Her çağrı en yüksek standarda göre ölçülür. Mimari hassasiyetle."
                  : "The original evaluation console for Estenove sales teams. Every call, measured against the highest standard. Excellence, with architectural precision."}
              </p>
              <div className={styles.heroActions}>
                <button
                  onClick={() => handleTab("evaluations")}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  <span>{lang === "tr" ? "Konsolu Aç" : "Open the console"}</span>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => handleTab("reports")}
                  className={`${styles.btn} ${styles.btnGhost}`}
                >
                  <span className={styles.btnPlay}>
                    <svg width="6" height="8" viewBox="0 0 6 8" fill="currentColor"><path d="M0 0v8l6-4z" /></svg>
                  </span>
                  <span>{lang === "tr" ? "Raporlar" : "Reports"}</span>
                </button>
              </div>
            </section>

            {/* Stats strip */}
            <div className={styles.statsStrip}>
              <div className={styles.statStripItem}>
                <div className={styles.statStripV}>{avgScore || 70}%</div>
                <div className={styles.statStripK}>{lang === "tr" ? "Ort. kalite skoru" : "Avg. quality score"}</div>
              </div>
              <div className={styles.statStripItem}>
                <div className={styles.statStripV}>{evaluations.length ? (avgScore / 10).toFixed(1) : "7.0"}</div>
                <div className={styles.statStripK}>{lang === "tr" ? "Danışman perf." : "Consultant perf."}</div>
              </div>
              <div className={styles.statStripItem}>
                <div className={styles.statStripV}>
                  {evaluations.length > 999
                    ? `${(evaluations.length / 1000).toFixed(0)}k+`
                    : evaluations.length || "12k+"}
                </div>
                <div className={styles.statStripK}>{lang === "tr" ? "İncelenen çağrı" : "Calls reviewed"}</div>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className={styles.scrollInd}>
              <span className={styles.scrollLine}><span className={styles.scrollLineFill} /></span>
              <span className={styles.scrollLabel}>Scroll</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          ALL OTHER TABS — Sidebar + topbar shell
          ══════════════════════════════════════════════════ */}
      {activeTab !== "home" && (
      <div className={styles.shell}>
        {/* Drawer backdrop — mobile/iPad */}
        {drawerOpen && (
          <div
            className={styles.drawerBackdrop}
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside className={`${styles.sb}${drawerOpen ? ` ${styles.sbDrawerOpen}` : ""}`}>
          {/* Brand */}
          <button className={styles.sbBrand} onClick={() => handleTab("home")}>
            <img src="/estenove-mark.png" alt="Estenove" className={styles.sbMark} />
            <div>
              <div className={styles.sbBrandName}>Estenove</div>
              <div className={styles.sbBrandSub}>Sales · Performance</div>
            </div>
          </button>

          {/* Main nav */}
          <nav className={styles.sbNav}>
            {mainNavItems.map(({ key, icon }) => {
              if (key === "reports" && isManagerLike) {
                return (
                  <div key="reports-group">
                    <button
                      onClick={() => setReportsOpen(v => !v)}
                      className={`${styles.sbLink} ${(activeTab === "reports" || activeTab === "negKeywords" || activeTab === "coachingTracking") ? styles.sbLinkActive : ""}`}
                      style={{ justifyContent: "space-between" }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="doc" size={15} />
                        <span>{lang === "tr" ? "Raporlar" : "Reports"}</span>
                      </span>
                      <span style={{ fontSize: 10, transition: "transform 0.2s", display: "inline-block", transform: reportsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                    </button>
                    <div style={{ overflow: "hidden", maxHeight: reportsOpen ? 120 : 0, transition: "max-height 0.2s ease" }}>
                      <button
                        onClick={() => handleTab("reports")}
                        className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "reports" ? styles.sbLinkActive : ""}`}
                        style={{ paddingLeft: 32 }}
                      >
                        <span>{navLabels.reports}</span>
                      </button>
                      <button
                        onClick={() => handleTab("negKeywords")}
                        className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "negKeywords" ? styles.sbLinkActive : ""}`}
                        style={{ paddingLeft: 32 }}
                      >
                        <span>{navLabels.negKeywords}</span>
                      </button>
                      <button
                        onClick={() => handleTab("coachingTracking")}
                        className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "coachingTracking" ? styles.sbLinkActive : ""}`}
                        style={{ paddingLeft: 32 }}
                      >
                        <span>{navLabels.coachingTracking}</span>
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <button
                  key={key}
                  onClick={() => handleTab(key)}
                  className={`${styles.sbLink} ${activeTab === key ? styles.sbLinkActive : ""}`}
                >
                  <Icon name={icon} size={15} />
                  <span>{navLabels[key]}</span>
                </button>
              );
            })}
          </nav>

          {/* Admin management section */}
          {user.role === "ADMIN" && (
            <>
              <div className={styles.sbSection}>{lang === "tr" ? "Yönetim" : "Management"}</div>
              <nav className={styles.sbNav}>
                <button
                  onClick={() => handleTab("batch")}
                  className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "batch" ? styles.sbLinkActive : ""}`}
                >
                  <Icon name="upload" size={14} />
                  <span>{navLabels.batch}</span>
                </button>
                <button
                  onClick={() => handleTab("feedbacks")}
                  className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "feedbacks" ? styles.sbLinkActive : ""}`}
                >
                  <Icon name="inbox" size={14} />
                  <span>{navLabels.feedbacks}</span>
                </button>
                <button
                  onClick={() => handleTab("sync")}
                  className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "sync" ? styles.sbLinkActive : ""}`}
                >
                  <Icon name="sync" size={14} />
                  <span>{navLabels.sync}</span>
                </button>
                <button
                  onClick={() => handleTab("recentCalls")}
                  className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "recentCalls" ? styles.sbLinkActive : ""}`}
                >
                  <Icon name="phone" size={14} />
                  <span>{navLabels.recentCalls}</span>
                </button>
              </nav>
            </>
          )}

          {/* Bottom: admin settings + logout + user card */}
          <div className={styles.sbBottom}>
            {(user.role === "ADMIN" || user.role === "MANAGER") && (
              <button
                onClick={() => handleTab("admin")}
                className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "admin" ? styles.sbLinkActive : ""}`}
              >
                <Icon name="gear" size={14} />
                <span>{navLabels.admin}</span>
              </button>
            )}
            <button
              onClick={onLogout}
              className={`${styles.sbLink} ${styles.sbLinkSm}`}
            >
              <Icon name="logout" size={14} />
              <span>{lang === "tr" ? "Çıkış" : "Logout"}</span>
            </button>
            <div className={styles.sbUser}>
              <div className={styles.sbAvatar}>{user.name.charAt(0).toUpperCase()}</div>
              <div className={styles.sbUserTxt}>
                <div className={styles.sbUserName}>{user.name.split(" ")[0]}</div>
                <div className={styles.sbUserRole}>{roleLabel}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Shell main ── */}
        <div className={styles.shellMain}>

          {/* ── Topbar ── */}
          <div className={styles.tb}>
            {/* Hamburger — mobile/iPad only, shown via CSS */}
            <button
              className={styles.hamburger}
              onClick={() => setDrawerOpen(v => !v)}
              aria-label="Menu"
            >
              <span /><span /><span />
            </button>
            <div className={styles.tbSearch}>
              <Icon name="search" size={14} />
              <span style={{ fontSize: 13 }}>{lang === "tr" ? "Ara..." : "Search..."}</span>
            </div>
            <div className={styles.tbRight}>
              {/* Language toggle */}
              <button className={styles.tbIcon} onClick={toggleLang}>
                <Icon name="globe" size={14} />
                <span>{lang === "tr" ? "TR" : "EN"}</span>
              </button>
              {/* Bell */}
              <NotificationBell lang={lang} />
              {/* New Analysis CTA — only for ADMIN */}
              {user.role === "ADMIN" && (
                <button
                  className={styles.tbCta}
                  onClick={() => handleTab("batch")}
                >
                  <Icon name="plus" size={13} />
                  <span>{lang === "tr" ? "Yeni Analiz" : "New Analysis"}</span>
                </button>
              )}
              {/* Theme toggle */}
              <button className={styles.themeToggle} onClick={toggleTheme} title={isLight ? "Dark mode" : "Light mode"}>
                <Icon name={isLight ? "moon" : "sun"} size={15} />
              </button>
              {/* Avatar + user menu */}
              <div style={{ position: "relative" }}>
                <button
                  className={styles.tbAvatar}
                  onClick={() => setShowUserMenu(v => !v)}
                  style={{ border: "none", cursor: "pointer" }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </button>
                {showUserMenu && (
                  <>
                    {/* backdrop to close on outside click */}
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 99 }}
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className={styles.userMenu}>
                      <div className={styles.userMenuHd}>
                        <div className={styles.userMenuName}>{user.name}</div>
                        <div className={styles.userMenuRole}>{roleLabel}</div>
                      </div>
                      <div className={styles.userMenuDivider} />
                      {(user.role === "ADMIN" || user.role === "MANAGER") && (
                        <button
                          className={styles.userMenuItem}
                          onClick={() => { handleTab("admin"); setShowUserMenu(false); }}
                        >
                          <Icon name="gear" size={14} />
                          <span>{navLabels.admin}</span>
                        </button>
                      )}
                      <button
                        className={styles.userMenuItem}
                        onClick={() => { onLogout(); setShowUserMenu(false); }}
                      >
                        <Icon name="logout" size={14} />
                        <span>{lang === "tr" ? "Çıkış Yap" : "Sign out"}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className={styles.shellContent}>

            {/* ── HOME dashboard ── */}
            {activeTab === "home" && (
              <div className={styles.page}>
                {/* Hero banner */}
                <div className={styles.heroBanner}>
                  <div className={styles.heroBannerEyebrow}>
                    <span className={styles.dot} />
                    <span>Sales Quality Assurance · 2026</span>
                  </div>
                  <h1 className={styles.heroBannerH1}>
                    Estenove / Sales Quality Hub
                  </h1>
                  <p className={styles.heroBannerLede}>
                    {lang === "tr"
                      ? "Estenove satış ekipleri için özgün değerlendirme konsolu. Her çağrı en yüksek standarda göre ölçülür."
                      : "The original evaluation console for Estenove sales teams. Every call, measured against the highest standard."}
                  </p>
                  <div className={styles.heroBannerCta}>
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => handleTab("evaluations")}
                    >
                      <Icon name="list" size={14} />
                      <span>{lang === "tr" ? "Değerlendirmeler" : "Evaluations"}</span>
                    </button>
                    <button
                      className={`${styles.btn} ${styles.btnGhost}`}
                      onClick={() => handleTab("reports")}
                    >
                      <Icon name="doc" size={14} />
                      <span>{lang === "tr" ? "Raporlarım" : "My Reports"}</span>
                    </button>
                  </div>
                </div>

                {/* KPI grid */}
                <div className={`${styles.card} ${styles.kpiGrid}`}>
                  {/* Avg score */}
                  <div className={styles.kpi}>
                    <div className={styles.kpiK}>{lang === "tr" ? "Ort. Skor" : "Avg. Score"}</div>
                    <div className={`${styles.kpiV} ${avgScore >= 70 ? styles.kpiVGood : ""}`}>
                      {avgScore}<em>%</em>
                    </div>
                    <div className={styles.kpiFoot}>
                      <Icon name="trendUp" size={11} />
                      {lang === "tr" ? "Son 30 gün" : "Last 30 days"}
                    </div>
                    <div className={styles.kpiBar}><div style={{ width: `${avgScore}%` }} /></div>
                  </div>

                  {/* Total calls */}
                  <div className={styles.kpi}>
                    <div className={styles.kpiK}>{lang === "tr" ? "Toplam Çağrı" : "Total Calls"}</div>
                    <div className={styles.kpiV}>
                      {evaluations.length}<em>{lang === "tr" ? "adet" : "calls"}</em>
                    </div>
                    <div className={styles.kpiFoot}>
                      <Icon name="phone" size={11} />
                      {lang === "tr" ? "Değerlendirilen" : "Evaluated"}
                    </div>
                    <div className={styles.kpiBar}>
                      <div style={{ width: `${Math.min(evaluations.length, 100)}%` }} />
                    </div>
                  </div>

                  {/* Highest score */}
                  <div className={styles.kpi}>
                    <div className={styles.kpiK}>{lang === "tr" ? "En Yüksek" : "Highest"}</div>
                    <div className={`${styles.kpiV} ${styles.kpiVGood}`}>
                      {evaluations.length ? highestScore : "—"}<em>{evaluations.length ? "%" : ""}</em>
                    </div>
                    <div className={styles.kpiFoot}>
                      <Icon name="star" size={11} />
                      {lang === "tr" ? "Tüm zamanlar" : "All time"}
                    </div>
                    <div className={styles.kpiBar}>
                      <div style={{ width: `${highestScore}%` }} />
                    </div>
                  </div>
                </div>

                {/* Dashboard grid: recent + trend */}
                <div className={styles.dashGrid}>
                  {/* Recent evaluations */}
                  <div className={`${styles.card} ${styles.recent}`}>
                    <div className={styles.sectHd}>
                      <h2>
                        <Icon name="list" size={15} />
                        {lang === "tr" ? "Son Değerlendirmeler" : "Recent Evaluations"}
                      </h2>
                      <button className={styles.sectLink} onClick={() => handleTab("evaluations")}>
                        {lang === "tr" ? "Tümü" : "See all"}
                        <Icon name="chevron" size={12} />
                      </button>
                    </div>
                    <ul className={styles.recList}>
                      {evaluations.length === 0 && (
                        <li className={styles.recEmpty}>
                          {lang === "tr" ? "Henüz değerlendirme yok." : "No evaluations yet."}
                        </li>
                      )}
                      {evaluations.slice(0, 5).map((ev, i) => (
                        <li key={ev.id ?? i} className={styles.recItem}>
                          <div className={styles.recAvatar}>
                            {(ev.agentName || ev.customerName || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.recMain}>
                            <div className={styles.recWho}>{ev.agentName || ev.customerName || "—"}</div>
                            <div className={styles.recSub}>{ev.callType || "—"}</div>
                          </div>
                          <div className={styles.recDate}>
                            {ev.createdAt
                              ? new Date(ev.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })
                              : "—"}
                          </div>
                          <div className={`${styles.recScore} ${scoreColor(ev.score)}`}>
                            {ev.score}%
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Quality trend */}
                  <div className={`${styles.card} ${styles.trend}`}>
                    <div className={styles.sectHd}>
                      <h2>
                        <Icon name="trendUp" size={15} />
                        {lang === "tr" ? "Kalite Trendi" : "Quality Trend"}
                      </h2>
                    </div>
                    <p className={styles.sectSub}>
                      {lang === "tr" ? "Son 7 gün · haftalık özet" : "Last 7 days · weekly summary"}
                    </p>
                    <div className={styles.bars}>
                      {trendData.map((d, i) => (
                        <div key={i} className={styles.bar}>
                          <div
                            className={styles.barFill}
                            style={{ height: `${d.h}%` }}
                          />
                          <span className={styles.barLabel}>{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── EVALUATIONS ── */}
            {activeTab === "evaluations" && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.evaluations}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr" ? "Tüm değerlendirmelerini görüntüle" : "View all your evaluations"}
                  </p>
                </div>
                <div className={styles.card}>
                  <EvaluationsView showAgent={user.role !== "AGENT"} lang={lang} />
                </div>
              </div>
            )}

            {/* ── SCORES ── */}
            {activeTab === "scores" && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.scores}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr" ? "Performans karnesi ve istatistikler" : "Performance scorecard and stats"}
                  </p>
                </div>
                {user.role === "ADMIN" && (
                  <div className={styles.card} style={{ marginBottom: 0 }}>
                    <select
                      className={styles.formSelect}
                      value={scoresAgent}
                      onChange={e => {
                        setScoresAgent(e.target.value);
                        setScoresData(null);
                        fetchScores(e.target.value || undefined);
                      }}
                    >
                      <option value="">{lang === "tr" ? "Kendi skorlarım" : "My own scores"}</option>
                      {users.filter((u: any) => u.role === "AGENT").map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={styles.card}>
                  {scoresLoading ? (
                    <div className={styles.spinner}><div /></div>
                  ) : scoresData ? (
                    <ScoreView data={scoresData} lang={lang} canRefresh={user.role !== "AGENT"} />
                  ) : (
                    <div className={styles.emptyMsg}>
                      {lang === "tr" ? "Skorları yüklemek için sekmeye tıklayın." : "Click the tab to load scores."}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── REPORTS ── */}
            {activeTab === "reports" && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.reports}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr" ? "Performans raporları" : "Performance reports"}
                  </p>
                </div>
                <div className={styles.card}>
                  <ReportsView agentId={user.role === "AGENT" ? user.id : undefined} lang={lang} />
                </div>
              </div>
            )}

            {/* ── TEAM REPORTS ── */}
            {activeTab === "teamreports" && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.teamreports}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr" ? "Takım bazlı performans analizi ve danışman karşılaştırması" : "Team-level performance analysis and consultant comparison"}
                  </p>
                </div>

                {/* Team leader selector — ADMIN & MANAGER only */}
                {isManagerLike && (
                  <div className={styles.card} style={{ padding: 16 }}>
                    <label className={styles.fbLabel}>{lang === "tr" ? "Takım Lideri" : "Team Leader"}</label>
                    <select
                      className={styles.formSelect}
                      value={teamReportLeaderId}
                      onChange={e => {
                        const lid = e.target.value;
                        setTeamReportLeaderId(lid);
                        setTeamReportMembers([]);
                        setTeamReportSelectedIds([]);
                        setTeamReportEvals([]);
                        setCompareIds([]);
                        setCompareCurrentData({});
                        setComparePrevData({});
                        if (lid) fetchTeamReportMembers(lid);
                      }}
                    >
                      <option value="">{lang === "tr" ? "— Takım lideri seçin —" : "— Select team leader —"}</option>
                      {users.filter((u: any) => u.role === "TEAM_LEADER").map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Loading members */}
                {teamReportMembersLoading && (
                  <div className={`${styles.card} ${styles.spinner}`}><div /></div>
                )}

                {/* Empty state before selecting a leader */}
                {isManagerLike && !teamReportLeaderId && !teamReportMembersLoading && (
                  <div className={styles.emptyMsg}>
                    {lang === "tr" ? "Başlamak için bir takım lideri seçin." : "Select a team leader to get started."}
                  </div>
                )}

                {/* Main content — shown once members are available */}
                {teamReportMembers.length > 0 && !teamReportMembersLoading && (
                  <>
                    {/* Mode toggle */}
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["list", "compare"] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => { setTeamReportMode(m); if (m === "compare") { setCompareIds([]); setCompareCurrentData({}); setComparePrevData({}); } }}
                          style={{
                            padding: "8px 18px", borderRadius: 9, cursor: "pointer",
                            border: teamReportMode === m ? "1px solid var(--accent)" : "1px solid var(--rule)",
                            background: teamReportMode === m ? "rgba(59,130,246,.15)" : "rgba(255,255,255,.04)",
                            color: teamReportMode === m ? "var(--accent)" : "var(--fg-dim)",
                            fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace",
                            letterSpacing: "0.08em", textTransform: "uppercase" as const,
                          }}
                        >
                          {m === "list" ? (lang === "tr" ? "Liste" : "List") : (lang === "tr" ? "Karşılaştır" : "Compare")}
                        </button>
                      ))}
                    </div>

                    {/* Consultant selection grid */}
                    <div className={styles.card}>
                      <div className={styles.sectHd}>
                        <h2>
                          <Icon name="users" size={15} />
                          {lang === "tr" ? "Danışmanlar" : "Consultants"}
                          <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--fg-faint)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {teamReportMode === "compare"
                              ? ` · ${compareIds.length}/3`
                              : ` · ${teamReportSelectedIds.length}/${teamReportMembers.length + (selectedTL ? 1 : 0)}`}
                          </span>
                        </h2>
                        {teamReportMode === "list" ? (
                          <button className={styles.sectLink} onClick={() => {
                            const allIds = [...(selectedTL ? [selectedTL.id] : []), ...teamReportMembers.map((m: any) => m.id)];
                            const total = teamReportMembers.length + (selectedTL ? 1 : 0);
                            setTeamReportSelectedIds(teamReportSelectedIds.length === total ? [] : allIds);
                          }}>
                            {teamReportSelectedIds.length === teamReportMembers.length + (selectedTL ? 1 : 0)
                              ? (lang === "tr" ? "Seçimi Kaldır" : "Deselect All")
                              : (lang === "tr" ? "Tümünü Seç" : "Select All")}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>
                            {lang === "tr" ? "En fazla 3 danışman" : "Up to 3 consultants"}
                          </span>
                        )}
                      </div>
                      <div className={styles.trMemberGrid}>
                        {selectedTL && (() => {
                          const listSel = teamReportSelectedIds.includes(selectedTL.id);
                          const cmpSel = compareIds.includes(selectedTL.id);
                          const isActive = teamReportMode === "list" ? listSel : cmpSel;
                          const disabled = teamReportMode === "compare" && !cmpSel && compareIds.length >= 3;
                          return (
                            <div
                              key={selectedTL.id}
                              className={`${styles.trMemberCard} ${isActive ? styles.trMemberCardActive : ""}`}
                              style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.38 : 1, position: "relative" }}
                              onClick={() => {
                                if (disabled) return;
                                if (teamReportMode === "list") {
                                  setTeamReportSelectedIds(prev =>
                                    prev.includes(selectedTL.id) ? prev.filter(id => id !== selectedTL.id) : [...prev, selectedTL.id]
                                  );
                                } else {
                                  if (cmpSel) {
                                    setCompareIds(prev => prev.filter(id => id !== selectedTL.id));
                                    setCompareCurrentData(prev => { const n = { ...prev }; delete n[selectedTL.id]; return n; });
                                    setComparePrevData(prev => { const n = { ...prev }; delete n[selectedTL.id]; return n; });
                                  } else {
                                    setCompareIds(prev => [...prev, selectedTL.id]);
                                  }
                                }
                              }}
                            >
                              <div className={styles.trMemberAvatar} style={{ background: "rgba(52,211,153,.18)", color: "#34d399" }}>{selectedTL.name.charAt(0).toUpperCase()}</div>
                              <div className={styles.trMemberName}>{selectedTL.name.split(" ")[0]}</div>
                              <div style={{ fontSize: 8.5, color: "#34d399", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>TL</div>
                              {isActive && <div className={styles.trMemberCheck}>✓</div>}
                            </div>
                          );
                        })()}
                        {teamReportMembers.map((m: any) => {
                          const listSel = teamReportSelectedIds.includes(m.id);
                          const cmpSel = compareIds.includes(m.id);
                          const isActive = teamReportMode === "list" ? listSel : cmpSel;
                          const disabled = teamReportMode === "compare" && !cmpSel && compareIds.length >= 3;
                          return (
                            <div
                              key={m.id}
                              className={`${styles.trMemberCard} ${isActive ? styles.trMemberCardActive : ""}`}
                              style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.38 : 1 }}
                              onClick={() => {
                                if (disabled) return;
                                if (teamReportMode === "list") {
                                  setTeamReportSelectedIds(prev =>
                                    prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                                  );
                                } else {
                                  if (cmpSel) {
                                    setCompareIds(prev => prev.filter(id => id !== m.id));
                                    setCompareCurrentData(prev => { const n = { ...prev }; delete n[m.id]; return n; });
                                    setComparePrevData(prev => { const n = { ...prev }; delete n[m.id]; return n; });
                                  } else {
                                    setCompareIds(prev => [...prev, m.id]);
                                  }
                                }
                              }}
                            >
                              <div className={styles.trMemberAvatar}>{m.name.charAt(0).toUpperCase()}</div>
                              <div className={styles.trMemberName}>{m.name.split(" ")[0]}</div>
                              {isActive && <div className={styles.trMemberCheck}>✓</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Date range + apply */}
                    <div className={styles.card} style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, alignItems: "flex-end", padding: 16 }}>
                      <div>
                        <label className={styles.fbLabel}>{lang === "tr" ? "Başlangıç" : "Start Date"}</label>
                        <input type="date" className={styles.formInput} style={{ width: "auto" }} value={teamReportStartDate} onChange={e => setTeamReportStartDate(e.target.value)} />
                      </div>
                      <div>
                        <label className={styles.fbLabel}>{lang === "tr" ? "Bitiş" : "End Date"}</label>
                        <input type="date" className={styles.formInput} style={{ width: "auto" }} value={teamReportEndDate} onChange={e => setTeamReportEndDate(e.target.value)} />
                      </div>
                      <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        style={{ borderRadius: 9 }}
                        onClick={() => teamReportMode === "list" ? fetchTeamReportEvals() : fetchCompareData()}
                      >
                        {lang === "tr" ? "Uygula" : "Apply"}
                      </button>
                      {teamReportStartDate && (
                        <button
                          className={`${styles.btn} ${styles.btnGhost}`}
                          style={{ borderRadius: 9, fontSize: 12 }}
                          onClick={() => { setTeamReportStartDate(""); setTeamReportEndDate(""); }}
                        >
                          {lang === "tr" ? "Temizle" : "Clear"}
                        </button>
                      )}
                    </div>

                    {/* LIST MODE */}
                    {teamReportMode === "list" && (
                      <>
                        {(teamReportLoading || teamReportScoresLoading) ? (
                          <div className={`${styles.card} ${styles.spinner}`}><div /></div>
                        ) : (
                          <>
                            {/* Single agent → full ScoreView */}
                            {teamReportSelectedIds.length === 1 && teamReportScores[teamReportSelectedIds[0]] && (
                              <ScoreView data={teamReportScores[teamReportSelectedIds[0]]} lang={lang} canRefresh={true} />
                            )}

                            {/* Multiple agents → comparison cards */}
                            {teamReportSelectedIds.length > 1 && Object.keys(teamReportScores).length > 0 && (() => {
                              const agentData = teamReportSelectedIds.map(id => teamReportScores[id]).filter(Boolean);
                              if (!agentData.length) return null;
                              const scoreColor = (s: number) =>
                                s >= 85 ? "#34d399" : s >= 70 ? "var(--accent)" : s >= 55 ? "#fbbf24" : "#f87171";
                              return (
                                <div className={styles.compareGrid} style={{ gridTemplateColumns: `repeat(${agentData.length}, 1fr)` }}>
                                  {agentData.map((d) => (
                                    <div key={d.agent.id} className={styles.compareCard}>
                                      <div className={styles.compareCardHdr}>
                                        <div className={styles.compareAvatar}>{d.agent.name.charAt(0)}</div>
                                        <div>
                                          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg)" }}>{d.agent.name}</div>
                                          <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                            #{d.rank} · {d.agent.team}
                                          </div>
                                        </div>
                                      </div>
                                      <div className={styles.compareMainScore} style={{ marginTop: 16 }}>
                                        <div className={styles.compareScoreV} style={{ color: scoreColor(d.stats.avgScore) }}>
                                          {d.stats.avgScore}<span>%</span>
                                        </div>
                                        <div className={styles.compareScoreK}>{lang === "tr" ? "Ort.\nSkor" : "Avg.\nScore"}</div>
                                      </div>
                                      <div className={styles.compareStatsRow} style={{ marginTop: 16 }}>
                                        <div className={styles.compareStat}>
                                          <div className={styles.compareStatV} style={{ color: "var(--accent)" }}>{d.stats.totalCalls}</div>
                                          <div className={styles.compareStatK}>{lang === "tr" ? "Toplam" : "Total"}</div>
                                        </div>
                                        <div className={styles.compareStat}>
                                          <div className={styles.compareStatV} style={{ color: scoreColor(d.stats.avgScore) }}>{d.stats.avgScore}%</div>
                                          <div className={styles.compareStatK}>{lang === "tr" ? "Ortalama" : "Average"}</div>
                                        </div>
                                        <div className={styles.compareStat}>
                                          <div className={styles.compareStatV} style={{ color: "#34d399" }}>{d.stats.highestScore}%</div>
                                          <div className={styles.compareStatK}>{lang === "tr" ? "En Yüksek" : "Highest"}</div>
                                        </div>
                                      </div>
                                      <div className={styles.compareTrend} style={{ marginTop: 16 }}>
                                        <div className={styles.compareTrendLabel}>{lang === "tr" ? "Haftalık seyir" : "Weekly trend"}</div>
                                        <div className={styles.compareBars}>
                                          {d.weeklyProgress.map((w: any, i: number) => (
                                            <div key={i} className={styles.compareBar}>
                                              <div
                                                className={styles.compareBarFill}
                                                style={{ height: `${w.score}%`, background: `linear-gradient(180deg, ${scoreColor(w.score)}cc, ${scoreColor(w.score)}44)` }}
                                              />
                                              <div className={styles.compareBarLabel}>{w.week.replace("Hafta ", "W")}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div style={{ marginTop: 16 }}>
                                        <div className={styles.compareTrendLabel}>{lang === "tr" ? "Son çağrılar" : "Recent calls"}</div>
                                        {d.recentCalls.slice(0, 4).map((c: any) => (
                                          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--rule)" }}>
                                            <div style={{ fontSize: 11, color: "var(--fg-dim)" }}>{c.customer}</div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: scoreColor(c.score) }}>{c.score}%</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            {/* Evaluation list */}
                            <div className={styles.card}>
                              {teamReportEvals.length === 0 ? (
                                <div className={styles.emptyMsg}>
                                  {lang === "tr" ? "Danışman seçip Uygula'ya basın." : "Select consultants and press Apply."}
                                </div>
                              ) : (
                                <EvaluationList evaluations={teamReportEvals} showAgent lang={lang} emptyMessage={lang === "tr" ? "Sonuç bulunamadı." : "No results."} />
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* COMPARE MODE */}
                    {teamReportMode === "compare" && (
                      <>
                        {compareIds.length === 0 ? (
                          <div className={styles.emptyMsg}>
                            {lang === "tr" ? "Karşılaştırmak için danışman seçin." : "Select consultants to compare."}
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                style={{ borderRadius: 9 }}
                                onClick={() => fetchCompareData()}
                                disabled={compareLoading}
                              >
                                {compareLoading
                                  ? (lang === "tr" ? "Yükleniyor..." : "Loading...")
                                  : (lang === "tr" ? "Karşılaştır" : "Compare")}
                              </button>
                            </div>

                            {/* Period info banner */}
                            {teamReportStartDate && teamReportEndDate && (() => {
                              const prev = getPrevPeriodDates();
                              return (
                                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 16, padding: "10px 14px", background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.12)", borderRadius: 9, fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em", color: "var(--fg-dim)" }}>
                                  <span><span style={{ color: "var(--accent)" }}>●</span> {lang === "tr" ? "Dönem:" : "Period:"} {teamReportStartDate} → {teamReportEndDate}</span>
                                  {prev && <span style={{ opacity: 0.6 }}><span style={{ color: "var(--fg-faint)" }}>○</span> {lang === "tr" ? "Önceki:" : "Prev:"} {prev.startDate} → {prev.endDate}</span>}
                                </div>
                              );
                            })()}

                            {compareLoading ? (
                              <div className={`${styles.card} ${styles.spinner}`}><div /></div>
                            ) : Object.keys(compareCurrentData).length > 0 && (
                              <div className={styles.compareGrid} style={{ gridTemplateColumns: `repeat(${compareIds.length}, 1fr)` }}>
                                {compareIds.map(agentId => {
                                  const member = teamReportMembers.find((m: any) => m.id === agentId);
                                  const curr = compareCurrentData[agentId];
                                  const prev = comparePrevData[agentId];
                                  if (!curr) return null;
                                  const scoreDelta = prev ? curr.stats.avgScore - prev.stats.avgScore : null;
                                  const callsDelta = prev ? curr.stats.totalCalls - prev.stats.totalCalls : null;
                                  return (
                                    <div key={agentId} className={styles.compareCard}>
                                      <div className={styles.compareCardHdr}>
                                        <div className={styles.compareAvatar}>{(curr.agent?.name || member?.name || "?").charAt(0).toUpperCase()}</div>
                                        <div>
                                          <div className={styles.compareAgentName}>{curr.agent?.name || member?.name}</div>
                                          {curr.isDemo && <span style={{ fontSize: 9, color: "#fbbf24", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Demo</span>}
                                        </div>
                                      </div>

                                      <div className={styles.compareMainScore}>
                                        <div className={styles.compareScoreV}>{curr.stats.avgScore}<span>%</span></div>
                                        {scoreDelta !== null && (
                                          <div className={`${styles.compareDelta} ${scoreDelta >= 0 ? styles.compareDeltaPos : styles.compareDeltaNeg}`}>
                                            {scoreDelta >= 0 ? "↑" : "↓"} {Math.abs(scoreDelta)}%
                                          </div>
                                        )}
                                        <div className={styles.compareScoreK}>{lang === "tr" ? "Ort. Skor" : "Avg. Score"}</div>
                                      </div>

                                      <div className={styles.compareStatsRow}>
                                        <div className={styles.compareStat}>
                                          <div className={styles.compareStatV}>{curr.stats.totalCalls}</div>
                                          <div className={styles.compareStatK}>{lang === "tr" ? "Çağrı" : "Calls"}</div>
                                          {callsDelta !== null && (
                                            <div className={`${styles.compareDelta} ${callsDelta >= 0 ? styles.compareDeltaPos : styles.compareDeltaNeg}`} style={{ fontSize: 9 }}>
                                              {callsDelta >= 0 ? "+" : ""}{callsDelta}
                                            </div>
                                          )}
                                        </div>
                                        <div className={styles.compareStat}>
                                          <div className={styles.compareStatV}>{curr.stats.highestScore}<span style={{ fontSize: 11 }}>%</span></div>
                                          <div className={styles.compareStatK}>{lang === "tr" ? "En Yüksek" : "Best"}</div>
                                        </div>
                                        <div className={styles.compareStat}>
                                          <div className={styles.compareStatV}>#{curr.rank}</div>
                                          <div className={styles.compareStatK}>{lang === "tr" ? "Sıra" : "Rank"}</div>
                                        </div>
                                      </div>

                                      {curr.weeklyProgress?.length > 0 && (
                                        <div className={styles.compareTrend}>
                                          <div className={styles.compareTrendLabel}>{lang === "tr" ? "Haftalık" : "Weekly"}</div>
                                          <div className={styles.compareBars}>
                                            {curr.weeklyProgress.map((w: any, i: number) => (
                                              <div key={i} className={styles.compareBar}>
                                                <div className={styles.compareBarFill} style={{ height: `${Math.max(w.score || 0, 0)}%`, minHeight: (w.score || 0) > 0 ? 3 : 0 }} />
                                                <span className={styles.compareBarLabel}>{`W${i + 1}`}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── PEER ── */}
            {activeTab === "peer" && (
              <div className={styles.page}>
                <PeerComparisonView agentId={user.id} lang={lang} />
              </div>
            )}

            {/* ── STATUS ── */}
            {activeTab === "status" && (() => {
              const now = new Date();
              const applyQuick = (f: typeof statusFilter, month?: string) => {
                const end = new Date();
                end.setHours(23, 59, 59, 999);
                if (f === "3m") { const s = new Date(end); s.setMonth(s.getMonth() - 3); setStatusStart(s.toISOString().slice(0, 10)); setStatusEnd(end.toISOString().slice(0, 10)); }
                else if (f === "6m") { const s = new Date(end); s.setMonth(s.getMonth() - 6); setStatusStart(s.toISOString().slice(0, 10)); setStatusEnd(end.toISOString().slice(0, 10)); }
                else if (f === "1y") { const s = new Date(end); s.setFullYear(s.getFullYear() - 1); setStatusStart(s.toISOString().slice(0, 10)); setStatusEnd(end.toISOString().slice(0, 10)); }
                else if (f === "month" && month) {
                  const [y, m] = month.split("-").map(Number);
                  const s = new Date(y, m - 1, 1);
                  const e = new Date(y, m, 0, 23, 59, 59, 999);
                  setStatusStart(s.toISOString().slice(0, 10)); setStatusEnd(e.toISOString().slice(0, 10));
                } else if (f === "all") { setStatusStart(""); setStatusEnd(""); }
              };

              const filtered = evaluations.filter(ev => {
                const d = ev.callDate ? new Date(ev.callDate) : null;
                if (!d) return true;
                if (statusStart && d < new Date(statusStart)) return false;
                if (statusEnd && d > new Date(statusEnd + "T23:59:59")) return false;
                return true;
              });
              const fAvg = filtered.length ? Math.round(filtered.reduce((a: number, e: any) => a + e.score, 0) / filtered.length) : 0;
              const fHigh = filtered.length ? Math.max(...filtered.map((e: any) => e.score)) : 0;

              const tr = lang === "tr";
              const quickBtns: { key: typeof statusFilter; label: string }[] = [
                { key: "all", label: tr ? "Tümü" : "All" },
                { key: "month", label: tr ? "Ay Seçimi" : "By Month" },
                { key: "3m", label: tr ? "Son 3 Ay" : "Last 3M" },
                { key: "6m", label: tr ? "Son 6 Ay" : "Last 6M" },
                { key: "1y", label: tr ? "Son 1 Yıl" : "Last 1Y" },
              ];

              return (
                <div className={styles.page}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
                    <div>
                      <h1 className={styles.pageH1}>{navLabels.status}</h1>
                      <p className={styles.pageSub}>{tr ? "Genel istatistikler" : "Overall statistics"}</p>
                    </div>

                    {/* Filter controls */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                      {/* Quick filter chips */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {quickBtns.map(btn => (
                          <button key={btn.key} onClick={() => { setStatusFilter(btn.key); applyQuick(btn.key, statusMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`); }}
                            style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid", cursor: "pointer", transition: "all 0.15s", background: statusFilter === btn.key ? "var(--accent)" : "rgba(255,255,255,.05)", borderColor: statusFilter === btn.key ? "var(--accent)" : "var(--rule)", color: statusFilter === btn.key ? "#fff" : "var(--fg-faint)" }}>
                            {btn.label}
                          </button>
                        ))}
                      </div>

                      {/* Month picker — sadece "month" seçiliyken */}
                      {statusFilter === "month" && (
                        <input type="month" value={statusMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`}
                          onChange={e => { setStatusMonth(e.target.value); applyQuick("month", e.target.value); }}
                          style={{ padding: "5px 12px", borderRadius: 10, fontSize: 12, background: "rgba(255,255,255,.07)", border: "1px solid var(--rule)", color: "var(--fg)", outline: "none" }} />
                      )}

                      {/* Custom date range */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="date" value={statusStart} onChange={e => { setStatusStart(e.target.value); setStatusFilter("all"); }}
                          style={{ padding: "5px 10px", borderRadius: 10, fontSize: 11, background: "rgba(255,255,255,.07)", border: "1px solid var(--rule)", color: "var(--fg)", outline: "none" }} />
                        <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>–</span>
                        <input type="date" value={statusEnd} onChange={e => { setStatusEnd(e.target.value); setStatusFilter("all"); }}
                          style={{ padding: "5px 10px", borderRadius: 10, fontSize: 11, background: "rgba(255,255,255,.07)", border: "1px solid var(--rule)", color: "var(--fg)", outline: "none" }} />
                        {(statusStart || statusEnd) && (
                          <button onClick={() => { setStatusStart(""); setStatusEnd(""); setStatusFilter("all"); }}
                            style={{ padding: "4px 8px", borderRadius: 8, fontSize: 10, background: "rgba(255,255,255,.06)", border: "1px solid var(--rule)", color: "var(--fg-faint)", cursor: "pointer" }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className={styles.statGrid3}>
                    {[
                      { label: tr ? "Toplam Çağrı" : "Total Calls", value: filtered.length, accent: "var(--accent)" },
                      { label: tr ? "Ortalama Skor" : "Average Score", value: `${fAvg}%`, accent: "#34d399" },
                      { label: tr ? "En Yüksek" : "Highest", value: filtered.length ? `${fHigh}%` : "—", accent: "#fbbf24" },
                    ].map(s => (
                      <div key={s.label} className={styles.statCard}>
                        <div className={styles.statLabel}>{s.label}</div>
                        <div className={styles.statValue} style={{ color: s.accent }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.card}>
                    <EvaluationList
                      evaluations={filtered.slice(0, 50)}
                      showAgent
                      lang={lang}
                    />
                  </div>
                </div>
              );
            })()}

            {/* ── TEAM ── */}
            {activeTab === "team" && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.team}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr" ? "Danışman performanslarını karşılaştır" : "Compare consultant performances"}
                  </p>
                </div>

                {/* Filter row — components carry their own card styling */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 14, alignItems: "start" }}>
                  <TeamMemberPicker
                    members={members}
                    selectedIds={selectedIds}
                    onChange={setSelectedIds}
                    lang={lang}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <DateRangePicker
                      startDate={startDate}
                      endDate={endDate}
                      onStartChange={setStartDate}
                      onEndChange={setEndDate}
                      onApply={fetchTeamEvals}
                      lang={lang}
                    />
                    <button
                      onClick={fetchTeamEvals}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      style={{ width: "100%", borderRadius: 10, justifyContent: "center" }}
                    >
                      {lang === "tr" ? "Uygula" : "Apply"}
                    </button>
                  </div>
                </div>

                {/* Loading */}
                {(teamEvalsLoading || teamScoresLoading) && (
                  <div className={`${styles.card} ${styles.spinner}`}><div /></div>
                )}

                {/* Single agent — full-width ScoreView, same as My Scores */}
                {!teamScoresLoading && selectedIds.length === 1 && teamMemberScores[selectedIds[0]] && (
                  <ScoreView data={teamMemberScores[selectedIds[0]]} lang={lang} canRefresh={user.role !== "AGENT"} />
                )}

                {/* Multiple agents — full-width comparison grid */}
                {!teamScoresLoading && selectedIds.length > 1 && Object.keys(teamMemberScores).length > 0 && (() => {
                  const agentData = selectedIds.map(id => teamMemberScores[id]).filter(Boolean);
                  if (!agentData.length) return null;
                  const scoreColor = (s: number) =>
                    s >= 85 ? "#34d399" : s >= 70 ? "var(--accent)" : s >= 55 ? "#fbbf24" : "#f87171";
                  return (
                    <div className={styles.compareGrid} style={{ gridTemplateColumns: `repeat(${agentData.length}, 1fr)` }}>
                      {agentData.map((d) => (
                        <div key={d.agent.id} className={styles.compareCard}>
                          <div className={styles.compareCardHdr}>
                            <div className={styles.compareAvatar}>{d.agent.name.charAt(0)}</div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg)" }}>{d.agent.name}</div>
                              <div style={{ fontSize: 11, color: "var(--fg-faint)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                #{d.rank} · {d.agent.team}
                              </div>
                            </div>
                          </div>
                          <div className={styles.compareMainScore} style={{ marginTop: 16 }}>
                            <div className={styles.compareScoreV} style={{ color: scoreColor(d.stats.avgScore) }}>
                              {d.stats.avgScore}<span>%</span>
                            </div>
                            <div className={styles.compareScoreK}>{lang === "tr" ? "Ort.\nSkor" : "Avg.\nScore"}</div>
                          </div>
                          <div className={styles.compareStatsRow} style={{ marginTop: 16 }}>
                            <div className={styles.compareStat}>
                              <div className={styles.compareStatV} style={{ color: "var(--accent)" }}>{d.stats.totalCalls}</div>
                              <div className={styles.compareStatK}>{lang === "tr" ? "Toplam" : "Total"}</div>
                            </div>
                            <div className={styles.compareStat}>
                              <div className={styles.compareStatV} style={{ color: scoreColor(d.stats.avgScore) }}>{d.stats.avgScore}%</div>
                              <div className={styles.compareStatK}>{lang === "tr" ? "Ortalama" : "Average"}</div>
                            </div>
                            <div className={styles.compareStat}>
                              <div className={styles.compareStatV} style={{ color: "#34d399" }}>{d.stats.highestScore}%</div>
                              <div className={styles.compareStatK}>{lang === "tr" ? "En Yüksek" : "Highest"}</div>
                            </div>
                          </div>
                          <div className={styles.compareTrend} style={{ marginTop: 16 }}>
                            <div className={styles.compareTrendLabel}>{lang === "tr" ? "Haftalık seyir" : "Weekly trend"}</div>
                            <div className={styles.compareBars}>
                              {d.weeklyProgress.map((w: any, i: number) => (
                                <div key={i} className={styles.compareBar}>
                                  <div
                                    className={styles.compareBarFill}
                                    style={{ height: `${w.score}%`, background: `linear-gradient(180deg, ${scoreColor(w.score)}cc, ${scoreColor(w.score)}44)` }}
                                  />
                                  <div className={styles.compareBarLabel}>{w.week.replace("Hafta ", "W")}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ marginTop: 16 }}>
                            <div className={styles.compareTrendLabel}>{lang === "tr" ? "Son çağrılar" : "Recent calls"}</div>
                            {d.recentCalls.slice(0, 4).map((c: any) => (
                              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--rule)" }}>
                                <div style={{ fontSize: 11, color: "var(--fg-dim)" }}>{c.customer}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: scoreColor(c.score) }}>{c.score}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Evaluation list — full width */}
                {!teamEvalsLoading && (
                  <div className={styles.card}>
                    <EvaluationList
                      evaluations={teamEvals}
                      showAgent
                      lang={lang}
                      emptyMessage={lang === "tr" ? "Filtre uygulayın." : "Apply a filter."}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── FEEDBACK ── */}
            {activeTab === "feedback" && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.feedback}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr" ? "Görüşlerinizi bizimle paylaşın" : "Share your thoughts with us"}
                  </p>
                </div>
                <div className={styles.card} style={{ maxWidth: 560 }}>
                  <div className={styles.fbGrid}>
                    {([
                      {
                        key: "system", icon: "gear",
                        title: lang === "tr" ? "Sistem" : "System",
                        sub: lang === "tr" ? "Arayüz, kullanım, genel" : "Interface, usability, general",
                      },
                      {
                        key: "evaluation", icon: "star",
                        title: lang === "tr" ? "Değerlendirme" : "Evaluation",
                        sub: lang === "tr" ? "Puanlama, rapor, analiz" : "Scoring, reports, analysis",
                      },
                    ] as const).map(cat => (
                      <button
                        key={cat.key}
                        onClick={() => setFbCat(cat.key as "system" | "evaluation")}
                        className={`${styles.fbCatCard} ${fbCat === cat.key ? styles.fbCatCardActive : ""}`}
                      >
                        <Icon name={cat.icon} size={20} />
                        <div className={styles.fbCatTitle}>{cat.title}</div>
                        <div className={styles.fbCatSub}>{cat.sub}</div>
                      </button>
                    ))}
                  </div>
                  <label className={styles.fbLabel}>{lang === "tr" ? "Yorumunuz" : "Your Comment"}</label>
                  <textarea
                    className={styles.fbTextarea}
                    rows={5}
                    value={fbComment}
                    onChange={e => setFbComment(e.target.value)}
                    placeholder={lang === "tr" ? "Görüşlerinizi buraya yazın..." : "Write your thoughts here..."}
                    disabled={fbStatus === "sending"}
                  />
                  {fbStatus === "success" && (
                    <p style={{ color: "#34d399", fontSize: 13, marginTop: 8 }}>
                      {lang === "tr" ? "Geri bildiriminiz iletildi, teşekkürler!" : "Feedback sent, thank you!"}
                    </p>
                  )}
                  {fbStatus === "error" && (
                    <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>
                      {lang === "tr" ? "Gönderme başarısız." : "Failed to send."}
                    </p>
                  )}
                  <button
                    onClick={handleFeedback}
                    disabled={fbStatus === "sending" || !fbCat || !fbComment.trim()}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    style={{
                      marginTop: 16, borderRadius: 10, justifyContent: "center",
                      opacity: (fbStatus === "sending" || !fbCat || !fbComment.trim()) ? 0.45 : 1,
                    }}
                  >
                    {fbStatus === "sending"
                      ? (lang === "tr" ? "Gönderiliyor..." : "Sending...")
                      : (lang === "tr" ? "Gönder" : "Send")}
                  </button>
                </div>
              </div>
            )}

            {/* ── BATCH (ADMIN) ── */}
            {activeTab === "batch" && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.batch}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr" ? "CSV veya DOCX ile toplu çağrı analizi" : "Bulk call analysis via CSV or DOCX"}
                  </p>
                </div>
                <div className={styles.card}>
                  <div className={styles.batchModeBtns}>
                    {(["csv", "docx"] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => { setBatchMode(mode); setBatchResults(null); setBatchMsg(""); }}
                        className={`${styles.batchModeBtn} ${batchMode === mode ? styles.batchModeBtnActive : ""}`}
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {batchMode === "csv" && (
                    <>
                      <p style={{ fontSize: 12, color: "var(--fg-faint)", marginBottom: 12 }}>
                        {lang === "tr" ? "Beklenen kolonlar:" : "Expected columns:"}{" "}
                        <code style={{ color: "var(--fg-dim)" }}>transcript</code>{" "}
                        ({lang === "tr" ? "zorunlu" : "required"}),
                        agentName, customerName, callDuration, callType
                      </p>
                      <label className={styles.uploadZone}>
                        <Icon name="upload" size={24} />
                        <span className={styles.uploadZoneText}>
                          {batchFile ? batchFile.name : (lang === "tr" ? "CSV dosyası seçin" : "Select CSV file")}
                        </span>
                        <input type="file" accept=".csv" onChange={handleCsvChange} style={{ display: "none" }} />
                      </label>
                      {batchCalls.length > 0 && (
                        <p style={{ fontSize: 12, color: "#34d399", marginBottom: 12 }}>
                          {batchCalls.length} {lang === "tr" ? "çağrı yüklendi" : "calls loaded"}
                        </p>
                      )}
                    </>
                  )}

                  {batchMode === "docx" && (
                    <>
                      <p style={{ fontSize: 12, color: "var(--fg-faint)", marginBottom: 12 }}>
                        {lang === "tr"
                          ? "Her dosya = 1 çağrı. İsteğe bağlı başlık: Danışman:, Müşteri:, Süre:"
                          : "Each file = 1 call. Optional header: Agent:, Customer:, Duration:"}
                      </p>
                      <label className={styles.uploadZone}>
                        {docxLoading ? (
                          <div className={styles.spinner}><div /></div>
                        ) : (
                          <>
                            <Icon name="doc" size={24} />
                            <span className={styles.uploadZoneText}>
                              {docxRows.length > 0
                                ? `${docxRows.length} ${lang === "tr" ? "dosya yüklendi" : "files loaded"}`
                                : (lang === "tr" ? "DOCX dosyaları seçin" : "Select DOCX files")}
                            </span>
                          </>
                        )}
                        <input type="file" accept=".docx" multiple onChange={handleDocxChange} style={{ display: "none" }} />
                      </label>
                      {docxRows.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                            <select
                              value={applyAllAgentId}
                              onChange={e => setApplyAllAgentId(e.target.value)}
                              style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,.05)", border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "8px 12px", color: "var(--fg)", fontSize: 12, outline: "none" }}
                            >
                              <option value="">{lang === "tr" ? "— Danışman seç —" : "— Select agent —"}</option>
                              {users.filter((u: any) => ["AGENT", "TEAM_LEADER"].includes(u.role)).map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => { if (applyAllAgentId) setDocxRows(prev => prev.map(r => ({ ...r, agentId: applyAllAgentId }))); }}
                              disabled={!applyAllAgentId}
                              className={styles.btnSmall}
                              style={{ opacity: applyAllAgentId ? 1 : 0.4 }}
                            >
                              {lang === "tr" ? "Tümüne uygula" : "Apply to all"}
                            </button>
                            <select
                              value={applyAllPromptId}
                              onChange={e => setApplyAllPromptId(e.target.value)}
                              style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,.05)", border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "8px 12px", color: "var(--fg)", fontSize: 12, outline: "none" }}
                            >
                              <option value="">{lang === "tr" ? "— Prompt seç —" : "— Select prompt —"}</option>
                              {prompts.filter((p: any) => p.isActive).map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => { if (applyAllPromptId) setDocxRows(prev => prev.map(r => ({ ...r, promptId: applyAllPromptId }))); }}
                              disabled={!applyAllPromptId}
                              className={styles.btnSmall}
                              style={{ opacity: applyAllPromptId ? 1 : 0.4 }}
                            >
                              {lang === "tr" ? "Tümüne uygula" : "Apply to all"}
                            </button>
                          </div>
                          <div style={{ maxHeight: 200, overflowY: "auto" }}>
                            {docxRows.map((row, idx) => (
                              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                                <span style={{ fontSize: 11, color: "var(--fg-faint)", minWidth: 24 }}>{idx + 1}</span>
                                <span style={{ fontSize: 12, color: "var(--fg-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.fileName}</span>
                                <select
                                  value={row.agentId}
                                  onChange={e => updateDocxRow(idx, "agentId", e.target.value)}
                                  style={{ background: "rgba(255,255,255,.05)", border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 6, padding: "4px 8px", color: "var(--fg)", fontSize: 11, outline: "none" }}
                                >
                                  <option value="">—</option>
                                  {users.filter((u: any) => ["AGENT", "TEAM_LEADER"].includes(u.role)).map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={row.promptId}
                                  onChange={e => updateDocxRow(idx, "promptId", e.target.value)}
                                  style={{ background: "rgba(255,255,255,.05)", border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 6, padding: "4px 8px", color: "var(--fg)", fontSize: 11, outline: "none" }}
                                >
                                  <option value="">—</option>
                                  {prompts.filter((p: any) => p.isActive).map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                    <button
                      onClick={handleBatchStart}
                      disabled={batchLoading || (batchMode === "csv" ? batchCalls.length === 0 : docxRows.length === 0)}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      style={{
                        borderRadius: 10,
                        background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
                        opacity: (batchLoading || (batchMode === "csv" ? batchCalls.length === 0 : docxRows.length === 0)) ? 0.45 : 1,
                      }}
                    >
                      {batchLoading
                        ? (lang === "tr" ? "Analiz ediliyor..." : "Analyzing...")
                        : (lang === "tr"
                            ? `${batchMode === "csv" ? batchCalls.length : docxRows.length} Çağrıyı Analiz Et`
                            : `Analyze ${batchMode === "csv" ? batchCalls.length : docxRows.length} Calls`)}
                    </button>
                    {batchMsg && (
                      <p style={{ fontSize: 13, color: batchMsg.includes("hata") || batchMsg.includes("başarısız") ? "#f87171" : "#34d399" }}>
                        {batchMsg}
                      </p>
                    )}
                  </div>

                  {batchResults && (
                    <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: "rgba(52,211,153,.08)", border: "0.5px solid rgba(52,211,153,.2)" }}>
                      <p style={{ color: "#34d399", fontWeight: 600, fontSize: 13 }}>
                        {lang === "tr" ? "Sonuç:" : "Result:"}{" "}
                        {batchResults.success} {lang === "tr" ? "başarılı" : "successful"},{" "}
                        {batchResults.failed} {lang === "tr" ? "başarısız" : "failed"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "leaderboard" && (
              <div className={styles.page}>
                <LeaderboardView lang={lang} userRole={user.role as "AGENT" | "TEAM_LEADER" | "MANAGER" | "ADMIN"} />
              </div>
            )}

            {activeTab === "negKeywords" && (user.role === "ADMIN" || user.role === "MANAGER") && (
              <div className={styles.page}>
                <NegativeKeywordsReport lang={lang} />
              </div>
            )}

            {activeTab === "coachingTracking" && isManagerLike && (
              <div className={styles.page}>
                <CoachingTrackingView lang={lang} />
              </div>
            )}

            {/* ── ADMIN ── */}
            {activeTab === "feedbacks" && user.role === "ADMIN" && (
              <AdminPanel user={user} lang={lang} initialTab="feedbacks" />
            )}

            {activeTab === "sync" && user.role === "ADMIN" && (
              <AdminPanel user={user} lang={lang} initialTab="sync" />
            )}

            {activeTab === "recentCalls" && user.role === "ADMIN" && (
              <AdminPanel user={user} lang={lang} initialTab="recentCalls" />
            )}

            {activeTab === "admin" && (user.role === "ADMIN" || user.role === "MANAGER") && (
              <AdminPanel user={user} lang={lang} />
            )}

            {/* ── ADVISOR DASHBOARD ── */}
            {activeTab === "advisor" && (isManagerLike || user.role === "TEAM_LEADER") && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.advisor}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr"
                      ? "Danışman bazında skor ve gelişim takibi"
                      : "Score and development tracking per advisor"}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                  {/* ── Left panel — selectors ── */}
                  <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>

                    {/* TL list — Admin & Manager only */}
                    {isManagerLike && (
                      <>
                        <div className={styles.sectHd}>
                          <h2 className={styles.sectH2}>
                            {lang === "tr" ? "Takım Lideri" : "Team Leader"}
                          </h2>
                        </div>
                        {advisorTLsLoading && (
                          <div className={`${styles.card} ${styles.spinner}`}><div /></div>
                        )}
                        {!advisorTLsLoading && advisorTLs.length === 0 && (
                          <p style={{ fontSize: 13, color: "var(--fg-faint)", padding: "8px 0" }}>
                            {lang === "tr" ? "Takım bulunamadı." : "No teams found."}
                          </p>
                        )}
                        {advisorTLs.map(tl => (
                          <button
                            key={tl.id}
                            onClick={() => {
                              if (advisorSelectedTLId === tl.id) return;
                              setAdvisorSelectedTLId(tl.id);
                              setAdvisorSelectedAgentId(null);
                              setAdvisorScoreData(null);
                              setAdvisorMembers([]);
                              fetchAdvisorMembers(tl.id);
                            }}
                            style={{
                              display: "block", width: "100%", textAlign: "left",
                              padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                              border: advisorSelectedTLId === tl.id
                                ? "1px solid var(--accent)"
                                : "1px solid var(--glass-border)",
                              background: advisorSelectedTLId === tl.id
                                ? "rgba(59,130,246,.12)"
                                : "var(--glass-bg)",
                              color: advisorSelectedTLId === tl.id ? "var(--accent)" : "var(--fg)",
                              fontSize: 13, fontWeight: 500,
                            }}
                          >
                            {tl.name}
                            <span style={{ display: "block", fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>
                              {tl.teamName}
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Agent list — shown when TL selected (Admin/Manager) or always (TL role) */}
                    {(advisorSelectedTLId !== null || user.role === "TEAM_LEADER") && (
                      <>
                        <div className={styles.sectHd} style={{ marginTop: isManagerLike ? 16 : 0 }}>
                          <h2 className={styles.sectH2}>
                            {lang === "tr" ? "Danışman" : "Advisor"}
                          </h2>
                        </div>
                        {advisorMembersLoading && (
                          <div className={`${styles.card} ${styles.spinner}`}><div /></div>
                        )}
                        {!advisorMembersLoading && advisorMembers.length === 0 && (
                          <p style={{ fontSize: 13, color: "var(--fg-faint)", padding: "8px 0" }}>
                            {lang === "tr" ? "Danışman bulunamadı." : "No advisors found."}
                          </p>
                        )}
                        {advisorMembers.map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              if (advisorSelectedAgentId === m.id) return;
                              setAdvisorSelectedAgentId(m.id);
                              fetchAdvisorScore(m.id);
                            }}
                            style={{
                              display: "block", width: "100%", textAlign: "left",
                              padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                              border: advisorSelectedAgentId === m.id
                                ? "1px solid var(--accent)"
                                : "1px solid var(--glass-border)",
                              background: advisorSelectedAgentId === m.id
                                ? "rgba(59,130,246,.12)"
                                : "var(--glass-bg)",
                              color: advisorSelectedAgentId === m.id ? "var(--accent)" : "var(--fg)",
                              fontSize: 13, fontWeight: 500,
                            }}
                          >
                            {m.name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  {/* ── Right panel — ScoreView ── */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {advisorLoading && (
                      <div className={`${styles.card} ${styles.spinner}`}><div /></div>
                    )}
                    {!advisorLoading && advisorScoreData && (
                      <ScoreView data={advisorScoreData} lang={lang} canRefresh={true} />
                    )}
                    {!advisorLoading && !advisorScoreData && (
                      <div className={styles.emptyMsg}>
                        {lang === "tr" ? "← Bir danışman seçin" : "← Select an advisor"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── SEARCH ── */}
            {activeTab === "search" && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.search}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr"
                      ? "Müşteri adı veya transkript içeriğine göre ara"
                      : "Search by customer name or transcript content"}
                  </p>
                </div>
                <div className={styles.card}>
                  <SearchView lang={lang} />
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      )}

    </div>
  );
}
