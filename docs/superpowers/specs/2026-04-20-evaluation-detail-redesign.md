# Evaluation Detail Redesign — Spec

**Date:** 2026-04-20  
**Status:** Approved

---

## Overview

Two features added to `/evaluation/[id]`:

1. **Split layout** — scrollable report on the left, transcript on the right, both always visible
2. **AI-assisted re-evaluation** — admin/manager types natural language feedback; system re-runs the evaluation with that feedback as additional context and updates the result in DB

---

## Page Layout

### Header (unchanged)
Sticky `bg-zinc-950 border-zinc-800`. Back link + "Değerlendirme Detayı" title.

### Meta Cards (unchanged)
4-column grid: Danışman, Müşteri, Süre, Tarih. Same `bg-zinc-900 border-zinc-800 rounded-2xl` cards.

### Score Row
- Left: large score (`text-4xl font-black` color-coded) + call type badge
- Right: "Raporu Kopyala" button (existing) + new **"Düzenle" button** (only rendered for ADMIN and MANAGER roles)

### Split Content Area
`grid grid-cols-2 gap-3` filling remaining viewport height (`flex-1 min-h-0`).

**Left panel — Report**  
`bg-zinc-950 border border-zinc-800 rounded-2xl overflow-y-auto p-6`  
Uses existing `formatReport()` logic unchanged.

**Right panel — Transcript**  
`bg-zinc-950 border border-zinc-800 rounded-2xl overflow-y-auto p-6`  
- Header: small uppercase label "💬 Konuşma Transkripti"  
- Content: `font-mono text-xs leading-relaxed`  
- Timestamp tokens `[HH:MM]` → `text-zinc-600`  
- Lines starting "SDR:" → `text-blue-400`  
- Other speaker lines → `text-emerald-400`  
- Falls back to plain `text-zinc-500` if transcript is empty/null

---

## Düzenle Feature (AI Re-evaluation)

### Trigger
"Düzenle" button visible only when `user.role === 'ADMIN' || user.role === 'MANAGER'`. User is fetched from `/api/auth/me` on page load (same pattern as other pages).

### Feedback Panel
Slides up from the bottom of the viewport (`fixed bottom-0`, Framer Motion `y` animation: 100% → 0).

Contents:
- Header: "✏️ Değerlendirmeyi Yeniden Düzenle" + hint text + close (✕) button
- Textarea: placeholder example feedback, `min-h-[52px] max-h-[120px]` auto-resize
- "Yeniden Değerlendir" submit button

### Submit Flow
1. Client POSTs to `POST /api/evaluations/[id]/refine` with `{ feedback: string }`
2. Button enters loading state (spinner)
3. On success: panel closes, page re-fetches evaluation (updated report + score rendered)
4. On error: error message shown inside the panel, button resets

---

## New API Endpoint

**`POST /api/evaluations/[id]/refine`**

Auth: ADMIN or MANAGER only (401 otherwise).

Steps:
1. Fetch evaluation by `id` from DB (include `promptId`)
2. Fetch the associated `Prompt` by `promptId` (use its `content`). If `promptId` is null, return 400 with "Bu değerlendirme için prompt bulunamadı."
3. Build Groq messages:
   ```
   system: prompt.content
   user:
     === TRANSKRİPT ===
     {evaluation.transcript}

     === YÖNETİCİ NOTU ===
     {feedback}
     Bu notu dikkate alarak değerlendirmeyi yeniden yap.
   ```
4. Call Groq (`llama-3.3-70b-versatile`, same pattern as `/api/analyze`)
5. Parse score: `const m = text.match(/Genel Skor:\s*%?\s*(\d+)/); const score = m ? parseInt(m[1], 10) : evaluation.score;` (falls back to existing score if not found)
6. `prisma.evaluation.update({ where: { id }, data: { report, score } })`
7. Return `{ report, score }`

---

## Auth Pattern

Page fetches `/api/auth/me` on mount. Stores `currentUser`. Conditionally renders "Düzenle" button:
```tsx
{(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
  <button onClick={() => setFeedbackOpen(true)}>✏️ Düzenle</button>
)}
```

---

## Files Changed

| File | Change |
|------|--------|
| `app/evaluation/[id]/page.tsx` | Full rewrite: split layout, transcript panel, feedback panel, auth fetch |
| `app/api/evaluations/[id]/refine/route.ts` | New file: POST handler |

---

## Out of Scope

- Manual field-by-field editing (not needed; AI feedback covers this more flexibly)
- Transcript editing (source data, read-only)
- Light mode adaptation (page stays dark-only, consistent with existing pages)
