"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  customerName: string;
  callType: string;
  score: number;
  callDate: string;
  createdAt: string;
  agent: { name: string } | null;
}

interface SearchViewProps {
  lang: "tr" | "en";
}

const CALL_TYPE_LABELS: Record<string, Record<"tr" | "en", string>> = {
  FIRST_CALL:  { tr: "1. Çağrı",   en: "1st Call" },
  SECOND_CALL: { tr: "2. Çağrı",   en: "2nd Call" },
  FOLLOW_UP:   { tr: "Takip",      en: "Follow-up" },
  GENERAL:     { tr: "Genel",      en: "General" },
};

export default function SearchView({ lang }: SearchViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [searched, setSearched] = useState(false);

  const tr = lang === "tr";

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setStatus("loading");
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.results ?? []);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const scoreColor = (s: number) =>
    s >= 75 ? "#34d399" : s >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tr
            ? "Müşteri adı, danışman adı veya transkript içeriği..."
            : "Customer name, consultant name or transcript content..."}
          style={{
            flex: 1,
            background: "rgba(255,255,255,.06)",
            border: "1px solid var(--rule)",
            borderRadius: 10,
            padding: "10px 14px",
            color: "var(--fg)",
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
          autoFocus
        />
        <button
          onClick={handleSearch}
          disabled={query.trim().length < 2 || status === "loading"}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 13,
            fontFamily: "inherit",
            cursor: query.trim().length < 2 ? "not-allowed" : "pointer",
            opacity: query.trim().length < 2 ? 0.5 : 1,
            transition: "opacity 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {status === "loading"
            ? (tr ? "Aranıyor..." : "Searching...")
            : (tr ? "Ara" : "Search")}
        </button>
      </div>

      {/* Hint */}
      {!searched && query.trim().length > 0 && query.trim().length < 2 && (
        <p style={{ fontSize: 12, color: "var(--fg-faint)" }}>
          {tr ? "En az 2 karakter girin." : "Enter at least 2 characters."}
        </p>
      )}

      {/* Loading */}
      {status === "loading" && (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <div style={{
            width: 20, height: 20,
            border: "2px solid rgba(255,255,255,.15)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }} />
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <p style={{ fontSize: 13, color: "#f87171" }}>
          {tr ? "Arama başarısız. Lütfen tekrar deneyin." : "Search failed. Please try again."}
        </p>
      )}

      {/* No results */}
      {status === "done" && results.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>
          {tr ? "Sonuç bulunamadı." : "No results found."}
        </p>
      )}

      {/* Results */}
      {status === "done" && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 11.5, color: "var(--fg-faint)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>
            {results.length}{tr ? " sonuç" : " results"}
          </p>
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => router.push(`/evaluation/${r.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                background: "rgba(255,255,255,.04)",
                border: "1px solid var(--rule)",
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.08)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.04)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--rule)";
              }}
            >
              {/* Left: name + meta */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.customerName}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>
                  {r.agent?.name ?? "—"}
                  {" · "}
                  {CALL_TYPE_LABELS[r.callType]?.[lang] ?? r.callType}
                  {" · "}
                  {new Date(r.createdAt).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>

              {/* Right: score */}
              <span style={{
                fontSize: 15,
                fontWeight: 600,
                color: scoreColor(r.score),
                fontFamily: "'JetBrains Mono', monospace",
                flexShrink: 0,
              }}>
                {r.score}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
