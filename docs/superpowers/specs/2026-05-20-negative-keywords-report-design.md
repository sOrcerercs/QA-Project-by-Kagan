# Negative Keywords Report — Design Spec

## Goal

ADMIN ve MANAGER kullanıcılarının belirledikleri negatif kelimelerin tüm çağrı transcript'lerinde ne sıklıkta geçtiğini görebileceği, tarih aralığına göre filtrelenebilen bir rapor sistemi. Keyword yönetimi (ekle/sil) ve rapor görüntüleme aynı ekranda yaşar.

## Architecture

- **Veri:** Yeni `NegativeKeyword` Prisma modeli (PostgreSQL). Her keyword DB'de ayrı satır olarak tutulur.
- **Tarama:** Sunucu tarafında Prisma `contains` + `mode: 'insensitive'` (PostgreSQL `ILIKE '%word%'`). Transcript'ler hiçbir zaman client'a taşınmaz.
- **Snippet:** Her eşleşme için keyword'ün transcript'teki ilk konumuna göre ±80 karakter alıntı döndürülür.
- **Yetki:** Tüm endpoint'ler ve UI bileşeni ADMIN + MANAGER'a özel. Diğer roller hiçbir şekilde erişemez.

## Tech Stack

Next.js 15 App Router, TypeScript, Prisma (PostgreSQL), Tailwind CSS, mevcut `DateRangePicker` component.

---

## Data Model

```prisma
model NegativeKeyword {
  id          String   @id @default(cuid())
  word        String   @unique        // trim + lowercase kaydedilir
  createdById String                  // hangi kullanıcı ekledi
  createdAt   DateTime @default(now())
}
```

Migration: `prisma/migrations/20260520000000_add_negative_keywords/`

---

## API Routes

### GET `/api/negative-keywords`
- **Yetki:** ADMIN | MANAGER
- **Response:** `{ keywords: [{ id, word, createdAt }] }`

### POST `/api/negative-keywords`
- **Yetki:** ADMIN | MANAGER
- **Body:** `{ word: string }`
- **Validasyon:** boş olamaz, trim + lowercase kaydedilir, `@unique` ile duplicate önlenir
- **Response:** `{ keyword: { id, word, createdAt } }`
- **Hata:** 409 duplicate, 400 boş

### DELETE `/api/negative-keywords/[id]`
- **Yetki:** ADMIN | MANAGER
- **Response:** `{ success: true }`

### GET `/api/reports/negative-keywords`
- **Yetki:** ADMIN | MANAGER
- **Query params:** `startDate` (ISO), `endDate` (ISO) — ikisi de opsiyonel
- **Davranış:**
  1. Tüm aktif keyword'leri çek
  2. Tarih aralığıyla filtrelenmiş `Evaluation`'ları çek (`callDate` üzerinden)
  3. Her keyword için `transcript ILIKE '%word%'` olan evaluation'ları filtrele
  4. Her eşleşme için snippet üret (±80 karakter)
  5. Sonucu keyword bazında grupla
- **Response:**
```typescript
{
  results: Array<{
    keywordId: string
    word: string
    callCount: number          // kaç farklı çağrıda geçti
    totalHits: number          // toplam geçiş sayısı (bir çağrıda birden fazla olabilir)
    agentNames: string[]       // unique danışman adları
    matches: Array<{
      evaluationId: string
      agentName: string
      callDate: string         // ISO
      snippet: string          // ±80 karakter, keyword dahil
    }>
  }>
  totalEvaluationsScanned: number
  dateRange: { start: string | null; end: string | null }
}
```

---

## UI

### Sidebar Değişikliği (LandingPage.tsx)

"Reports" sidebar girişi genişleyebilir bir gruba dönüşür. Sadece ADMIN ve MANAGER görür.

```
▼ Raporlar           ← tıklanınca açılır/kapanır (chevron animasyonu)
    Raporlarım       ← mevcut "reports" tab
    Negatif Kelimeler ← yeni "negKeywords" tab
```

- Grup içindeki herhangi bir sekme aktifken grup açık kalır
- Animasyon: CSS `max-height` transition ile kayarak açılır/kapanır
- AGENT ve TEAM_LEADER için "Reports" grubunun davranışı değişmez (doğrudan "reports" tabına yönlendirir)

### Yeni Component: `NegativeKeywordsReport.tsx`

`app/components/shared/NegativeKeywordsReport.tsx` — tek dosya, üç bölüm:

**Bölüm 1 — Keyword Yönetimi (kart)**
- Kayıtlı keyword'ler chip/badge olarak listelenir, her birinde `×` (sil) butonu
- Altta: text input + "Ekle" butonu
- Ekleme: trim + lowercase, hemen listeye eklenir (optimistic) + POST
- Silme: confirm olmadan direkt DELETE
- Boş liste durumu: "Henüz keyword eklenmedi." mesajı

**Bölüm 2 — Filtre (kart)**
- Mevcut `DateRangePicker` component'i kullanılır
- "Raporu Çalıştır" butonu — keyword listesi boşsa disabled
- Loading state: buton spinner'a dönüşür

**Bölüm 3 — Sonuçlar (kart, rapor çalıştırıldıktan sonra görünür)**

*Özet tablo:*
| Keyword | Çağrı Sayısı | Toplam Geçiş | Danışmanlar |
|---|---|---|---|
| aptal | 3 | 5 | Ali Veli, Ayşe Kaya |

- Her satıra tıklanınca `<tr>` altında expand bölümü açılır
- Expand bölümü: eşleşen çağrıların listesi
  - Her satır: danışman adı | tarih | snippet (keyword **bold** olarak highlight)
  - Snippet'te keyword `<mark>` veya bold span ile vurgulanır

*Boş sonuç durumu:* "Seçilen tarih aralığında eşleşme bulunamadı."

---

## LandingPage Tab Routing

- Yeni tab key: `"negKeywords"`
- Görünürlük koşulu: `user.role === "ADMIN" || user.role === "MANAGER"`
- `activeTab === "negKeywords"` durumunda `<NegativeKeywordsReport lang={lang} />` render edilir
- Tab `initialTab` mantığı: URL'de `?tab=negKeywords` ile doğrudan açılabilir

---

## Sınırlar ve Kararlar

- **Keyword sayısı limiti yok** — pratik kullanımda zaten az olur
- **Tarih filtresi `callDate` üzerinden** — `createdAt` değil
- **Snippet algoritması:** `transcript.indexOf(word)` (case-insensitive için `toLowerCase()` üzerinden arama, orijinal transcript'ten alıntı). Bir çağrıda keyword birden fazla geçiyorsa ilk geçişin snippet'i döndürülür, `totalHits` ise tüm geçişleri sayar (regex `g` flag ile).
- **Performans:** Tarih aralığı olmadan çalıştırılabilir; binlerce transcript varsa yavaş olabilir — bu kabul edilebilir (rapor on-demand, cron değil).
- **Türkçe karakter:** PostgreSQL `ILIKE` Türkçe karakterleri büyük/küçük harf olarak doğru eşleştiremeyebilir (İ/i sorunu). Bu nedenle sunucuda ek olarak JavaScript `toLowerCase()` ile de kontrol yapılır; ikisi de eşleşirse hit sayılır.
