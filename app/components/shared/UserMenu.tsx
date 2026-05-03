"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const roleLabel: Record<string, Record<string, string>> = {
  tr: { ADMIN: "Admin", MANAGER: "Müdür", TEAM_LEADER: "Takım Lideri", AGENT: "Danışman" },
  en: { ADMIN: "Admin", MANAGER: "Manager", TEAM_LEADER: "Team Leader", AGENT: "Consultant" },
};

const L = {
  tr: {
    adminSettings: "Admin Ayarları",
    profileSettings: "Profil Ayarları",
    logout: "Çıkış Yap",
  },
  en: {
    adminSettings: "Admin Settings",
    profileSettings: "Profile Settings",
    logout: "Log Out",
  },
};

interface UserMenuProps {
  user: { name: string; role: string };
  lang: "tr" | "en";
  onLogout: () => void;
}

export default function UserMenu({ user, lang, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = L[lang];
  const isAdmin = user.role === "ADMIN" || user.role === "MANAGER";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-sm font-bold hover:ring-2 hover:ring-primary/40 transition-all select-none"
      >
        {user.name?.charAt(0)?.toUpperCase()}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            className="absolute right-0 top-full mt-2 w-52 bg-surface-container-low border border-outline-variant rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            {/* User info */}
            <div className="px-4 py-3 border-b border-outline-variant">
              <p className="text-sm font-semibold text-on-surface truncate">{user.name}</p>
              <p className="text-xs text-on-surface-variant">{roleLabel[lang][user.role] ?? user.role}</p>
            </div>

            {/* Menu items */}
            <div className="py-1">
              {isAdmin && (
                <button
                  onClick={() => navigate("/settings/admin")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-high transition-colors text-left"
                >
                  <MIcon name="admin_panel_settings" className="text-lg text-on-surface-variant" />
                  {t.adminSettings}
                </button>
              )}
              <button
                onClick={() => navigate("/settings/profile")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-high transition-colors text-left"
              >
                <MIcon name="manage_accounts" className="text-lg text-on-surface-variant" />
                {t.profileSettings}
              </button>
              <div className="my-1 border-t border-outline-variant" />
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error/10 transition-colors text-left"
              >
                <MIcon name="logout" className="text-lg" />
                {t.logout}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
