# Evaluation Detail Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the evaluation detail page with a split report/transcript layout and an AI-assisted re-evaluation panel accessible to ADMIN and MANAGER roles.

**Architecture:** Two changes — a new `POST /api/evaluations/[id]/refine` endpoint that calls Groq with admin feedback and updates the evaluation in DB, and a full rewrite of `app/evaluation/[id]/page.tsx` to render the split layout, fetch current user role, and show the Framer Motion feedback panel.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Framer Motion (`motion/react`), Groq API via raw fetch, Prisma, Lucide React

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/api/evaluations/[id]/refine/route.ts` | Create | POST handler: auth check → fetch evaluation + prompt → call Groq with feedback → update DB → return new report + score |
| `app/evaluation/[id]/page.tsx` | Rewrite | Split layout, transcript panel, current-user fetch, Framer Motion feedback panel |

---

## Task 1: Create the refine API endpoint

**Files:**
- Create: `app/api/evaluations/[id]/refine/route.ts`

- [ ] **Step 1: Create the file with auth guard**

Create `app/api/evaluations/[id]/refine/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const feedback: string = body.feedback ?? "";

  if (!feedback.trim()) {
    return NextResponse.json({ error: "Feedback boş olamaz." }, { status: 400 });
  }

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: { agent: { select: { name: true } } },
  });
  if (!evaluation) {
    return NextResponse.json({ error: "Değerlendirme bulunamadı." }, { status: 404 });
  }

  if (!evaluation.promptId) {
    return NextResponse.json(
      { error: "Bu değerlendirme için prompt bulunamadı." },
      { status: 400 }
    );
  }

  const prompt = await prisma.prompt.findUnique({ where: { id: evaluation.promptId } });
  if (!prompt) {
    return NextResponse.json({ error: "Prompt bulunamadı." }, { status: 404 });
  }

  const fullPrompt = `${prompt.content}

=== DEĞERLENDİRİLECEK GÖRÜŞME BİLGİLERİ ===
Temsilci Adı: ${evaluation.agent?.name ?? "Belirtilmedi"}
Müşteri Adı: ${evaluation.customerName}
Görüşme Süresi: ${evaluation.callDuration}

=== TRANSKRİPT ===
${evaluation.transcript}

=== YÖNETİCİ NOTU ===
${feedback}
Bu notu dikkate alarak değerlendirmeyi yeniden yap ve ZORUNLU ÇIKTI FORMATINDA Türkçe rapor üret.`;

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  });

  if (!groqResponse.ok) {
    const errText = await groqResponse.text();
    return NextResponse.json({ error: "Groq API hatası: " + errText }, { status: 500 });
  }

  const groqData = await groqResponse.json();
  const reportText: string = groqData.choices[0].message.content;

  const scoreMatch = reportText.match(/Genel Skor:\s*%?\s*(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : evaluation.score;

  const updated = await prisma.evaluation.update({
    where: { id },
    data: { report: reportText, score },
  });

  return NextResponse.json({ report: updated.report, score: updated.score });
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit
```

Expected: no errors related to `refine/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/evaluations/[id]/refine/route.ts
git commit -m "feat: add POST /api/evaluations/[id]/refine for AI-assisted re-evaluation"
```

---

## Task 2: Rewrite the evaluation detail page

**Files:**
- Modify: `app/evaluation/[id]/page.tsx`

- [ ] **Step 1: Replace the entire file**

Overwrite `app/evaluation/[id]/page.tsx` with:

```tsx
"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, User, Clock, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState("");

  useEffect(() => {
    fetchEvaluation();
    fetchCurrentUser();
  }, [id]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok) setCurrentUser(data.user);
    } catch {}
  };

  const fetchEvaluation = async () => {
    try {
      const res = await fetch(`/api/evaluations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Değerlendirme bulunamadı.");
      setEvaluation(data.evaluation);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!evaluation) return;
    navigator.clipboard.writeText(evaluation.report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefine = async () => {
    if (!feedback.trim()) return;
    setIsRefining(true);
    setRefineError("");
    try {
      const res = await fetch(`/api/evaluations/${id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yeniden değerlendirme başarısız.");
      setEvaluation((prev: any) => ({
        ...prev,
        report: data.report,
        score: data.score,
      }));
      setFeedback("");
      setFeedbackOpen(false);
    } catch (err: any) {
      setRefineError(err.message);
    } finally {
      setIsRefining(false);
    }
  };

  const canEdit =
    currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

  const scoreColor = (score: number) =>
    score >= 85
      ? "text-emerald-400"
      : score >= 70
      ? "text-blue-400"
      : score >= 55
      ? "text-amber-400"
      : "text-red-400";

  const formatReport = (text: string) =>
    text.split("\n").map((line, i) => {
      if (
        line.startsWith("📊") ||
        line.startsWith("📝") ||
        line.startsWith("💰") ||
        line.startsWith("💭") ||
        line.startsWith("🛑") ||
        line.startsWith("🚨") ||
        line.startsWith("📈") ||
        line.startsWith("🔍") ||
        line.startsWith("💡") ||
        line.startsWith("🎯") ||
        line.startsWith("✅")
      ) {
        return (
          <div
            key={i}
            className="mt-6 mb-2 text-blue-400 font-bold text-base border-b border-zinc-800 pb-2"
          >
            {line}
          </div>
        );
      }
      if (
        line.startsWith("Temsilci:") ||
        line.startsWith("Müşteri:") ||
        line.startsWith("Görüşme") ||
        line.startsWith("Genel Skor:")
      ) {
        return (
          <div key={i} className="text-zinc-300 text-sm font-medium py-0.5">
            {line}
          </div>
        );
      }
      if (line.startsWith("•") || line.startsWith("-")) {
        return (
          <div key={i} className="text-zinc-300 text-sm py-1 pl-2">
            {line}
          </div>
        );
      }
      if (line.includes("Kanıt:")) {
        return (
          <div key={i} className="text-emerald-400 text-xs py-0.5 pl-6 font-mono">
            {line}
          </div>
        );
      }
      if (line.includes("Olması Gereken:")) {
        return (
          <div key={i} className="text-amber-400 text-xs py-0.5 pl-6">
            {line}
          </div>
        );
      }
      if (line.trim() === "") return <div key={i} className="h-1" />;
      return (
        <div key={i} className="text-zinc-400 text-sm py-0.5">
          {line}
        </div>
      );
    });

  const formatTranscript = (text: string) =>
    text.split("\n").map((line, i) => {
      const timeMatch = line.match(/^(\[\d{2}:\d{2}\])\s*(.*)/);
      if (timeMatch) {
        const [, time, rest] = timeMatch;
        const isSdr = rest.trimStart().startsWith("SDR:");
        return (
          <div key={i} className="py-0.5">
            <span className="text-zinc-600 font-mono text-[11px]">{time} </span>
            <span className={isSdr ? "text-blue-400 text-xs" : "text-emerald-400 text-xs"}>
              {rest}
            </span>
          </div>
        );
      }
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return (
        <div key={i} className="text-zinc-500 text-xs py-0.5">
          {line}
        </div>
      );
    });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || "Değerlendirme bulunamadı."}</p>
        <Link href="/" className="text-blue-400 hover:underline text-sm">
          ← Dashboard&apos;a Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-black text-white h-screen flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex-shrink-0 z-10">
        <div className="flex justify-between items-center">
          <Link
            href="/"
            className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <h1 className="text-lg font-bold tracking-tight">Değerlendirme Detayı</h1>
          <div className="w-24" />
        </div>
      </header>

      {/* Meta + Score */}
      <div className="px-6 pt-5 flex-shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 mb-2">
              <User className="w-3 h-3" /> Danışman
            </div>
            <p className="text-sm font-semibold text-white">
              {evaluation.agent?.name || "Bilinmiyor"}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 mb-2">
              <User className="w-3 h-3" /> Müşteri
            </div>
            <p className="text-sm font-semibold text-white">{evaluation.customerName}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 mb-2">
              <Clock className="w-3 h-3" /> Süre
            </div>
            <p className="text-sm font-semibold text-white">{evaluation.callDuration}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 mb-2">
              <Calendar className="w-3 h-3" /> Tarih
            </div>
            <p className="text-sm font-semibold text-white">
              {new Date(evaluation.createdAt).toLocaleDateString("tr-TR")}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className={`text-4xl font-black ${scoreColor(evaluation.score)}`}>
              %{evaluation.score}
            </span>
            {evaluation.callType && (
              <span className="px-3 py-1 rounded-lg text-xs font-bold border border-blue-500/20 bg-blue-500/10 text-blue-400">
                {evaluation.callType.replace("_", " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-sm transition-all border border-zinc-700"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Kopyalandı!" : "Raporu Kopyala"}
            </button>
            {canEdit && (
              <button
                onClick={() => setFeedbackOpen(true)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-blue-500/50 text-zinc-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-all"
              >
                ✏️ Düzenle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Split Content */}
      <div className="flex-1 min-h-0 px-6 pb-6 grid grid-cols-2 gap-4">
        {/* Left: Report */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-y-auto p-6 leading-relaxed">
          {formatReport(evaluation.report)}
        </div>

        {/* Right: Transcript */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-y-auto p-6">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">
            💬 Konuşma Transkripti
          </div>
          {evaluation.transcript ? (
            <div className="leading-relaxed">
              {formatTranscript(evaluation.transcript)}
            </div>
          ) : (
            <p className="text-zinc-600 italic text-sm">Transkript bulunamadı.</p>
          )}
        </div>
      </div>

      {/* Feedback Panel */}
      <AnimatePresence>
        {feedbackOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isRefining && setFeedbackOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-700 px-6 py-5 z-50"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-bold text-white">
                    ✏️ Değerlendirmeyi Yeniden Düzenle
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    AI&apos;ya düzeltme talimatı ver — değerlendirme buna göre yeniden üretilecek
                  </div>
                </div>
                {!isRefining && (
                  <button
                    onClick={() => setFeedbackOpen(false)}
                    className="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
                  >
                    ✕
                  </button>
                )}
              </div>
              {refineError && (
                <p className="text-red-400 text-xs mb-3">{refineError}</p>
              )}
              <div className="flex gap-3 items-end">
                <textarea
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white resize-none outline-none focus:border-blue-500 placeholder:text-zinc-600 min-h-[52px] max-h-[120px] transition-colors"
                  placeholder="Örn: Danışman, şirketin adını doğru bir şekilde söylemiştir, pozitif değerlendirebilirsin."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={2}
                  disabled={isRefining}
                />
                <button
                  onClick={handleRefine}
                  disabled={isRefining || !feedback.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-semibold text-sm h-[52px] flex items-center gap-2 whitespace-nowrap transition-colors"
                >
                  {isRefining ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Değerlendiriliyor...
                    </>
                  ) : (
                    "🔄 Yeniden Değerlendir"
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit
```

Expected: no errors. If Tailwind v4 gives CSS-related type noise, that's expected and not a blocker.

- [ ] **Step 3: Start dev server and manual test**

```bash
cd /Users/sorcerer/sdr-analyzer && npm run dev
```

Open `http://localhost:3000`, log in, navigate to an existing evaluation. Verify:

1. Page shows split layout (report left, transcript right), both independently scrollable
2. Score, meta cards, copy button work as before
3. Log in as ADMIN or MANAGER → "Düzenle" button is visible
4. Log in as AGENT → "Düzenle" button is NOT visible
5. Click "Düzenle" → panel slides up from bottom with backdrop
6. Click backdrop or ✕ → panel closes
7. Type feedback → "Yeniden Değerlendir" button activates
8. Submit → spinner shows, report + score update in-place, panel closes

- [ ] **Step 4: Commit**

```bash
git add app/evaluation/[id]/page.tsx
git commit -m "feat: split layout with transcript panel and AI feedback re-evaluation"
```
