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
