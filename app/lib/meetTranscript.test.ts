import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMeetTranscript } from "./meetTranscript";

const synthetic = readFileSync(
  join(__dirname, "__fixtures__/meet-transcript-synthetic.txt"),
  "utf8",
);

describe("parseMeetTranscript", () => {
  it("katılımcıları okur", () => {
    const p = parseMeetTranscript(synthetic);
    expect(p.attendees).toEqual(["Mavican Tekuz", "Test Customer"]);
  });

  it("süreyi saniyeye çevirir", () => {
    expect(parseMeetTranscript(synthetic).durationSec).toBe(750); // 12*60+30
  });

  it("süre satırı yoksa null döner", () => {
    const p = parseMeetTranscript("Attendees\nA, B\nTranscript\nA: hi\n");
    expect(p.durationSec).toBeNull();
  });

  it("ilk bloğu 00:00–05:00 olarak damgalar", () => {
    const first = parseMeetTranscript(synthetic).utterances[0];
    expect(first.speaker).toBe("Mavican Tekuz");
    expect(first.blockStartSec).toBe(0);
    expect(first.blockEndSec).toBe(300);
  });

  it("orta bloğu iki damga arasına yerleştirir", () => {
    const u = parseMeetTranscript(synthetic).utterances.find(
      x => x.text === "Yes I can.",
    )!;
    expect(u.blockStartSec).toBe(300);
    expect(u.blockEndSec).toBe(600);
  });

  it("son bloğun sonunu süreden alır", () => {
    const u = parseMeetTranscript(synthetic).utterances.find(
      x => x.text === "Understood.",
    )!;
    expect(u.blockStartSec).toBe(600);
    expect(u.blockEndSec).toBe(750);
  });

  it("süre yoksa son bloğu +5 dakika ile kapatır", () => {
    const raw = "Attendees\nA, B\nTranscript\n00:05:00\nA: hi\n";
    const u = parseMeetTranscript(raw).utterances[0];
    expect(u.blockStartSec).toBe(300);
    expect(u.blockEndSec).toBe(600);
  });

  it("ön eksiz satırı önceki konuşmaya birleştirir", () => {
    const u = parseMeetTranscript(synthetic).utterances.find(
      x => x.speaker === "Mavican Tekuz" && x.text.startsWith("Great."),
    )!;
    expect(u.text).toBe("Great. Let me introduce myself. I am a medical advisor here.");
  });

  it("markdown vurgusu ve başlık işaretlerini yok sayar", () => {
    const raw = [
      "## **Başlık - Transcript**",
      "# **Attendees**",
      "Ali Veli, Müşteri Kişi",
      "# **Transcript**",
      "Ali Veli: merhaba",
      "### 00:05:00",
      "Müşteri Kişi: selam",
      "### Meeting ended after 00:06:00",
    ].join("\n");
    const p = parseMeetTranscript(raw);
    expect(p.attendees).toEqual(["Ali Veli", "Müşteri Kişi"]);
    expect(p.durationSec).toBe(360);
    expect(p.utterances).toHaveLength(2);
  });

  it("üç katılımcıyı olduğu gibi döner (filtre çağıranın işi)", () => {
    const raw = "Attendees\nA Bir, B İki, C Üç\nTranscript\nA Bir: hi\n";
    expect(parseMeetTranscript(raw).attendees).toHaveLength(3);
  });
});
