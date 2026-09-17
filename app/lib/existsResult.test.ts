import { describe, it, expect } from "vitest";
import { buildExistsResult } from "./existsResult";

describe("buildExistsResult", () => {
  it("bulunan id'yi true, bulunmayanı false işaretler", () => {
    const res = buildExistsResult(
      ["01AAA", "01BBB"],
      ["ff_01AAA"]
    );
    expect(res).toEqual({ "01AAA": true, "01BBB": false });
  });

  it("ff_ önekli istenen id'yi de doğru eşler (anahtar girildiği gibi kalır)", () => {
    const res = buildExistsResult(["ff_01AAA"], ["ff_01AAA"]);
    expect(res).toEqual({ "ff_01AAA": true });
  });

  it("boş istek listesi için boş obje döner", () => {
    expect(buildExistsResult([], ["ff_01AAA"])).toEqual({});
  });

  it("hiç eşleşme yoksa hepsi false", () => {
    expect(buildExistsResult(["01AAA", "01BBB"], [])).toEqual({ "01AAA": false, "01BBB": false });
  });

  it("geçersiz (boş) istenen id'yi atlar", () => {
    expect(buildExistsResult(["", "01AAA"], ["ff_01AAA"])).toEqual({ "01AAA": true });
  });
});
