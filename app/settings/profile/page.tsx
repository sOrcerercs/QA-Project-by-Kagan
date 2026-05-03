"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { motion } from "motion/react";

const L = {
  tr: {
    title: "Profil Ayarları",
    accountInfo: "Hesap Bilgileri",
    name: "Ad Soyad",
    email: "E-posta",
    emailNote: "E-posta adresi değiştirilemez.",
    saveInfo: "Bilgileri Kaydet",
    changePassword: "Şifre Değiştir",
    currentPassword: "Mevcut Şifre",
    newPassword: "Yeni Şifre",
    confirmPassword: "Yeni Şifre (Tekrar)",
    changePasswordBtn: "Şifreyi Değiştir",
    saving: "Kaydediliyor...",
    mismatch: "Yeni şifreler eşleşmiyor.",
    back: "Geri",
    role: { ADMIN: "Admin", MANAGER: "Müdür", TEAM_LEADER: "Takım Lideri", AGENT: "Danışman" },
  },
  en: {
    title: "Profile Settings",
    accountInfo: "Account Info",
    name: "Full Name",
    email: "Email",
    emailNote: "Email address cannot be changed.",
    saveInfo: "Save Info",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    changePasswordBtn: "Change Password",
    saving: "Saving...",
    mismatch: "New passwords do not match.",
    back: "Back",
    role: { ADMIN: "Admin", MANAGER: "Manager", TEAM_LEADER: "Team Leader", AGENT: "Consultant" },
  },
};

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const [isDark, setIsDark] = useState(true);

  const [name, setName] = useState("");
  const [infoStatus, setInfoStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [infoError, setInfoError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [pwError, setPwError] = useState("");

  const t = L[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("estenove-lang");
    if (savedLang === "en" || savedLang === "tr") setLang(savedLang);
    const savedTheme = localStorage.getItem("estenove-theme");
    const dark = savedTheme !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("light", !dark);

    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.replace("/login"); return; }
      setUser(d.user);
      setName(d.user.name ?? "");
    });
  }, []);

  const handleSaveInfo = async () => {
    setInfoStatus("saving");
    setInfoError("");
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) { setInfoError(data.error); setInfoStatus("error"); return; }
    setUser((prev: any) => ({ ...prev, name: data.user.name }));
    setInfoStatus("success");
    setTimeout(() => setInfoStatus("idle"), 2500);
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (newPassword !== confirmPassword) { setPwError(t.mismatch); return; }
    setPwStatus("saving");
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) { setPwError(data.error); setPwStatus("error"); return; }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwStatus("success");
    setTimeout(() => setPwStatus("idle"), 2500);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-outline border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface-container-low border-b border-outline-variant px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight">{t.title}</h1>
            <p className="text-xs text-on-surface-variant">{user.email}</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Avatar + name */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-2xl font-black select-none">
            {user.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold">{user.name}</p>
            <p className="text-sm text-on-surface-variant">{t.role[user.role as keyof typeof t.role] ?? user.role}</p>
          </div>
        </motion.div>

        {/* Account Info */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-surface-container rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">{t.accountInfo}</h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.name}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setInfoStatus("idle"); }}
                className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.email}</label>
              <input
                type="email"
                value={user.email}
                readOnly
                className="w-full bg-surface-container-highest rounded-xl px-4 py-2.5 text-sm text-on-surface-variant border border-outline-variant cursor-not-allowed opacity-60"
              />
              <p className="text-[11px] text-outline mt-1">{t.emailNote}</p>
            </div>
          </div>

          {infoError && <p className="text-error text-xs">{infoError}</p>}

          <div className="flex justify-end">
            <button
              onClick={handleSaveInfo}
              disabled={infoStatus === "saving" || name.trim() === user.name}
              className="flex items-center gap-2 bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-on-primary px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            >
              {infoStatus === "saving" ? (
                <><div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />{t.saving}</>
              ) : infoStatus === "success" ? (
                <><Check className="w-4 h-4" />✓</>
              ) : (
                t.saveInfo
              )}
            </button>
          </div>
        </motion.div>

        {/* Change Password */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-surface-container rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">{t.changePassword}</h2>

          <div className="space-y-3">
            {[
              { label: t.currentPassword, value: currentPassword, onChange: setCurrentPassword },
              { label: t.newPassword, value: newPassword, onChange: setNewPassword },
              { label: t.confirmPassword, value: confirmPassword, onChange: setConfirmPassword },
            ].map(({ label, value, onChange }) => (
              <div key={label}>
                <label className="text-xs text-on-surface-variant font-semibold block mb-1">{label}</label>
                <input
                  type="password"
                  value={value}
                  onChange={(e) => { onChange(e.target.value); setPwStatus("idle"); setPwError(""); }}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            ))}
          </div>

          {pwError && <p className="text-error text-xs">{pwError}</p>}

          <div className="flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={pwStatus === "saving" || !currentPassword || !newPassword || !confirmPassword}
              className="flex items-center gap-2 bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-on-primary px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            >
              {pwStatus === "saving" ? (
                <><div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />{t.saving}</>
              ) : pwStatus === "success" ? (
                <><Check className="w-4 h-4" />✓</>
              ) : (
                t.changePasswordBtn
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
