/**
 * docx-export.ts
 * Generates genuine Microsoft Word (.docx) OpenXML documents for ExamForge tests.
 * 100% compliant with MS Word 2016+, Office 365, LibreOffice, and Google Docs.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
import type { GeneratedTest, GeneratedQuestion } from "./types";

export interface DocxExportOptions {
  academyName?: string;
  academyLocation?: string;
  examLabel?: string;
  studentName?: string;
  rollNumber?: string;
  className?: string;
  subjectName?: string;
  timeAllowed?: string;
  totalMarks?: string | number;
  examDate?: string;
  printStudentInfo?: boolean;
  printAnswerKey?: boolean;
}

export async function exportTestToDocxBlob(
  test: GeneratedTest,
  opts: DocxExportOptions = {}
): Promise<Blob> {
  const academyName = opts.academyName || "EXAMFORGE ACADEMY";
  const location = opts.academyLocation || "";
  const examLabel = opts.examLabel || test.title || "EXAMINATION PAPER";
  const className = opts.className || test.className || "";
  const subjectName = opts.subjectName || test.subjectName || "";
  const timeAllowed = opts.timeAllowed || `${test.durationMins || 60} Mins`;
  const totalMarks = opts.totalMarks || `${test.totalMarks || 100}`;
  const examDate = opts.examDate || new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const printStudentInfo = opts.printStudentInfo !== false;
  const printAnswerKey = opts.printAnswerKey === true;

  const docChildren: Array<Paragraph | Table> = [];

  // 1. Academy / School Header
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: academyName.toUpperCase(),
          bold: true,
          size: 32, // 16pt
          font: "Calibri",
          color: "111827",
        }),
      ],
    })
  );

  if (location) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({
            text: location,
            italics: true,
            size: 20, // 10pt
            font: "Calibri",
            color: "4B5563",
          }),
        ],
      })
    );
  }

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: examLabel.toUpperCase(),
          bold: true,
          size: 24, // 12pt
          font: "Calibri",
          color: "059669",
        }),
      ],
    })
  );

  // 2. Student Info Box Table
  if (printStudentInfo) {
    const infoRows = [
      new TableRow({
        children: [
          createMetaCell(`Student Name: ${opts.studentName || "_______________________"}`),
          createMetaCell(`Roll Number: ${opts.rollNumber || "____________________"}`),
        ],
      }),
      new TableRow({
        children: [
          createMetaCell(`Class: ${className}`),
          createMetaCell(`Subject: ${subjectName}`),
        ],
      }),
      new TableRow({
        children: [
          createMetaCell(`Date: ${examDate}`),
          createMetaCell(`Time Allowed: ${timeAllowed}   |   Total Marks: ${totalMarks}`),
        ],
      }),
    ];

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: infoRows,
      })
    );

    docChildren.push(
      new Paragraph({
        spacing: { before: 100, after: 100 },
        children: [],
      })
    );
  }

  // 3. Instructions
  if (test.instructions && test.instructions.length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({
            text: "General Instructions:",
            bold: true,
            size: 20,
            font: "Calibri",
            color: "374151",
          }),
        ],
      })
    );

    for (const inst of test.instructions) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 20, after: 20 },
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: inst,
              size: 19,
              font: "Calibri",
              color: "4B5563",
            }),
          ],
        })
      );
    }

    docChildren.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
        },
        children: [],
      })
    );
  }

  // 4. Test Sections & Questions
  let questionCounter = 1;

  for (const section of test.sections || []) {
    // Section Header
    docChildren.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: section.title.toUpperCase(),
            bold: true,
            size: 22,
            font: "Calibri",
            color: "047857",
          }),
          new TextRun({
            text: ` (${section.totalMarks} Marks)`,
            bold: true,
            size: 20,
            font: "Calibri",
            color: "4B5563",
          }),
        ],
      })
    );

    for (const q of section.questions || []) {
      const qNum = questionCounter++;

      // Question Stem
      docChildren.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({
              text: `Q${qNum}. `,
              bold: true,
              size: 21,
              font: "Calibri",
              color: "111827",
            }),
            new TextRun({
              text: q.question_text,
              size: 21,
              font: "Calibri",
              color: "111827",
            }),
            new TextRun({
              text: `  [${q.marks} Mark${q.marks > 1 ? "s" : ""}]`,
              bold: true,
              size: 19,
              font: "Calibri",
              color: "6B7280",
            }),
          ],
        })
      );

      // Multiple Choice Options Table
      if (q.options) {
        const optionRows = [
          new TableRow({
            children: [
              createOptionCell(`(A) ${q.options.option_a}`),
              createOptionCell(`(B) ${q.options.option_b}`),
            ],
          }),
          new TableRow({
            children: [
              createOptionCell(`(C) ${q.options.option_c}`),
              createOptionCell(`(D) ${q.options.option_d}`),
            ],
          }),
        ];

        docChildren.push(
          new Table({
            width: { size: 95, type: WidthType.PERCENTAGE },
            rows: optionRows,
          })
        );
      }

      // Add writing space lines for short/long questions
      if (!q.options && q.type_name === "Short") {
        docChildren.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: "Ans: ____________________________________________________________________________________",
                color: "9CA3AF",
                size: 18,
                font: "Calibri",
              }),
            ],
          })
        );
      } else if (!q.options && q.type_name === "Long") {
        docChildren.push(
          new Paragraph({
            spacing: { before: 40, after: 60 },
            children: [
              new TextRun({
                text: "Ans:\n____________________________________________________________________________________\n____________________________________________________________________________________",
                color: "9CA3AF",
                size: 18,
                font: "Calibri",
              }),
            ],
          })
        );
      }
    }
  }

  // 5. Answer Key Section (if requested)
  if (printAnswerKey) {
    docChildren.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 120 },
        children: [
          new TextRun({
            text: "EXAMFORGE — OFFICIAL ANSWER KEY & SOLUTIONS",
            bold: true,
            size: 26,
            font: "Calibri",
            color: "059669",
          }),
        ],
      })
    );

    let ansCounter = 1;
    for (const section of test.sections || []) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 140, after: 60 },
          children: [
            new TextRun({
              text: section.title,
              bold: true,
              size: 21,
              font: "Calibri",
              color: "1F2937",
            }),
          ],
        })
      );

      for (const q of section.questions || []) {
        const qNum = ansCounter++;
        let ansText = "See model answer / textbook.";
        if (q.options?.correct_option) {
          const optLetter = q.options.correct_option;
          const optText =
            optLetter === "A"
              ? q.options.option_a
              : optLetter === "B"
              ? q.options.option_b
              : optLetter === "C"
              ? q.options.option_c
              : q.options.option_d;
          ansText = `Option (${optLetter}): ${optText}`;
        } else if (q.model_answer) {
          ansText = q.model_answer;
        }

        docChildren.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: `Q${qNum} Answer: `,
                bold: true,
                size: 20,
                font: "Calibri",
                color: "059669",
              }),
              new TextRun({
                text: ansText,
                size: 20,
                font: "Calibri",
                color: "1F2937",
              }),
            ],
          })
        );
      }
    }
  }

  // Build the Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 in
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${test.className || ""} ${test.subjectName || ""} | ExamForge`,
                    size: 16,
                    font: "Calibri",
                    color: "9CA3AF",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Page ",
                    size: 18,
                    font: "Calibri",
                    color: "9CA3AF",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    font: "Calibri",
                    color: "9CA3AF",
                  }),
                  new TextRun({
                    text: " of ",
                    size: 18,
                    font: "Calibri",
                    color: "9CA3AF",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    font: "Calibri",
                    color: "9CA3AF",
                  }),
                ],
              }),
            ],
          }),
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

function createMetaCell(text: string): TableCell {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "D1D5DB" },
    },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            size: 19,
            font: "Calibri",
            color: "374151",
          }),
        ],
      }),
    ],
  });
}

function createOptionCell(text: string): TableCell {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            size: 20,
            font: "Calibri",
            color: "1F2937",
          }),
        ],
      }),
    ],
  });
}
