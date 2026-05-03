"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AgentDashboard from "@/app/components/dashboards/AgentDashboard";
import TeamLeaderDashboard from "@/app/components/dashboards/TeamLeaderDashboard";
import AdminDashboard from "@/app/components/dashboards/AdminDashboard";

function DashboardInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initialTab   = searchParams.get("tab") || "home";

  const [user, setUser] = useState<{
    id: string; name: string; role: string; email: string; teamId?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("estenove-theme") : null;
    return saved !== "light";
  });
  const [lang, setLang] = useState<"tr" | "en">(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("estenove-lang") : null;
    return saved === "en" || saved === "tr" ? saved : "tr";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) { router.replace("/login"); return; }
        setUser(data.user);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const sharedProps = {
    user, isDark, lang, initialTab,
    onToggleTheme: toggleTheme,
    onToggleLang:  toggleLang,
    onLogout:      handleLogout,
  };

  if (user.role === "ADMIN")       return <AdminDashboard user={user} initialTab={initialTab} />;
  if (user.role === "AGENT")       return <AgentDashboard {...sharedProps} />;
  if (user.role === "TEAM_LEADER") return <TeamLeaderDashboard {...sharedProps} />;

  return null;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
