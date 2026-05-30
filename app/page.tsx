"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LandingPage from "@/app/components/LandingPage";

export default function RootPage() {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    name: string;
    role: string;
    email: string;
    teamId?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"en" | "tr">(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("estenove-lang") : null;
    return saved === "en" || saved === "tr" ? saved : "tr";
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) { router.replace("/login"); return; }
        setUser(data.user);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (loading) {
    return (
      <div style={{ background: "#08090b" }} className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return <LandingPage user={user} lang={lang} onLogout={handleLogout} />;
}