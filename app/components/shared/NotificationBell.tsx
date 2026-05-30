"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import MIcon from "@/app/components/shared/MIcon";

interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  referenceId: string | null;
  createdAt: string;
}

const L = {
  tr: {
    title: "Bildirimler",
    empty: "Henüz bildirim yok.",
    markAllRead: "Tümünü okundu işaretle",
    evaluation: "Değerlendirme",
    feedback: "Geri Bildirim",
  },
  en: {
    title: "Notifications",
    empty: "No notifications yet.",
    markAllRead: "Mark all as read",
    evaluation: "Evaluation",
    feedback: "Feedback",
  },
};

interface Props {
  lang: "tr" | "en";
}

export default function NotificationBell({ lang }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = L[lang];

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const markOneRead = async (id: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.isRead) await markOneRead(n.id);
    setOpen(false);
    if (n.type === "FEEDBACK") {
      router.push("/settings/admin?tab=feedbacks");
    } else if (n.type === "EVALUATION" && n.referenceId) {
      router.push(`/evaluation/${n.referenceId}`);
    } else if (n.type === "UNASSIGNED_CALL") {
      router.push("/settings/admin?tab=sync");
    }
  };

  const typeIcon = (type: string) => {
    if (type === "FEEDBACK") return "feedback";
    if (type === "UNASSIGNED_CALL") return "person_add";
    return "assessment";
  };
  const typeLabel = (type: string) => {
    if (type === "FEEDBACK") return t.feedback;
    if (type === "UNASSIGNED_CALL") return lang === "tr" ? "Atanmamış Çağrı" : "Unassigned Call";
    return t.evaluation;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-all"
      >
        <MIcon name="notifications" className="text-xl" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-error text-on-error text-[9px] font-black rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            className="absolute right-0 top-full mt-2 w-80 bg-surface-container-low border border-outline-variant rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
              <p className="text-sm font-bold text-on-surface">{t.title}</p>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-primary hover:underline">
                  {t.markAllRead}
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-on-surface-variant text-sm">{t.empty}</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high ${!n.isRead ? "bg-primary/5" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === "FEEDBACK" ? "bg-amber-500/15 text-amber-400" : "bg-primary/15 text-primary"}`}>
                      <MIcon name={typeIcon(n.type)} className="text-base" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">{typeLabel(n.type)}</p>
                      <p className="text-xs text-on-surface mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-outline mt-1">
                        {new Date(n.createdAt).toLocaleString(lang === "tr" ? "tr-TR" : "en-GB", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
