/**
 * paper-preview-html.ts
 *
 * Headless HTML & Office spreadsheet rendering engine for ExamForge.
 * Generates standards-compliant A4/Letter/Legal printable HTML and Excel (.xls)
 * views from GeneratedTest data with zero DOM/browser dependencies.
 */

import type { GeneratedTest, GeneratedQuestion } from "./types";

/* ------------------------------- Constants ------------------------------- */

export const HEADER_FONT_FAMILIES = [
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "Calibri, sans-serif", label: "Calibri" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "Cinzel, serif", label: "Cinzel" },
  { value: "'Cormorant Garamond', serif", label: "Cormorant Garamond" },
  { value: "Marcellus, serif", label: "Marcellus" },
  { value: "Cardo, serif", label: "Cardo" },
] as const;

export const PAPER_FONT_FAMILIES = [
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "Calibri, sans-serif", label: "Calibri" },
  { value: "'Courier New', monospace", label: "Courier New" },
] as const;

export const PAPER_SIZES = [
  { value: "A4", label: "A4 (210 × 297 mm)", width: "210mm", height: "297mm" },
  { value: "Letter", label: "Letter (216 × 279 mm)", width: "216mm", height: "279mm" },
  { value: "Legal", label: "Legal (216 × 356 mm)", width: "216mm", height: "356mm" },
] as const;

export const MARGIN_PRESETS = [
  { value: "Narrow", label: "Narrow (10 mm)", mm: 10 },
  { value: "Normal", label: "Normal (16 mm)", mm: 16 },
  { value: "Wide", label: "Wide (25 mm)", mm: 25 },
] as const;

export const DATE_FORMATS = [
  { value: "Locale", label: "Aug 7, 2026" },
  { value: "DMY", label: "DD/MM/YYYY" },
  { value: "MDY", label: "MM/DD/YYYY" },
  { value: "ISO", label: "YYYY-MM-DD" },
] as const;

export const LIVE_EDIT_FONT_SIZES = [
  { value: "1", label: "8 pt (Smallest)" },
  { value: "2", label: "10 pt (Small)" },
  { value: "3", label: "12 pt (Body)" },
  { value: "4", label: "14 pt (Subheading)" },
  { value: "5", label: "18 pt (Heading)" },
  { value: "6", label: "24 pt (Title)" },
] as const;

export const LIVE_EDIT_COLORS = [
  { label: "Dark (Default)", value: "#111827", previewClass: "bg-slate-900 border-slate-700" },
  { label: "Emerald Green", value: "#059669", previewClass: "bg-emerald-600 border-emerald-700" },
  { label: "Deep Blue", value: "#2563eb", previewClass: "bg-blue-600 border-blue-700" },
  { label: "Crimson Red", value: "#dc2626", previewClass: "bg-red-600 border-red-700" },
  { label: "Muted Slate", value: "#64748b", previewClass: "bg-slate-500 border-slate-600" },
  { label: "Violet Accent", value: "#7c3aed", previewClass: "bg-violet-600 border-violet-700" },
] as const;

export const GOOGLE_FONTS_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Cinzel:wght@700&family=Cormorant+Garamond:wght@700&family=Marcellus&family=Cardo:wght@700&display=swap" rel="stylesheet">';

/* ------------------------------ Helpers ---------------------------------- */

/** HTML-escape a string for safe interpolation. */
export function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Extract a clean ordinal class label from the test's className.
 *   "Class 10"  → "10th"
 *   "10th"      → "10th"
 *   "10"        → "10th"
 *   ""          → "10th" (fallback)
 */
export function extractClassNumber(className: string): string {
  const m = (className || "").match(/\d+/);
  if (!m) return "10th";
  return `${m[0]}th`;
}

/**
 * Convert minutes → humanized duration.
 *   ≤ 60 min  → "X min"
 *   >  60 min → "X hr Y min" (or "X hr" if exact)
 */
export function formatDuration(mins: number): string {
  if (!mins || mins <= 0) return "0 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date according to the given format code. */
export function formatDate(date: Date, fmt: string): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  switch (fmt) {
    case "DMY":
      return `${pad2(d)}/${pad2(m)}/${y}`;
    case "MDY":
      return `${pad2(m)}/${pad2(d)}/${y}`;
    case "ISO":
      return `${y}-${pad2(m)}-${pad2(d)}`;
    case "Locale":
    default:
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
  }
}

/** Today's date in the given format. */
export function todayDate(fmt: string): string {
  return formatDate(new Date(), fmt);
}

/**
 * Auto-generate a 4-digit paper code (last 4 digits of timestamp).
 * No "PC-" prefix, no alphabet — e.g. "4827".
 */
export function generatePaperCode(): string {
  const ts = Date.now().toString();
  return ts.slice(-4);
}

/* ------------------------- Preview options shape ------------------------- */

export type PrintExportOpts = {
  // Academy header
  academyName: string;
  academyLocation: string;
  logoDataUrl: string | null;
  logoSize: number;
  headerFont: string;
  headerSize: number;
  paperFont: string;
  fontSize: number;
  topMargin: number;
  // Layout
  paperSize: string;
  marginPreset: string;
  // Student info
  studentName: string;
  rollNumber: string;
  classNameInput: string;
  paperCode: string;
  subjectNameInput: string;
  timeAllowed: string;
  totalMarksInput: string;
  examDate: string;
  examSyllabus: string;
  showExamSyllabus: boolean;
  examLabel: string;
  showExamLabel: boolean;
  dateFormat: string;
  // Paper options
  printAnswerKey: boolean;
  showBubbleSheet: boolean;
  watermarkText: string;
  watermarkImage: string | null;
  watermarkSize: number;
  mcqBorder: boolean;
  shortBorder: boolean;
  longBorder: boolean;
  repeatHeader: boolean;
  separateSubjectivePart: boolean;
  showPageNumbers: boolean;
  /** Header layout: 1 = current centered academy header + fieldset grid,
   *  2 = left logo + name/details + horizontal rule + student info table. */
  headerLayout: 1 | 2;
  /** MCQ layout: 1 = current (border toggle / list style),
   *  2 = 6-column table (Q.No · Question · A · B · C · D). */
  mcqLayout: 1 | 2;
  academyLocBold: boolean;
  headerLineSpacing: number;
};

/* ----------------------- Preview HTML generation ------------------------- */

/**
 * Build the full HTML document (with embedded CSS) for the live preview,
 * PDF export, and print.
 */
export function renderPreviewHTML(test: GeneratedTest, opts: PrintExportOpts): string {
  const escape = escapeHtml;
  const fs = opts.fontSize;
  const hs = opts.headerSize;
  const ls = opts.logoSize;
  const pf = opts.paperFont;
  const hf = opts.headerFont;
  const tm = opts.topMargin;

  const paperSize =
    PAPER_SIZES.find((p) => p.value === opts.paperSize) ?? PAPER_SIZES[0];
  const marginPreset =
    MARGIN_PRESETS.find((m) => m.value === opts.marginPreset) ?? MARGIN_PRESETS[1];
  const margins = marginPreset.mm;

  /* ---- Build MCQ options grid (shared between bordered & non-bordered) ---- */
  const buildOptionsGrid = (q: GeneratedQuestion): string => {
    if (!q.options) return "";
    const optItems = ["A", "B", "C", "D"].map((l) => {
      const text = escape(
        q.options![
          `option_${l.toLowerCase()}` as
            | "option_a"
            | "option_b"
            | "option_c"
            | "option_d"
        ]
      );
      return `<span class="oi"><b>${l}.</b> ${text}</span>`;
    });
    const anyLong = ["A", "B", "C", "D"].some(
      (l) =>
        (
          q.options![
            `option_${l.toLowerCase()}` as
              | "option_a"
              | "option_b"
              | "option_c"
              | "option_d"
          ] || ""
        ).length > 40
    );
    return anyLong
      ? `<div class="opts-1col">${optItems.map((o) => `<div>${o}</div>`).join("")}</div>`
      : `<div class="opts-2col">${optItems.map((o) => `<div>${o}</div>`).join("")}</div>`;
  };

  /* ---- Academy header ----
   * Layout 1: logo LEFT, name + location CENTERED (current default).
   * Layout 2: logo LEFT, name + location stacked next to logo, followed by horizontal rule.
   */
  const hasAcademy = opts.academyName || opts.academyLocation || opts.logoDataUrl;
  const logoImg = opts.logoDataUrl
    ? `<img src="${opts.logoDataUrl}" alt="logo" style="max-height:${ls}px; max-width:${ls * 2.4}px; object-fit:contain;" />`
    : "";
  const academyHtml =
    hasAcademy && opts.headerLayout === 2
      ? `<div class="academy academy-l2" style="line-height:${opts.headerLineSpacing ?? 1.4};">
           <div class="academy-logo">${logoImg}</div>
           <div class="academy-text-l2">
             ${
               opts.academyName
                 ? `<div class="academy-name-l2" style="font-family:${hf}; font-size:${hs}pt; font-weight:bold; color:#000; line-height:1.1;">${escape(opts.academyName)}</div>`
                 : ""
             }
             ${
               opts.academyLocation
                 ? `<div class="academy-loc-l2" style="font-family:${pf}; font-size:${Math.max(fs - 2, 8)}pt; font-style:italic; ${opts.academyLocBold ? "font-weight:bold;" : ""} text-align:left; color:#555; margin-top:4px; white-space:pre-line;">${escape(opts.academyLocation)}</div>`
                 : ""
             }
           </div>
         </div>
         <hr class="academy-hr-l2" />`
      : hasAcademy
        ? `<div class="academy">
             <div class="academy-logo">${logoImg}</div>
             <div class="academy-text">
               ${
                 opts.academyName
                   ? `<div class="academy-name" style="font-family:${hf}; font-size:${hs}pt;">${escape(opts.academyName)}</div>`
                   : ""
               }
               ${
                 opts.academyLocation
                   ? `<div class="academy-loc" style="font-family:${hf};">${escape(opts.academyLocation)}</div>`
                   : ""
               }
             </div>
           </div>`
        : "";

  /* ---- Student info ---- */
  const field = (label: string, value: string) =>
    `<fieldset class="fld"><legend>${escape(label)}</legend><span class="fld-val">${escape(value || "\u00A0")}</span></fieldset>`;

  const studentInfoFields: string[] = [
    field("Student Name", opts.studentName),
    field("Roll Number", opts.rollNumber),
    field("Class", opts.classNameInput),
    field("Paper Code", opts.paperCode),
    field("Subject", opts.subjectNameInput),
    field("Time Allowed", opts.timeAllowed),
    field("Total Marks", opts.totalMarksInput),
    field("Exam Date", opts.examDate),
  ];
  if (opts.showExamSyllabus) {
    studentInfoFields.push(field("Exam Syllabus", opts.examSyllabus));
  }
  if (opts.showExamLabel) {
    studentInfoFields.push(field("Exam", opts.examLabel));
  }

  // Layout 2 — 6-column table
  const lbl = (text: string) => `<td class="it-lbl"><b>${escape(text)}</b></td>`;
  const val = (text: string) => `<td class="it-val">${escape(text || "\u00A0")}</td>`;
  const infoRows: string[] = [
    `<tr>${lbl("Name:")}${val(opts.studentName)}${lbl("Roll No:")}${val(opts.rollNumber)}${lbl("Date:")}${val(opts.examDate)}</tr>`,
    `<tr>${lbl("Subject:")}${val(opts.subjectNameInput)}${lbl("Total Marks:")}${val(opts.totalMarksInput)}${lbl("Time Allowed:")}${val(opts.timeAllowed)}</tr>`,
  ];
  const thirdRowThirdLabel = opts.showExamSyllabus ? "Syllabus:" : (opts.showExamLabel ? "Exam:" : "");
  const thirdRowThirdValue = opts.showExamSyllabus ? opts.examSyllabus : (opts.showExamLabel ? opts.examLabel : "");
  infoRows.push(
    `<tr>${lbl("Class:")}${val(opts.classNameInput)}${lbl("Paper Code:")}${val(opts.paperCode)}${thirdRowThirdLabel ? lbl(thirdRowThirdLabel) : "<td></td>"}${thirdRowThirdValue ? val(thirdRowThirdValue) : "<td></td>"}</tr>`
  );
  if (opts.showExamLabel && opts.showExamSyllabus) {
    infoRows.push(
      `<tr>${lbl("Exam:")}${val(opts.examLabel)}<td></td><td></td><td></td><td></td></tr>`
    );
  }
  const studentInfoTableHtml = `<table class="info-table">${infoRows.join("")}</table>`;

  const studentInfoHtml =
    opts.headerLayout === 2
      ? studentInfoTableHtml
      : `<div class="info-grid">${studentInfoFields.join("")}</div>`;

  /* ---- Bubble sheet (4-column layout) ---- */
  const mcqSections = (test.sections || []).filter((s) => s.type_name === "MCQ");
  const shortSections = (test.sections || []).filter((s) => s.type_name === "Short");
  const longSections = (test.sections || []).filter((s) => s.type_name === "Long");

  const totalMcqs = mcqSections.reduce(
    (sum, sec) => sum + (sec.questions || []).length,
    0
  );
  const bsRowsPerCol = totalMcqs > 0 ? Math.ceil(totalMcqs / 4) : 1;

  const bubbleSheetHtml =
    opts.showBubbleSheet && mcqSections.length > 0
      ? (() => {
          let qn = 0;
          const cells: string[] = [];
          mcqSections.forEach((sec) => {
            (sec.questions || []).forEach(() => {
              qn++;
              const bubbles = ["A", "B", "C", "D"]
                .map((l) => `<span class="bub">${l}</span>`)
                .join("");
              cells.push(
                `<div class="bs-cell"><span class="bs-q">${qn}.</span>${bubbles}</div>`
              );
            });
          });
          return `<section class="bubble-sheet">
              <div class="bs-grid" style="grid-template-rows: repeat(${bsRowsPerCol}, auto); grid-auto-flow: column;">${cells.join("")}</div>
            </section>`;
        })()
      : "";

  /* ---- Sections ---- */
  let subjectivePartRendered = false;
  const sectionsHtml = (() => {
    const parts: string[] = [];
    (test.sections || []).forEach((sec) => {
      const isMcq = sec.type_name === "MCQ";
      const isShort = sec.type_name === "Short";
      const isLong = sec.type_name === "Long";
      const useBorder = isMcq
        ? opts.mcqBorder
        : isShort
          ? opts.shortBorder
          : opts.longBorder;
      const useMcqTable = isMcq && opts.mcqLayout === 2;
      const qNum = isMcq ? 1 : isShort ? 2 : isLong ? 3 : 1;

      let sectionTitle = "";
      if (isMcq) {
        sectionTitle = `<h2 class="section-title">Objective Part</h2>`;
      } else if (!subjectivePartRendered && (isShort || isLong)) {
        const pageBreakCls = opts.separateSubjectivePart
          ? " page-break-before"
          : "";
        sectionTitle = `<h2 class="section-title${pageBreakCls}">Subjective Part</h2>`;
        subjectivePartRendered = true;
      }

      const qFormula = `(${sec.marksPerQuestion}×${(sec.questions || []).length}=${sec.sectionMarks})`;
      const instructionText = isMcq
        ? "Attempt all MCQs"
        : isShort
          ? "Attempt all Short Questions"
          : "Attempt all Long Questions";
      const questionHeading = `<h3 class="question-heading">Question ${qNum}. ${instructionText} <span class="marks-formula">${qFormula}</span></h3>`;

      let body: string;
      if (useMcqTable) {
        const mcqRows = (sec.questions || [])
          .map((q, qi) => {
            const qn = qi + 1;
            const a = q.options ? escape(q.options.option_a) : "";
            const b = q.options ? escape(q.options.option_b) : "";
            const c = q.options ? escape(q.options.option_c) : "";
            const d = q.options ? escape(q.options.option_d) : "";
            return `<tr><td class="qn">${qn}</td><td>${escape(q.question_text)}</td><td>${a}</td><td>${b}</td><td>${c}</td><td>${d}</td></tr>`;
          })
          .join("");
        body = `<table class="qt mcq-table"><thead><tr><th>Q.No</th><th>Question Statement</th><th>Option A</th><th>Option B</th><th>Option C</th><th>Option D</th></tr></thead><tbody>${mcqRows}</tbody></table>`;
      } else {
        const rows = (sec.questions || [])
          .map((q, qi) => {
            const qn = qi + 1;
            const optsGrid = buildOptionsGrid(q);
            if (useBorder) {
              return `<tr><td class="qn">${qn}</td><td>${escape(q.question_text)}${optsGrid}</td></tr>`;
            }
            return `<div class="qi"><span class="qn">${qn}.</span> ${escape(q.question_text)}${optsGrid}</div>`;
          })
          .join("");
        body = useBorder ? `<table class="qt">${rows}</table>` : rows;
      }

      parts.push(
        `<section class="test-section">${sectionTitle}${questionHeading}${body}</section>`
      );
    });
    return parts.join("");
  })();

  /* ---- Answer Key ---- */
  const answerKeyHtml =
    opts.printAnswerKey && mcqSections.length > 0
      ? (() => {
          let n = 0;
          const parts = mcqSections
            .map((sec, si) => {
              const items = (sec.questions || [])
                .map((q) => {
                  n++;
                  return q.options
                    ? `<span class="aki"><b>${n}.</b> <b class="akc">${escape(q.options.correct_option)}</b></span>`
                    : "";
                })
                .join("\u00A0\u00A0");
              return `<div class="ak-sec"><h4>Section ${String.fromCharCode(65 + si)}</h4><div class="ak-in">${items}</div></div>`;
            })
            .join("");
          return `<section class="answer-key"><h3 class="ak-title">Answer Key</h3>${parts}</section>`;
        })()
      : "";

  /* ---- Watermarks ---- */
  const watermarkTextHtml = opts.watermarkText
    ? `<div class="wm-text">${escape(opts.watermarkText)}</div>`
    : "";
  const watermarkImageHtml = opts.watermarkImage
    ? `<div class="wm-image" style="background-image:url('${opts.watermarkImage}');"></div>`
    : "";

  const headerContent = `${academyHtml}${studentInfoHtml}`;
  const headerOpen = opts.repeatHeader
    ? `<table class="header-table"><thead><tr><td>${headerContent}</td></tr></thead><tbody><tr><td class="body-cell">`
    : `<div class="page-header">${headerContent}</div>`;
  const headerClose = opts.repeatHeader ? `</td></tr></tbody></table>` : "";

  const pageNumberCss = opts.showPageNumbers
    ? `@page { @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #555; } }`
    : "";

  const htmlTitle = test.title || `${test.subjectName} Examination`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escape(htmlTitle)}</title>
${GOOGLE_FONTS_LINK}
<style>
  @page { size: ${paperSize.value}; margin: ${margins}mm; }
  ${pageNumberCss}

  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  body {
    background: #e2e8f0;
    font-family: ${pf};
    padding: 16px;
    min-width: 0;
  }
  .page {
    background: #fff;
    width: ${paperSize.width};
    max-width: 100%;
    min-height: ${paperSize.height};
    margin: 0 auto;
    padding: ${margins}mm;
    padding-top: ${tm}mm;
    position: relative;
    overflow-x: auto;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    color: #111;
    line-height: 1.5;
    font-size: ${fs}pt;
    font-family: ${pf};
  }

  .wm-text {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 96pt;
    font-weight: 900;
    color: rgba(4, 120, 87, 0.07);
    pointer-events: none;
    z-index: 0;
    white-space: nowrap;
    letter-spacing: 6px;
  }
  .wm-image {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 0;
    opacity: 0.05;
    background-position: center;
    background-repeat: no-repeat;
    background-size: ${opts.watermarkSize}%;
  }

  .academy {
    display: flex;
    align-items: center;
    gap: 16px;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  .academy-logo { flex-shrink: 0; }
  .academy-text { flex: 1; text-align: center; }
  .academy-name {
    font-family: ${hf};
    font-size: ${hs}pt;
    font-weight: bold;
    color: #000;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.15;
  }
  .academy-loc {
    font-family: ${pf};
    font-size: ${Math.max(fs - 1, 8.5)}pt;
    color: #444;
    margin-top: 3px;
    font-style: italic;
  }

  .academy-l2 {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 6px;
  }
  .academy-text-l2 {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .academy-hr-l2 {
    border: 0;
    border-top: 2px solid #000;
    margin: 4px 0 10px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
    position: relative; z-index: 1;
  }
  .fld {
    border: 1px solid #000;
    border-radius: 3px;
    padding: 3px 6px 1px;
    background: #fff;
    min-height: 22px;
    margin: 0;
  }
  .fld legend {
    font-size: ${Math.max(fs - 3, 7)}pt;
    font-weight: 700;
    color: #444;
    background: #fff;
    padding: 0 4px;
  }
  .fld-val { font-size: ${fs}pt; font-family: ${pf}; }

  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 4px;
    position: relative; z-index: 1;
    font-family: ${pf};
    font-size: ${fs}pt;
  }
  .info-table td {
    border: 1px solid #000;
    padding: 4px 8px;
    vertical-align: top;
  }
  .info-table td b { font-weight: 700; }
  .it-lbl { white-space: nowrap; width: 1%; padding: 2px 4px !important; }
  .it-val { min-width: 80px; padding: 2px 6px !important; }

  .bubble-sheet {
    margin-top: 14px;
    position: relative; z-index: 1;
  }
  .bs-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
  }
  .bs-cell {
    border: 1px solid #000;
    padding: 4px 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: ${Math.max(fs - 1, 9)}pt;
    font-family: ${pf};
    margin: 0;
  }
  .bs-q { font-weight: bold; min-width: 20px; }
  .bub {
    display: inline-block;
    border: 1.5px solid #000;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    line-height: 18px;
    text-align: center;
    font-size: 9px;
    margin-left: 2px;
  }

  .instructions {
    margin-top: 10px;
    background: #fff;
    padding: 6px 10px;
    font-family: ${pf};
    font-size: ${Math.max(fs - 1, 9)}pt;
    border-left: 3px solid #047857;
    position: relative; z-index: 1;
  }

  .test-section {
    margin-top: 16px;
    position: relative; z-index: 1;
  }
  .section-title {
    font-family: ${hf};
    font-size: ${Math.max(fs + 4, 14)}pt;
    font-weight: 700;
    color: #111;
    text-align: center;
    text-transform: uppercase;
    margin: 14px 0 8px;
    position: relative;
    z-index: 1;
  }
  .section-title .marks-formula {
    position: absolute;
    right: 0;
    top: 0;
    font-weight: 600;
    color: #555;
    font-size: ${Math.max(fs, 10)}pt;
    text-decoration: none;
  }
  .page-break-before { page-break-before: always; }
  .question-heading {
    font-family: ${hf};
    font-size: ${Math.max(fs + 2, 12)}pt;
    font-weight: 700;
    margin: 10px 0 6px;
    position: relative;
  }
  .question-heading .marks-formula {
    position: absolute;
    right: 0;
    top: 0;
    font-weight: 600;
    color: #555;
    font-size: ${Math.max(fs, 10)}pt;
  }
  .qi { margin-bottom: 8px; padding-left: 4px; font-family: ${pf}; }
  .qn { font-weight: bold; margin-right: 4px; }
  .opts-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 16px;
    margin-top: 4px;
    margin-left: 20px;
  }
  .opts-1col { margin-top: 4px; margin-left: 20px; }
  .oi { font-size: ${Math.max(fs - 1, 9)}pt; font-family: ${pf}; }

  table.qt { width: 100%; border-collapse: collapse; margin: 0; font-family: ${pf}; }
  table.qt td { border: 1px solid #000; padding: 4px 8px; vertical-align: top; }
  table.qt th {
    border: 1px solid #000;
    padding: 5px 8px;
    background: #fff;
    font-family: ${hf};
    font-weight: 700;
    text-align: left;
  }
  td.qn { width: 32px; font-weight: bold; text-align: center; }

  table.mcq-table th { text-align: center; }
  table.mcq-table td.qn { text-align: center; }

  .answer-key {
    page-break-before: always;
    margin-top: 20px;
    position: relative; z-index: 1;
  }
  .ak-title {
    font-family: ${hf};
    text-align: center;
    text-transform: uppercase;
    font-size: ${Math.max(fs + 4, 14)}pt;
    border-bottom: 2px solid #000;
    padding-bottom: 4px;
    margin-bottom: 10px;
  }
  .ak-sec h4 { font-family: ${hf}; font-size: ${Math.max(fs - 1, 9)}pt; margin: 8px 0 4px; font-weight: 700; }
  .ak-in { line-height: 2; font-family: ${pf}; }
  .aki { display: inline-block; min-width: 50px; }
  .akc { color: #000; }

  @media screen and (max-width: 768px) {
    body { padding: 8px 4px; }
    .page {
      width: 100% !important;
      max-width: 100% !important;
      min-height: auto !important;
      padding: 14px 10px !important;
      margin: 0 !important;
      border-radius: 4px;
      overflow-x: auto;
    }
    .wm-text { font-size: 48pt !important; }
    .academy {
      flex-direction: column !important;
      text-align: center !important;
      gap: 8px !important;
    }
    .academy-logo { margin: 0 auto !important; }
    .academy-l2 {
      flex-direction: column !important;
      text-align: center !important;
      gap: 6px !important;
    }
    .academy-text-l2 { text-align: center !important; }
    .info-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 6px !important;
    }
    .bs-grid {
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      grid-auto-flow: row !important;
      grid-template-rows: none !important;
      gap: 0 !important;
    }
    .opts-2col {
      grid-template-columns: 1fr !important;
      margin-left: 10px !important;
    }
    .opts-1col { margin-left: 10px !important; }
    .section-title .marks-formula,
    .question-heading .marks-formula {
      position: static !important;
      display: block !important;
      text-align: right !important;
      margin-top: 2px !important;
      font-size: 8.5pt !important;
    }
    .bubble-sheet {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    table.qt, table.mcq-table {
      width: 100% !important;
      font-size: ${Math.max(fs - 1, 8.5)}pt !important;
    }
  }

  @media screen and (max-width: 480px) {
    body { padding: 4px 2px; }
    .page { padding: 10px 6px !important; }
    .info-grid {
      grid-template-columns: 1fr 1fr !important;
      gap: 4px !important;
    }
    .fld { padding: 2px 4px !important; }
    .fld legend { font-size: 6.5pt !important; padding: 0 2px !important; }
    .fld-val { font-size: ${Math.max(fs - 1, 8)}pt !important; }
    .bs-cell {
      padding: 3px 2px !important;
      font-size: 8pt !important;
      gap: 2px !important;
    }
    .bs-q { min-width: 16px !important; }
    .bub {
      width: 15px !important;
      height: 15px !important;
      line-height: 15px !important;
      font-size: 7.5px !important;
      margin-left: 1px !important;
    }
    .info-table { font-size: ${Math.max(fs - 2, 7.5)}pt !important; }
    .info-table td { padding: 2px 4px !important; }
    .it-val { min-width: 40px !important; padding: 2px 3px !important; }
  }

  @media print {
    body { background: #fff !important; padding: 0 !important; }
    .page {
      box-shadow: none !important;
      width: auto !important;
      max-width: none !important;
      min-height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    .academy {
      display: flex !important;
      flex-direction: row !important;
      text-align: left !important;
      gap: 16px !important;
    }
    .academy-text { text-align: center !important; }
    .academy-l2 {
      display: flex !important;
      flex-direction: row !important;
      text-align: left !important;
      gap: 14px !important;
    }
    .academy-text-l2 { text-align: left !important; }
    .info-grid {
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      gap: 8px !important;
    }
    .fld { padding: 3px 6px 1px !important; }
    .fld legend {
      font-size: ${Math.max(fs - 3, 7)}pt !important;
      padding: 0 4px !important;
    }
    .fld-val { font-size: ${fs}pt !important; }
    .bs-grid {
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      grid-auto-flow: column !important;
      grid-template-rows: repeat(${bsRowsPerCol}, auto) !important;
      gap: 0 !important;
    }
    .bs-cell {
      padding: 4px 6px !important;
      font-size: ${Math.max(fs - 1, 9)}pt !important;
      gap: 4px !important;
    }
    .bs-q { min-width: 20px !important; }
    .bub {
      width: 18px !important;
      height: 18px !important;
      line-height: 18px !important;
      font-size: 9px !important;
      margin-left: 2px !important;
    }
    .opts-2col {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      margin-left: 20px !important;
    }
    .opts-1col { margin-left: 20px !important; }
    .section-title .marks-formula,
    .question-heading .marks-formula {
      position: absolute !important;
      right: 0 !important;
      top: 0 !important;
      display: inline !important;
      font-size: ${Math.max(fs, 10)}pt !important;
    }
    .info-table { font-size: ${fs}pt !important; }
    .info-table td { padding: 4px 8px !important; }
    .it-val { min-width: 80px !important; }
    thead { display: table-header-group !important; }
    tr { page-break-inside: avoid !important; }
  }
</style></head>
<body>
  <div class="page">
    ${watermarkTextHtml}
    ${watermarkImageHtml}
    ${headerOpen}
    ${bubbleSheetHtml}
    ${test.instructions ? `<div class="instructions"><b>Instructions:</b> ${escape(test.instructions)}</div>` : ""}
    ${sectionsHtml}
    ${answerKeyHtml}
    ${headerClose}
  </div>
</body></html>`;
}

/* --------------------------- Excel (.xls) export ------------------------- */

export function renderExcelHTML(test: GeneratedTest): string {
  const escape = escapeHtml;
  let qn = 0;
  const qRows: string[] = [];
  const aRows: string[] = [];

  (test.sections || []).forEach((sec, si) => {
    (sec.questions || []).forEach((q) => {
      qn++;
      const correctText = q.options
        ? q.options[
            `option_${(q.options.correct_option || "").toLowerCase()}` as
              | "option_a"
              | "option_b"
              | "option_c"
              | "option_d"
          ] ?? ""
        : "";
      qRows.push(
        `<tr>
          <td>${qn}</td>
          <td>Section ${String.fromCharCode(65 + si)}</td>
          <td>${escape(q.type_name)}</td>
          <td>${escape(q.difficulty_name)}</td>
          <td>${q.marks}</td>
          <td>${escape(q.question_text)}</td>
          ${q.options ? `<td>${escape(q.options.option_a)}</td><td>${escape(q.options.option_b)}</td><td>${escape(q.options.option_c)}</td><td>${escape(q.options.option_d)}</td>` : `<td></td><td></td><td></td><td></td>`}
          <td>${escape(q.blooms_taxonomy ?? "")}</td>
          <td>${escape(q.topic_name ?? "")}</td>
          <td>${escape(q.chapter_name ?? "")}</td>
        </tr>`
      );
      aRows.push(
        `<tr>
          <td>${qn}</td>
          <td>${escape(q.type_name)}</td>
          <td>${q.options ? escape(q.options.correct_option) : "—"}</td>
          <td>${q.options ? escape(correctText) : escape(q.model_answer ?? "Self-assess")}</td>
          <td>${q.marks}</td>
        </tr>`
      );
    });
  });

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escape(test.title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  table { border-collapse: collapse; width: 100%; }
  th { font-weight: bold; padding: 6px; border: 1px solid #000; text-align: left; }
  td { padding: 5px; border: 1px solid #ccc; vertical-align: top; }
  .title { font-size: 14pt; font-weight: bold; color: #000; }
  .meta { font-size: 10pt; color: #666; margin-bottom: 8px; }
</style></head>
<body>
  <div class="title">${escape(test.title)}</div>
  <div class="meta">${escape(test.className)} · ${escape(test.subjectName)} · ${test.totalQuestions} questions · ${test.totalMarks} marks · ${test.durationMins} min</div>
  <h3>Questions</h3>
  <table>
    <thead><tr>
      <th>#</th><th>Section</th><th>Type</th><th>Difficulty</th><th>Marks</th><th>Question</th>
      <th>Option A</th><th>Option B</th><th>Option C</th><th>Option D</th>
      <th>Bloom's</th><th>Topic</th><th>Chapter</th>
    </tr></thead>
    <tbody>${qRows.join("")}</tbody>
  </table>
  <br/>
  <h3>Answer Key</h3>
  <table>
    <thead><tr>
      <th>#</th><th>Type</th><th>Correct</th><th>Answer / Model Answer</th><th>Marks</th>
    </tr></thead>
    <tbody>${aRows.join("")}</tbody>
  </table>
</body></html>`;
}
