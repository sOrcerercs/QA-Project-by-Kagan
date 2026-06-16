import * as XLSX from "xlsx";

export interface ParsedQaRow {
  salesOwner: string | null;
  status: string | null;
  bookingDate: string | null;
  crmId: string | null;
  customerName: string | null;
  dealStage: string | null;
  contactType: string | null;
  contactMethod: string | null;
  recentNote: string | null;
  country: string | null;
  timeFrame: string | null;
  qaNotes: string | null;
}

const HEADER_MAP: Record<string, keyof ParsedQaRow> = {
  "Sales owner": "salesOwner",
  "New Status": "status",
  "Booking Date": "bookingDate",
  "ID": "crmId",
  "Name": "customerName",
  "Deal Stage": "dealStage",
  "2nd Contact Type": "contactType",
  "contactMethod": "contactMethod",
  "Contacts Deals recent_note": "recentNote",
  "Contacts Country - Mobile": "country",
  "operation time frame": "timeFrame",
  "QA Notes": "qaNotes",
};

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  // Excel numeric ids (e.g. 22025815883) must not render in scientific/float form.
  const s = typeof v === "number" ? (Number.isInteger(v) ? v.toFixed(0) : String(v)) : String(v);
  const t = s.trim();
  return t === "" ? null : t;
}

function emptyRow(): ParsedQaRow {
  return {
    salesOwner: null, status: null, bookingDate: null, crmId: null, customerName: null,
    dealStage: null, contactType: null, contactMethod: null, recentNote: null,
    country: null, timeFrame: null, qaNotes: null,
  };
}

export function parseQaWorkbook(buffer: Buffer): ParsedQaRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel dosyasında sayfa bulunamadı.");
  const ws = wb.Sheets[sheetName];

  // Read headers from first row directly, robust to all-null data rows.
  const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
  if (headerRow.length === 0) throw new Error("Excel dosyasında başlık satırı bulunamadı.");
  const headers = (headerRow[0] as unknown[]).map((h) => (h === null || h === undefined ? "" : String(h)));

  if (!headers.includes("Name") || !headers.includes("Sales owner")) {
    throw new Error("Beklenen kolonlar bulunamadı ('Sales owner', 'Name'). Excel formatını kontrol edin.");
  }

  const records: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null });

  const rows: ParsedQaRow[] = [];
  for (const rec of records) {
    const row = emptyRow();
    for (const [header, field] of Object.entries(HEADER_MAP)) {
      if (header in rec) row[field] = str(rec[header]);
    }
    if (!row.customerName && !row.salesOwner && !row.crmId) continue;
    rows.push(row);
  }
  return rows;
}
