# Fireflies Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fireflies.ai'dan Google Meet ve WhatsApp aramalarını günlük otomatik olarak çekip analiz ederek Evaluation olarak kaydetmek.

**Architecture:** Kriko akışının paraleli olarak bağımsız bir Fireflies akışı kurulur — `lib/fireflies.ts` GraphQL client, `/api/calls/sync-fireflies` manuel endpoint, `/api/cron/sync-fireflies` Vercel cron endpoint. Schema değişikliği gerekmez; `source: "FIREFLIES"` ve `externalCallId: "ff_<id>"` prefix mevcut alanları kullanır.

**Tech Stack:** Next.js 16, Prisma, Fireflies GraphQL API v2, TypeScript

---

## File Map

| Dosya | Durum | Sorumluluk |
|-------|-------|-----------|
| `app/lib/fireflies.ts` | Yeni | Fireflies GraphQL client, tipler, yardımcı fonksiyonlar |
| `app/api/calls/sync-fireflies/route.ts` | Yeni | Manuel sync POST + durum GET endpoint'i |
| `app/api/cron/sync-fireflies/route.ts` | Yeni | Vercel cron tetiklemeli otomatik sync |
| `vercel.json` | Güncelle | Fireflies cron schedule ekle |

---

## Task 1: Fireflies API Client

**Files:**
- Create: `app/lib/fireflies.ts`

- [ ] **Step 1: Dosyayı oluştur**

```typescript
// app/lib/fireflies.ts

export interface FirefliesSentence {
  speaker_name: string;
  text: string;
  start_time: number;
  end_time: number;
}

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;        // ISO datetime string
  duration: number;    // dakika cinsinden
  host_email: string | null;
  participants: string[];  // email adresleri
  sentences: FirefliesSentence[];
}

const FIREFLIES_ENDPOINT = "https://api.fireflies.ai/graphql";

const TRANSCRIPTS_QUERY = `
  query Transcripts($fromDate: String, $toDate: String) {
    transcripts(fromDate: $fromDate, toDate: $toDate) {
      id
      title
      date
      duration
      host_email
      participants
      sentences {
        speaker_name
        text
        start_time
        end_time
      }
    }
  }
`;

export function isFirefliesConfigured(): boolean {
  return !!process.env.FIREFLIES_API_KEY;
}

export async function fetchTranscriptsByDate(date: string): Promise<FirefliesTranscript[]> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) throw new Error("FIREFLIES_API_KEY eksik.");

  const res = await fetch(FIREFLIES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: TRANSCRIPTS_QUERY,
      variables: { fromDate: date, toDate: date },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Fireflies API hatası: ${res.status} ${res.statusText} — ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Fireflies GraphQL hatası: ${JSON.stringify(json.errors).slice(0, 200)}`);
  }

  return json.data.transcripts as FirefliesTranscript[];
}

export function filterAnalyzableTranscripts(
  transcripts: FirefliesTranscript[],
  minDurationMinutes = 2
): FirefliesTranscript[] {
  return transcripts.filter(t =>
    t.duration >= minDurationMinutes &&
    t.sentences.length > 0 &&
    buildTranscriptText(t.sentences).trim().length > 50
  );
}

export function buildTranscriptText(sentences: FirefliesSentence[]): string {
  return sentences.map(s => `${s.speaker_name}: ${s.text}`).join("\n");
}

export function extractSpeakerNames(sentences: FirefliesSentence[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const s of sentences) {
    if (s.speaker_name && !seen.has(s.speaker_name)) {
      seen.add(s.speaker_name);
      names.push(s.speaker_name);
    }
  }
  return names;
}

/** Dakika (float) → "MM:SS" */
export function formatFirefliesDuration(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 3: Commit**

```bash
git add app/lib/fireflies.ts
git commit -m "feat: add Fireflies GraphQL API client"
```

---

## Task 2: Manuel Sync Endpoint

**Files:**
- Create: `app/api/calls/sync-fireflies/route.ts`

- [ ] **Step 1: Dosyayı oluştur**

```typescript
// app/api/calls/sync-fireflies/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import {
  fetchTranscriptsByDate,
  filterAnalyzableTranscripts,
  buildTranscriptText,
  extractSpeakerNames,
  formatFirefliesDuration,
  isFirefliesConfigured,
  FirefliesTranscript,
} from "@/app/lib/fireflies";

const UNASSIGNED_EMAIL = "unassigned@estenove.local";
const UNASSIGNED_NAME = "Atanmamış";

async function getOrCreateUnassignedUser() {
  let user = await prisma.user.findUnique({ where: { email: UNASSIGNED_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: UNASSIGNED_NAME,
        email: UNASSIGNED_EMAIL,
        passwordHash: "DISABLED",
        role: "AGENT",
      },
    });
  }
  return user;
}

/** Transcript'teki konuşmacı adlarını DB kullanıcılarıyla eşleştir */
async function matchAgentFromSpeakers(speakerNames: string[]) {
  if (speakerNames.length === 0) return null;

  const candidates = await prisma.user.findMany({
    where: { role: { in: ["AGENT", "TEAM_LEADER", "MANAGER"] } },
    select: { id: true, name: true },
  });

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  for (const speakerName of speakerNames) {
    const norm = normalize(speakerName);
    if (!norm) continue;

    // Tam eşleşme
    for (const u of candidates) {
      if (normalize(u.name) === norm) return u;
    }

    // Kısmi eşleşme (ad + soyad)
    const parts = norm.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      for (const u of candidates) {
        const uNorm = normalize(u.name);
        if (uNorm.includes(parts[0]) && uNorm.includes(parts[1])) return u;
      }
    }
  }

  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function analyzeWithRetry(
  formData: FormData,
  baseUrl: string,
  maxRetries = 3
): Promise<{ ok: boolean; data?: any; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const r = await fetch(`${baseUrl}/api/analyze`, { method: "POST", body: formData });
      if (r.ok) return { ok: true, data: await r.json() };
      const errText = await r.text().catch(() => "");
      if (
        (r.status === 429 || (r.status === 500 && errText.includes("Rate limit"))) &&
        attempt < maxRetries - 1
      ) {
        await sleep(5000 * Math.pow(2, attempt));
        continue;
      }
      return { ok: false, error: `${r.status} ${errText.slice(0, 100)}` };
    } catch (e: any) {
      if (attempt < maxRetries - 1) { await sleep(3000); continue; }
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: "max_retries_exceeded" };
}

async function processTranscript(transcript: FirefliesTranscript, unassignedUserId: string) {
  const externalCallId = `ff_${transcript.id}`;

  // Mükerrer kontrolü
  const existing = await prisma.evaluation.findUnique({ where: { externalCallId } });
  if (existing) return { status: "skipped" as const, reason: "already_imported" };

  const speakerNames = extractSpeakerNames(transcript.sentences);
  const matched = await matchAgentFromSpeakers(speakerNames);
  const agentId = matched?.id ?? unassignedUserId;
  const isUnassigned = !matched;

  const transcriptText = buildTranscriptText(transcript.sentences);
  if (transcriptText.trim().length < 50) {
    return { status: "skipped" as const, reason: "no_transcript" };
  }

  const agentName = matched?.name || speakerNames[0] || "Belirtilmedi";
  const duration = formatFirefliesDuration(transcript.duration);

  const formData = new FormData();
  formData.append("transcript", transcriptText);
  formData.append("agentName", agentName);
  formData.append("customerName", "Belirtilmedi");
  formData.append("callDuration", duration);
  formData.append("callType", "AUTO");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const result = await analyzeWithRetry(formData, baseUrl);
  if (!result.ok) {
    return { status: "failed" as const, reason: `analyze_error: ${result.error}` };
  }

  const report = result.data.report || "";
  const score = result.data.score || 0;
  const callType = result.data.callType || "SECOND_CALL";
  const promptId = result.data.promptId || null;

  await prisma.evaluation.create({
    data: {
      agentId,
      customerName: "Belirtilmedi",
      callDuration: duration,
      transcript: transcriptText,
      report,
      score,
      callType: callType as any,
      promptId,
      callDate: new Date(transcript.date),
      externalCallId,
      externalAgentName: speakerNames[0] || null,
      unassigned: isUnassigned,
      source: "FIREFLIES",
    },
  });

  return {
    status: isUnassigned ? "unassigned" as const : "imported" as const,
    agentName,
  };
}

async function notifyAdminsOfUnassigned(count: number) {
  if (count === 0) return;
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] } },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: admins.map(a => ({
      userId: a.id,
      type: "UNASSIGNED_CALL",
      message: `Fireflies'tan ${count} çağrı çekildi ancak danışman eşleşmesi bulunamadı. Lütfen manuel atama yapın.`,
    })),
  });
}

/** POST: belirli bir tarihi senkronize et (default: bugün) */
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  return runSync(req, "MANUAL");
}

/** GET: son sync logları + atanmamış sayısı */
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const logs = await prisma.syncLog.findMany({
    where: { source: "FIREFLIES" },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  const unassignedCount = await prisma.evaluation.count({
    where: { unassigned: true, source: "FIREFLIES" },
  });

  return NextResponse.json({
    configured: isFirefliesConfigured(),
    logs,
    unassignedCount,
  });
}

/** Sync çekirdeği — hem POST hem cron tarafından çağrılır */
export async function runSync(req: NextRequest, trigger: "MANUAL" | "CRON") {
  let body: any = {};
  try { body = await req.json(); } catch {}

  // Bugünün tarihi (Turkey TZ: UTC+3)
  const now = new Date();
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const todayTR = tr.toISOString().slice(0, 10);
  const date = body.date || todayTR;

  if (!isFirefliesConfigured()) {
    return NextResponse.json(
      { error: "Fireflies API yapılandırılmamış (FIREFLIES_API_KEY eksik)." },
      { status: 500 }
    );
  }

  const log = await prisma.syncLog.create({
    data: { source: "FIREFLIES", date, trigger },
  });

  try {
    const transcripts = await fetchTranscriptsByDate(date);
    const analyzable = filterAnalyzableTranscripts(transcripts);
    const unassignedUser = await getOrCreateUnassignedUser();

    let imported = 0, skipped = 0, unassigned = 0, failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < analyzable.length; i++) {
      const result = await processTranscript(analyzable[i], unassignedUser.id);
      if (result.status === "imported") imported++;
      else if (result.status === "unassigned") { imported++; unassigned++; }
      else if (result.status === "skipped") skipped++;
      else { failed++; errors.push(`${analyzable[i].id}: ${result.reason}`); }
      if (i < analyzable.length - 1) await sleep(3000);
    }

    skipped += transcripts.length - analyzable.length;

    if (unassigned > 0) await notifyAdminsOfUnassigned(unassigned);

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        totalFetched: transcripts.length,
        imported,
        skipped,
        unassigned,
        failed,
        error: errors.length ? errors.slice(0, 5).join("; ") : null,
      },
    });

    return NextResponse.json({
      success: true,
      date,
      totalFetched: transcripts.length,
      analyzable: analyzable.length,
      imported,
      skipped,
      unassigned,
      failed,
      errors: errors.slice(0, 10),
    });
  } catch (e: any) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), error: e.message },
    });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 3: Dev server'da test et**

```bash
curl -X POST http://localhost:3000/api/calls/sync-fireflies \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin_session_cookie>" \
  -d '{"date": "2026-05-07"}'
```

Beklenen response (configured değilse):
```json
{"error": "Fireflies API yapılandırılmamış (FIREFLIES_API_KEY eksik)."}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/calls/sync-fireflies/route.ts
git commit -m "feat: add Fireflies manual sync endpoint"
```

---

## Task 3: Cron Endpoint

**Files:**
- Create: `app/api/cron/sync-fireflies/route.ts`

- [ ] **Step 1: Dosyayı oluştur**

```typescript
// app/api/cron/sync-fireflies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/app/api/calls/sync-fireflies/route";
import { isFirefliesConfigured } from "@/app/lib/fireflies";

/**
 * Vercel Cron tarafından çağrılır. CRON_SECRET ile korunur.
 * vercel.json schedule: "0 2 * * *" (her gece 02:00 UTC = 05:00 TR)
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  if (!isFirefliesConfigured()) {
    return NextResponse.json({ error: "Fireflies yapılandırılmamış." }, { status: 500 });
  }

  return runSync(req, "CRON");
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/sync-fireflies/route.ts
git commit -m "feat: add Fireflies cron endpoint"
```

---

## Task 4: vercel.json ve Ortam Değişkeni

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: vercel.json'a Fireflies cron ekle**

Mevcut `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-calls",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

Güncellenmiş hali:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-calls",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/sync-fireflies",
      "schedule": "0 2 * * *"
    }
  ]
}
```

- [ ] **Step 2: `.env.local`'a API key ekle**

`.env.local` dosyasına şu satırı ekle (değeri yöneticiden alınan gerçek key ile değiştir):

```
FIREFLIES_API_KEY=<buraya_api_key>
```

- [ ] **Step 3: Dev server'ı yeniden başlat ve uçtan uca test et**

Dev server'ı yeniden başlat (env değişkeni için):
```bash
# Önce kapat: lsof -ti :3000 | xargs kill -9
# Sonra başlat: npm run dev
```

Admin hesabıyla giriş yap ve sync'i tetikle:
```bash
curl -X POST http://localhost:3000/api/calls/sync-fireflies \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin_session_cookie>" \
  -d '{"date": "2026-05-07"}'
```

Beklenen başarılı response:
```json
{
  "success": true,
  "date": "2026-05-07",
  "totalFetched": 5,
  "analyzable": 3,
  "imported": 2,
  "skipped": 1,
  "unassigned": 0,
  "failed": 0,
  "errors": []
}
```

Sync logunu kontrol et:
```bash
curl http://localhost:3000/api/calls/sync-fireflies \
  -H "Cookie: <admin_session_cookie>"
```

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat: add Fireflies cron schedule to vercel.json"
```

---

## Notlar

- `FIREFLIES_API_KEY` Vercel ortamına da eklenmeli (Production > Environment Variables).
- Fireflies `participants` alanı email adresleri döner; agent eşleşmesi `sentences[].speaker_name` üzerinden yapılır.
- `duration` Fireflies'ta **dakika** cinsinden gelir (Kriko'da saniye), bu yüzden `filterAnalyzableTranscripts` 2 dakika (120 saniye) eşdeğeri olan `minDurationMinutes = 2` kullanır.
- Mevcut Kriko sync akışına dokunulmaz.
