# Second Call v11.3 — zengin JSON bloğu

Second Call promptunun sonundaki **"ZORUNLU EK ÇIKTI — RAPOR SONUNA EKLE"**
bölümünü (===JSON_DATA=== şablonu + altındaki Kurallar listesi) tamamen
aşağıdakiyle değiştir. Promptun geri kalanına dokunma.

Mevcut blok yalnızca `sectionScores` + dar `weakCriteria` üretiyordu; kart bu
yüzden ikinci çağrılarda kanıt alıntısı, doğru yapılanlar ve uygulanmayan
maddeler gösteremiyordu.

---

## Yapıştırılacak metin

```
ZORUNLU EK ÇIKTI — RAPOR SONUNA EKLE:
Raporun tamamlanmasının ardından, başka hiçbir metin olmaksızın, tam olarak
şu bloğu ekle. ===END_JSON=== ifadesinden sonra HİÇBİR ŞEY yazma.

===JSON_DATA===
{
  "promptVersion": "v11.3",
  "scorable": true,
  "overallScore": 0,
  "band": "<Mükemmel | Yetkin | Gelişim Gerekli | Müdahale Gerekli>",
  "sectionScores": { "A": 0, "B": 0, "C": 0 },
  "sections": [
    { "key": "A", "label": "Giriş & Profilleme", "score": 0 },
    { "key": "B", "label": "Çözüm & Otorite", "score": 0 },
    { "key": "C", "label": "Kapanış & Köprü", "score": 0 }
  ],
  "passedCriteria": [
    { "id": "A1", "label": "Kimlik & Marka",
      "earned": 3.0, "weight": 3.0,
      "summary": "<tek cümle: ne doğru yapıldı>",
      "subChecks": [ { "label": "<alt adım>", "ok": true } ],
      "evidence": [
        { "speaker": "Danışman", "timestamp": "00:11",
          "text": "<transkriptten birebir alıntı>",
          "highlight": ["<alıntı içindeki kritik parça>"] }
      ] }
  ],
  "weakCriteria": [
    { "id": "<kriter ID>", "label": "<kriterin Türkçe adı>",
      "verdict": "FAIL | PARTIAL",
      "loss": 0.0, "weight": 0.0, "score": 0, "section": "<A|B|C>",
      "whatHappened": "<ne olduğu, tek-iki cümle>",
      "subChecks": [ { "label": "<alt adım>", "ok": false } ],
      "evidence": [
        { "speaker": "Danışman", "timestamp": "03:34",
          "text": "<transkriptten birebir alıntı>" }
      ],
      "shouldHaveSaid": "<danışmanın söylemesi gereken somut cümle>",
      "coachingNote": "<tek cümlelik Türkçe koçluk notu>" }
  ],
  "naCriteria": [
    { "id": "<kriter ID>", "label": "<kriterin adı>", "reason": "<neden uygulanmadı>" }
  ],
  "medicalFlags": [],
  "coaching": [
    { "title": "<yapılacak davranış>",
      "detail": "<neden önemli, tek-iki cümle>",
      "source": "<ilgili bölüm/adım>" }
  ]
}
===END_JSON===

KURALLAR:
- Sınırlayıcılar TAM olarak ===JSON_DATA=== ve ===END_JSON=== olmalı
  (boşluk yok, backtick yok, ``` yok, markdown yok).
- Blok içinde YALNIZCA geçerli JSON bulunsun: çift tırnak kullan, yorum
  ekleme, sondaki virgülü koyma.
- Geçerli kriter ID'leri:
  A: A1, A2, A3, A4, A5
  B: B1, B2, B3, B4, B5, B6, B7, B8, B9, B10, B11, B12, B13
  C: C1, C2, C3, C4, C5, C6
- label: kriterin promptta yazan Türkçe adı (ör. "Ice Breaker + Empati",
  "Fiyat İtirazı & Manager Close", "Dinamik Takip & Follow-up Hunter").
- weight: kriterin promptta yazan çarpanı (ör. A1 için 3.0, B13 için 0.5).
- sectionScores: A (%20), B (%45), C (%35) bölümlerinin 0-100 arası tam
  sayı ağırlıklı puanları. Hesaplama YALNIZCA o bölümün uygulanabilir
  ağırlıkları üzerinden yapılır. Bir bölümdeki TÜM kriterler koşullu/N/A
  ise o bölümün değeri null olsun — ASLA 0 yazma. 0 "değerlendirildi ve
  sıfır aldı", null "puanlanabilir kriter yoktu" demektir.
- passedCriteria: PASS alan HER kriter buraya girer, ağırlığı büyükten
  küçüğe sıralı. evidence BOŞ BIRAKILAMAZ — kanıtsız PASS yazma.
- weakCriteria: SADECE PASS almayan (FAIL veya PARTIAL) kriterler.
  Koşullu/N/A maddelerini EKLEME. Yoksa boş dizi: [].
  verdict FAIL ise score 0, PARTIAL ise score 50.
  loss = (1 − verdict_değeri) × weight.
  SIRALAMA: kaybedilen puana göre azalan; eşitlikte ağırlığı büyük olan
  önce. Dizideki ilk eleman aramanın en çok puan kaybettiren maddesidir.
- naCriteria: koşulu oluşmadığı için değerlendirilemeyen her kriter,
  sebebiyle. Bunlar skora ve paydaya DAHİL EDİLMEZ.
- evidence.text: transkriptten BİREBİR alıntı — özetleme, düzeltme, çevirme.
  timestamp: transkriptteki [MM:SS] damgası.
- highlight: OPSİYONEL. Değeri, aynı kanıttaki "text" alanının BİREBİR ALT
  DİZESİ olmak zorunda. Emin değilsen alanı hiç ekleme.
- coaching: raporun koçluk bölümündeki maddelerin aynısı, aynı sırada.
  Kırılan madde yoksa boş dizi: [].
- medicalFlags: ikinci çağrıda medikal bayrak beklenmiyor; boş dizi bırak.
- Arama puanlanabilir bir satış görüşmesi değilse (telesekreter, yanlış
  numara, 30 saniyeden kısa kapanma, dil engeli, kullanılamaz transkript):
    "scorable": false
    "overallScore": null
    "sectionScores": { "A": null, "B": null, "C": null }
    "passedCriteria": [], "weakCriteria": [], "naCriteria": []
- Bu bloğun yapısı HER raporda ve HER güncellemede (refine) BİREBİR aynı
  kalmalı; böylece güncellemeler formatı bozmaz.
```

---

## Değişmemesi gerekenler

- Raporun anlatı kısmındaki **`Genel Skor:`** satırı aynen kalmalı —
  skor oradan regex'le okunuyor. Başlık değişirse yeni skorlar 0 olur.
- `sectionScores` kolonu korunuyor: trend grafiği, kriter raporu ve OKR
  sorguları ona bağlı.
- `weakCriteria[].score` (0-100) ve `coachingNote` korunuyor: mevcut
  raporlar bu iki alanı kullanıyor.

## Sonrasında

Bu blok devreye girdikten sonra ikinci çağrılarda da kart tam dolar:
doğru yapılanlar, kanıt alıntıları, "ne demeliydi" satırları,
uygulanmayan maddeler ve koçluk kutusu. Kod tarafında değişiklik gerekmez.
