# First Call v11.3 — JSON bloğuna ek

Mevcut blok kartın ihtiyacı olanın çoğunu zaten üretiyor. Eksik olan tek şey:
**anlatı raporunda (bölüm 1, 5, 6) olup makine bloğunda olmayan üç alan.**

İki yerde değişiklik var, ikisi de ekleme. Mevcut hiçbir alan silinmiyor,
adı değişmiyor.

---

## Değişiklik 1 — JSON şablonu

`MACHINE-READABLE DATA BLOCK` bölümünde, şablonun sonunu **bul**:

```
  "naCriteria": [
    { "id": "B1", "label": "Doktor Odaklı Otorite", "reason": "Doktor rolüne dair soru gelmedi" }
  ]
}
===END_JSON===
```

**Değiştir**:

```
  "naCriteria": [
    { "id": "B1", "label": "Doktor Odaklı Otorite", "reason": "Doktor rolüne dair soru gelmedi" }
  ],
  "band": "<Güçlü | Kabul Edilebilir | Koçluk Gerekiyor | Kritik>",
  "bandEn": "<Strong | Acceptable | Coaching Required | Critical>",
  "medicalFlags": [
    { "title": "<durum adı>",
      "qualifier": "<kontrol altında vb. — yoksa alanı hiç yazma>",
      "detail": "<danışman doğru davrandı mı, konsültasyon saati verildi mi>",
      "escalation": <true | false> }
  ],
  "coaching": [
    { "title": "<yapılacak davranış>",
      "detail": "<neden önemli, tek-iki cümle>",
      "source": "Call Flow · Adım <A/B/C/D/E> — <adım adı>" }
  ]
}
===END_JSON===
```

---

## Değişiklik 2 — KURALLAR listesinin sonuna ekle

```
- band / bandEn: raporun 1. bölümündeki bant. Eşikler BANDS tablosuyla
  aynı: 85-100 Güçlü/Strong · 70-84 Kabul Edilebilir/Acceptable ·
  55-69 Koçluk Gerekiyor/Coaching Required · <55 Kritik/Critical.
  hardFail true ise "Kritik" / "Critical" yaz.
- medicalFlags: raporun 5. bölümüyle AYNI içerik. "Medikal bayrak yok."
  durumunda boş dizi kullan: []. 18 yaş altı ESCALATION durumunda o
  maddeye "escalation": true yaz.
- coaching: raporun 6. bölümündeki iki maddenin aynısı, aynı sırada ve
  aynı üç alanla (başlık / açıklama / kaynak). Kırılan madde yoksa
  boş dizi: [].
- naCriteria: PASS, PARTIAL veya FAIL almayan HER kriter buraya girer.
  passedCriteria + weakCriteria + naCriteria birlikte 13 kriterin
  (A1-A6, B1-B3, C1-C4) TAMAMINI kapsamak zorundadır; hiçbiri dışarıda
  kalamaz. Kapsanmayan kriter varsa blok eksiktir.
- evidence: her maddede 1-2 alıntı. Karşılıklı gereken yerlerde
  (randevu onayı, soru-cevap, takip sorusu eksikliği) hem danışmanın
  hem müşterinin repliği AYRI birer alıntı olarak verilir.
- evidence[].text içinde kriteri karşılayan (veya karşılamayan) cümle
  parçası **kalın** işaretlenir — raporun 2. bölümündeki kuralın aynısı.
  Bu işaret makine bloğunda da korunur.
- scorable false olduğunda medicalFlags ve coaching de boş dizi olur.
```

---

## Değişmeyecekler

- **`**kalın**` gösterimi** zaten çalışıyor. Kart, alıntı içindeki yıldızları
  otomatik olarak gerçek vurguya çeviriyor; ayrı bir `highlight` alanına
  gerek yok.
- **Alan adları** birebir tutuyor: `passedCriteria`, `weakCriteria`,
  `naCriteria`, `weight`, `earned`, `loss`, `subChecks`, `timestamp`,
  `verdict`, `scorable`, `hardFail`, `sectionScores` (null hâli dâhil).
  Hiçbirini değiştirme.
- **`Genel Skor:` satırı** anlatı raporunda kalmalı — skor oradan
  regex'le okunuyor. Başlık değişirse tüm yeni skorlar 0 olur.
- `windowOffered` / `narrowingAttempted` kartı ilgilendirmiyor ama
  "Daraltma Oranı" metriğini besliyor; dokunma.

## Sonrasında

Bu iki değişiklikten sonra kartta şunlar açılır: **skor bandı rozeti**,
**medikal bayrak bölümü** (18 yaş altında kırmızı escalation olarak),
**"Bu hafta odaklanılacak noktalar" koçluk kutusu**, ve maddelerde
tek yerine iki alıntı. Kod tarafında değişiklik gerekmez.
