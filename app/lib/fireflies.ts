// Fireflies.ai GraphQL API client (server-side only)
// API: https://api.fireflies.ai/graphql

export interface FirefliesSentence {
  speaker_name: string;
  text: string;
  start_time: number;
  end_time: number;
}

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;        // ISO datetime string
  duration: number;    // dakika cinsinden
  host_email: string | null;
  participants: string[];  // email adresleri
  sentences: FirefliesSentence[];
}

const FIREFLIES_ENDPOINT = "https://api.fireflies.ai/graphql";

const TRANSCRIPTS_QUERY = `
  query Transcripts($fromDate: String, $toDate: String) {
    transcripts(fromDate: $fromDate, toDate: $toDate) {
      id
      title
      date
      duration
      host_email
      participants
      sentences {
        speaker_name
        text
        start_time
        end_time
      }
    }
  }
`;

export function isFirefliesConfigured(): boolean {
  return !!process.env.FIREFLIES_API_KEY;
}

export async function fetchTranscriptsByDate(date: string): Promise<FirefliesTranscript[]> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) throw new Error("FIREFLIES_API_KEY eksik.");

  const res = await fetch(FIREFLIES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: TRANSCRIPTS_QUERY,
      variables: { fromDate: date, toDate: date },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Fireflies API hatası: ${res.status} ${res.statusText} — ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Fireflies GraphQL hatası: ${JSON.stringify(json.errors).slice(0, 200)}`);
  }

  if (!json.data?.transcripts) {
    throw new Error("Fireflies API yanıtında 'data.transcripts' yok.");
  }
  return json.data.transcripts as FirefliesTranscript[];
}

export function filterAnalyzableTranscripts(
  transcripts: FirefliesTranscript[],
  minDurationMinutes = 2
): FirefliesTranscript[] {
  return transcripts.filter(t =>
    t.duration >= minDurationMinutes &&
    t.sentences.length > 0 &&
    buildTranscriptText(t.sentences).trim().length > 50
  );
}

export function buildTranscriptText(sentences: FirefliesSentence[]): string {
  return sentences.map(s => `${s.speaker_name}: ${s.text}`).join("\n");
}

export function extractSpeakerNames(sentences: FirefliesSentence[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const s of sentences) {
    if (s.speaker_name && !seen.has(s.speaker_name)) {
      seen.add(s.speaker_name);
      names.push(s.speaker_name);
    }
  }
  return names;
}

/** Dakika (float) → "MM:SS" */
export function formatFirefliesDuration(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
