/**
 * Meet kaydının Drive kimliği `Evaluation.recordingUrl` içinde, insanın da
 * açabileceği bir bağlantı olarak saklanıyor.
 *
 * NEDEN ÇIPLAK ID DEĞİL: kolonun adı `recordingUrl` ve Kriko oraya gerçek
 * bir URL yazıyor. Aynı kolona bir kaynakta URL, diğerinde çıplak kimlik
 * koymak, veritabanına bakan herkesi yanıltır. Bağlantı olarak saklamak
 * ayrıca kaydı Drive'da açmayı da bedava veriyor.
 */

const DRIVE_FILE_RE = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})(?:\/|$|\?)/;

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** Drive bağlantısından dosya kimliği; Drive bağlantısı değilse null. */
export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  return DRIVE_FILE_RE.exec(url)?.[1] ?? null;
}
