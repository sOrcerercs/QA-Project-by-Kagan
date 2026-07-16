import { describe, it, expect } from "vitest";
import { pickCallRecording } from "./callRecording";

const recs = [
  { call_id: "1dfdfd4c", download_url: "harun.mp3" },
  { call_id: "12a2dbbd", download_url: "begum.mp3" },
];

describe("pickCallRecording", () => {
  it("externalCallId ile eşleşen kaydı seçer", () => {
    expect(pickCallRecording(recs, "12a2dbbd")?.download_url).toBe("begum.mp3");
    expect(pickCallRecording(recs, "1dfdfd4c")?.download_url).toBe("harun.mp3");
  });
  it("eşleşme yoksa ilk kayda düşer", () => {
    expect(pickCallRecording(recs, "yok")?.download_url).toBe("harun.mp3");
  });
  it("externalCallId null/undefined → ilk kayıt", () => {
    expect(pickCallRecording(recs, null)?.download_url).toBe("harun.mp3");
    expect(pickCallRecording(recs, undefined)?.download_url).toBe("harun.mp3");
  });
  it("boş/undefined dizi → undefined", () => {
    expect(pickCallRecording([], "12a2dbbd")).toBeUndefined();
    expect(pickCallRecording(undefined, "12a2dbbd")).toBeUndefined();
  });
});
