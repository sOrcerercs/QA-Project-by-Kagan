import { describe, it, expect } from "vitest";
import {
  resolveDurationMinutes,
  filterAnalyzableTranscripts,
  type FirefliesTranscript,
  type FirefliesSentence,
} from "./fireflies";

const sentence = (over: Partial<FirefliesSentence> = {}): FirefliesSentence =>
  ({ speaker_name: "Danışman", text: "Merhaba, Estenove'den arıyorum.", start_time: 0, end_time: 5, ...over }) as FirefliesSentence;

const transcript = (over: Partial<FirefliesTranscript> = {}): FirefliesTranscript => ({
  id: "t1",
  title: "Görüşme",
  date: Date.parse("2026-09-17T09:00:00.000Z"),
  duration: null,
  host_email: null,
  participants: [],
  sentences: [sentence()],
  ...over,
});

/**
 * REGRESYON. Fireflies deşifre edilmemiş bir kayıt için `sentences: null`
 * döndürüyor; tip bunu null'suz sayıyordu ve gece cron'u 13-17 Eylül 2026
 * arası her gece düştü — iki farklı yerde, hangi kaydın listede önce
 * geldiğine göre: "reading 'reduce'" ve "reading 'length'".
 *
 * Tek bir deşifresiz kayıt TÜM senkronizasyonu düşürüyordu; oysa o kaydın
 * atlanması yeterliydi.
 */
describe("deşifresiz kayıt (sentences: null)", () => {
  it("resolveDurationMinutes çökmez, null döner", () => {
    expect(resolveDurationMinutes(transcript({ sentences: null }))).toBeNull();
  });

  it("duration doluysa sentences null olsa da onu kullanır", () => {
    expect(resolveDurationMinutes(transcript({ sentences: null, duration: 7 }))).toBe(7);
  });

  it("filterAnalyzableTranscripts çökmez ve o kaydı eler", () => {
    const out = filterAnalyzableTranscripts([transcript({ id: "bos", sentences: null })]);
    expect(out).toEqual([]);
  });

  it("deşifresiz kayıt YANINDAKİ geçerli kaydı düşürmez", () => {
    // Asıl hata buydu: bir bozuk kayıt yüzünden o günün tamamı kayboluyordu.
    const uzun = Array.from({ length: 6 }, (_, i) =>
      sentence({ text: `Uzun bir cümle parçası ${i} — eşik 50 karakter.`, end_time: 200 }),
    );
    const out = filterAnalyzableTranscripts([
      transcript({ id: "bos", sentences: null }),
      transcript({ id: "saglam", sentences: uzun }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["saglam"]);
  });

  it("boş cümle dizisi de elenir", () => {
    expect(filterAnalyzableTranscripts([transcript({ sentences: [] })])).toEqual([]);
  });
});
