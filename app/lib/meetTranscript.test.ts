import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseMeetTranscript,
  formatBlockRange,
  resolveMeetRoles,
  buildMeetTranscriptText,
  classifyMeetTranscript,
} from "./meetTranscript";

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

describe("formatBlockRange", () => {
  it("MM:SS–MM:SS biçimi üretir", () => {
    expect(formatBlockRange(0, 300)).toBe("00:00–05:00");
    expect(formatBlockRange(300, 600)).toBe("05:00–10:00");
  });

  it("60 dakikayı aşan çağrıda dakika büyür", () => {
    expect(formatBlockRange(3900, 4200)).toBe("65:00–70:00");
  });

  it("saniye artığını korur", () => {
    expect(formatBlockRange(600, 750)).toBe("10:00–12:30");
  });
});

describe("resolveMeetRoles", () => {
  it("tam eşleşen katılımcıyı danışman sayar", () => {
    const r = resolveMeetRoles(["Mavican Tekuz", "Mohammed Alkhalid"], "Mavican Tekuz");
    expect(r).toEqual({ agentAttendee: "Mavican Tekuz", customerAttendee: "Mohammed Alkhalid" });
  });

  it("katılımcı sırası ters olsa da bulur", () => {
    const r = resolveMeetRoles(["Mohammed Alkhalid", "Mavican Tekuz"], "Mavican Tekuz");
    expect(r!.agentAttendee).toBe("Mavican Tekuz");
  });

  it("DB'deki resmî tam adı kısmi eşleştirir", () => {
    // DB: "Makbule Sinem Bulur" — Meet katılımcı listesi: "Sinem Bulur"
    const r = resolveMeetRoles(["Sinem Bulur", "John Doe"], "Makbule Sinem Bulur");
    expect(r!.agentAttendee).toBe("Sinem Bulur");
  });

  it("Türkçe I ve ks/x katlamasını uygular", () => {
    const r = resolveMeetRoles(["Aleksandra Boyko", "Jane Roe"], "Alexandra Boyko");
    expect(r!.agentAttendee).toBe("Aleksandra Boyko");
  });

  it("tek kelimelik MÜŞTERİ adı danışman rolünü KAPMAZ", () => {
    // allowSingleWord kapalı olmasa "Livia" müşterisi "Livia Goga" ile eşleşirdi.
    const r = resolveMeetRoles(["Livia Goga", "Livia"], "Livia Goga");
    expect(r!.agentAttendee).toBe("Livia Goga");
    expect(r!.customerAttendee).toBe("Livia");
  });

  it("hiçbir katılımcı eşleşmezse null döner", () => {
    expect(resolveMeetRoles(["Ali Veli", "Ayse Fatma"], "Mavican Tekuz")).toBeNull();
  });

  it("iki katılımcı da eşleşirse null döner", () => {
    expect(resolveMeetRoles(["Mavican Tekuz", "Mavican Tekuz"], "Mavican Tekuz")).toBeNull();
  });

  it("katılımcı sayısı 2 değilse null döner", () => {
    expect(resolveMeetRoles(["Mavican Tekuz"], "Mavican Tekuz")).toBeNull();
    expect(resolveMeetRoles(["Mavican Tekuz", "A B", "C D"], "Mavican Tekuz")).toBeNull();
  });
});

describe("buildMeetTranscriptText", () => {
  it("Kriko'nun şekliyle aynı satırlar üretir", () => {
    const text = buildMeetTranscriptText(
      [
        { speaker: "Mavican Tekuz", text: "Hello?", blockStartSec: 0, blockEndSec: 300 },
        { speaker: "Mohammed Alkhalid", text: "Hi.", blockStartSec: 300, blockEndSec: 600 },
      ],
      { agentAttendee: "Mavican Tekuz", customerAttendee: "Mohammed Alkhalid" },
    );
    expect(text).toBe(
      "Agent [00:00–05:00]: Hello?\nCustomer [05:00–10:00]: Hi.",
    );
  });

  it("tanınmayan konuşmacıyı Customer sayar", () => {
    const text = buildMeetTranscriptText(
      [{ speaker: "Bilinmeyen Kisi", text: "hm", blockStartSec: 0, blockEndSec: 300 }],
      { agentAttendee: "Mavican Tekuz", customerAttendee: "Mohammed Alkhalid" },
    );
    expect(text).toBe("Customer [00:00–05:00]: hm");
  });
});

describe("classifyMeetTranscript", () => {
  const ok = {
    attendees: ["Mavican Tekuz", "Mohammed Alkhalid"],
    durationSec: 1501,
    utterances: [
      {
        speaker: "Mavican Tekuz",
        text: "Hello Mohammed, this is a long enough sentence to pass the fifty character gate.",
        blockStartSec: 0,
        blockEndSec: 300,
      },
    ],
  };

  it("geçerli transkripti kabul eder", () => {
    const r = classifyMeetTranscript(ok, "Mavican Tekuz");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toContain("Agent [00:00–05:00]:");
  });

  it("katılımcı sayısı 2 değilse attendee_count", () => {
    const r = classifyMeetTranscript({ ...ok, attendees: ["A B", "C D", "E F"] }, "Mavican Tekuz");
    expect(r).toEqual({ ok: false, reason: "attendee_count" });
  });

  it("rol belirsizse agent_role_ambiguous", () => {
    const r = classifyMeetTranscript({ ...ok, attendees: ["A B", "C D"] }, "Mavican Tekuz");
    expect(r).toEqual({ ok: false, reason: "agent_role_ambiguous" });
  });

  it("süre 120 saniyeden kısaysa too_short", () => {
    const r = classifyMeetTranscript({ ...ok, durationSec: 90 }, "Mavican Tekuz");
    expect(r).toEqual({ ok: false, reason: "too_short" });
  });

  it("süre null ise süre kontrolünü ATLAR", () => {
    const r = classifyMeetTranscript({ ...ok, durationSec: null }, "Mavican Tekuz");
    expect(r.ok).toBe(true);
  });

  it("metin 50 karakterden kısaysa too_short_text", () => {
    const r = classifyMeetTranscript(
      { ...ok, utterances: [{ ...ok.utterances[0], text: "hi" }] },
      "Mavican Tekuz",
    );
    expect(r).toEqual({ ok: false, reason: "too_short_text" });
  });
});
