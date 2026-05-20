# Kriko Audio Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an inline audio player on the evaluation detail page for Kriko calls, using a secure backend proxy that keeps the API key server-side.

**Architecture:** At Kriko import time, store the deal-based audio URL in the existing `recordingUrl` field. A new proxy endpoint fetches the audio from Kriko with the server-side API key and streams it to the client. The evaluation page renders an HTML5 `<audio>` element pointing to the proxy when `source === "KRIKO"` and `recordingUrl` is set.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma (existing `recordingUrl String?` and `source String` fields — no migration needed).

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/calls/sync/route.ts` | Line 143: populate `recordingUrl` with deal-based audio URL |
| `app/api/evaluations/[id]/audio/route.ts` | NEW — Kriko audio proxy endpoint |
| `app/evaluation/[id]/page.tsx` | Add audio player card between meta chips and score row |

---

## Task 1: Store deal-based audio URL during Kriko sync

**Files:**
- Modify: `app/api/calls/sync/route.ts:143`

### Context

`processCall()` creates an Evaluation via `prisma.evaluation.create`. The current line 143:
```typescript
recordingUrl: call.recording_url || null,
```
`KrikoCall` has `deal_id: string | null` and `recording_url?: string`. `KRIKO_API_BASE` is already in `.env.local` (e.g. `https://call.kriko.com.tr`). No new env vars needed.

- [ ] **Step 1: Edit line 143 of `app/api/calls/sync/route.ts`**

Find this exact block (around line 130–147):

```typescript
  await prisma.evaluation.create({
    data: {
      agentId,
      customerName: call.customer_name || "Bilinmiyor",
      callDuration: formatDuration(call.duration_seconds),
      transcript,
      report,
      score,
      callType: callType as any,
      promptId,
      callDate: new Date(call.call_date),
      externalCallId: call.id,
      externalAgentName: call.agent_name,
      recordingUrl: call.recording_url || null,
      unassigned: isUnassigned,
      source: "KRIKO",
    },
  });
```

Replace only the `recordingUrl` line:

```typescript
      recordingUrl: call.deal_id
        ? `${process.env.KRIKO_API_BASE}/api/deals/${call.deal_id}/audio`
        : (call.recording_url || null),
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -10
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add app/api/calls/sync/route.ts
git commit -m "feat: store deal-based audio URL in recordingUrl during Kriko sync"
```

---

## Task 2: Create audio proxy endpoint

**Files:**
- Create: `app/api/evaluations/[id]/audio/route.ts`

### Context

The proxy reads `recordingUrl` and `source` from DB, then fetches the audio file from Kriko using `KRIKO_API_KEY` (already in env). It forwards `Range` headers so the browser audio player can seek. All authenticated users can access (no role restriction — evaluation access is already controlled at the page level).

- [ ] **Step 1: Create the directory and file**

Create `app/api/evaluations/[id]/audio/route.ts` with this exact content:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { id } = await params;

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: { recordingUrl: true, source: true },
  });

  if (!evaluation || evaluation.source !== "KRIKO" || !evaluation.recordingUrl) {
    return NextResponse.json({ error: "Ses kaydı bulunamadı." }, { status: 404 });
  }

  const apiKey = process.env.KRIKO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const upstreamHeaders: HeadersInit = { "X-API-Key": apiKey };
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

  let upstream: Response;
  try {
    upstream = await fetch(evaluation.recordingUrl, { headers: upstreamHeaders });
  } catch {
    return NextResponse.json({ error: "Ses dosyası alınamadı." }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Ses dosyası alınamadı." }, { status: upstream.status });
  }

  const responseHeaders = new Headers();
  for (const key of ["content-type", "content-length", "accept-ranges", "content-range"]) {
    const val = upstream.headers.get(key);
    if (val) responseHeaders.set(key, val);
  }
  if (!responseHeaders.get("content-type")) {
    responseHeaders.set("content-type", "audio/mpeg");
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/evaluations/[id]/audio/route.ts
git commit -m "feat: add Kriko audio proxy endpoint"
```

---

## Task 3: Add audio player to evaluation detail page

**Files:**
- Modify: `app/evaluation/[id]/page.tsx`

### Context

The evaluation page is at `app/evaluation/[id]/page.tsx`. It renders a fixed-height layout with:
1. **Header bar** (top, fixed)
2. **Meta chips row** (5 info cards: consultant, team, customer, duration, date) — wrapped in `<div className="px-6 pt-5 flex-shrink-0">`
3. **Score + buttons row** (`<div className="flex items-center justify-between mb-4">`)
4. **Two-column grid** (report left, transcript right)

The audio player card goes between the meta chips row closing `</div>` and the score row `<div>`.

The evaluation object from `GET /api/evaluations/[id]` already includes `source` and `recordingUrl` (the endpoint uses `include: { agent: {...} }` without a select, so all fields are returned).

The `MIcon` component is already defined inline in this file:
```tsx
const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);
```

- [ ] **Step 1: Find the exact insertion point**

In `app/evaluation/[id]/page.tsx`, find this exact line (the closing div of the meta chips grid):

```tsx
        </div>

        <div className="flex items-center justify-between mb-4">
```

- [ ] **Step 2: Insert the audio player card between meta chips and score row**

Replace:

```tsx
        </div>

        <div className="flex items-center justify-between mb-4">
```

With:

```tsx
        </div>

        {evaluation.source === "KRIKO" && evaluation.recordingUrl && (
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 mb-4">
            <div className="text-[10px] text-on-surface-variant font-bold uppercase flex items-center gap-1.5 mb-3">
              <MIcon name="mic" className="text-primary" style={{ fontSize: 14 }} />
              Çağrı Kaydı
            </div>
            <audio
              controls
              preload="none"
              className="w-full"
              src={`/api/evaluations/${evaluation.id}/audio`}
            />
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/evaluation/[id]/page.tsx
git commit -m "feat: add Kriko audio player to evaluation detail page"
```
