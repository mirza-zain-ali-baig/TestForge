"use client";

/**
 * PrintExportView — comprehensive "Print & Export" view for a GeneratedTest.
 *
 * Layout: top toolbar + two-column body
 *   • top toolbar           — export buttons, quick toggles, close
 *   • left  (380px)         — collapsible customization sections
 *   • right (flex-1)        — live iframe preview (optionally editable)
 *
 * The preview HTML is regenerated via useMemo whenever ANY control changes,
 * and pushed into the iframe through `srcDoc` for real-time updates.
 *
 * Export actions:
 *   • PDF    — opens a print window (user picks "Save as PDF")
 *   • Word   — downloads a Word-compatible .doc
 *   • Excel  — downloads an Excel-compatible .xls
 *   • Print  — prints the live iframe directly
 *
 * Live edit: toggling "Live edit" makes the iframe body contentEditable.
 * Click "Apply edits" to capture the edited HTML and use it for exports.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Printer,
  FileText,
  FileSpreadsheet,
  Download,
  Upload,
  Image as ImageIcon,
  Building2,
  Stamp,
  GraduationCap,
  Settings2,
  Trash2,
  Type,
  AlignJustify,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  KeyRound,
  PencilLine,
  Check,
  LayoutTemplate,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import type { GeneratedTest, GeneratedQuestion } from "@/lib/types";
import { saveTest } from "./lib";
import { exportTestToDocxBlob } from "@/lib/docx-export";

/* ------------------------------- Constants ------------------------------- */

/**
 * Header font families — includes the existing basics plus stylish
 * Google Fonts (Playfair Display, Cinzel, Cormorant Garamond, Marcellus, Cardo).
 * The Google Fonts <link> is injected into the preview HTML head (see GOOGLE_FONTS_LINK).
 */
const HEADER_FONT_FAMILIES = [
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

const PAPER_FONT_FAMILIES = [
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "Calibri, sans-serif", label: "Calibri" },
  { value: "'Courier New', monospace", label: "Courier New" },
] as const;

const PAPER_SIZES = [
  { value: "A4", label: "A4 (210 × 297 mm)", width: "210mm", height: "297mm" },
  { value: "Letter", label: "Letter (216 × 279 mm)", width: "216mm", height: "279mm" },
  { value: "Legal", label: "Legal (216 × 356 mm)", width: "216mm", height: "356mm" },
] as const;

const MARGIN_PRESETS = [
  { value: "Narrow", label: "Narrow (10 mm)", mm: 10 },
  { value: "Normal", label: "Normal (16 mm)", mm: 16 },
  { value: "Wide", label: "Wide (25 mm)", mm: 25 },
] as const;

const DATE_FORMATS = [
  { value: "Locale", label: "Aug 7, 2026" },
  { value: "DMY", label: "DD/MM/YYYY" },
  { value: "MDY", label: "MM/DD/YYYY" },
  { value: "ISO", label: "YYYY-MM-DD" },
] as const;

const GOOGLE_FONTS_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Cinzel:wght@700&family=Cormorant+Garamond:wght@700&family=Marcellus&family=Cardo:wght@700&display=swap" rel="stylesheet">';

/* ------------------------------ Helpers ---------------------------------- */

/** HTML-escape a string for safe interpolation. */
function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Extract a clean ordinal class label from the test's className.
 *   "Class 10"  → "10th"
 *   "10th"      → "10th"
 *   "10"        → "10th"
 *   ""          → "10th" (fallback)
 */
function extractClassNumber(className: string): string {
  const m = (className || "").match(/\d+/);
  if (!m) return "10th";
  return `${m[0]}th`;
}

/**
 * Convert minutes → humanized duration.
 *   ≤ 60 min  → "X min"
 *   >  60 min → "X hr Y min" (or "X hr" if exact)
 */
function formatDuration(mins: number): string {
  if (!mins || mins <= 0) return "0 min";
  if (mins <= 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date according to the given format code. */
function formatDate(date: Date, fmt: string): string {
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
function todayDate(fmt: string): string {
  return formatDate(new Date(), fmt);
}

/**
 * Auto-generate a 4-digit paper code (last 4 digits of timestamp).
 * No "PC-" prefix, no alphabet — e.g. "4827".
 */
function generatePaperCode(): string {
  const ts = Date.now().toString();
  return ts.slice(-4);
}

/* ------------------------- Preview options shape ------------------------- */

type PrintExportOpts = {
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
 * PDF export, and print. The iframe loads this via `srcDoc`.
 *
 * Implementation notes:
 *   • No test title line and no stats line in the body (per spec).
 *   • Watermarks use position:fixed so they repeat on every printed page.
 *   • Repeating header uses a <table><thead> structure (thead repeats in print).
 *   • Bordered sections use one <table> per section with border-collapse:collapse
 *     and margin:0 so cells are adjacent (no gap between rows).
 *   • Section headings (Objective Part / Subjective Part) are centered, bold,
 *     underlined, with the marks formula right-aligned on the same line.
 *   • Per-question marks ([1] / (1 marks)) are NOT rendered.
 *   • Question numbering is fixed by type: Question 1 = MCQ, 2 = Short, 3 = Long.
 */
function renderPreviewHTML(test: GeneratedTest, opts: PrintExportOpts): string {
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
   * Layout 2: logo LEFT, name (Arial 20pt bold) + location (Times New Roman
   *           11pt italic, left-aligned) stacked next to logo, followed by a
   *           bold horizontal rule.
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

  /* ---- Student info ----
   * Layout 1: fieldset/legend grid (4 columns, current default).
   * Layout 2: 3-column × 3-row professional exam-style table with bold labels
   *           and thin borders. Optional Syllabus cell appears in row 3 col 3;
   *           optional Exam label adds a 4th row.
   */
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

  // Layout 2 — 6-column table: label|value|label|value|label|value
  const lbl = (text: string) => `<td class="it-lbl"><b>${escape(text)}</b></td>`;
  const val = (text: string) => `<td class="it-val">${escape(text || "\u00A0")}</td>`;
  const infoRows: string[] = [
    `<tr>${lbl("Name:")}${val(opts.studentName)}${lbl("Roll No:")}${val(opts.rollNumber)}${lbl("Date:")}${val(opts.examDate)}</tr>`,
    `<tr>${lbl("Subject:")}${val(opts.subjectNameInput)}${lbl("Total Marks:")}${val(opts.totalMarksInput)}${lbl("Time Allowed:")}${val(opts.timeAllowed)}</tr>`,
  ];
  // Row 3: Class | Paper Code | Syllabus (or Exam label)
  const thirdRowThirdLabel = opts.showExamSyllabus ? "Syllabus:" : (opts.showExamLabel ? "Exam:" : "");
  const thirdRowThirdValue = opts.showExamSyllabus ? opts.examSyllabus : (opts.showExamLabel ? opts.examLabel : "");
  infoRows.push(
    `<tr>${lbl("Class:")}${val(opts.classNameInput)}${lbl("Paper Code:")}${val(opts.paperCode)}${thirdRowThirdLabel ? lbl(thirdRowThirdLabel) : "<td></td>"}${thirdRowThirdValue ? val(thirdRowThirdValue) : "<td></td>"}</tr>`
  );
  // Optional 4th row: Exam label (if both syllabus and exam are shown)
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

  /* ---- Bubble sheet (4-column layout, BEFORE instructions) ---- */
  const mcqSections = test.sections.filter((s) => s.type_name === "MCQ");
  const shortSections = test.sections.filter((s) => s.type_name === "Short");
  const longSections = test.sections.filter((s) => s.type_name === "Long");

  /* Column-wise bubble grid: fill down each column before moving to the
   * next. With N total MCQs and 4 columns, each column gets ceil(N/4) rows. */
  const totalMcqs = mcqSections.reduce(
    (sum, sec) => sum + sec.questions.length,
    0
  );
  const bsRowsPerCol = totalMcqs > 0 ? Math.ceil(totalMcqs / 4) : 1;

  const bubbleSheetHtml =
    opts.showBubbleSheet && mcqSections.length > 0
      ? (() => {
          let qn = 0;
          const cells: string[] = [];
          mcqSections.forEach((sec) => {
            sec.questions.forEach(() => {
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

  /* ---- Sections with proper headings ---- */
  const subjectiveTotal = [...shortSections, ...longSections].reduce(
    (sum, s) => sum + s.sectionMarks,
    0
  );

  let subjectivePartRendered = false;
  const sectionsHtml = (() => {
    const parts: string[] = [];
    test.sections.forEach((sec) => {
      const isMcq = sec.type_name === "MCQ";
      const isShort = sec.type_name === "Short";
      const isLong = sec.type_name === "Long";
      const useBorder = isMcq
        ? opts.mcqBorder
        : isShort
          ? opts.shortBorder
          : opts.longBorder;
      // MCQ Layout 2 always renders as a 6-column table (ignores mcqBorder).
      const useMcqTable = isMcq && opts.mcqLayout === 2;

      // Fixed numbering by type: MCQ=1, Short=2, Long=3
      const qNum = isMcq ? 1 : isShort ? 2 : isLong ? 3 : 1;

      // Section heading (Objective Part / Subjective Part) — no marks on these
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

      // Per-question marks formula on the question heading row — in brackets
      const qFormula = `(${sec.marksPerQuestion}×${sec.questions.length}=${sec.sectionMarks})`;
      // Add instruction text per question type
      const instructionText = isMcq
        ? "Attempt all MCQs"
        : isShort
          ? "Attempt all Short Questions"
          : "Attempt all Long Questions";
      const questionHeading = `<h3 class="question-heading">Question ${qNum}. ${instructionText} <span class="marks-formula">${qFormula}</span></h3>`;

      // Build question body — single <table> per bordered section so cells are
      // adjacent (border-collapse:collapse + margin:0 → no gap between rows).
      let body: string;
      if (useMcqTable) {
        // MCQ Layout 2: 6-column table (Q.No · Question · A · B · C · D)
        const mcqRows = sec.questions
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
        const rows = sec.questions
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

  /* ---- Answer Key (MCQ only, at the end) ---- */
  const answerKeyHtml =
    opts.printAnswerKey && mcqSections.length > 0
      ? (() => {
          let n = 0;
          const parts = mcqSections
            .map((sec, si) => {
              const items = sec.questions
                .map((q) => {
                  n++;
                  return q.options
                    ? `<span class="aki"><b>${n}.</b> <b class="akc">${q.options.correct_option}</b></span>`
                    : "";
                })
                .join("\u00A0\u00A0");
              return `<div class="ak-sec"><h4>Section ${String.fromCharCode(65 + si)}</h4><div class="ak-in">${items}</div></div>`;
            })
            .join("");
          return `<section class="answer-key"><h3 class="ak-title">Answer Key</h3>${parts}</section>`;
        })()
      : "";

  /* ---- Watermarks (text and/or image) — position:fixed so they repeat on every page ---- */
  const watermarkTextHtml = opts.watermarkText
    ? `<div class="wm-text">${escape(opts.watermarkText)}</div>`
    : "";
  const watermarkImageHtml = opts.watermarkImage
    ? `<div class="wm-image" style="background-image:url('${opts.watermarkImage}');"></div>`
    : "";

  /* ---- Header (with optional repeat on every printed page) ----
   * When repeatHeader is on, the academy header + student info are wrapped
   * in a <table><thead><tr><td>…</td></tr></thead><tbody><tr><td>… main content …</td></tr></tbody></table>
   * structure. Browsers repeat <thead> on every printed page. */
  const headerContent = `${academyHtml}${studentInfoHtml}`;
  const headerOpen = opts.repeatHeader
    ? `<table class="header-table"><thead><tr><td>${headerContent}</td></tr></thead><tbody><tr><td class="body-cell">`
    : `<div class="page-header">${headerContent}</div>`;
  const headerClose = opts.repeatHeader ? `</td></tr></tbody></table>` : "";

  /* ---- Page-number footer (via @page margin box, only in print) ---- */
  const pageNumberCss = opts.showPageNumbers
    ? `@page { @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #555; } }`
    : "";

  /* ---- HTML title (used for tab/window, not rendered in body) ---- */
  const htmlTitle = test.title || `${test.subjectName} Examination`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escape(htmlTitle)}</title>
${GOOGLE_FONTS_LINK}
<style>
  @page { size: ${paperSize.value}; margin: ${margins}mm; }
  ${pageNumberCss}

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #e2e8f0;
    font-family: ${pf};
    padding: 16px;
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
    overflow: hidden;
    color: #111;
    line-height: 1.5;
    font-size: ${fs}pt;
    font-family: ${pf};
  }

  /* Watermarks — position:fixed so they repeat on every printed page */
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
    background-size: ${opts.watermarkSize}%; /* smaller watermark logo */
  }
  @media print {
    .wm-image {
      opacity: 0.05;
      background-size: ${opts.watermarkSize}%;
      position: fixed;
      display: block;
    }
  }

  /* Academy header — Layout 1 (centered) */
  .academy {
    display: flex;
    align-items: center;
    gap: 16px;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 12px;
    position: relative;
    z-index: 1;
  }
  .academy-logo { flex-shrink: 0; }
  .academy-text { flex: 1; text-align: center; }
  .academy-name { font-weight: 800; color: #000; line-height: 1.1; }
  .academy-loc {
    font-size: ${Math.max(fs - 2, 8)}pt;
    color: #555;
    margin-top: 4px;
    white-space: pre-line; /* preserve newlines from textarea (multi-campus) */
  }

  /* Academy header — Layout 2 (logo left, name + location left-aligned, HR) */
  .academy-l2 {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 6px;
    position: relative;
    z-index: 1;
  }
  .academy-text-l2 { flex: 1; text-align: left; }
  .academy-name-l2 { /* inline styles applied directly */ }
  .academy-loc-l2 { /* inline styles applied directly */ }
  .academy-hr-l2 {
    border: 0;
    border-top: 2px solid #000;
    margin: 6px 0 10px;
  }

  /* Header table (repeats on each printed page via thead) */
  .header-table { width: 100%; border-collapse: collapse; }
  .header-table td { border: none; padding: 0; vertical-align: top; }
  .body-cell { padding: 0; }

  /* Student info fieldset grid (4 cols, short height, bold legends) */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 10px 0;
    position: relative; z-index: 1;
  }
  .fld {
    border: 1px solid #000;
    border-radius: 0;
    padding: 3px 6px 1px; /* shorter fieldset */
    background: #fff;
    min-height: 22px;
    margin: 0;
  }
  .fld legend {
    font-size: ${Math.max(fs - 3, 7)}pt;
    font-weight: 700; /* bold legend */
    color: #444;
    background: #fff;
    padding: 0 4px;
  }
  .fld-val { font-size: ${fs}pt; font-family: ${pf}; }

  /* Student info table — Layout 2 (professional exam-style, 3 cols × 3 rows) */
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

  /* Bubble sheet (column-wise 4-col grid, no gap between borders, no title) */
  .bubble-sheet {
    margin-top: 14px;
    position: relative; z-index: 1;
  }
  .bs-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0; /* no gap between borders */
    /* grid-template-rows + grid-auto-flow:column are set inline based on ceil(N/4) */
  }
  .bs-cell {
    border: 1px solid #000;
    padding: 4px 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: ${Math.max(fs - 1, 9)}pt;
    font-family: ${pf};
    margin: 0; /* no margin — borders touch */
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

  /* Instructions */
  .instructions {
    margin-top: 10px;
    background: #fff;
    padding: 6px 10px;
    font-family: ${pf};
    font-size: ${Math.max(fs - 1, 9)}pt;
    border-left: 3px solid #047857;
    position: relative; z-index: 1;
  }

  /* Sections */
  .test-section {
    margin-top: 16px;
    position: relative; z-index: 1;
  }
  /* Section headings: centered, bold (no underline); marks formula right-aligned on same line.
     Headings use the header font; body text uses the paper font. */
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

  /* Bordered question tables — single table per section,
     border-collapse:collapse + margin:0 so cells are adjacent (no gap) */
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

  /* MCQ Layout 2 — 6-column question table */
  table.mcq-table th { text-align: center; }
  table.mcq-table td.qn { text-align: center; }

  /* Answer key */
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

  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; width: auto; min-height: auto; margin: 0; padding: 0; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
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

function renderExcelHTML(test: GeneratedTest): string {
  const escape = escapeHtml;
  let qn = 0;
  const qRows: string[] = [];
  const aRows: string[] = [];

  test.sections.forEach((sec, si) => {
    sec.questions.forEach((q) => {
      qn++;
      const correctText = q.options
        ? q.options[
            `option_${q.options.correct_option.toLowerCase()}` as
              | "option_a"
              | "option_b"
              | "option_c"
              | "option_d"
          ]
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
  th { font-weight: bold; font-weight: bold; padding: 6px; border: 1px solid #000; text-align: left; }
  td { padding: 5px; border: 1px solid #ccc; vertical-align: top; }
  tr:nth-child(even) {  }
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

/* --------------------------- Component shell ----------------------------- */

export function PrintExportView({
  test,
  onClose,
}: {
  test: GeneratedTest;
  onClose: () => void;
}) {
  /* ---- Academy header state ---- */
  const [academyName, setAcademyName] = useState("");
  const [academyLocation, setAcademyLocation] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<number>(90);
  const [headerFont, setHeaderFont] = useState<string>("Arial, sans-serif");
  const [headerSize, setHeaderSize] = useState<number>(20);
  const [paperFont, setPaperFont] = useState<string>("'Times New Roman', serif");
  const [fontSize, setFontSize] = useState<number>(9); // default 9pt (was 12)
  const [topMargin, setTopMargin] = useState<number>(6); // default 6mm (was 0)

  /* ---- Layout state ---- */
  const [paperSize, setPaperSize] = useState<string>("A4");
  const [marginPreset, setMarginPreset] = useState<string>("Normal");
  const [dateFormat, setDateFormat] = useState<string>("Locale");

  /* ---- Student info state ---- */
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [classNameInput, setClassNameInput] = useState(
    extractClassNumber(test.className)
  );
  // Paper code auto-generated once via lazy initializer (4 digits, last 4 of timestamp).
  const [paperCode, setPaperCode] = useState<string>(() => generatePaperCode());
  const [subjectNameInput, setSubjectNameInput] = useState(
    test.subjectName || ""
  );
  const [timeAllowed, setTimeAllowed] = useState(
    formatDuration(test.durationMins)
  );
  const [totalMarksInput, setTotalMarksInput] = useState(
    String(test.totalMarks)
  );
  const [examDate, setExamDate] = useState<string>(() => todayDate("Locale"));
  const [examSyllabus, setExamSyllabus] = useState("L1");
  const [showExamSyllabus, setShowExamSyllabus] = useState(false);
  const [examLabel, setExamLabel] = useState("Mid Term");
  const [showExamLabel, setShowExamLabel] = useState(false);

  /* ---- Paper options state ---- */
  const [printAnswerKey, setPrintAnswerKey] = useState(true);
  const [showBubbleSheet, setShowBubbleSheet] = useState(true); // enabled by default
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null);
  const [watermarkSize, setWatermarkSize] = useState<number>(40); // percentage of page width
  const [mcqBorder, setMcqBorder] = useState(true);
  const [shortBorder, setShortBorder] = useState(false);
  const [longBorder, setLongBorder] = useState(false);
  const [repeatHeader, setRepeatHeader] = useState(false);
  const [separateSubjectivePart, setSeparateSubjectivePart] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(false);

  /* ---- Layout toggles (header & MCQ rendering variants) ---- */
  const [headerLayout, setHeaderLayout] = useState<1 | 2>(1);
  const [mcqLayout, setMcqLayout] = useState<1 | 2>(1);
  const [academyLocBold, setAcademyLocBold] = useState(false);
  const [headerLineSpacing, setHeaderLineSpacing] = useState(1.4);

  /* ---- Live edit state ---- */
  const [liveEdit, setLiveEdit] = useState(false);
  const [editedHtml, setEditedHtml] = useState<string | null>(null);

  /* ---- iframe ref for direct printing ---- */
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  /* ---- Memoized preview options ---- */
  const opts: PrintExportOpts = useMemo(
    () => ({
      academyName,
      academyLocation,
      logoDataUrl,
      logoSize,
      headerFont,
      headerSize,
      paperFont,
      fontSize,
      topMargin,
      paperSize,
      marginPreset,
      studentName,
      rollNumber,
      classNameInput,
      paperCode,
      subjectNameInput,
      timeAllowed,
      totalMarksInput,
      examDate,
      examSyllabus,
      showExamSyllabus,
      examLabel,
      showExamLabel,
      dateFormat,
      printAnswerKey,
      showBubbleSheet,
      watermarkText,
      watermarkImage,
      watermarkSize,
      mcqBorder,
      shortBorder,
      longBorder,
      repeatHeader,
      separateSubjectivePart,
      showPageNumbers,
      headerLayout,
      mcqLayout,
      academyLocBold,
      headerLineSpacing,
    }),
    [
      academyName,
      academyLocation,
      logoDataUrl,
      logoSize,
      headerFont,
      headerSize,
      paperFont,
      fontSize,
      topMargin,
      paperSize,
      marginPreset,
      studentName,
      rollNumber,
      classNameInput,
      paperCode,
      subjectNameInput,
      timeAllowed,
      totalMarksInput,
      examDate,
      examSyllabus,
      showExamSyllabus,
      examLabel,
      showExamLabel,
      dateFormat,
      printAnswerKey,
      showBubbleSheet,
      watermarkText,
      watermarkImage,
      watermarkSize,
      mcqBorder,
      shortBorder,
      longBorder,
      repeatHeader,
      separateSubjectivePart,
      showPageNumbers,
      headerLayout,
      mcqLayout,
      academyLocBold,
      headerLineSpacing,
    ]
  );

  /* ---- Memoized preview HTML (regenerated on ANY control change) ---- */
  const previewHtml = useMemo(() => renderPreviewHTML(test, opts), [test, opts]);

  /* ---- Preview HTML tracking ----
   * When controls change, clear editedHtml so the fresh preview is used.
   * The iframe always shows previewHtml (so controls work live).
   * Exports use editedHtml (if set) so user's manual edits are preserved. */
  const [prevPreview, setPrevPreview] = useState(previewHtml);
  if (previewHtml !== prevPreview) {
    setPrevPreview(previewHtml);
    setEditedHtml(null); // clear stale edits when controls change
  }

  /* ---- Toggle contentEditable on iframe body + preserve scroll position ----
   * Re-applied after every srcDoc change (iframe reloads) and on liveEdit toggle.
   * Saves scroll position before reload and restores it after. */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Save scroll position before iframe reloads
    let savedScroll = 0;
    try {
      savedScroll = iframe.contentWindow?.scrollY ?? 0;
    } catch { /* ignore */ }
    const apply = () => {
      try {
        const doc = iframe.contentWindow?.document;
        if (doc?.body) {
          doc.body.contentEditable = liveEdit ? "true" : "false";
          // Restore scroll position after reload
          if (savedScroll > 0) {
            iframe.contentWindow?.scrollTo(0, savedScroll);
          }
        }
      } catch {
        /* ignore cross-origin or not-yet-ready iframe */
      }
    };
    iframe.addEventListener("load", apply);
    apply();
    return () => iframe.removeEventListener("load", apply);
  }, [liveEdit, previewHtml, editedHtml]);

  /* ---- The srcDoc for the iframe: always use fresh previewHtml so controls work.
   * Exports (PDF/Word/Excel) use editedHtml if set, otherwise previewHtml. */
  const effectiveSrcDoc = previewHtml;
  const exportHtml = editedHtml ?? previewHtml;

  /* ------------------------------- Actions ------------------------------- */

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleWatermarkImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setWatermarkImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  /* ---- Rich text formatting command (execCommand on iframe) ---- */
  const execCmd = (cmd: string, value?: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.document.execCommand(cmd, false, value);
    } catch {
      // ignore
    }
  };

  /* ---- Apply edits: read iframe body HTML and save for exports ---- */
  const handleApplyEdits = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      toast.error("Preview not ready");
      return;
    }
    try {
      const doc = iframe.contentWindow.document;
      const fullHtml = "<!DOCTYPE html>" + doc.documentElement.outerHTML;
      setEditedHtml(fullHtml);
      toast.success("Edits applied — exports will use the edited version");
    } catch {
      toast.error("Could not read edits from preview");
    }
  };

  const handleExportPDF = () => {
    const html = exportHtml;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Pop-up blocked. Allow pop-ups to export PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
    toast.success("Opening print window for PDF…");
  };

  const handleExportWord = async () => {
    try {
      toast.info("Generating Word document (.docx)...");
      const blob = await exportTestToDocxBlob(test, {
        academyName,
        academyLocation,
        examLabel: showExamLabel ? examLabel : (test.title || "Examination Paper"),
        studentName,
        rollNumber,
        className: classNameInput || test.className,
        subjectName: subjectNameInput || test.subjectName,
        timeAllowed,
        totalMarks: totalMarksInput || test.totalMarks,
        examDate,
        printStudentInfo: true,
        printAnswerKey,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(test.title || "exam_paper").replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word document (.docx) exported successfully");
    } catch (e) {
      console.error("DOCX export error:", e);
      toast.error(e instanceof Error ? `Export failed: ${e.message}` : "Failed to export Word document");
    }
  };

  const handleExportExcel = () => {
    const html = renderExcelHTML(test);
    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(test.title || "exam_paper").replace(/\s+/g, "_")}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel spreadsheet exported");
  };

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) {
      toast.error("Preview not ready yet.");
      return;
    }
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      toast.success("Print dialog opened");
    } catch {
      toast.error("Could not print the preview.");
    }
  };

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTest(test);
      setSaved(true);
      toast.success("Test saved to My Tests");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshPaperCode = () => {
    setPaperCode(generatePaperCode());
    toast.success("New paper code generated");
  };

  /* ---- Date format change: re-format existing examDate ---- */
  const handleDateFormatChange = (fmt: string) => {
    setDateFormat(fmt);
    const parsed = new Date(examDate);
    if (!isNaN(parsed.getTime())) {
      setExamDate(formatDate(parsed, fmt));
    } else {
      setExamDate(todayDate(fmt));
    }
  };

  /* ----------------------------- UI helpers ----------------------------- */

  const inputCls = "h-8 text-xs";
  const labelCls = "text-[11px] font-medium text-muted-foreground mb-1";

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ===== Top toolbar ===== */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <Printer className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Print &amp; Export</h1>
            <p className="text-[10px] text-white/80">
              {test.title || `${test.subjectName} Examination`} ·{" "}
              {test.totalQuestions} Q · {test.totalMarks} marks
            </p>
          </div>
        </div>

        {/* Quick toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <QuickToggle
            active={headerLayout === 2}
            onClick={() => setHeaderLayout((v) => (v === 1 ? 2 : 1))}
            icon={<LayoutTemplate className="h-3.5 w-3.5" />}
            label={headerLayout === 2 ? "Header L2" : "Header L1"}
          />
          <QuickToggle
            active={mcqLayout === 2}
            onClick={() => setMcqLayout((v) => (v === 1 ? 2 : 1))}
            icon={<LayoutTemplate className="h-3.5 w-3.5" />}
            label={mcqLayout === 2 ? "MCQ L2" : "MCQ L1"}
          />
          <QuickToggle
            active={showBubbleSheet}
            onClick={() => setShowBubbleSheet((v) => !v)}
            icon={<ListChecks className="h-3.5 w-3.5" />}
            label="Bubble sheet"
          />
          <QuickToggle
            active={printAnswerKey}
            onClick={() => setPrintAnswerKey((v) => !v)}
            icon={<KeyRound className="h-3.5 w-3.5" />}
            label="Answer key"
          />
          <QuickToggle
            active={liveEdit}
            onClick={() => {
              if (liveEdit) {
                // Currently editing → apply changes and turn off
                handleApplyEdits();
                setLiveEdit(false);
              } else {
                // Turn on live edit (clear any previous edits)
                setEditedHtml(null);
                setLiveEdit(true);
              }
            }}
            icon={liveEdit ? <Check className="h-3.5 w-3.5" /> : <PencilLine className="h-3.5 w-3.5" />}
            label={liveEdit ? "Apply changes" : "Live edit"}
          />
          {/* Rich text formatting toolbar — only visible during live edit */}
          {liveEdit && (
            <div className="flex items-center gap-1 border-l border-white/20 pl-2">
              <select
                className="h-7 rounded border border-white/20 bg-white/10 px-1 text-[10px] text-white"
                onChange={(e) => execCmd("fontName", e.target.value)}
                defaultValue=""
                title="Font family"
              >
                <option value="" disabled className="text-black">Font</option>
                <option value="Arial, sans-serif" className="text-black">Arial</option>
                <option value="'Times New Roman', serif" className="text-black">Times New Roman</option>
                <option value="Georgia, serif" className="text-black">Georgia</option>
                <option value="Calibri, sans-serif" className="text-black">Calibri</option>
                <option value="'Courier New', monospace" className="text-black">Courier</option>
              </select>
              <select
                className="h-7 rounded border border-white/20 bg-white/10 px-1 text-[10px] text-white"
                onChange={(e) => execCmd("fontSize", e.target.value)}
                defaultValue=""
                title="Font size"
              >
                <option value="" disabled className="text-black">Size</option>
                <option value="1" className="text-black">8pt</option>
                <option value="2" className="text-black">10pt</option>
                <option value="3" className="text-black">12pt</option>
                <option value="4" className="text-black">14pt</option>
                <option value="5" className="text-black">18pt</option>
                <option value="6" className="text-black">24pt</option>
              </select>
              <button
                className="flex h-7 w-7 items-center justify-center rounded border border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => execCmd("bold")}
                title="Bold"
              >
                <b className="text-xs">B</b>
              </button>
              <button
                className="flex h-7 w-7 items-center justify-center rounded border border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => execCmd("italic")}
                title="Italic"
              >
                <i className="text-xs">I</i>
              </button>
              <button
                className="flex h-7 w-7 items-center justify-center rounded border border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => execCmd("underline")}
                title="Underline"
              >
                <u className="text-xs">U</u>
              </button>
              <button
                className="flex h-7 items-center justify-center rounded border border-white/20 bg-white/10 px-1.5 text-white hover:bg-white/20"
                onClick={() => execCmd("foreColor", "#047857")}
                title="Green text"
              >
                <span className="text-xs" style={{ color: "#4ade80" }}>A</span>
              </button>
              <button
                className="flex h-7 items-center justify-center rounded border border-white/20 bg-white/10 px-1.5 text-white hover:bg-white/20"
                onClick={() => execCmd("foreColor", "#000000")}
                title="Black text"
              >
                <span className="text-xs">A</span>
              </button>
            </div>
          )}
        </div>

        {/* Export buttons + close */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={handleExportPDF}
            className="h-8 bg-white text-xs text-emerald-700 hover:bg-white/90"
          >
            <Download className="mr-1 h-3.5 w-3.5" /> PDF
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExportWord}
            className="h-8 bg-white/15 text-xs text-white hover:bg-white/25"
          >
            <FileText className="mr-1 h-3.5 w-3.5" /> Word (.docx)
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExportExcel}
            className="h-8 bg-white/15 text-xs text-white hover:bg-white/25"
          >
            <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Excel
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="h-8 bg-emerald-700 text-xs text-white hover:bg-emerald-800"
          >
            <Printer className="mr-1 h-3.5 w-3.5" /> Print
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || saved}
            className="h-8 bg-amber-600 text-xs text-white hover:bg-amber-700"
          >
            {saved ? (
              <>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Saved
              </>
            ) : (
              <>
                <Save className="mr-1 h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
              </>
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/15"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ===== Two-column body ===== */}
      <div className="flex min-h-0 flex-1">
        {/* ===== Left column: collapsible controls (380px scrollable) ===== */}
        <aside className="w-[380px] shrink-0 overflow-y-auto border-r bg-background">
          <div className="space-y-2 p-2">
            {/* ---------- Academy Header ---------- */}
            <CollapsibleSection
              icon={<Building2 className="h-4 w-4" />}
              title="Academy Header"
              defaultOpen
            >
              {/* Logo upload */}
              <div>
                <Label className={labelCls}>Logo (image)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex h-8 cursor-pointer items-center gap-1 rounded-md border bg-background px-2 text-[11px] hover:bg-accent">
                    <Upload className="h-3 w-3" />
                    {logoDataUrl ? "Change" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {logoDataUrl && (
                    <>
                      <img
                        src={logoDataUrl}
                        alt="logo"
                        className="h-8 w-8 rounded border object-contain"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[11px] text-destructive"
                        onClick={() => setLogoDataUrl(null)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Logo size slider (40-150px) */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Logo size</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {logoSize}px
                  </span>
                </div>
                <Slider
                  value={[logoSize]}
                  min={40}
                  max={150}
                  step={1}
                  onValueChange={(v) => setLogoSize(v[0])}
                  className="mt-2"
                />
              </div>

              {/* Academy name */}
              <div>
                <Label className={labelCls}>Academy name</Label>
                <Input
                  value={academyName}
                  onChange={(e) => setAcademyName(e.target.value)}
                  placeholder="e.g. Greenwood High School"
                  className={inputCls}
                />
              </div>

              {/* Academy location — multi-line textarea (one campus per line) */}
              <div>
                <Label className={labelCls}>
                  Academy location (one campus per line)
                </Label>
                <Textarea
                  value={academyLocation}
                  onChange={(e) => setAcademyLocation(e.target.value)}
                  placeholder={"e.g.\nLahore Campus\nKarachi Campus\nIslamabad Campus"}
                  rows={3}
                  className="min-h-[60px] text-xs"
                />
              </div>

              {/* Academy name font family (includes stylish Google Fonts) */}
              <div>
                <Label className={labelCls}>Academy name font</Label>
                <Select value={headerFont} onValueChange={setHeaderFont}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEADER_FONT_FAMILIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Academy name font size (12-36pt) */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Academy name size</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {headerSize}pt
                  </span>
                </div>
                <Slider
                  value={[headerSize]}
                  min={12}
                  max={36}
                  step={1}
                  onValueChange={(v) => setHeaderSize(v[0])}
                  className="mt-2"
                />
              </div>

              {/* Academy location bold toggle */}
              <div className="flex items-center justify-between">
                <Label className={labelCls}>Academy details bold</Label>
                <Switch checked={academyLocBold} onCheckedChange={setAcademyLocBold} />
              </div>

              {/* Header line spacing */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Header line spacing</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {headerLineSpacing.toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={[headerLineSpacing * 10]}
                  min={10}
                  max={30}
                  step={1}
                  onValueChange={(v) => setHeaderLineSpacing(v[0] / 10)}
                  className="mt-2"
                />
              </div>
            </CollapsibleSection>

            {/* ---------- Paper & Layout ---------- */}
            <CollapsibleSection
              icon={<LayoutTemplate className="h-4 w-4" />}
              title="Paper & Layout"
              defaultOpen
            >
              {/* Paper size */}
              <div>
                <Label className={labelCls}>Paper size</Label>
                <Select value={paperSize} onValueChange={setPaperSize}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_SIZES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Margins preset */}
              <div>
                <Label className={labelCls}>Margins</Label>
                <Select value={marginPreset} onValueChange={setMarginPreset}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARGIN_PRESETS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Paper font family */}
              <div>
                <Label className={labelCls}>
                  <Type className="mr-1 inline h-3 w-3" />
                  Paper font
                </Label>
                <Select value={paperFont} onValueChange={setPaperFont}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_FONT_FAMILIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Paper font size (8-16pt) */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Paper font size</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {fontSize}pt
                  </span>
                </div>
                <Slider
                  value={[fontSize]}
                  min={8}
                  max={16}
                  step={1}
                  onValueChange={(v) => setFontSize(v[0])}
                  className="mt-2"
                />
              </div>

              {/* Top margin override (0-50mm) */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Top margin (override)</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {topMargin}mm
                  </span>
                </div>
                <Slider
                  value={[topMargin]}
                  min={0}
                  max={50}
                  step={1}
                  onValueChange={(v) => setTopMargin(v[0])}
                  className="mt-2"
                />
              </div>
            </CollapsibleSection>

            {/* ---------- Student Info ---------- */}
            <CollapsibleSection
              icon={<GraduationCap className="h-4 w-4" />}
              title="Student Info"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className={labelCls}>Student Name</Label>
                  <Input
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="—"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Roll Number</Label>
                  <Input
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="—"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Class</Label>
                  <Input
                    value={classNameInput}
                    onChange={(e) => setClassNameInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Paper Code (4 digits)</Label>
                  <div className="flex gap-1">
                    <Input
                      value={paperCode}
                      onChange={(e) =>
                        setPaperCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      className={inputCls}
                      maxLength={4}
                      inputMode="numeric"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 px-2"
                      onClick={handleRefreshPaperCode}
                      title="Regenerate code"
                    >
                      <AlignJustify className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className={labelCls}>Subject</Label>
                  <Input
                    value={subjectNameInput}
                    onChange={(e) => setSubjectNameInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Time Allowed</Label>
                  <Input
                    value={timeAllowed}
                    onChange={(e) => setTimeAllowed(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Total Marks</Label>
                  <Input
                    value={totalMarksInput}
                    onChange={(e) => setTotalMarksInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Exam Date</Label>
                  <Input
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Date format selector */}
              <div>
                <Label className={labelCls}>Date format</Label>
                <Select
                  value={dateFormat}
                  onValueChange={handleDateFormatChange}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Exam Syllabus toggle + input */}
              <div className="mt-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Exam Syllabus</Label>
                  <Switch
                    checked={showExamSyllabus}
                    onCheckedChange={setShowExamSyllabus}
                  />
                </div>
                {showExamSyllabus && (
                  <Input
                    value={examSyllabus}
                    onChange={(e) => setExamSyllabus(e.target.value)}
                    placeholder="e.g. L1 to L5"
                    className="mt-2 h-8 text-xs"
                  />
                )}
              </div>

              {/* Exam Label toggle + input */}
              <div className="mt-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Exam Label</Label>
                  <Switch
                    checked={showExamLabel}
                    onCheckedChange={setShowExamLabel}
                  />
                </div>
                {showExamLabel && (
                  <Input
                    value={examLabel}
                    onChange={(e) => setExamLabel(e.target.value)}
                    placeholder="e.g. Mid Term"
                    className="mt-2 h-8 text-xs"
                  />
                )}
              </div>
            </CollapsibleSection>

            {/* ---------- Paper Options ---------- */}
            <CollapsibleSection
              icon={<Settings2 className="h-4 w-4" />}
              title="Paper Options"
            >
              <ToggleRow
                label="Answer key (MCQ only)"
                checked={printAnswerKey}
                onCheckedChange={setPrintAnswerKey}
              />
              <ToggleRow
                label="Bubble sheet"
                checked={showBubbleSheet}
                onCheckedChange={setShowBubbleSheet}
              />
              <ToggleRow
                label="Repeat header on each page"
                checked={repeatHeader}
                onCheckedChange={setRepeatHeader}
              />
              <ToggleRow
                label="Separate subjective part (page break)"
                checked={separateSubjectivePart}
                onCheckedChange={setSeparateSubjectivePart}
              />
              <ToggleRow
                label="Page numbers (Page X of Y)"
                checked={showPageNumbers}
                onCheckedChange={setShowPageNumbers}
              />

              {/* Border toggles */}
              <div className="mt-2">
                <Label className={labelCls}>Section borders</Label>
                <div className="mt-1 space-y-1.5">
                  <ToggleRow
                    label="MCQ border"
                    checked={mcqBorder}
                    onCheckedChange={setMcqBorder}
                  />
                  <ToggleRow
                    label="Short border"
                    checked={shortBorder}
                    onCheckedChange={setShortBorder}
                  />
                  <ToggleRow
                    label="Long border"
                    checked={longBorder}
                    onCheckedChange={setLongBorder}
                  />
                </div>
              </div>

              {/* Watermark text */}
              <div className="mt-2">
                <Label className={labelCls}>
                  <Stamp className="mr-1 inline h-3 w-3" />
                  Watermark text
                </Label>
                <Input
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="e.g. SAMPLE"
                  className={inputCls}
                />
              </div>

              {/* Watermark image */}
              <div>
                <Label className={labelCls}>Watermark image (optional)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex h-8 cursor-pointer items-center gap-1 rounded-md border bg-background px-2 text-[11px] hover:bg-accent">
                    <ImageIcon className="h-3 w-3" />
                    {watermarkImage ? "Change" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleWatermarkImageUpload}
                    />
                  </label>
                  {watermarkImage && (
                    <>
                      <img
                        src={watermarkImage}
                        alt="watermark"
                        className="h-8 w-8 rounded border object-contain opacity-60"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[11px] text-destructive"
                        onClick={() => setWatermarkImage(null)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Watermark size */}
              {watermarkImage && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className={labelCls}>Watermark size</Label>
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {watermarkSize}%
                    </span>
                  </div>
                  <Slider
                    value={[watermarkSize]}
                    min={10}
                    max={80}
                    step={5}
                    onValueChange={(v) => setWatermarkSize(v[0])}
                    className="mt-2"
                  />
                </div>
              )}
            </CollapsibleSection>

            <p className="flex items-start gap-1 px-2 pb-2 text-[10px] text-muted-foreground">
              <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-emerald-500" />
              <span>
                PDF opens a print window — choose “Save as PDF” as the
                destination. Word &amp; Excel download directly. Toggle “Live
                edit” to tweak text inline in the preview, then click “Apply
                edits” to save.
              </span>
            </p>
          </div>
        </aside>

        {/* ===== Right column: live preview ===== */}
        <main className="flex min-h-0 flex-1 flex-col bg-slate-200/60 p-3 dark:bg-slate-900/40">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  liveEdit ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                {liveEdit
                  ? "Live edit ON — click text in the preview to edit, then click “Apply edits”."
                  : "Live preview · updates as you type"}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {paperSize} · {marginPreset} · {fontSize}pt · {topMargin}mm top
            </span>
          </div>
          <iframe
            ref={iframeRef}
            title="Paper preview"
            srcDoc={effectiveSrcDoc}
            className={`h-full w-full flex-1 rounded-lg border bg-white shadow-xl ${
              liveEdit
                ? "border-amber-500 ring-2 ring-amber-400/50"
                : "border-slate-300 dark:border-slate-700"
            }`}
          />
        </main>
      </div>
    </div>
  );
}

/* --------------------------- Small UI helpers ---------------------------- */

/** Quick toggle button for the top toolbar (active = white, inactive = translucent). */
function QuickToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition ${
        active
          ? "bg-white text-emerald-700"
          : "bg-white/15 text-white hover:bg-white/25"
      }`}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}

/** Collapsible section with a header (icon + title + chevron) and content. */
function CollapsibleSection({
  icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 border-b bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2 text-left transition hover:bg-emerald-100/60 dark:from-emerald-950/30 dark:to-teal-950/30"
          >
            <span className="text-emerald-600">{icon}</span>
            <h3 className="flex-1 text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              {title}
            </h3>
            <ChevronDown
              className={`h-4 w-4 text-emerald-700 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2.5 p-3">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/** Row with a label and a switch toggle. */
function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background/50 px-2.5 py-1.5">
      <Label className="cursor-pointer text-xs font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
