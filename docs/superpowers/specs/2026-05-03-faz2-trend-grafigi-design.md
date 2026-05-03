# Faz 2 — Kategori Trend Grafiği & Düşen Kategori Analizi
**Tarih:** 2026-05-03  
**Versiyon:** 1.0  
**Proje:** SDR Analyzer — ESTENOVE Saç Ekim Kliniği  
**Kapsam:** Faz 2 — Trend Grafikleri (Faz 1: Kategori Scoring & Coaching Loop tamamlandı)

---

## 1. Genel Bakış

Faz 1'de her değerlendirmeden A/B/C bölüm skorları `sectionScores Json?` alanında DB'ye kaydedilmektedir. Bu faz, bu verileri zaman ekseninde görselleştirir:

1. **Kategori Trend Grafiği:** A/B/C haftalık ortalamalarını gösteren SVG çizgi grafiği (4H / 3A / 6A / Tümü seçici ile)
2. **Dönem Trendi Göstergesi:** Seçili dönem başı → sonu arasında en fazla puan kaybeden bölüm
3. **Son Hafta Uyarısı:** Geçen hafta ile bu hafta karşılaştırmasında en fazla düşen bölüm

---

## 2. Veri Modeli

Yeni DB alanı gerekmez. Mevcut `Evaluation.sectionScores Json?` (`{ A: number; B: number; C: number }`) kullanılır.

`sectionScores` null olan eski evaluationlar trend hesabına dahil edilmez; o haftalar için boşluk bırakılır.

---

## 3. API: `/api/scores/trend`

### 3.1 Route

`GET /api/scores/trend`

**Dosya:** `app/api/scores/trend/route.ts` (yeni dosya)

### 3.2 Parametreler

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `agentId` | string | hayır | Belirtilmezse oturumdaki kullanıcı. AGENT rolü sadece kendini görebilir. |
| `range` | `4w` \| `3m` \| `6m` \| `all` | hayır | Default: `4w` |

**Range → Tarih Aralığı:**
- `4w` → bugünden 28 gün öncesi
- `3m` → bugünden 90 gün öncesi
- `6m` → bugünden 180 gün öncesi
- `all` → tüm kayıtlar

### 3.3 Auth & Yetki

`getUserFromToken` ile kontrol. AGENT sadece kendi `agentId`'sini görebilir (scores API ile aynı kural).

### 3.4 Hesaplama Mantığı

```
1. Evaluations'ı çek: agentId + tarih aralığı filtresi, sadece sectionScores null olmayan kayıtlar
2. Her evaluation'ı ISO hafta numarasına (YYYY-Www) göre grupla
3. Her hafta için A, B, C ortalamalarını hesapla (Math.round)
4. Haftaları tarihe göre sırala (eskiden yeniye)
5. trendIndicators hesapla:
   a. periodDrop: weeks[0] ve weeks[weeks.length-1] karşılaştır, en büyük negatif delta olan bölüm
   b. lastWeekDrop: weeks[weeks.length-2] ve weeks[weeks.length-1] karşılaştır, en büyük negatif delta
   c. Her ikisi için de delta pozitifse (artış) → null dön (gösterge yok)
6. hasEnoughData: weeks.length >= 2
```

### 3.5 Response

```typescript
{
  weeks: Array<{
    week: string;       // "H1", "H2", ... (sıra numarası)
    date: string;       // "28 Nis" (hafta başlangıcı, tr-TR formatı)
    A: number;          // 0-100
    B: number;
    C: number;
    callCount: number;  // o haftaki evaluation sayısı
  }>;
  trendIndicators: {
    periodDrop: {
      section: "A" | "B" | "C";
      label: string;    // "Giriş & Profilleme" | "Çözüm & Otorite" | "Kapanış & Köprü"
      from: number;
      to: number;
      delta: number;    // negatif, ör. -11
    } | null;
    lastWeekDrop: {
      section: "A" | "B" | "C";
      label: string;
      from: number;
      to: number;
      delta: number;
    } | null;
  };
  hasEnoughData: boolean;  // weeks.length >= 2
}
```

---

## 4. Frontend: `TrendChart` Bileşeni

**Dosya:** `app/components/shared/TrendChart.tsx` (yeni dosya)

### 4.1 Yerleşim

ScoreView'de (`app/components/shared/ScoreView.tsx`) mevcut Bölüm Analizi kartının hemen altına eklenir.

### 4.2 Props

```typescript
interface TrendChartProps {
  agentId: string;
}
```

Bileşen kendi içinde `/api/scores/trend` çağrısı yapar. ScoreView'e yeni prop veya API değişikliği gerekmez.

### 4.3 Bileşen Yapısı

**Üst bar:**
- Sol: "◈ Kategori Trendi" başlığı
- Sağ: Toggle butonları — `4H` | `3A` | `6A` | `Tümü` (aktif olan mor/primary renginde)

**Grafik alanı (`hasEnoughData: true`):**
- SVG tabanlı çizgi grafik (kütüphane yok)
- Üç çizgi: A (yeşil `#4ade80`), B (sarı `#facc15`), C (kırmızı `#f87171`)
- X ekseni: hafta etiketleri (H1, H2...)
- Y ekseni: 0-100 aralığı, yatay grid çizgileri (25, 50, 75, 100)
- Her noktada küçük daire (radius 3)
- Legend: grafik altında A/B/C renk açıklamaları

**Göstergeler (`trendIndicators` null değilse):**
- Dönem Trendi + Son Hafta Uyarısı yan yana (grid 2 kolon)
- Her gösterge: ok ikonu + bölüm adı + "X → Y (-Z puan)"
- Dönem trendi rengi: kırmızı tonu; Son hafta: sarı/amber tonu
- Gösterge null ise (artış veya veri yok) o kutu gizlenir

**`hasEnoughData: false` durumu:**
- Grafik alanı yerine: "Trend hesaplanabilmesi için seçili dönemde en az 2 haftalık veri gerekir." mesajı

**Loading state:**
- Toggle değiştirildiğinde veya ilk yüklemede: grafik alanında spinner

### 4.4 Renk & Stil

Faz 1 Bölüm Analizi kartı ile tutarlı: `bg-surface-container rounded-3xl p-8`, `border-outline-variant`.

---

## 5. ScoreView Entegrasyonu

`app/components/shared/ScoreView.tsx` içinde Bölüm Analizi kartının kapanış `</div>`'ından sonra:

```tsx
<TrendChart agentId={agent.id} />
```

`TrendChart` import'u eklenir. ScoreData interface değişmez.

---

## 6. Edge Cases

| Durum | Davranış |
|-------|----------|
| Seçili dönemde hiç evaluation yok | `hasEnoughData: false`, bilgi mesajı |
| Bir haftada tek evaluation | O hafta tek değer kullanılır, gösterge hesaplanabilir |
| Tüm kriterler artış gösteriyorsa | `trendIndicators.periodDrop` ve/veya `lastWeekDrop` null, kutu gizlenir |
| `sectionScores` null olan eski kayıtlar | Sorgudan dışlanır, boşluk geçilir |

---

## 7. Kapsam Dışı (Faz 3+)

- Grafik noktaları üzerinde hover tooltip
- CSV/export
- Team Leader ekip geneli trend görünümü
- Bölüm bazlı hedef çizgisi (target line)

---

## 8. Uygulama Sırası

1. `app/api/scores/trend/route.ts` — yeni endpoint
2. `app/components/shared/TrendChart.tsx` — yeni bileşen
3. `app/components/shared/ScoreView.tsx` — `<TrendChart>` ekle
