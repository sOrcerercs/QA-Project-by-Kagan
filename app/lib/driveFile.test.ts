import { describe, it, expect } from "vitest";
import { driveViewUrl, extractDriveFileId } from "./driveFile";

describe("driveViewUrl / extractDriveFileId", () => {
  const id = "1_S696Z5UxB6hwxs43aCyLjhUjx6j6aFV";

  it("ürettiği URL'den kimliği geri okur", () => {
    expect(extractDriveFileId(driveViewUrl(id))).toBe(id);
  });

  it("Drive'ın kendi paylaşım bağlantısını da okur", () => {
    expect(extractDriveFileId(`https://drive.google.com/file/d/${id}/view?usp=drivesdk`)).toBe(id);
  });

  it("Kriko manifest URL'inden kimlik ÇIKARMAZ", () => {
    // Yanlışlıkla Kriko kaydını Drive'dan çekmeye çalışmak, anlamsız bir
    // 404'ten daha kötü olurdu: hangi kaynağın bozuk olduğu belirsizleşirdi.
    expect(extractDriveFileId("https://api.kriko.io/recordings/abc123")).toBe(null);
  });

  it("boş/eksik değerde null döner", () => {
    expect(extractDriveFileId(null)).toBe(null);
    expect(extractDriveFileId("")).toBe(null);
    expect(extractDriveFileId("saçma")).toBe(null);
  });
});
