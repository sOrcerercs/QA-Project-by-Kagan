import { callGemini } from "@/app/lib/gemini";
import {
  buildBatchPrompt,
  parseBatchResponse,
  type UpsellBatchItem,
  type UpsellVerdict,
} from "@/app/lib/upsellClassify";

// gemini.ts içindeki GEMINI_MODEL ile aynı olmalı; EvaluationUpsell.model
// alanına yazılır ki hangi modelin ürettiği geriye dönük bilinsin.
export const CLASSIFIER_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Sen bir veri sınıflandırıcısın. Sana bir saç ekim kliniğinin satış kalite raporlarından alınmış "Upsell Durumu" satırları verilecek.

Her satır için iki şeyi belirle:
- stemCell: Danışman müşteriye Stem Cell (kök hücre) tedavisini SUNDU mu?
- premium: Danışman müşteriye Premium paketi SUNDU mu?

Her biri için tam olarak şu üç değerden birini kullan:
- "SUNULDU"    → danışman bunu müşteriye anlattı/sundu/teklif etti (kalitesi zayıf olsa bile sunulmuşsa SUNULDU'dur)
- "SUNULMADI"  → satır bunun sunulmadığını, atlandığını veya hiç bahsedilmediğini söylüyor
- "NA"         → satır bunun müşterinin bütçe kısıtı nedeniyle uygulanamadığını / değerlendirme dışı olduğunu söylüyor

Kurallar:
- Satırda hiç bahsi geçmeyen bir kalem için "SUNULMADI" kullan, "NA" kullanma. "NA" YALNIZCA açıkça bütçe kısıtı belirtilen durumlar içindir.
- "bahsedildi ancak aktif bir upsell çabası gösterilmedi" → SUNULDU (sunulmuş ama zayıf).
- Yorum yapma, açıklama yazma.

ÇIKTI: Yalnızca geçerli bir JSON dizisi döndür, başka hiçbir metin olmasın. Her girdi satırı için tam olarak bir nesne, girdideki numara "i" alanına yazılacak:
[{"i":1,"stemCell":"SUNULDU","premium":"NA"},{"i":2,"stemCell":"SUNULMADI","premium":"SUNULDU"}]`;

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
        if (original) out.set(original.i, { ...v, i: original.i });
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
