import { describe, it, expect } from "vitest";
import {
  extractUpsellLine,
  normalizeStatus,
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
});
