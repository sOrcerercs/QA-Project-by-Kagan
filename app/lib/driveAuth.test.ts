import { describe, it, expect } from "vitest";
import { isAccessTokenFresh, ACCESS_TOKEN_MARGIN_MS } from "./driveAuth";

describe("isAccessTokenFresh", () => {
  const now = 1_000_000;

  it("token hiç alınmadıysa taze değildir", () => {
    expect(isAccessTokenFresh(null, now)).toBe(false);
  });

  it("süresi geçmiş token taze değildir", () => {
    expect(isAccessTokenFresh(now - 1, now)).toBe(false);
  });

  it("bol süresi kalan token tazedir", () => {
    expect(isAccessTokenFresh(now + 30 * 60_000, now)).toBe(true);
  });

  it("payın İÇİNDE kalan token taze SAYILMAZ", () => {
    // Uzun bir indirme ortasında token'ın ölmesi, kaydın yarısında kopan
    // bir akış demek. Payı erken tazeleyerek bunu önlüyoruz.
    expect(isAccessTokenFresh(now + ACCESS_TOKEN_MARGIN_MS - 1, now)).toBe(false);
  });

  it("tam pay sınırındaki token tazedir", () => {
    expect(isAccessTokenFresh(now + ACCESS_TOKEN_MARGIN_MS, now)).toBe(true);
  });
});
