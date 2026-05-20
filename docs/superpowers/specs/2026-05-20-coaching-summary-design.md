# Coaching Summary — Design Spec

## Goal

Her danışman için birikmiş değerlendirme verisini Gemini ile sentezleyip kısa bir gelişim özeti + somut aksiyon maddeleri üretmek. Özet DB'de önbelleklenir; yeni değerlendirme geldiğinde yenilenir.

## Görünürlük

| Rol | Ne görür |
|-----|----------|
| AGENT | Kendi özeti (ScoreView içinde) |
| TEAM_LEADER | Takım üyelerinin özeti (Takım Raporları + Agent Profile) |
| MANAGER | Tüm danışmanların özeti |
| ADMIN | Tüm danışmanların özeti |

---

## Veri Modeli

```prisma
model CoachingSummary {
  id          String    @id @default(cuid())
  agentId     String    @unique
  summary     String?                        // null = stale, yeniden üretilmeli
  actionItems Json?                          // string[] — 2-3 aksiyon maddesi
  generatedAt DateTime?
  evalCount   Int       @default(0)          // kaç eval baz alındı
  updatedAt   DateTime  @updatedAt
}
```

`summary: null` = bayat işareti. Yeni değerlendirme kaydedilince `/api/analyze` bu alanı null'a çeker.

---

## Veri Penceresi Mantığı

```
Son 10 günde danışmanın ≥ 10 değerlendirmesi var mı?
  → Evet: son 10 günün değerlendirmelerini kullan
  → Hayır: son 10 değerlendirmeyi kullan (tarihten bağımsız)
```

---

## API

### `GET /api/scores/coaching-summary`

**Query parametreleri:**
- `agentId` — zorunlu; AGENT kendi ID'sini gönderir, diğer roller herhangi bir ID gönderebilir
- `lang` — `"tr"` (varsayılan) veya `"en"`

**Yetkilendirme:**
- AGENT: yalnızca kendi `agentId`'si
- TEAM_LEADER / MANAGER / ADMIN: herhangi bir `agentId`

**Mantık:**
1. `CoachingSummary` kaydı yoksa veya `summary === null` ise → Gemini'ye gönder → kaydet → döndür
2. `summary` doluysa → direkt döndür (Gemini çağrısı yok)

**Yanıt:**
```json
{
  "summary": "Ali son değerlendirmelerde...",
  "actionItems": ["Köprü kurma tekniğini dene", "..."],
  "generatedAt": "2026-05-20T10:00:00.000Z",
  "evalCount": 10
}
```

### `POST /api/scores/coaching-summary/refresh`

- TEAM_LEADER / MANAGER / ADMIN için `summary`'yi null'a çeker
- Sonraki GET otomatik yeniler
- Body: `{ agentId: string }`

---

## Gemini Prompt

Gemini'ye gönderilen bağlam:
- `avgSectionScores`: A / B / C bölüm ortalamaları (0-100)
- `topWeakCriteria`: en sık tekrar eden 3 kriter — `{ label, avgScore, count, coachingNote }`
- `weeklyProgress`: son 4 haftanın skor trendi `[{ week, score, calls }]`
- `evalCount` ve tarih penceresi (son 10 gün veya son 10 eval)
- `lang`: `"tr"` veya `"en"`

İstenen çıktı formatı (JSON):
```json
{
  "summary": "3-4 cümle, akıcı değerlendirme paragrafı",
  "actionItems": [
    "Somut aksiyon 1",
    "Somut aksiyon 2",
    "Somut aksiyon 3"
  ]
}
```

Prompt talimatları:
- Eleştiriyi yapıcı tut, suçlayıcı olmayan bir dil kullan
- Her aksiyon maddesi ölçülebilir ve bu hafta uygulanabilir olsun
- Dil `lang` parametresine göre Türkçe veya İngilizce

---

## Cache Invalidation Akışı

```
/api/analyze → yeni Evaluation kaydedilir
       ↓
CoachingSummary upsert: { agentId, summary: null }
       ↓
Danışman/yönetici sayfayı açar
       ↓
GET /api/scores/coaching-summary → summary null?
  → Gemini çağrısı → JSON parse → DB'ye kaydet → döndür
  → Sonraki açılışta DB'den okur (Gemini yok)
```

---

## UI Bileşeni — `AgentCoachingSummary`

**Props:** `{ agentId: string; lang: "tr" | "en"; canRefresh: boolean }`

**Durumlar:**
- **Yükleniyor:** İskelet satırlar (loading skeleton)
- **Dolu:** Özet paragraf + "Bu hafta odaklan:" başlıklı aksiyon maddeleri + "N değerlendirme baz alındı · Tarih" alt metni
- **Hata:** "Özet oluşturulamadı" + retry butonu

**Yenile butonu:** `canRefresh === true` (TEAM_LEADER/MANAGER/ADMIN) olduğunda görünür. Refresh endpoint'ini çağırır, sonra GET'i tekrar atar.

**Yerleşim:**
1. `ScoreView` — mevcut skor kartlarının altına ek section olarak
2. Takım Raporları (`LandingPage` teamreports sekmesi) — danışman seçilince sağ panel / alt section
3. Agent Profile görünümü — sayfanın üst bölümünde ana içerik

---

## Dosya Haritası

| Dosya | İşlem |
|-------|-------|
| `prisma/schema.prisma` | `CoachingSummary` modeli eklenir |
| `prisma/migrations/20260520000001_add_coaching_summary/migration.sql` | Migration SQL |
| `app/api/scores/coaching-summary/route.ts` | GET endpoint |
| `app/api/scores/coaching-summary/refresh/route.ts` | POST refresh endpoint |
| `app/api/analyze/route.ts` | Yeni eval kaydedilince summary null'a çek |
| `app/components/shared/AgentCoachingSummary.tsx` | UI bileşeni |
| `app/components/shared/ScoreView.tsx` | `AgentCoachingSummary` entegrasyonu |
| `app/components/LandingPage.tsx` | Takım raporları entegrasyonu |
| `app/lib/prisma.ts` | SCHEMA_VERSION güncelle |
