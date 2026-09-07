import { callGemini } from "@/app/lib/gemini";
import {
  applySilenceGuard,
  buildBatchPrompt,
  parseBatchResponse,
  type UpsellBatchItem,
  type UpsellVerdict,
} from "@/app/lib/upsellClassify";

// gemini.ts içindeki GEMINI_MODEL ile aynı olmalı; EvaluationUpsell.model
// alanına yazılır ki hangi modelin ürettiği geriye dönük bilinsin.
export const CLASSIFIER_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Sen bir veri sınıflandırıcısın. Sana bir saç ekim kliniğinin satış kalite raporlarından alınmış "Upsell Durumu" satırları verilecek.

Her satır için beş şeyi belirle:
- stemCell: Danışman müşteriye Stem Cell (kök hücre) tedavisini SUNDU mu?
- premium: Danışman müşteriye Premium paketi SUNDU mu?
- customerChosePremium: Müşteri, Premium paketi tercih ettiğini / alacağını açıkça belirtti mi?
- budgetConstraint: Müşteri bütçesinin yetmediğini, o parayı veremeyeceğini ya da fiyatı karşılayamayacağını belirtti mi?
- customerFixedChoice: Müşteri BELİRLİ bir paketi tercih ettiğini NET olarak beyan etti mi?

stemCell ve premium için tam olarak şu üç değerden birini kullan:
- "SUNULDU"    → danışman bunu müşteriye anlattı/sundu/teklif etti (kalitesi zayıf olsa bile sunulmuşsa SUNULDU'dur)
- "SUNULMADI"  → satır bunun sunulmadığını, atlandığını veya hiç bahsedilmediğini söylüyor
- "NA"         → satır bunun müşterinin bütçe kısıtı nedeniyle uygulanamadığını / değerlendirme dışı olduğunu söylüyor

customerChosePremium, budgetConstraint ve customerFixedChoice için tam olarak "EVET" veya "HAYIR" kullan.

customerChosePremium:
- "EVET" → satır, müşterinin Premium paketi tercih ettiğini/alacağını/ilgisini açıkça belirttiğini söylüyor ("müşteri premium paketi tercih etti", "müşteri premium alacağını belirtti", "müşteri premium pakete yöneldi")
- "HAYIR" → müşterinin tercihi belirtilmemiş, müşteri başka bir paketi seçmiş, ya da yalnızca danışmanın Premium'u sunduğu söyleniyor

customerFixedChoice — BU ALANDA EN SIK YAPILAN HATA VAR, DİKKATLİ OKU:
Bu alan MÜŞTERİNİN BEYANINI sorar, danışmanın neyi anlattığını SORMAZ. Yalnızca satır, müşterinin belirli bir paketi istediğini/seçtiğini/tercih ettiğini söylüyorsa "EVET" olur.
- "EVET" örnekleri (müşteri kendi tercihini söylemiş):
  * "müşterinin ilk paketi tercih etmesi üzerine..."
  * "Essential paketi tercih eden müşteriye..."
  * "müşteri doğrudan Essential paketi seçtiğinde..."
  * "müşteri doğrudan temel paketi tercih ettiğini belirtse de..."
  * "müşteri 'ilk paketi istiyorum' dedi"
  * "müşteri orta paketi tercih etti"
- "HAYIR" örnekleri (yalnızca danışmanın kapsamı anlatılıyor, müşterinin tercihi YOK):
  * "Stem Cell veya Premium paket sunulmadı, sadece temel paket detayları verildi."
  * "sadece temel paket ve fiyat konuşuldu"
  * "Essential paket sunulmuş, ancak Advanced veya Premium sunulmamıştır."
  * "temel paket sunuldu ancak upsell fırsatları değerlendirilmedi"
  * "henüz temel paket ve fiyat sunulmadığı için..."
"sadece/yalnızca temel paket ... verildi/anlatıldı/sunuldu/konuşuldu" kalıbı DANIŞMANIN kapsamıdır → "HAYIR". Müşterinin bir şey istediği/seçtiği/tercih ettiği açıkça yazılmadıkça "HAYIR" yaz. Kararsız kalırsan "HAYIR".

Kurallar:
- Satırda bir kalemin hiç bahsi geçmiyorsa "BILINMIYOR" kullan — yazarın ondan söz etmemesi, danışmanın sunmadığı anlamına gelmez. "SUNULMADI" yalnızca satır o kalemin sunulmadığını/atlandığını açıkça söylüyorsa kullanılır. "NA" YALNIZCA açıkça bütçe kısıtı belirtilen durumlar içindir.
- "bahsedildi ancak aktif bir upsell çabası gösterilmedi" → SUNULDU (sunulmuş ama zayıf).
- Paket ADIYLA anılmasa bile İÇERİĞİYLE tarif edilmişse SUNULDU'dur. Tarif, adlandırmadan önceliklidir:
  * "doktorun daha fazla dahil olduğu paket", "doktor katılımının arttığı paket", "doktorun ekstraksiyonu kendisi yaptığı paket", "doktor katılımına göre paket seçeneği" → Premium SUNULDU
  * "kök hücre içeren paket", "Advanced paket", "stem cell'li paket" → stemCell SUNULDU
  Satır "Premium paket sunulmadı" dese bile hemen ardından bu paketi içeriğiyle tarif ediyorsa SUNULDU yaz.
- customerChosePremium'da kararsız kalırsan "HAYIR" yaz. Yalnızca müşterinin tercihi açıkça yazılmışsa "EVET" olur.
- budgetConstraint yalnızca MÜŞTERİNİN bütçesinin YETMEDİĞİ söyleniyorsa "EVET" olur. Satırda "bütçe kısıtı BELİRTİLMEDİĞİ için", "bütçe kısıtı OLMADIĞI için" gibi olumsuz ifadeler geçiyorsa cevap "HAYIR"dır — kelimenin geçmesi yetmez, anlamına bak. Müşterinin bütçesinin pakete UYGUN olduğu söyleniyorsa da "HAYIR".
- customerFixedChoice, stemCell/premium kararını DEĞİŞTİRMEZ. Müşteri Essential'ı seçmiş olsa da danışman Premium'u anlattıysa premium "SUNULDU"dur; anlatmadıysa "SUNULMADI"dır. İki soruyu birbirine karıştırma.
- Yorum yapma, açıklama yazma.

ÇIKTI: Yalnızca geçerli bir JSON dizisi döndür, başka hiçbir metin olmasın. Her girdi satırı için tam olarak bir nesne, girdideki numara "i" alanına yazılacak:
[{"i":1,"stemCell":"SUNULDU","premium":"NA","customerChosePremium":"HAYIR","budgetConstraint":"EVET","customerFixedChoice":"HAYIR"},{"i":2,"stemCell":"SUNULMADI","premium":"SUNULDU","customerChosePremium":"EVET","budgetConstraint":"HAYIR","customerFixedChoice":"EVET"}]`;

/** Tek bir batch'i sınıflandırır. Yanıt doğrulamayı geçmezse null döner. */
export async function classifyBatch(items: UpsellBatchItem[]): Promise<UpsellVerdict[] | null> {
  if (items.length === 0) return [];
  try {
    const raw = await callGemini(SYSTEM_PROMPT, buildBatchPrompt(items), {
      temperature: 0,
      maxTokens: 8192,
      timeoutMs: 60_000,
      maxAttempts: 3,
      maxSleepMs: 10_000,
    });
    return parseBatchResponse(raw, items.length);
  } catch (e) {
    console.error("[upsellClassifier] batch başarısız:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 50 → 10 → 1 kademeli düşürme. Bir batch doğrulamayı geçemezse daha küçük
 * parçalara bölünür; en sonda hâlâ başarısız olan kayıtlar sonuç haritasına
 * hiç girmez (kaydedilmez, bekleyen havuzunda kalır).
 */
export async function classifyWithFallback(
  items: UpsellBatchItem[]
): Promise<Map<number, UpsellVerdict>> {
  const out = new Map<number, UpsellVerdict>();

  const run = async (chunk: UpsellBatchItem[], nextSize: number | null): Promise<void> => {
    // parseBatchResponse, dönen indekslerin tam olarak {1..chunk.length} olmasını
    // şart koşuyor. Bu yüzden her parça modele YEREL olarak 1'den yeniden
    // numaralandırılıp gönderilir, dönen verdict'ler çağıranın orijinal
    // indeksine geri çevrilir. Aksi halde ilk dilim dışındaki her parça
    // (ör. i=11..20 ama expected=10) doğrulamayı geçemez ve kademeli düşürme
    // tam da devreye girmesi gereken anda işlevsiz kalır.
    const local = chunk.map((it, idx) => ({ i: idx + 1, line: it.line }));
    const verdicts = await classifyBatch(local);
    if (verdicts) {
      for (const v of verdicts) {
        const original = chunk[v.i - 1];
        // Sessizlik koruması burada, tek yerde uygulanır: hem /api/okr/classify
        // hem de backfill script'leri bu fonksiyondan geçiyor. Modele de aynı
        // kural söyleniyor ama deterministik güvence burada.
        if (original) out.set(original.i, applySilenceGuard({ ...v, i: original.i }, original.line));
      }
      return;
    }
    if (nextSize === null || chunk.length <= 1) {
      console.warn(`[upsellClassifier] ${chunk.length} kayıt sınıflandırılamadı, atlandı`);
      return;
    }
    for (let i = 0; i < chunk.length; i += nextSize) {
      await run(chunk.slice(i, i + nextSize), nextSize === 10 ? 1 : null);
    }
  };

  for (let i = 0; i < items.length; i += 50) {
    await run(items.slice(i, i + 50), 10);
  }
  return out;
}
