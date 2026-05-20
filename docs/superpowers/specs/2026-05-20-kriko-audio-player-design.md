# Kriko Audio Player Design

**Date:** 2026-05-20  
**Status:** Approved

## Problem

Kriko'dan import edilen çağrıların ses kaydı dinlenemiyor. Kriko, her deal için `https://call.kriko.com.tr/api/deals/{deal_id}/audio` endpoint'i üzerinden ses dosyası sunuyor. API key client'a asla gösterilmemeli.

## Goal

Değerlendirme detay sayfasında, Kriko'dan gelen çağrılar için inline ses oynatıcısı göster.

---

## Architecture

Üç değişiklik — sıfır schema migrasyonu:

| File | Change |
|------|--------|
| `app/api/calls/sync/route.ts` | `recordingUrl` alanını `deal_id` tabanlı URL ile doldur |
| `app/api/evaluations/[id]/audio/route.ts` | YENİ — backend proxy endpoint |
| `app/evaluation/[id]/page.tsx` | Ses oynatıcısı kartı ekle |

No schema changes — `recordingUrl String?` ve `source String` alanları zaten mevcut.

---

## Part 1: Import Sırasında URL Kaydet

**Dosya:** `app/api/calls/sync/route.ts` — `processCall` fonksiyonu, satır 143

### Mevcut (satır 143)
```typescript
recordingUrl: call.recording_url || null,
```

### Yeni
```typescript
recordingUrl: call.deal_id
  ? `${process.env.KRIKO_API_BASE}/api/deals/${call.deal_id}/audio`
  : (call.recording_url || null),
```

**Mantık:** `deal_id` varsa (neredeyse her zaman vardır) Kriko ses API URL'sini oluştur. Yoksa `recording_url`'e düş, o da yoksa `null`.

`KRIKO_API_BASE` zaten `.env.local`'de mevcut (örn. `https://call.kriko.com.tr`). Yeni env var eklenmez.

---

## Part 2: Backend Proxy — `GET /api/evaluations/[id]/audio`

**Dosya:** `app/api/evaluations/[id]/audio/route.ts` (yeni)

### Davranış

1. Auth kontrolü — giriş yapmış her kullanıcı (tüm roller)
2. DB'den `recordingUrl` ve `source` çek
3. `source !== "KRIKO"` veya `recordingUrl` null → 404
4. `KRIKO_API_KEY` env var kontrolü — yoksa 500
5. `recordingUrl`'e `X-API-Key` header ile istek at
6. Kriko'dan gelen `Range`, `Content-Type`, `Content-Length`, `Accept-Ranges` headerlarını forward et
7. Response body'yi stream et — büyük dosyalar için belleğe almadan

### Tam dosya

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

  const headers: HeadersInit = { "X-API-Key": apiKey };
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) headers["Range"] = rangeHeader;

  const upstream = await fetch(evaluation.recordingUrl, { headers });

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

---

## Part 3: Değerlendirme Sayfasında Ses Oynatıcısı

**Dosya:** `app/evaluation/[id]/page.tsx`

### Koşul

`evaluation.source === "KRIKO"` **ve** `evaluation.recordingUrl` dolu olduğunda göster.

`evaluation` objesi `GET /api/evaluations/[id]` endpoint'inden geliyor ve `include: { agent: {...} }` ile tüm alanları döndürüyor — `source` ve `recordingUrl` zaten mevcut.

### Yerleşim

Değerlendirme detay kartının (skor/rapor) hemen **üstüne**, mevcut header/danışman bilgisi bloğunun altına bir kart eklenir.

### UI

```
┌─────────────────────────────────────────────────┐
│ 🎙️  Çağrı Kaydı                                 │
│ ┌───────────────────────────────────────────┐   │
│ │  ▶  ──────────────────────────  0:00      │   │
│ └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

Standart HTML5 `<audio controls>` elementi:
- `src="/api/evaluations/{id}/audio"`
- `preload="none"` — sayfa yüklenince ses dosyasını çekmez
- `className="w-full"` — tam genişlik

### Örnek JSX (mevcut bileşen stiline uygun)

```tsx
{evaluation.source === "KRIKO" && evaluation.recordingUrl && (
  <div className="bg-surface-container rounded-3xl p-6 mb-6">
    <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2 mb-3">
      <MIcon name="mic" className="text-primary" />
      Çağrı Kaydı
    </h3>
    <audio
      controls
      preload="none"
      className="w-full"
      src={`/api/evaluations/${evaluation.id}/audio`}
    />
  </div>
)}
```

---

## Environment Variables

`KRIKO_API_KEY` ve `KRIKO_API_BASE` zaten `.env.local`'de mevcut — yeni env var eklenmez.

Vercel'de de mevcut olması gerekir (Kriko sync zaten çalışıyorsa oradadır).

---

## Error Handling

| Senaryo | Davranış |
|---------|---------|
| `deal_id` null olan Kriko çağrısı | `recordingUrl` null kalır, oynatıcı görünmez |
| Kriko 401 döner | Proxy 401 → tarayıcı ses yükleyemez (sayfa bozulmaz) |
| Kriko 404 döner | Proxy 404 → ses kontrolü disabled görünür |
| `KRIKO_API_KEY` env var eksik | 500 → ses kontrolü disabled görünür |
| Eski çağrılar (backfill yok) | `recordingUrl` null → oynatıcı görünmez |

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/calls/sync/route.ts` | `recordingUrl` satırını `deal_id` URL'i ile güncelle |
| `app/api/evaluations/[id]/audio/route.ts` | YENİ — Kriko ses proxy endpoint'i |
| `app/evaluation/[id]/page.tsx` | Ses oynatıcısı kartı ekle |
