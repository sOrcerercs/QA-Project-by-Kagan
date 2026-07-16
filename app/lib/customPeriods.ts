export interface DateRange { start: string; end: string; }

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// "s1:e1,s2:e2[,s3:e3][,s4:e4]" → en fazla 4 geçerli aralık (biçim + start<=end).
export function parseCustomRanges(param: string | null | undefined): DateRange[] {
  if (!param) return [];
  const out: DateRange[] = [];
  for (const seg of param.split(",")) {
    const [start, end] = seg.split(":").map((s) => s.trim());
    if (!ISO.test(start ?? "") || !ISO.test(end ?? "")) continue;
    if (start > end) continue;
    out.push({ start, end });
    if (out.length === 4) break;
  }
  return out;
}
