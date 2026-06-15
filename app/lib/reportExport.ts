// Weekly report PDF export — text/table based (jsPDF), NOT an html2canvas
// snapshot. html2canvas cannot parse Tailwind v4's oklch() colors and silently
// throws, so we render real text + tables here, mirroring evaluationExport.ts.
// Paginates natively and embeds DejaVuSans so Turkish ş/ğ/ı/İ render.

import { registerPdfFont, slugifyFilename } from "@/app/lib/evaluationExport";
import { translations } from "@/app/lib/i18n";

type Lang = "tr" | "en";

export interface ReportData {
  consultantPerformance: {
    agentId: string; name: string; calls: number; healthScore: number;
    byPrompt: { promptId: string; promptName: string; avgScore: number; count: number }[];
  }[];
  promptColumns: { promptId: string; promptName: string }[];
  dailyCallBreakdown: { date: string; firstCall: number; secondCall: number }[];
  callDurations: { name: string; calls: number; totalDuration: string; avgDuration: string }[];
  teamDistribution: { team: string; totalCalls: number; firstCall: number; secondCall: number }[];
  consultantCallDistribution: { name: string; totalCalls: number; firstCall: number; secondCall: number }[];
  unlistenedConsultants: { name: string; team: string }[];
  summary: { totalEvaluations: number; totalSecondCalls: number; avgScore: number; highPotential: number; atRisk: number };
}

export interface ReportPeriod { start?: string; end?: string }

interface Col { header: string; width: number; align?: "left" | "right" }

const MARGIN = 14;
const ACCENT: [number, number, number] = [29, 78, 216];
const DARK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [107, 114, 128];
const RULE: [number, number, number] = [220, 222, 226];

function fmtDate(d: string | undefined, lang: Lang): string {
  if (!d) return "…";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "…";
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR");
}

// pt → mm with line spacing
const lineHeight = (sizePt: number) => sizePt * 0.3528 * 1.25;

export async function downloadReportPdf(
  data: ReportData,
  period: ReportPeriod | null,
  lang: Lang,
  filename?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const font = await registerPdfFont(doc);
  const t: any = translations[lang];

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - MARGIN * 2;
  const bottom = pageH - MARGIN;
  const state = { y: MARGIN };

  const ensure = (h: number) => {
    if (state.y + h > bottom) { doc.addPage(); state.y = MARGIN; }
  };

  const heading = (text: string, sub?: string) => {
    ensure(14);
    state.y += 3;
    doc.setFont(font, "bold");
    doc.setFontSize(12);
    doc.setTextColor(...ACCENT);
    doc.text(text, MARGIN, state.y);
    state.y += lineHeight(12);
    if (sub) {
      doc.setFont(font, "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(sub, MARGIN, state.y);
      state.y += lineHeight(8.5);
    }
    state.y += 1.5;
  };

  // Generic table renderer with header fill, cell wrapping, row separators and
  // automatic pagination (header repeats on each new page).
  const table = (cols: Col[], rows: string[][]) => {
    const bodySize = 8.5;
    const lh = lineHeight(bodySize);
    const padX = 2;
    const padY = 1.3;
    const totalW = cols.reduce((a, c) => a + c.width, 0);

    const drawHeader = () => {
      const h = lh + padY * 2;
      ensure(h + lh); // header + at least one body line
      doc.setFillColor(...ACCENT);
      doc.rect(MARGIN, state.y, totalW, h, "F");
      doc.setFont(font, "bold");
      doc.setFontSize(bodySize);
      doc.setTextColor(255, 255, 255);
      let x = MARGIN;
      for (const c of cols) {
        const right = c.align === "right";
        doc.text(c.header, right ? x + c.width - padX : x + padX, state.y + padY + lh * 0.78, {
          align: right ? "right" : "left",
        });
        x += c.width;
      }
      state.y += h;
    };

    drawHeader();

    for (const row of rows) {
      const wrapped = cols.map((c, i) => doc.splitTextToSize(String(row[i] ?? ""), c.width - padX * 2) as string[]);
      const lines = Math.max(1, ...wrapped.map((w) => w.length));
      const h = lines * lh + padY * 2;
      if (state.y + h > bottom) { doc.addPage(); state.y = MARGIN; drawHeader(); }
      doc.setFont(font, "normal");
      doc.setFontSize(bodySize);
      doc.setTextColor(...DARK);
      let x = MARGIN;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        const right = c.align === "right";
        let ty = state.y + padY + lh * 0.78;
        for (const ln of wrapped[i]) {
          doc.text(ln, right ? x + c.width - padX : x + padX, ty, { align: right ? "right" : "left" });
          ty += lh;
        }
        x += c.width;
      }
      state.y += h;
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.1);
      doc.line(MARGIN, state.y, MARGIN + totalW, state.y);
    }
    state.y += 2;
  };

  // ── Title + period ────────────────────────────────────────────────
  doc.setFont(font, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text(t.haftalikRapor ?? "Haftalık Değerlendirme Raporu", MARGIN, state.y + 4);
  state.y += 4 + lineHeight(16);
  if (period) {
    doc.setFont(font, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(`${fmtDate(period.start, lang)} — ${fmtDate(period.end, lang)}`, MARGIN, state.y);
    state.y += lineHeight(9.5);
  }
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, state.y + 1, pageW - MARGIN, state.y + 1);
  state.y += 4;

  // ── Summary ───────────────────────────────────────────────────────
  const s = data.summary;
  table(
    [
      { header: t.totalEval ?? "Toplam", width: maxW * 0.24, align: "right" },
      { header: "Second Call", width: maxW * 0.19, align: "right" },
      { header: t.avgScoreLbl ?? "Ort. Skor", width: maxW * 0.19, align: "right" },
      { header: t.highPotential ?? "Yüksek Potansiyel", width: maxW * 0.19, align: "right" },
      { header: t.atRisk ?? "Riskli", width: maxW * 0.19, align: "right" },
    ],
    [[String(s.totalEvaluations), String(s.totalSecondCalls), `%${s.avgScore}`, String(s.highPotential), String(s.atRisk)]],
  );

  // ── Daily call breakdown ──────────────────────────────────────────
  if (data.dailyCallBreakdown.length) {
    heading(t.dailyCallDist ?? "Günlük Çağrı Dağılımı");
    table(
      [
        { header: t.dateLabel ?? "Tarih", width: maxW * 0.4 },
        { header: "First Call", width: maxW * 0.2, align: "right" },
        { header: "Second Call", width: maxW * 0.2, align: "right" },
        { header: t.total ?? "Toplam", width: maxW * 0.2, align: "right" },
      ],
      data.dailyCallBreakdown.map((d) => [d.date, String(d.firstCall), String(d.secondCall), String(d.firstCall + d.secondCall)]),
    );
  }

  // ── Consultant performance (dynamic prompt columns) ───────────────
  if (data.consultantPerformance.length) {
    heading(t.consultantPerfScores ?? "Danışman Performansı", t.healthScoreAndCalls);
    const nameW = 46;
    const healthW = 22;
    const promptCols = data.promptColumns;
    const promptW = promptCols.length ? Math.max(18, (maxW - nameW - healthW) / promptCols.length) : 0;
    const cols: Col[] = [
      { header: t.consultant ?? "Danışman", width: nameW },
      ...promptCols.map((p) => ({ header: p.promptName, width: promptW, align: "right" as const })),
      { header: t.statusCol ?? "Skor", width: healthW, align: "right" as const },
    ];
    const rows = [...data.consultantPerformance]
      .sort((a, b) => b.healthScore - a.healthScore)
      .map((c) => {
        const byId = new Map(c.byPrompt.map((p) => [p.promptId, p]));
        return [
          c.name,
          ...promptCols.map((pc) => {
            const ps = byId.get(pc.promptId);
            return ps ? `%${ps.avgScore} (${ps.count})` : "—";
          }),
          `%${c.healthScore}`,
        ];
      });
    table(cols, rows);
  }

  // ── Call durations ────────────────────────────────────────────────
  if (data.callDurations.length) {
    heading(t.consultantCallDurationsTitle ?? "Çağrı Süreleri");
    table(
      [
        { header: t.consultant ?? "Danışman", width: maxW * 0.4 },
        { header: t.callsCol ?? "Çağrı", width: maxW * 0.2, align: "right" },
        { header: t.totalDurationCol ?? "Toplam Süre", width: maxW * 0.2, align: "right" },
        { header: t.avgDurationCol ?? "Ort. Süre", width: maxW * 0.2, align: "right" },
      ],
      data.callDurations.map((d) => [d.name, String(d.calls), d.totalDuration, d.avgDuration]),
    );
  }

  // ── Team distribution (with totals row) ───────────────────────────
  if (data.teamDistribution.length) {
    heading(t.teamCallDist ?? "Takım Dağılımı");
    const rows = data.teamDistribution.map((d) => [d.team, String(d.totalCalls), String(d.firstCall), String(d.secondCall)]);
    const tot = data.teamDistribution.reduce(
      (a, d) => ({ totalCalls: a.totalCalls + d.totalCalls, firstCall: a.firstCall + d.firstCall, secondCall: a.secondCall + d.secondCall }),
      { totalCalls: 0, firstCall: 0, secondCall: 0 },
    );
    rows.push([(t.total ?? "TOPLAM").toString().toUpperCase(), String(tot.totalCalls), String(tot.firstCall), String(tot.secondCall)]);
    table(
      [
        { header: t.teamCol ?? "Takım", width: maxW * 0.4 },
        { header: t.total ?? "Toplam", width: maxW * 0.2, align: "right" },
        { header: "First Call", width: maxW * 0.2, align: "right" },
        { header: "Second Call", width: maxW * 0.2, align: "right" },
      ],
      rows,
    );
  }

  // ── Consultant call distribution ──────────────────────────────────
  if (data.consultantCallDistribution.length) {
    heading(t.consultantCallDist ?? "Danışman Çağrı Dağılımı");
    table(
      [
        { header: t.consultant ?? "Danışman", width: maxW * 0.4 },
        { header: t.total ?? "Toplam", width: maxW * 0.2, align: "right" },
        { header: "First Call", width: maxW * 0.2, align: "right" },
        { header: "Second Call", width: maxW * 0.2, align: "right" },
      ],
      [...data.consultantCallDistribution]
        .sort((a, b) => b.totalCalls - a.totalCalls)
        .map((c) => [c.name, String(c.totalCalls), String(c.firstCall), String(c.secondCall)]),
    );
  }

  // ── Unlistened consultants ────────────────────────────────────────
  if (data.unlistenedConsultants.length) {
    heading(t.unlistenedTitle ?? "Dinlenmeyen Danışmanlar", t.unlistenedSub);
    table(
      [
        { header: t.consultant ?? "Danışman", width: maxW * 0.6 },
        { header: t.teamCol ?? "Takım", width: maxW * 0.4 },
      ],
      data.unlistenedConsultants.map((c) => [c.name, c.team]),
    );
    ensure(8);
    doc.setFont(font, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    const countLine = typeof t.unlistenedCount === "function"
      ? t.unlistenedCount(data.unlistenedConsultants.length)
      : `${data.unlistenedConsultants.length}`;
    doc.text(String(countLine), MARGIN, state.y);
    state.y += lineHeight(8.5);
  }

  const base = filename || `haftalik_rapor_${slugifyFilename(fmtDate(period?.start, lang))}_${slugifyFilename(fmtDate(period?.end, lang))}`;
  doc.save(base.endsWith(".pdf") ? base : `${base}.pdf`);
}

// ---- Comparison report PDF ----
interface CmpBucket { label: string; start: string; end: string; data: any }
interface CmpResult { mode: "delta" | "trend"; periods: CmpBucket[] }

export async function downloadComparisonPdf(result: CmpResult, lang: Lang, filename?: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const font = await registerPdfFont(doc);
  const t: any = (await import("@/app/lib/i18n")).translations[lang];
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  const bottom = pageH - margin;
  const state = { y: margin };
  const lh = (pt: number) => pt * 0.3528 * 1.25;

  const heading = (text: string) => {
    if (state.y + 12 > bottom) { doc.addPage(); state.y = margin; }
    state.y += 3;
    doc.setFont(font, "bold"); doc.setFontSize(12); doc.setTextColor(29, 78, 216);
    doc.text(text, margin, state.y); state.y += lh(12) + 1.5;
  };

  const table = (cols: { header: string; width: number; align?: "right" }[], rows: string[][]) => {
    const size = 8.5, l = lh(size), padX = 2, padY = 1.3;
    const totalW = cols.reduce((a, c) => a + c.width, 0);
    const drawHeader = () => {
      const h = l + padY * 2;
      if (state.y + h + l > bottom) { doc.addPage(); state.y = margin; }
      doc.setFillColor(29, 78, 216); doc.rect(margin, state.y, totalW, h, "F");
      doc.setFont(font, "bold"); doc.setFontSize(size); doc.setTextColor(255, 255, 255);
      let x = margin;
      for (const c of cols) { doc.text(c.header, c.align === "right" ? x + c.width - padX : x + padX, state.y + padY + l * 0.78, { align: c.align === "right" ? "right" : "left" }); x += c.width; }
      state.y += h;
    };
    drawHeader();
    for (const row of rows) {
      const wrapped = cols.map((c, i) => doc.splitTextToSize(String(row[i] ?? ""), c.width - padX * 2) as string[]);
      const lines = Math.max(1, ...wrapped.map(w => w.length));
      const h = lines * l + padY * 2;
      if (state.y + h > bottom) { doc.addPage(); state.y = margin; drawHeader(); }
      doc.setFont(font, "normal"); doc.setFontSize(size); doc.setTextColor(17, 17, 17);
      let x = margin;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i]; let ty = state.y + padY + l * 0.78;
        for (const ln of wrapped[i]) { doc.text(ln, c.align === "right" ? x + c.width - padX : x + padX, ty, { align: c.align === "right" ? "right" : "left" }); ty += l; }
        x += c.width;
      }
      state.y += h; doc.setDrawColor(220); doc.setLineWidth(0.1); doc.line(margin, state.y, margin + totalW, state.y);
    }
    state.y += 2;
  };

  const d = (a: number, b: number) => (b === 0 ? (a === 0 ? "0%" : "+∞") : `${a - b > 0 ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`);

  doc.setFont(font, "bold"); doc.setFontSize(16); doc.setTextColor(17, 17, 17);
  doc.text(t.comparison ?? "Karşılaştırma", margin, state.y + 4); state.y += 4 + lh(16) + 2;

  const periods = result.periods;
  if (result.mode === "delta") {
    const [cur, prev] = periods;
    const s = cur.data.summary, p = prev.data.summary;
    const cols4 = (c1: string) => [{ header: c1, width: maxW * 0.4 }, { header: cur.label, width: maxW * 0.2, align: "right" as const }, { header: prev.label, width: maxW * 0.2, align: "right" as const }, { header: t.cmpDelta ?? "Δ", width: maxW * 0.2, align: "right" as const }];

    heading(t.cmpModeDelta ?? "Dönem Karşılaştırma");
    table(cols4(""), [
      [t.totalEval ?? "Toplam", String(s.totalEvaluations), String(p.totalEvaluations), d(s.totalEvaluations, p.totalEvaluations)],
      ["Second Call", String(s.totalSecondCalls), String(p.totalSecondCalls), d(s.totalSecondCalls, p.totalSecondCalls)],
      [t.avgScoreLbl ?? "Ort. Skor", `%${s.avgScore}`, `%${p.avgScore}`, d(s.avgScore, p.avgScore)],
      [t.highPotential ?? "Yüksek", String(s.highPotential), String(p.highPotential), d(s.highPotential, p.highPotential)],
      [t.atRisk ?? "Riskli", String(s.atRisk), String(p.atRisk), d(s.atRisk, p.atRisk)],
    ]);

    const cpPrev = new Map<string, any>(prev.data.consultantPerformance.map((c: any) => [c.agentId, c]));
    heading(lang === "tr" ? "Danışman Performansı" : "Consultant Performance");
    table(cols4(t.consultant ?? "Danışman"), cur.data.consultantPerformance.map((c: any) => {
      const pv = cpPrev.get(c.agentId)?.healthScore ?? 0;
      return [c.name, `%${c.healthScore}`, `%${pv}`, d(c.healthScore, pv)];
    }));

    // Call Durations
    if (cur.data.callDurations?.length) {
      const cdPrev = new Map<string, any>(prev.data.callDurations?.map((c: any) => [c.name, c]) ?? []);
      heading(lang === "tr" ? "Çağrı Süreleri" : "Call Durations");
      table(cols4(t.consultant ?? "Danışman"), cur.data.callDurations.map((c: any) => {
        const pv = cdPrev.get(c.name)?.calls ?? 0;
        return [c.name, String(c.calls), String(pv), d(c.calls, pv)];
      }));
    }

    // Team Distribution
    if (cur.data.teamDistribution?.length) {
      const tdPrev = new Map<string, any>(prev.data.teamDistribution?.map((c: any) => [c.team, c]) ?? []);
      heading(t.teamCol ?? (lang === "tr" ? "Takım" : "Team"));
      table(cols4(t.teamCol ?? (lang === "tr" ? "Takım" : "Team")), cur.data.teamDistribution.map((c: any) => {
        const pv = tdPrev.get(c.team)?.totalCalls ?? 0;
        return [c.team, String(c.totalCalls), String(pv), d(c.totalCalls, pv)];
      }));
    }

    // Consultant Call Distribution
    if (cur.data.consultantCallDistribution?.length) {
      const ccdPrev = new Map<string, any>(prev.data.consultantCallDistribution?.map((c: any) => [c.name, c]) ?? []);
      heading(lang === "tr" ? "Çağrı Dağılımı" : "Call Distribution");
      table(cols4(t.consultant ?? "Danışman"), cur.data.consultantCallDistribution.map((c: any) => {
        const pv = ccdPrev.get(c.name)?.totalCalls ?? 0;
        return [c.name, String(c.totalCalls), String(pv), d(c.totalCalls, pv)];
      }));
    }
  } else {
    const periodCols = (c1: string) => [{ header: c1, width: maxW - periods.length * 24 }, ...periods.map(p => ({ header: p.label, width: 24, align: "right" as const }))];
    heading(t.cmpModeTrend ?? "Trend");
    table(periodCols(t.avgScoreLbl ?? "Ort. Skor"), [[t.totalEval ?? "Toplam", ...periods.map(p => `%${p.data.summary.avgScore}`)]]);

    const names = Array.from(new Set(periods.flatMap(p => p.data.consultantPerformance.map((c: any) => c.name))));
    heading(lang === "tr" ? "Danışman Performansı" : "Consultant Performance");
    table(periodCols(t.consultant ?? "Danışman"), names.map(name => [name, ...periods.map(p => { const c = p.data.consultantPerformance.find((x: any) => x.name === name); return c ? `%${c.healthScore}` : "—"; })]));

    // Team Distribution
    const allTeams = Array.from(new Set(periods.flatMap(p => (p.data.teamDistribution ?? []).map((c: any) => c.team))));
    if (allTeams.length) {
      heading(t.teamCol ?? (lang === "tr" ? "Takım" : "Team"));
      table(periodCols(t.teamCol ?? (lang === "tr" ? "Takım" : "Team")), allTeams.map(team => [team, ...periods.map(p => { const c = (p.data.teamDistribution ?? []).find((x: any) => x.team === team); return c ? String(c.totalCalls) : "—"; })]));
    }

    // Consultant Call Distribution
    const allCcdNames = Array.from(new Set(periods.flatMap(p => (p.data.consultantCallDistribution ?? []).map((c: any) => c.name))));
    if (allCcdNames.length) {
      heading(lang === "tr" ? "Çağrı Dağılımı" : "Call Distribution");
      table(periodCols(t.consultant ?? "Danışman"), allCcdNames.map(name => [name, ...periods.map(p => { const c = (p.data.consultantCallDistribution ?? []).find((x: any) => x.name === name); return c ? String(c.totalCalls) : "—"; })]));
    }
  }

  const fname = filename || `karsilastirma_${result.mode}`;
  doc.save(fname.endsWith(".pdf") ? fname : `${fname}.pdf`);
}
