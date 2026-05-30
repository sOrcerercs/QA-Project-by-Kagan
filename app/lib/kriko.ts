// Kriko Call Recording API client (server-side only)
// API: https://call.kriko.com.tr/api/calls?date=YYYY-MM-DD

export interface KrikoCustomer {
  call_count: number;
  id: string;
  name: string | null;
  status: string | null;
  location: string | null;
  source: string | null;
  email: string | null;
  language: string | null;
  phone_number: string | null;
  first_contact_at: string | null;
  last_contact_at: string | null;
}

export interface KrikoTranscript {
  source: string;     // "deepgram"
  language: string;
  content: string;    // Konuşmacı + zaman damgalı düz metin
}

export interface KrikoCall {
  id: string;
  status: "pending" | "completed" | string;
  title: string;
  external_id: string;
  provider: string;                    // freshcaller, twilio, ...
  account_name: string | null;
  agent_name: string | null;
  call_date: string;                   // ISO
  customer_name: string | null;
  customer_phone_number: string | null;
  deal_id: string | null;
  deal_value: number | null;
  duration_seconds: number;
  customer: KrikoCustomer | null;
  transcript: KrikoTranscript | null;  // null when status="pending"
  analysis: any[];
  qas: any[];
  // Recording URL'si Kriko ekleyince burada belirir:
  recording_url?: string;
}

export interface KrikoCallsResponse {
  call_count: number;
  date: string;
  calls: KrikoCall[];
}

/** Yapılandırma kontrolü */
export function isKrikoConfigured(): boolean {
  return !!process.env.KRIKO_API_KEY && !!process.env.KRIKO_API_BASE;
}

/** Belirli bir tarihteki tüm çağrıları getir (YYYY-MM-DD) */
export async function fetchCallsByDate(date: string): Promise<KrikoCallsResponse> {
  const apiKey = process.env.KRIKO_API_KEY;
  const base = process.env.KRIKO_API_BASE;

  if (!apiKey || !base) {
    throw new Error("Kriko API yapılandırması eksik (.env.local içinde KRIKO_API_KEY ve KRIKO_API_BASE).");
  }

  const url = `${base}/api/calls?date=${encodeURIComponent(date)}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Kriko API hatası: ${res.status} ${res.statusText} — ${txt.slice(0, 200)}`);
  }

  // Ham byte'ları al — res.json() geçersiz byte'ları U+FFFD ile ezer, bilgi kaybolur.
  const buffer = await res.arrayBuffer();

  // UTF-8 ile dene
  let text = new TextDecoder("utf-8").decode(buffer);
  let data: KrikoCallsResponse = JSON.parse(text);

  // Türkçe karakter bozukluğu varsa (⍰ = U+FFFD) Windows-1254 ile yeniden decode et
  const hasCorruption = data.calls.some(
    (c) => c.agent_name?.includes("�") || c.customer_name?.includes("�")
  );
  if (hasCorruption) {
    text = new TextDecoder("windows-1254").decode(buffer);
    data = JSON.parse(text);
  }

  return data;
}

/** Filtre: transkript var + duration >= 120s (2 dakika). Kriko statüyü "completed" olarak işaretlemediğinden status kontrolü yok. */
export function filterAnalyzableCalls(calls: KrikoCall[], minDurationSec = 120): KrikoCall[] {
  return calls.filter(c =>
    c.duration_seconds >= minDurationSec &&
    c.transcript?.content &&
    c.transcript.content.trim().length > 50
  );
}

/** MM:SS biçimine çevir (örn. 582 → "9:42") */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** YYYY-MM-DD biçiminde bugünün tarihi (Turkey TZ) */
export function todayInTR(): string {
  const now = new Date();
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return tr.toISOString().slice(0, 10);
}

/** YYYY-MM-DD biçiminde dünün tarihi (Turkey TZ). Kriko transkriptleri bir gün gecikmeyle tamamlıyor. */
export function yesterdayInTR(): string {
  const now = new Date();
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000 - 86400000);
  return tr.toISOString().slice(0, 10);
}

