import { describe, it, expect } from "vitest";
import { keywordDetectCallType } from "./callTypeDetector";

describe("keywordDetectCallType", () => {
  it("classifies a solution-presenting call as SECOND_CALL even when photos are mentioned", () => {
    // The core bug: photos referenced + offer presented → must be SECOND_CALL.
    expect(
      keywordDetectCallType(
        "Based on the photos you sent on WhatsApp, we recommend the DHI technique, 3500 grafts."
      )
    ).toBe("SECOND_CALL");
  });

  it("treats a price/euro mention as SECOND_CALL even alongside whatsapp", () => {
    expect(
      keywordDetectCallType("I'll send the offer over WhatsApp, the price is 2200 euro.")
    ).toBe("SECOND_CALL");
  });

  it("classifies a photo request with no solution as FIRST_CALL", () => {
    expect(
      keywordDetectCallType(
        "Hi, before we continue could you send me photos of your head from four angles?"
      )
    ).toBe("FIRST_CALL");
  });

  it("classifies a Turkish photo request as FIRST_CALL", () => {
    expect(
      keywordDetectCallType("Saç bölgenizin fotoğraflarınızı gönderir misiniz lütfen?")
    ).toBe("FIRST_CALL");
  });

  it("does NOT call a bare photo/whatsapp mention a FIRST_CALL (escalates instead)", () => {
    // Generic mention, no request, no solution → ambiguous, not first call.
    expect(keywordDetectCallType("Yes, I received your message on WhatsApp, thank you."))
      .toBeNull();
  });

  it("returns null when neither solution nor photo-request signals appear", () => {
    expect(keywordDetectCallType("Hello, how are you today? Nice weather."))
      .toBeNull();
  });

  it("lets a solution signal win even if a photo request is also present", () => {
    expect(
      keywordDetectCallType(
        "Could you send me your photos? Also our FUE package with hotel and transfer is ready."
      )
    ).toBe("SECOND_CALL");
  });

  it("detects Turkish solution/price vocabulary", () => {
    expect(keywordDetectCallType("Size özel paket fiyatı ve ödeme planını anlatayım."))
      .toBe("SECOND_CALL");
  });
});
