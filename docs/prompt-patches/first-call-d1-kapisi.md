# First Call v11.3 — D1 hard fail kapısı

## Sorun

Aynı kayıtta, aynı ayarlarla 4 koşu yapıldı. Bölüm skorları, kırılan maddeler,
kriter kapsamı ve aritmetik **dördünde de birebir aynı** çıktı. Tek fark D1'di:

| Koşu | D1 | Skor |
|---|---|---|
| 1 | tetiklendi | 0 |
| 2 | — | 50 |
| 3 | tetiklendi | 0 |
| 4 | — | 50 |

D1 binary ve skoru doğrudan sıfırladığı için tek başına 50 puan oynatıyor.

Tetikleyen alıntı (`cmtk2pl8b000104l4umvt94px`, 02:40):

> "Because usually, we do not accept patients 65 or above their age.
> **But still, I'm gonna share all of these medical details**, and that's why
> I asked for your exact birth date as well."

Danışman bir politikayı dile getiriyor, ama **eleme yapmıyor ve aramayı
bitirmiyor** — bilgiyi medikal ekibe iletmeye devam ediyor. Promptun kendi
"NOT D1" listesindeki *"Recording a condition and saying it is useful for the
consultant"* maddesine giriyor. Yani D1'i tetikleyen iki koşu yanlış pozitif.

Mevcut kural zaten "Disqualifies the lead on medical grounds **and ends the
call**" diyor. Model "and ends the call" kısmını yarı yarıya atlıyor, çünkü
kural bir cümlenin içinde gömülü ve test edilebilir bir adım değil.

## Çözüm: mekanik kapı

Prompt zaten ~1150 satır; açıklama eklemek durumu kötüleştirir. Kuralı
**sayılabilir iki koşula** indiriyoruz.

### Değişiklik 1

`D1 - Medical Boundary (HARD FAIL)` bölümünde şunu **bul**:

```
EVIDENCE REQUIREMENT:
D1 requires a VERBATIM quote of the SDR'S OWN WORDS matching one of the
three behaviours above. Without such a quote, D1 is NOT triggered.
```

**Değiştir**:

```
D1 KAPISI — İKİ KOŞUL BİRDEN. İkisi de sağlanmıyorsa D1 YOKTUR.

  (1) KANIT: danışmanın KENDİ sözlerinden, zaman damgalı, birebir alıntı.
      Alıntı yoksa D1 yok. Müşterinin sözleri D1 tetiklemez.

  (2) SONUÇ: aramanın o noktadan SONRA medikal gerekçeyle sonlanması,
      ya da leadin süreçten düşürülmesi.

  (2)'yi ŞÖYLE TEST ET — alıntıdan SONRAKİ konuşmaya bak:
      Danışman fotoğraf istemeye, konsültasyon saati vermeye, bilgiyi
      medikal ekibe iletmeye ya da akışa devam etmeye devam ettiyse
      → (2) YOKTUR → D1 YOK. Başka hiçbir gerekçe bunu değiştirmez.

  Bir kısıtı, politikayı, riski veya yaş sınırını DİLE GETİRMEK tek başına
  D1 DEĞİLDİR. Belirleyici olan, aramanın o yüzden bitip bitmediğidir.

  ÖRNEK — D1 DEĞİL:
    Danışman: "Genelde 65 yaş ve üstü hasta kabul etmiyoruz. Ama yine de
    tüm medikal detayları paylaşacağım, doğum tarihinizi de bu yüzden
    sordum."
    → Politika dile getirildi; eleme YAPILMADI, arama DEVAM ETTİ.
    → D1 YOK, hardFail false. Bu bir KOÇLUK NOTUDUR: kabul kriterleri
      konsültasyondan önce hastaya söylenmemeli. weakCriteria'ya GİRMEZ.

  ÖRNEK — D1:
    Danışman: "Yaşınız uygun değil, bu işlem sizde sonuç vermez. Size
    yardımcı olamayacağız, iyi günler." → arama biter.
    → Hem eleme hem sonlandırma var. D1 VAR.
```

### Değişiklik 2

`MACHINE-READABLE DATA BLOCK` altındaki `KURALLAR:` listesinde şunu **bul**:

```
- hardFail true ise overallScore 0 olarak yazılır; sectionScores yine
  hesaplanmış hâliyle raporlanır ve D1 weakCriteria'ya eklenir.
```

**Değiştir**:

```
- hardFail YALNIZCA D1 KAPISI'nın İKİ koşulu da sağlandığında true olur.
  Şüphedeysen false yaz: yanlış bir hard fail, doğru bir raporu tamamen
  geçersiz kılar; kaçırılan bir hard fail ise koçlukta yakalanır.
- hardFail true ise overallScore 0 olarak yazılır; sectionScores yine
  hesaplanmış hâliyle raporlanır ve D1 weakCriteria'ya eklenir.
- D1 weakCriteria'ya eklenirken evidence BOŞ BIRAKILAMAZ ve whatHappened
  alanı aramanın alıntıdan SONRA nasıl sonlandığını açıkça yazmalıdır.
  Sonlanmayı gösteremiyorsan D1'i hiç ekleme.
```

## Doğrulama

Yamadan sonra aynı kayıtta 4 koşu daha:

```bash
for i in 1 2 3 4; do
  npx tsx scripts/reclassify-range.ts --id cmtk2pl8b000104l4umvt94px --dump /tmp/d1-$i
done
```

Beklenen: dördünde de `%50`, `hardFail: false`. Hâlâ sallanıyorsa kapı yeterli
değil demektir ve D1'i tamamen skordan ayırmayı (yalnızca bayrak olarak
göstermeyi) konuşmalıyız.

## Kod tarafındaki emniyet

`scripts/reclassify-range.ts`, puanı olan bir kaydı hard fail nedeniyle sıfıra
düşüren sonucu **varsayılan olarak yazmaz**; listeler. Bilerek yazdırmak için
`--allow-hardfail` gerekir. Bu yama D1'i sabitlese bile o kilit kalsın.
