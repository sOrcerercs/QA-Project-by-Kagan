"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import MIcon from "@/app/components/shared/MIcon";

const CATEGORIES = {
  tr: [
    { value: "evaluation", label: "Değerlendirme Sistemi" },
    { value: "ui", label: "Arayüz / Kullanım" },
    { value: "report", label: "Raporlar" },
    { value: "scoring", label: "Puanlama" },
    { value: "other", label: "Diğer" },
  ],
  en: [
    { value: "evaluation", label: "Evaluation System" },
    { value: "ui", label: "Interface / Usability" },
    { value: "report", label: "Reports" },
    { value: "scoring", label: "Scoring" },
    { value: "other", label: "Other" },
  ],
};

const L = {
  tr: {
    title: "Geri Bildirim Gönder",
    subtitle: "Sistem veya değerlendirmeler hakkında görüşlerinizi paylaşın.",
    category: "Konu",
    selectCategory: "Bir konu seçin...",
    comment: "Yorumunuz",
    commentPlaceholder: "Görüşlerinizi buraya yazın...",
    send: "Gönder",
    sending: "Gönderiliyor...",
    success: "Geri bildiriminiz iletildi, teşekkürler!",
    error: "Gönderme başarısız, tekrar deneyin.",
  },
  en: {
    title: "Send Feedback",
    subtitle: "Share your thoughts about the system or evaluations.",
    category: "Topic",
    selectCategory: "Select a topic...",
    comment: "Your Comment",
    commentPlaceholder: "Write your thoughts here...",
    send: "Send",
    sending: "Sending...",
    success: "Your feedback has been sent, thank you!",
    error: "Sending failed, please try again.",
  },
};

interface Props {
  lang: "tr" | "en";
  open: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ lang, open, onClose }: Props) {
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const t = L[lang];
  const cats = CATEGORIES[lang];

  const handleSend = async () => {
    if (!category || !comment.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, comment }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setTimeout(() => {
        setStatus("idle");
        setCategory("");
        setComment("");
        onClose();
      }, 1800);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => status !== "sending" && onClose()}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-surface-container-low border border-outline-variant rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-on-surface">{t.title}</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">{t.subtitle}</p>
                </div>
                {status !== "sending" && (
                  <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
                    <MIcon name="close" className="text-lg" />
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">{t.category}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={status === "sending"}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                >
                  <option value="">{t.selectCategory}</option>
                  {cats.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">{t.comment}</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t.commentPlaceholder}
                  rows={4}
                  disabled={status === "sending"}
                  className="w-full bg-surface-container-lowest rounded-xl px-4 py-3 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              {status === "success" && <p className="text-emerald-400 text-sm">{t.success}</p>}
              {status === "error" && <p className="text-error text-sm">{t.error}</p>}

              <div className="flex justify-end">
                <button
                  onClick={handleSend}
                  disabled={status === "sending" || !category || !comment.trim()}
                  className="flex items-center gap-2 bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                >
                  {status === "sending" ? (
                    <><div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />{t.sending}</>
                  ) : (
                    <><MIcon name="send" className="text-base" />{t.send}</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
