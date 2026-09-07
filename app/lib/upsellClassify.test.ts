import { describe, it, expect } from "vitest";
import {
  extractUpsellLine,
  normalizeStatus,
  normalizeYesNo,
  mentionsPackage,
  applySilenceGuard,
  buildBatchPrompt,
  parseBatchResponse,
} from "./upsellClassify";

const REPORT_BASARILI = `### 🗺️ Endişe Haritası & Bütçe Analizi
* **Greft Tahmini:** 4000 greft
* **Müşteri Bütçe Beyanı:** Belirtilmedi
* **Upsell Durumu:** BAŞARILI. Stem Cell terapisi başarılı bir şekilde sunuldu ve müşteri mevcut saçlarını korumak istediğini belirtti. Premium paket de detaylıca anlatıldı.

---
### 🚨 Kritik Hata Kontrolü`;

const REPORT_GELISIM = `* **Upsell Durumu:** GELİŞİM GEREKLİ. Premium paketten bahsedildi ancak aktif bir upsell çabası gösterilmedi. Stem Cell gibi ek tedaviler sunulmadı.`;

const REPORT_PARANTEZ = `* **Upsell Durumu:** BAŞARILI (Stem Cell tedavisi, PRP'den 10 kat daha iyi olduğu vurgulanarak etkili bir şekilde sunuldu ve müşteri tarafından mantıklı bulundu.)`;

const REPORT_YOK = `📊 SATIŞ KALİTESİ DEĞERLENDİRME RAPORU
Temsilci: Ella
Genel Skor: %91`;

describe("extractUpsellLine", () => {
  it("markdown kalın işaretlerini ve iki noktayı temizler", () => {
    expect(extractUpsellLine(REPORT_BASARILI)).toBe(
      "BAŞARILI. Stem Cell terapisi başarılı bir şekilde sunuldu ve müşteri mevcut saçlarını korumak istediğini belirtti. Premium paket de detaylıca anlatıldı."
    );
  });

  it("GELİŞİM GEREKLİ biçimini de çıkarır", () => {
    expect(extractUpsellLine(REPORT_GELISIM)).toBe(
      "GELİŞİM GEREKLİ. Premium paketten bahsedildi ancak aktif bir upsell çabası gösterilmedi. Stem Cell gibi ek tedaviler sunulmadı."
    );
  });

  it("parantezli biçimi bozmadan çıkarır", () => {
    expect(extractUpsellLine(REPORT_PARANTEZ)).toContain("PRP'den 10 kat daha iyi");
  });

  it("satır yoksa null döner", () => {
    expect(extractUpsellLine(REPORT_YOK)).toBeNull();
  });

  it("boş/null girdide null döner", () => {
    expect(extractUpsellLine("")).toBeNull();
    expect(extractUpsellLine(null)).toBeNull();
    expect(extractUpsellLine(undefined)).toBeNull();
  });
});

describe("normalizeStatus", () => {
  it("geçerli değerleri tanır", () => {
    expect(normalizeStatus("SUNULDU")).toBe("SUNULDU");
    expect(normalizeStatus(" sunulmadi ")).toBe("SUNULMADI");
    expect(normalizeStatus("sunulmadı")).toBe("SUNULMADI");
    expect(normalizeStatus("NA")).toBe("NA");
    expect(normalizeStatus("N/A")).toBe("NA");
    expect(normalizeStatus("BILINMIYOR")).toBe("BILINMIYOR");
  });

  it("bilinmeyen değerde null döner", () => {
    expect(normalizeStatus("BAŞARILI")).toBeNull();
    expect(normalizeStatus("")).toBeNull();
  });
});

describe("buildBatchPrompt", () => {
  it("satırları numaralandırır", () => {
    const out = buildBatchPrompt([
      { i: 1, line: "BAŞARILI. Stem Cell sunuldu." },
      { i: 2, line: "GELİŞİM GEREKLİ. Premium sunulmadı." },
    ]);
    expect(out).toContain("1) BAŞARILI. Stem Cell sunuldu.");
    expect(out).toContain("2) GELİŞİM GEREKLİ. Premium sunulmadı.");
  });
});

describe("normalizeYesNo", () => {
  it("EVET ve HAYIR'ı tanır", () => {
    expect(normalizeYesNo("EVET")).toBe("EVET");
    expect(normalizeYesNo(" hayır ")).toBe("HAYIR");
    expect(normalizeYesNo("hayir")).toBe("HAYIR");
  });

  it("tanımadığı değerde null döner", () => {
    expect(normalizeYesNo("BELKI")).toBeNull();
    expect(normalizeYesNo("")).toBeNull();
  });
});

describe("parseBatchResponse", () => {
  it("geçerli JSON dizisini ayrıştırır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULDU","premium":"NA"},{"i":2,"stemCell":"SUNULMADI","premium":"SUNULDU"}]`;
    expect(parseBatchResponse(raw, 2)).toEqual([
      { i: 1, stemCell: "SUNULDU", premium: "NA" },
      { i: 2, stemCell: "SUNULMADI", premium: "SUNULDU" },
    ]);
  });

  it("JSON etrafındaki fazladan metni yok sayar", () => {
    const raw = "İşte sonuç:\n```json\n[{\"i\":1,\"stemCell\":\"NA\",\"premium\":\"NA\"}]\n```\nUmarım yardımcı olur.";
    expect(parseBatchResponse(raw, 1)).toEqual([{ i: 1, stemCell: "NA", premium: "NA" }]);
  });

  it("uzunluk uyuşmazlığında null döner", () => {
    const raw = `[{"i":1,"stemCell":"SUNULDU","premium":"NA"}]`;
    expect(parseBatchResponse(raw, 2)).toBeNull();
  });

  it("sözlük dışı değerde null döner", () => {
    const raw = `[{"i":1,"stemCell":"BAŞARILI","premium":"NA"}]`;
    expect(parseBatchResponse(raw, 1)).toBeNull();
  });

  it("tekrarlanan indekste null döner", () => {
    const raw = `[{"i":1,"stemCell":"NA","premium":"NA"},{"i":1,"stemCell":"NA","premium":"NA"}]`;
    expect(parseBatchResponse(raw, 2)).toBeNull();
  });

  it("bozuk JSON'da null döner", () => {
    expect(parseBatchResponse("[{ bozuk", 1)).toBeNull();
    expect(parseBatchResponse("hiç JSON yok", 1)).toBeNull();
  });

  it("geçerli parantezler içinde bozuk JSON'da null döner", () => {
    expect(parseBatchResponse("[{ bozuk }]", 1)).toBeNull();
  });

  it("string i alanında null döner", () => {
    const raw = `[{"i":"1","stemCell":"NA","premium":"NA"}]`;
    expect(parseBatchResponse(raw, 1)).toBeNull();
  });

  it("customerChosePremium alanını ayrıştırır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULMADI","premium":"SUNULDU","customerChosePremium":"EVET"}]`;
    expect(parseBatchResponse(raw, 1)?.[0].customerChosePremium).toBe("EVET");
  });

  // Alan eksik/bozuk gelirse batch reddedilmez, kural sessizce devre dışı kalır:
  // metrik bugünkü kadar sıkı kalır, veri kaybı yerine muhafazakâr davranış.
  it("customerChosePremium yoksa undefined kalır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULMADI","premium":"SUNULDU"}]`;
    expect(parseBatchResponse(raw, 1)?.[0].customerChosePremium).toBeUndefined();
  });

  it("customerChosePremium sözlük dışıysa undefined kalır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULMADI","premium":"SUNULDU","customerChosePremium":"BELKI"}]`;
    const out = parseBatchResponse(raw, 1);
    expect(out?.[0].customerChosePremium).toBeUndefined();
    expect(out?.[0].stemCell).toBe("SUNULMADI");
  });

  it("eksik i alanında null döner", () => {
    const raw = `[{"stemCell":"NA","premium":"NA"}]`;
    expect(parseBatchResponse(raw, 1)).toBeNull();
  });

  it("yanlış indeks aralığında null döner", () => {
    const raw = `[{"i":7,"stemCell":"NA","premium":"NA"},{"i":9,"stemCell":"NA","premium":"NA"}]`;
    expect(parseBatchResponse(raw, 2)).toBeNull();
  });
});

describe("parseBatchResponse — bütçe kısıtı alanı", () => {
  it("budgetConstraint alanını ayrıştırır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULMADI","premium":"SUNULMADI","budgetConstraint":"EVET"}]`;
    expect(parseBatchResponse(raw, 1)?.[0].budgetConstraint).toBe("EVET");
  });

  it("budgetConstraint yoksa undefined kalır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULMADI","premium":"SUNULMADI"}]`;
    expect(parseBatchResponse(raw, 1)?.[0].budgetConstraint).toBeUndefined();
  });

  it("customerFixedChoice alanını ayrıştırır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULMADI","premium":"SUNULMADI","customerFixedChoice":"EVET"}]`;
    expect(parseBatchResponse(raw, 1)?.[0].customerFixedChoice).toBe("EVET");
  });

  it("customerFixedChoice yoksa undefined kalır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULMADI","premium":"SUNULMADI"}]`;
    expect(parseBatchResponse(raw, 1)?.[0].customerFixedChoice).toBeUndefined();
  });

  it("customerFixedChoice sözlük dışıysa batch reddedilmez, alan undefined kalır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULMADI","premium":"SUNULMADI","customerFixedChoice":"BELKI"}]`;
    const out = parseBatchResponse(raw, 1);
    expect(out).not.toBeNull();
    expect(out?.[0].customerFixedChoice).toBeUndefined();
  });

  it("iki ek alanı birlikte ayrıştırır", () => {
    const raw = `[{"i":1,"stemCell":"SUNULMADI","premium":"SUNULDU","customerChosePremium":"EVET","budgetConstraint":"HAYIR","customerFixedChoice":"EVET"}]`;
    const out = parseBatchResponse(raw, 1)?.[0];
    expect(out?.customerChosePremium).toBe("EVET");
    expect(out?.budgetConstraint).toBe("HAYIR");
    expect(out?.customerFixedChoice).toBe("EVET");
  });
});

describe("mentionsPackage", () => {
  it("Premium adı geçiyorsa true", () => {
    expect(mentionsPackage("Premium paket sunulmadı.", "premium")).toBe(true);
  });

  it("Premium hiç geçmiyorsa false", () => {
    expect(mentionsPackage("BAŞARILI (Stem Cell tedavisi detaylıca açıklandı.)", "premium")).toBe(false);
  });

  it("Stem Cell yazımlarını tanır", () => {
    expect(mentionsPackage("stem cell sunuldu", "stemCell")).toBe(true);
    expect(mentionsPackage("StemCell sunuldu", "stemCell")).toBe(true);
    expect(mentionsPackage("kök hücre tedavisi anlatıldı", "stemCell")).toBe(true);
  });

  // Advanced paket Stem Cell içeriyor: adı geçmese de "bahsedilmiş" sayılır,
  // yoksa sessizlik koruması yanlışlıkla devreye girer.
  it("Advanced paketi Stem Cell bahsi sayar", () => {
    expect(mentionsPackage("Advanced paket anlatıldı", "stemCell")).toBe(true);
  });

  it("boş satırda false", () => {
    expect(mentionsPackage("", "premium")).toBe(false);
  });
});

describe("applySilenceGuard", () => {
  const v = { i: 1, stemCell: "SUNULMADI" as const, premium: "SUNULMADI" as const };

  it("bahsi geçmeyen SUNULMADI'yı BILINMIYOR yapar", () => {
    const out = applySilenceGuard(v, "BAŞARILI (Stem Cell tedavisi sunuldu.)");
    expect(out.premium).toBe("BILINMIYOR");
    expect(out.stemCell).toBe("SUNULMADI"); // stem cell açıkça geçiyor
  });

  it("bahsi geçen SUNULMADI'ya dokunmaz", () => {
    const out = applySilenceGuard(v, "Stem Cell veya Premium paket sunulmadı.");
    expect(out.stemCell).toBe("SUNULMADI");
    expect(out.premium).toBe("SUNULMADI");
  });

  // Koruma yalnızca SUNULMADI için: SUNULDU/NA modelin olumlu bir kararı,
  // sessizlik gerekçesiyle silinmemeli.
  it("SUNULDU ve NA kararlarına dokunmaz", () => {
    const out = applySilenceGuard(
      { i: 1, stemCell: "SUNULDU", premium: "NA" },
      "BAŞARILI (kök hücre sunuldu.)"
    );
    expect(out.stemCell).toBe("SUNULDU");
    expect(out.premium).toBe("NA");
  });

  it("diğer alanları korur", () => {
    const out = applySilenceGuard({ ...v, budgetConstraint: "EVET" }, "Stem Cell sunuldu.");
    expect(out.budgetConstraint).toBe("EVET");
    expect(out.i).toBe(1);
  });
});
