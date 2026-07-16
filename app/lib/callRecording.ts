// Kriko deal-audio manifest'i deal'deki HER çağrı için bir kayıt döndürür
// (recordings[]), her biri call_id ile. Çok-çağrılı deal'de doğru sesi seçmek için
// değerlendirmenin externalCallId'siyle eşleşen kaydı seç; bulunamazsa ilk kayda düş.
export function pickCallRecording<T extends { call_id?: string }>(
  recordings: T[] | undefined | null,
  externalCallId: string | null | undefined,
): T | undefined {
  if (!recordings || recordings.length === 0) return undefined;
  if (externalCallId) {
    const match = recordings.find((r) => r.call_id === externalCallId);
    if (match) return match;
  }
  return recordings[0];
}
