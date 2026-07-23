import { describe, it, expect } from "vitest";
import { firefliesExternalCallId } from "./firefliesLink";

describe("firefliesExternalCallId", () => {
  it("ham transcript id'sini ff_ önekiyle döndürür", () => {
    expect(firefliesExternalCallId("01KY1V3VZNJZYXYFNGAPM4JV8F")).toBe("ff_01KY1V3VZNJZYXYFNGAPM4JV8F");
  });

  it("zaten ff_ önekli gelen id'yi çift öneklemez", () => {
    expect(firefliesExternalCallId("ff_01KY1V3VZNJZYXYFNGAPM4JV8F")).toBe("ff_01KY1V3VZNJZYXYFNGAPM4JV8F");
  });

  it("baştaki/sondaki boşlukları temizler", () => {
    expect(firefliesExternalCallId("  01KY1V3  ")).toBe("ff_01KY1V3");
  });

  it("boş veya whitespace girdi için null döner", () => {
    expect(firefliesExternalCallId("")).toBeNull();
    expect(firefliesExternalCallId("   ")).toBeNull();
  });

  it("sadece 'ff_' gelirse null döner (id boş)", () => {
    expect(firefliesExternalCallId("ff_")).toBeNull();
  });
});
