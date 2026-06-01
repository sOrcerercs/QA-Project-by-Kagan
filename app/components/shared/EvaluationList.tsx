"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Trash2 } from "lucide-react";
import MIcon from "@/app/components/shared/MIcon";
import styles from "./EvaluationList.module.css";

const scoreColor = (score: number) =>
  score >= 85 ? "#34d399" :
  score >= 70 ? "var(--accent)" :
  score >= 55 ? "#f59e0b" : "#f87171";

interface Evaluation {
  id: string;
  score: number;
  customerName: string;
  callDuration: string;
  callDate: string;
  createdAt: string;
  agent?: { name: string };
}

interface EvaluationListProps {
  evaluations: Evaluation[];
  showAgent?: boolean;
  detailLabel?: string;
  emptyMessage?: string;
  lang?: "tr" | "en";
  isAdmin?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onDeleteOne?: (id: string) => void;
}

export default function EvaluationList({
  evaluations,
  showAgent = true,
  detailLabel,
  emptyMessage,
  lang = "tr",
  isAdmin = false,
  selectedIds,
  onToggleSelect,
  onDeleteOne,
}: EvaluationListProps) {
  const resolvedDetailLabel = detailLabel ?? (lang === "en" ? "Detail" : "Detay");
  const resolvedEmptyMessage = emptyMessage ?? (lang === "en" ? "No evaluations yet." : "Henüz değerlendirme yok.");
  if (evaluations.length === 0) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center" }}>
        <MIcon name="call" className="text-6xl opacity-10 block mx-auto mb-4" />
        <p style={{ color: "var(--fg-dim)", fontSize: 13 }}>{resolvedEmptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {evaluations.map((ev, i) => (
        <motion.div
          key={ev.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className={styles.row}
        >
          {isAdmin && (
            <input
              type="checkbox"
              checked={selectedIds?.has(ev.id) ?? false}
              onChange={() => onToggleSelect?.(ev.id)}
              style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0, accentColor: "var(--accent)" }}
            />
          )}

          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: "rgba(var(--accent-rgb, 59,130,246),.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent)",
          }}>
            <MIcon name="description" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {showAgent && (
              <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: 13, lineHeight: 1.3 }}>
                {ev.agent?.name ?? "—"}
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: showAgent ? 2 : 0 }}>
              {ev.customerName} · {ev.callDuration}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                {lang === "tr" ? "Değerlendirme Tarihi" : "Evaluation Date"}:{" "}
                {new Date(ev.callDate).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")}
              </span>
              <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                {lang === "tr" ? "Kayıt" : "Record"}:{" "}
                {new Date(ev.createdAt).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")}
              </span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: scoreColor(ev.score) }}>
              %{ev.score}
            </span>
            {isAdmin && (
              <button
                onClick={() => onDeleteOne?.(ev.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--fg-dim)",
                  display: "flex",
                  alignItems: "center",
                  padding: 4,
                  borderRadius: 6,
                }}
                title="Sil"
              >
                <Trash2 size={13} />
              </button>
            )}
            <Link
              href={`/evaluation/${ev.id}`}
              style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--fg-dim)", textDecoration: "none" }}
            >
              {resolvedDetailLabel} <ArrowUpRight size={12} />
            </Link>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
