import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseQaWorkbook } from "./qaReportParse";

function makeBook(rows: any[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const HEADERS = ["Sales owner","New Status","Booking Date","ID","Name","Deal Stage","2nd Contact Type","contactMethod","Contacts Deals recent_note","Contacts Country - Mobile","operation time frame","Call Record","QA Notes"];

describe("parseQaWorkbook", () => {
  it("maps headers to fields and imports QA Notes", () => {
    const buf = makeBook([
      HEADERS,
      ["Emir Özdemir","completed","11.06.2026 0:00",22025815883,"Sofonias Biramo","Second Contact & Quote","Video call","Google Meet","note here","US","12+ Months","✅","good tone"],
    ]);
    const rows = parseQaWorkbook(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].salesOwner).toBe("Emir Özdemir");
    expect(rows[0].customerName).toBe("Sofonias Biramo");
    expect(rows[0].crmId).toBe("22025815883");
    expect(rows[0].qaNotes).toBe("good tone");
  });

  it("skips empty rows and throws on missing required headers", () => {
    const buf = makeBook([HEADERS, [null,null,null,null,null,null,null,null,null,null,null,null,null]]);
    expect(parseQaWorkbook(buf)).toHaveLength(0);
    const bad = makeBook([["Foo","Bar"],["a","b"]]);
    expect(() => parseQaWorkbook(bad)).toThrow();
  });
});
