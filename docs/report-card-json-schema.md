# Değerlendirme kartı — JSON_DATA sözleşmesi

Kart (`app/components/shared/EvaluationReportCard.tsx`) bu bloğu okur.
Ayrıştırma `app/lib/reportJson.ts`, normalleştirme `app/lib/reportCard.ts`,
çeviri `app/lib/reportDataI18n.ts`.

## Temel kural

**Kodda kriter listesi, kriter adı, ağırlık, bölüm adı veya bant eşiği yoktur.**
Hepsi bu bloktan gelir. Yani:

| Promptta yaptığın değişiklik | Kod değişikliği |
|---|---|
| Yeni kriter ekleme (B14, D2…) | gerekmez |
| Kriteri yeniden adlandırma | gerekmez |
| Ağırlık değiştirme | gerekmez |
| Yeni bölüm ekleme (D bölümü) | gerekmez |
| Bant adlarını/eşiklerini değiştirme | gerekmez |
| Bir maddeye yeni metin alanı ekleme | gerekmez (çeviri dâhil) |
| **Alan adını değiştirme** (`weakCriteria` → başka bir ad) | **gerekir** |

Kodun sabitlediği tek şey alan adları. Onlar da takma adlara toleranslı:

| Anlam | Kabul edilen adlar |
|---|---|
| doğru yapılanlar | `passedCriteria`, `passed` |
| kırılan maddeler | `weakCriteria`, `faults` |
| uygulanmayanlar | `naCriteria`, `na` |
| tam puan | `weight`, `max`, `maxPoints` |
| kazanılan puan | `earned`, `points` |
| kaybedilen puan | `loss`, `lost` |
| alt maddeler | `subChecks`, `subs` |
| zaman damgası | `timestamp`, `ts`, `time` |
| medikal bayrak | `medicalFlags`, `flags` |
| koçluk | `coaching`, `coachingFocus`, `focus` |

Tanınmayan fazladan alanlar sessizce yok sayılır — asla hata vermez.

## Blok

````
===JSON_DATA===
{
  "promptVersion": "v11.3",
  "callClassification": "CONNECTED_QUALIFIED",
  "scorable": true,
  "hardFail": false,
  "overallScore": 58,
  "band": "Gelişim Gerekli",

  "sectionScores": { "A": 75, "B": 50, "C": 50 },
  "sections": [
    { "key": "A", "label": "Giriş & Profilleme", "score": 75 }
  ],

  "passedCriteria": [
    {
      "id": "A1",
      "label": "Kimlik, Marka ve İzin",
      "earned": 3.0,
      "weight": 3.0,
      "summary": "Dört adım da tam.",
      "subChecks": [{ "label": "İsim", "ok": true }],
      "evidence": [
        { "speaker": "Danışman", "timestamp": "00:01",
          "text": "This is Billy calling from Estenove.",
          "highlight": ["Billy", "Estenove"] }
      ]
    }
  ],

  "weakCriteria": [
    {
      "id": "C3",
      "label": "Kapanış Disiplini",
      "verdict": "FAIL",
      "loss": 3.0,
      "weight": 3.0,
      "score": 0,
      "whatHappened": "Kapanışta saat hiç tekrarlanmadı.",
      "subChecks": [{ "label": "Saat", "ok": false }],
      "evidence": [
        { "speaker": "Danışman", "timestamp": "03:34", "text": "Have a great day.",
          "note": "→ takip sorusu yok" }
      ],
      "shouldHaveSaid": "Konsültasyonunuzu 16:00'a ayarladım…",
      "coachingNote": "Kapanışta saati tekrarla."
    }
  ],

  "naCriteria": [
    { "id": "B1", "label": "Doktor Odaklı Otorite", "reason": "Doktor rolüne dair soru gelmedi" }
  ],

  "medicalFlags": [
    { "title": "Tip 2 Diyabet", "qualifier": "kontrol altında",
      "detail": "Bilgi doğru kaydedildi, danışman eleme yapmadı." }
  ],

  "coaching": [
    { "title": "Kapanışta saati tekrarla",
      "detail": "Her aramada tek cümle: gün + saat + sonraki adım.",
      "source": "Call Flow · Adım E — Kapanış" }
  ]
}
===END_JSON===
````

## Alan notları

**`sectionScores`** korunmak zorunda — trend grafiği, kriter raporu ve OKR
sorguları bu kolona bağlı. `sections` dizisi opsiyoneldir; verilirse ölçerde
bölüm adı da görünür, verilmezse yalnızca harf (A/B/C) yazar.
Bir bölümün değeri `null` ise o bölüm için ölçer çizilmez ("puanlanabilir
kriter yoktu" demek — 0 ile karıştırılmaz).

**Puanlar.** `earned` ve `loss` birbirinin tümleyeni; hangisini verirsen diğeri
`weight` üzerinden hesaplanır. İkisini birden vermen gerekmez.

**`overallScore` ve `sectionScores` KOD TARAFINDAN HESAPLANIR** — bloğa
yazabilirsin (rapor metniyle tutarlı olsun diye) ama kart ve veritabanı
onları kullanmaz.

Gerekçe ölçüldü: 87 kaydın 16'sında (%18) modelin `overallScore`'u kendi
kriter verisini tutmuyordu (sapma −10 ile +26 puan), 6 kayıtta bölüm skorları
tutmuyordu. Verdict'ler ve ağırlıklar güvenilir; güvenilmez olan çok terimli
toplam. Bu yüzden modelden istenen şey YARGI, hesap değil.

`naCriteria` paydaya girmez, onlara puan yazma.

**`verdict`.** `FAIL` → kartta **KIRIK**, `PARTIAL` → **EKSİK**.
Verilmezse `earned`/`score`'dan türetilir.

**`scorable: false`** → kart tek satırlık "Bu arama puanlanamadı" kutusuna
düşer; skor, ölçer ve maddeler hiç gösterilmez. `callClassification` sebep
olarak yazılır.

**`hardFail: true`** → maddelerin üstünde kırmızı "Ağır ihlal" uyarısı çıkar.
Bölüm skorları korunur.

**`band`.** Artık **kod tarafından skordan türetiliyor**, bloktan okunmuyor.
Skoru da kod hesapladığı için (aşağıya bak), modelin yazdığı bant kendi
yanlış skoruna göre hesaplanmış oluyordu — 9 kayıtta düzeltilmiş skorla
çelişiyordu. Bant skorun bir fonksiyonu, yargı değil.
Bloğa yazmaya devam edebilirsin (rapor metniyle tutarlı olsun diye), ama
kart onu kullanmaz.

**Kanıt.** `text` transkriptten **birebir** alıntı, `timestamp` transkriptteki
`[MM:SS]` damgası. `note` modelin kendi açıklamasıdır (çevrilir), `text`
çevrilmez. `speaker` "Danışman"/"Müşteri" (İngilizcesi de tanınır).

**`highlight`.** Opsiyonel; alıntının **birebir alt dizesi** olmak zorunda.
Tutmayan parça sessizce yok sayılır. Alıntı çevrilmediği için bu da çevrilmez.

**Skor satırı.** Rapor metnindeki `Genel Skor:` / `Overall Score:` satırı
korunmalı — skor oradan regex'le okunuyor (`app/lib/reportJson.ts`).
Başlık değişirse tüm yeni değerlendirmeler 0 puan alır.

## Çeviri

Blok baştan sona gezilir; **yasak liste dışındaki her metin** çevrilir.
Prompta yeni bir metin alanı eklersen kod değişmeden o da çevrilir.

Çevrilmeyenler: `text`, `highlight`, `id`, `code`, `key`, `ts`/`timestamp`/
`time`, `verdict`, `result`, `status`, `promptVersion`, `schemaVersion`,
`callClassification`, `classification` — ve `<alan>En` ile biten her alan.

Bir alanın yanına hazır İngilizcesini koyarsan (`label` + `labelEn`) o alan
çeviri servisine hiç gitmez, kart doğrudan onu kullanır. Kritik/kısa alanlar
(kriter adı, bant) için tavsiye edilir: çeviri servisi çökse bile İngilizce
görünüm bozulmaz.

## Geriye uyum

Alanların hepsi opsiyoneldir. Eksik bölüm ekranda hiç görünmez.
Blok hiç yoksa kart ayrı `weakCriteria` ve `sectionScores` kolonlarından
sade bir görünüm üretir.
