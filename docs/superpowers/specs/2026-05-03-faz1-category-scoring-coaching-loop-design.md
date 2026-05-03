# Faz 1 — Kategori Bazlı Scoring & Coaching Loop
**Tarih:** 2026-05-03  
**Versiyon:** 1.0  
**Proje:** SDR Analyzer — ESTENOVE Saç Ekim Kliniği  
**Kapsam:** Faz 1 (Faz 2: Trend grafiği, Peer Comparison, Call Type Coverage)

---

## 1. Genel Bakış

Mevcut sistemde AI her değerlendirmeden yalnızca tek bir `score: Int` üretmektedir. Bu tasarım iki özelliği ekler:

1. **Kategori Bazlı Scoring (Hibrit):** A/B/C bölüm skorları + en zayıf 2-3 kriter DB'ye kaydedilir ve dashboardda gösterilir.
2. **Coaching Loop:** Her değerlendirmede AI tarafından üretilen 3 somut gelişim maddesi değerlendirme detay sayfasında gösterilir, agent'a otomatik bildirim gönderilir.

---

## 2. Değerlendirme Formları ve Kategori Yapısı

### Second Call — v11.2-ADVANCED

| Bölüm | Ağırlık | Kriterler |
|-------|---------|-----------|
| A — Giriş & Profilleme | %20 | A1 Kimlik&Marka, A2 Gündem, A3 Ice Breaker, A4 Kişiselleştirme, A5 Empati |
| B — Çözüm & Otorite | %45 | B1 Nabız, B2 Medikal Akış, B3 Yöntem, B4 Doktor, B5 Kanıt, B6 Sosyal Kanıt, B7 Paket, B8/B9 Upsell, B10 Fiyat, B11 Rakip, B12 İyileşme, B13 İtinerary |
| C — Kapanış & Köprü | %35 | C1 Netlik, C2 Fiyat İtirazı, C3 Korku/İtiraz, C4 Aciliyet, C5 Depozito, C6 Takip |

### First Call — v10.13-Specialized

| Bölüm | Kriterler |
|-------|-----------|
| A — Giriş & Derin Profilleme | A1 Kimlik, A2 Rapport, A3 Kaynak, A4 Zamanlama, A5 Tıbbi Profil, A6 Kişiselleştirme, A7 Empati |
| B — Çözüm & Otorite | B2 Tıbbi Akış, B4 Doktor Liderliği, B11 Fiyat Stratejisi, B12 Rakip |
| C — Kapanış & Sonraki Adımlar | C1 Netlik, C7 Fotoğraf Protokolü, C8 Köprü |

---

## 3. Veri Modeli Değişikliği

`Evaluation` modeline 2 opsiyonel alan eklenir (Prisma migration):

```prisma
model Evaluation {
  // ...mevcut alanlar...
  sectionScores  Json?   // { "A": 85, "B": 74, "C": 61 }
  weakCriteria   Json?   // [{ "id": "C5", "label": "Depozito Bilgisi", "score": 40, "coachingNote": "..." }, ...]
}
```

- `sectionScores`: Her bölümün 0-100 arası ağırlıklı skoru
- `weakCriteria`: En düşük skora sahip 2-3 kriter, her biri coaching notu içerir
- N/A olan kriterler (koşullu kriterler) JSON'a dahil edilmez
- Mevcut evaluation kayıtları bu alanlar `null` olarak kalır (geriye dönük uyumlu)

---

## 4. Analyze Route Değişikliği

### 4.1 Prompt Güncellemesi

Her iki prompt'a (v11.2 ve v10.13) çıktı formatının sonuna şu blok eklenir:

```
===JSON_DATA===
{
  "sectionScores": { "A": 85, "B": 74, "C": 61 },
  "weakCriteria": [
    { "id": "C5", "label": "Depozito Bilgisi", "score": 40, "coachingNote": "Depozito tutarını (£500) ve ödeme yöntemini her kapanış öncesinde net belirt." },
    { "id": "B2", "label": "Medikal Akış", "score": 55, "coachingNote": "Analiz → Öneri → Hizalama sırasını koru, öneri aşamasına geçmeden önce durumu yeterince analiz et." },
    { "id": "C2", "label": "Fiyat İtirazı", "score": 72, "coachingNote": "'Fix Once / Tek Seferlik Yatırım' mantığını fiyat itirazında kullan." }
  ]
}
===END_JSON===
```

Kurallar:
- N/A olan kriterler `weakCriteria`'ya dahil edilmez
- `weakCriteria` skoru 80'in altındaki kriterler arasından en düşük en fazla 3 tanesini içerir; tüm kriterler 80+ ise liste boş döner
- Tüm skorlar 0-100 tam sayı
- `coachingNote` Türkçe, somut, "sen" diliyle yazılır

### 4.2 Parsing Mantığı (`/api/analyze/route.ts`)

```
reportText = AI yanıtı
jsonBlock = reportText.match(/===JSON_DATA===([\s\S]*?)===END_JSON===/)?.[1]
if (jsonBlock) {
  parsed = JSON.parse(jsonBlock.trim())
  sectionScores = parsed.sectionScores
  weakCriteria = parsed.weakCriteria
}
```

Hata durumu: JSON parse başarısız olursa `sectionScores = null`, `weakCriteria = null` olarak kaydedilir, değerlendirme yine de tamamlanır.

### 4.3 Evaluation Kaydı

`/api/evaluations POST` isteğine `sectionScores` ve `weakCriteria` alanları eklenir.

---

## 5. UI Değişiklikleri

### 5.1 ScoreView Bileşeni — Bölüm Analizi Kartı

Mevcut stats kartlarının altına yeni bir kart eklenir:

- **Başlık:** "Bölüm Analizi" + toplam değerlendirme sayısı notu (ör. "14 çağrı ortalaması")
- **İçerik:** A/B/C bölümleri için gradient progress bar + skor
- **Alt bölüm:** "En Zayıf Kriterler" listesi — her kriter renkli sol-border kart olarak gösterilir (kırmızı <%55, turuncu %55-70, sarı %70-80)
- `sectionScores` null ise kart gösterilmez

### 5.2 Evaluation Detay Sayfası — Coaching Kartı

`/evaluation/[id]` sayfasına yeni kart eklenir:

- **Başlık:** "Bu Çağrıda Yapılabilecek 3 Şey" + "COACHING" etiketi
- **İçerik:** `weakCriteria` listesindeki her madde için numaralı kart (kriter adı + coachingNote)
- **Alt not:** "Agent bu değerlendirme kaydedildiğinde otomatik bildirim aldı."
- `weakCriteria` null veya boş ise kart gösterilmez

### 5.3 Bildirim Metni Güncellemesi

`/api/evaluations POST` içindeki agent bildirimi güncellenir:

```
Mevcut: "X müşterisi için değerlendirme tamamlandı. Skor: %Y"
Yeni:   "X müşterisi değerlendirmen hazır (%Y). [N] gelişim alanın var — detaylar için tıkla."
```

---

## 6. Değişmeyen Kısımlar

- Mevcut `score: Int` alanı ve regex ile çekme mantığı korunur (geriye dönük uyum)
- `report: String` alanı ve mevcut rapor görüntüleme değişmez
- Prompt'ların geri kalanı (kritik hatalar, koçluk kuralları vb.) değişmez
- Admin panelinden prompt güncelleme arayüzü değişmez — sadece prompt içeriğine JSON bloğu eklenir

---

## 7. Kapsam Dışı (Faz 2)

- Haftalık/aylık kategori trend grafiği
- "En çok düşen kategori" analizi
- Team Leader coaching özet raporu
- Peer comparison & takım ortalaması
- Call type coverage analizi
- Benchmark çağrı kütüphanesi

---

## 8. Scores API Güncellemesi

`/api/scores` route'u mevcut `weeklyProgress` ve `recentCalls` hesaplamalarına ek olarak agent'ın tüm evaluationlarından **ortalama bölüm skorlarını** hesaplar:

```
avgSectionScores = {
  A: average of all evaluation.sectionScores.A (null olanlar hariç),
  B: average of ...,
  C: average of ...
}
topWeakCriteria = en sık tekrar eden weakCriteria id'leri (frekans bazlı top 3)
```

Bu veriler `ScoreView`'e `sectionData` prop'u olarak geçirilir.

---

## 9. Uygulama Sırası

1. Prisma migration (`sectionScores`, `weakCriteria` alanları)
2. `/api/analyze/route.ts` — JSON parsing mantığı
3. `/api/evaluations/route.ts` — yeni alanları kaydet
4. Prompt güncelleme (v11.2 ve v10.13 için JSON bloğu ekleme)
5. `ScoreView` — Bölüm Analizi kartı
6. `/evaluation/[id]` — Coaching kartı
7. Bildirim metni güncellemesi
