# Fireflies Entegrasyonu — Tasarım Dokümanı

**Tarih:** 2026-05-07  
**Durum:** Onaylandı

---

## Genel Bakış

SDR Analyzer'a Fireflies.ai entegrasyonu eklenerek Google Meet ve WhatsApp aramalarının (Fireflies mikrofon özelliğiyle kaydedilen) otomatik olarak sisteme çekilmesi ve analiz edilmesi sağlanacak. Kriko entegrasyonu değişmeden korunacak; iki kaynak paralel çalışacak.

---

## Mimari

Mevcut Kriko akışıyla paralel, bağımsız bir Fireflies akışı kurulur:

```
[Vercel Cron - 02:00 UTC]
    → /api/cron/sync-fireflies
        → /api/calls/sync-fireflies  (runSync)
            → lib/fireflies.ts       (GraphQL API client)
            → /api/analyze           (mevcut AI analiz)
            → DB (Evaluation + SyncLog)
```

---

## Eklenecek Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `app/lib/fireflies.ts` | Fireflies GraphQL API client |
| `app/api/calls/sync-fireflies/route.ts` | Manuel tetikleme + durum endpoint'i |
| `app/api/cron/sync-fireflies/route.ts` | Vercel cron tetiklemeli otomatik sync |

---

## Fireflies API

- **Endpoint:** `https://api.fireflies.ai/graphql`
- **Auth:** `Authorization: Bearer <FIREFLIES_API_KEY>`
- **Sorgu:** `transcripts(date_from, date_to)` ile günlük transcript listesi

### GraphQL Sorgusu

```graphql
query Transcripts($from: String!, $to: String!) {
  transcripts(date_from: $from, date_to: $to) {
    id
    title
    date
    duration
    participants {
      displayName
      email
    }
    sentences {
      speaker_name
      text
    }
  }
}
```

### Transcript → Metin Dönüşümü

`sentences` dizisi düz metne çevrilir:

```
Ahmet Yılmaz: Merhaba, nasıl yardımcı olabilirim?
Müşteri: Bilgi almak istiyorum...
```

---

## Filtreleme

Kriko ile aynı kurallar:
- `duration >= 120 saniye`
- Transcript boş değil ve 50 karakterden uzun

---

## Agent Eşleşmesi

`participants[].displayName` değerleri sırayla DB'deki kullanıcılarla karşılaştırılır. Kriko'daki `matchAgent` mantığının aynısı:
1. NFD normalizasyon + küçük harf + trim
2. Tam eşleşme aranır
3. Yoksa ad+soyad kısmi eşleşme aranır
4. `participants` listesindeki ilk eşleşen kişi agent olarak atanır
5. Kimse eşleşmezse → "Atanmamış" kullanıcıya düşer, adminlere bildirim gönderilir

---

## Veritabanı

Schema değişikliği **gerekmez**. Mevcut alanlar yeterli:

| Alan | Değer |
|------|-------|
| `Evaluation.source` | `"FIREFLIES"` |
| `Evaluation.externalCallId` | `"ff_<fireflies_id>"` (çakışma önleme prefix) |
| `Evaluation.externalAgentName` | Fireflies'tan gelen ham participant displayName |
| `SyncLog.source` | `"FIREFLIES"` |

---

## Cron Zamanlaması

`vercel.json`'a eklenir:

```json
{ "path": "/api/cron/sync-fireflies", "schedule": "0 2 * * *" }
```

Her gece 02:00 UTC (05:00 TR saati). Kriko cron'uyla çakışmaz.

---

## Rate Limiting

- Çağrılar arasında 3 saniye bekleme (Groq rate limit koruması)
- 429 / 500 rate limit hatalarında exponential backoff: 5s → 10s → 20s (max 3 deneme)

---

## Ortam Değişkenleri

`.env.local`'a eklenir:

```
FIREFLIES_API_KEY=<api_key>
```

---

## Kapsam Dışı

- Fireflies webhook entegrasyonu (gerçek zamanlı) — cron yeterli
- Fireflies'a özgü yeni UI bileşenleri — mevcut sync paneli `source` alanını zaten gösteriyor
- Kriko'ya herhangi bir dokunuş
