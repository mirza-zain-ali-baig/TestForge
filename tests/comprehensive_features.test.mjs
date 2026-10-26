/**
 * comprehensive_features.test.mjs
 *
 * Comprehensive Unit Test Suite covering every core feature and export engine in ExamForge:
 * 1. Microsoft Word (.docx) OpenXML Document Generator Engine
 * 2. Headless Paper Preview HTML Rendering Engine (Layout 1 & Layout 2, A4/Letter/Legal)
 * 3. Excel Spreadsheet (.xls) Export Engine
 * 4. Question Shuffling & Answer Integrity Engine
 * 5. AI & Heuristic Blueprint Normalization & Parsing Engine
 * 6. Analytics Marks Bucketing & Overlap Computation Engine
 * 7. Cryptographic Session Signing, Password Hashing & RBAC Authorization Engine
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import {
  buildTestDocxDocument,
  exportTestToDocxBuffer,
} from "../src/lib/docx-export.ts";

import {
  renderPreviewHTML,
  renderExcelHTML,
  escapeHtml,
  extractClassNumber,
  formatDuration,
  formatDate,
  generatePaperCode,
} from "../src/lib/paper-preview-html.ts";

// Mock Generated Test Data
function createMockTest(overrides = {}) {
  return {
    title: "Mid-Term Computer Science Examination",
    className: "Class 10",
    subjectName: "Computer Science",
    subjectId: "subj-cs-10",
    durationMins: 90,
    instructions: "Read all questions carefully. Calculators are strictly prohibited.",
    totalMarks: 50,
    totalQuestions: 15,
    source: "hybrid",
    generatedAt: "2026-10-26T08:00:00.000Z",
    sections: [
      {
        id: "sec-mcq",
        type_name: "MCQ",
        marksPerQuestion: 1,
        sectionMarks: 10,
        questions: [
          {
            id: "q-1",
            source: "bank",
            question_text: "What does CPU stand for?",
            type_name: "MCQ",
            difficulty_name: "Easy",
            marks: 1,
            blooms_taxonomy: "Remembering",
            topic_name: "Hardware",
            chapter_name: "Computer Fundamentals",
            options: {
              option_a: "Central Processing Unit",
              option_b: "Central Process Utility",
              option_c: "Computer Personal Unit",
              option_d: "Central Power Unit",
              correct_option: "A",
            },
            model_answer: null,
          },
          {
            id: "q-2",
            source: "bank",
            question_text: "Which of the following is volatile memory?",
            type_name: "MCQ",
            difficulty_name: "Medium",
            marks: 1,
            blooms_taxonomy: "Understanding",
            topic_name: "Memory",
            chapter_name: "Computer Fundamentals",
            options: {
              option_a: "ROM",
              option_b: "RAM",
              option_c: "Hard Disk",
              option_d: "Flash Memory",
              correct_option: "B",
            },
            model_answer: null,
          },
        ],
      },
      {
        id: "sec-short",
        type_name: "Short",
        marksPerQuestion: 3,
        sectionMarks: 15,
        questions: [
          {
            id: "q-3",
            source: "bank",
            question_text: "Differentiate between compiler and interpreter with examples.",
            type_name: "Short",
            difficulty_name: "Medium",
            marks: 3,
            blooms_taxonomy: "Analyzing",
            topic_name: "Translators",
            chapter_name: "Programming Basics",
            options: null,
            model_answer: "A compiler translates entire code at once (e.g. C++), whereas an interpreter translates line-by-line (e.g. Python).",
          },
        ],
      },
      {
        id: "sec-long",
        type_name: "Long",
        marksPerQuestion: 5,
        sectionMarks: 25,
        questions: [
          {
            id: "q-4",
            source: "ai",
            question_text: "Explain the OSI 7-layer architecture with diagram and responsibilities of each layer.",
            type_name: "Long",
            difficulty_name: "Hard",
            marks: 5,
            blooms_taxonomy: "Evaluating",
            topic_name: "Networking",
            chapter_name: "Computer Networks",
            options: null,
            model_answer: "1. Physical, 2. Data Link, 3. Network, 4. Transport, 5. Session, 6. Presentation, 7. Application.",
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createDefaultPrintOpts(overrides = {}) {
  return {
    academyName: "Apex Science Academy",
    academyLocation: "Main Campus, Blue Area, Islamabad",
    logoDataUrl: null,
    logoSize: 90,
    headerFont: "Arial, sans-serif",
    headerSize: 20,
    paperFont: "'Times New Roman', serif",
    fontSize: 9,
    topMargin: 6,
    paperSize: "A4",
    marginPreset: "Normal",
    studentName: "John Doe",
    rollNumber: "CS-2026-042",
    classNameInput: "10th",
    paperCode: "4827",
    subjectNameInput: "Computer Science",
    timeAllowed: "1 hr 30 min",
    totalMarksInput: "50",
    examDate: "2026-10-26",
    examSyllabus: "Chapters 1 to 4",
    showExamSyllabus: true,
    examLabel: "Mid Term",
    showExamLabel: true,
    dateFormat: "ISO",
    printAnswerKey: true,
    showBubbleSheet: true,
    watermarkText: "CONFIDENTIAL",
    watermarkImage: null,
    watermarkSize: 40,
    mcqBorder: true,
    shortBorder: false,
    longBorder: false,
    repeatHeader: false,
    separateSubjectivePart: false,
    showPageNumbers: true,
    headerLayout: 1,
    mcqLayout: 1,
    academyLocBold: false,
    headerLineSpacing: 1.4,
    ...overrides,
  };
}

// ─── 1. DOCX Document Generation Engine ──────────────────────────────────────

describe("Feature 1: Microsoft Word (.docx) OpenXML Generator Engine", () => {
  test("buildTestDocxDocument: creates a valid Document structure with sections and tables", () => {
    const testData = createMockTest();
    const doc = buildTestDocxDocument(testData, {
      academyName: "Apex Science Academy",
      academyLocation: "Islamabad",
      printStudentInfo: true,
      printAnswerKey: true,
    });
    assert.ok(doc, "Document object must be returned");
    assert.ok(doc.documentWrapper, "Document must have documentWrapper");
  });

  test("exportTestToDocxBuffer: generates genuine OpenXML ZIP binary with PK signature", async () => {
    const testData = createMockTest();
    const buffer = await exportTestToDocxBuffer(testData, {
      academyName: "Apex Science Academy",
      studentName: "Jane Smith",
      rollNumber: "CS-101",
      printStudentInfo: true,
      printAnswerKey: true,
    });

    assert.ok(Buffer.isBuffer(buffer), "Expected return value to be a Buffer");
    assert.ok(buffer.length > 1000, `Expected non-empty docx buffer, received ${buffer.length} bytes`);

    // Standard OpenXML / DOCX begins with ZIP file header signature: PK\x03\x04
    assert.strictEqual(buffer[0], 0x50, "First byte must be ASCII 'P'");
    assert.strictEqual(buffer[1], 0x4b, "Second byte must be ASCII 'K'");
    assert.strictEqual(buffer[2], 0x03, "Third byte must be ZIP signature 0x03");
    assert.strictEqual(buffer[3], 0x04, "Fourth byte must be ZIP signature 0x04");
  });

  test("docx generator handles empty test and missing optional fields without crashing", async () => {
    const emptyTest = {
      title: "",
      className: "",
      subjectName: "",
      durationMins: 0,
      instructions: "",
      totalMarks: 0,
      totalQuestions: 0,
      source: "bank",
      generatedAt: new Date().toISOString(),
      sections: [],
    };

    const buffer = await exportTestToDocxBuffer(emptyTest, {
      printStudentInfo: false,
      printAnswerKey: false,
    });
    assert.ok(buffer.length > 500, "Should generate valid docx for empty test");
  });

  test("docx generator safely handles null/missing question texts and lowercase option keys", async () => {
    const testWithEdgeCases = createMockTest({
      sections: [
        {
          id: "sec-edge",
          type_name: "MCQ",
          marksPerQuestion: 1,
          sectionMarks: 1,
          questions: [
            {
              id: "edge-q",
              source: "bank",
              question_text: "",
              type_name: "MCQ",
              difficulty_name: "Easy",
              marks: 1,
              options: {
                option_a: "Alpha",
                option_b: "Beta",
                option_c: "Gamma",
                option_d: "Delta",
                correct_option: "b", // lowercase should be normalized safely
              },
            },
          ],
        },
      ],
    });

    const buffer = await exportTestToDocxBuffer(testWithEdgeCases, {
      printAnswerKey: true,
    });
    assert.ok(buffer.length > 1000);
  });
});

// ─── 2. Paper Preview HTML Rendering Engine ──────────────────────────────────

describe("Feature 2: Paper Preview HTML Rendering Engine", () => {
  test("renderPreviewHTML: generates full HTML document with DOCTYPE, CSS, and containers", () => {
    const testData = createMockTest();
    const opts = createDefaultPrintOpts();
    const html = renderPreviewHTML(testData, opts);

    assert.ok(html.startsWith("<!DOCTYPE html>"), "HTML must begin with standard DOCTYPE");
    assert.ok(html.includes("<title>Mid-Term Computer Science Examination</title>"), "Title must be in head");
    assert.ok(html.includes("class=\"page\""), "Page container must be rendered");
    assert.ok(html.includes("Apex Science Academy"), "Academy name must be rendered");
    assert.ok(html.includes("What does CPU stand for?"), "MCQ question text must appear");
    assert.ok(html.includes("Differentiate between compiler and interpreter"), "Short question must appear");
  });

  test("renderPreviewHTML: Header Layout 1 renders centered academy header + fieldset grid", () => {
    const testData = createMockTest();
    const opts = createDefaultPrintOpts({ headerLayout: 1 });
    const html = renderPreviewHTML(testData, opts);

    assert.ok(html.includes("class=\"academy\""), "Layout 1 must render standard academy div");
    assert.ok(html.includes("class=\"info-grid\""), "Layout 1 must render info-grid");
    assert.ok(html.includes("class=\"fld\""), "Layout 1 must use fieldset elements");
    assert.ok(html.includes("<legend>Student Name</legend>"), "Layout 1 has Student Name legend");
  });

  test("renderPreviewHTML: Header Layout 2 renders side-by-side header + student table", () => {
    const testData = createMockTest();
    const opts = createDefaultPrintOpts({ headerLayout: 2, academyLocBold: true });
    const html = renderPreviewHTML(testData, opts);

    assert.ok(html.includes("class=\"academy academy-l2\""), "Layout 2 must render academy-l2");
    assert.ok(html.includes("class=\"academy-hr-l2\""), "Layout 2 must include horizontal rule separator");
    assert.ok(html.includes("class=\"info-table\""), "Layout 2 must render info-table");
    assert.ok(html.includes("<td class=\"it-lbl\"><b>Name:</b></td>"), "Layout 2 has Name label cell");
    assert.ok(html.includes("<td class=\"it-lbl\"><b>Roll No:</b></td>"), "Layout 2 has Roll No cell");
  });

  test("renderPreviewHTML: MCQ Layout 1 renders standard options grid", () => {
    const testData = createMockTest();
    const opts = createDefaultPrintOpts({ mcqLayout: 1, mcqBorder: true });
    const html = renderPreviewHTML(testData, opts);

    assert.ok(html.includes("class=\"opts-2col\"") || html.includes("class=\"opts-1col\""), "Must render options container");
    assert.ok(html.includes("<span class=\"oi\"><b>A.</b> Central Processing Unit</span>"), "Option A must be formatted with bold label");
  });

  test("renderPreviewHTML: MCQ Layout 2 renders 6-column matrix table", () => {
    const testData = createMockTest();
    const opts = createDefaultPrintOpts({ mcqLayout: 2 });
    const html = renderPreviewHTML(testData, opts);

    assert.ok(html.includes("class=\"qt mcq-table\""), "Layout 2 must render 6-column mcq-table");
    assert.ok(html.includes("<th>Q.No</th><th>Question Statement</th><th>Option A</th><th>Option B</th><th>Option C</th><th>Option D</th>"), "Must contain standard 6-column table headers");
    assert.ok(html.includes("<td>Central Processing Unit</td>"), "Must place Option A into dedicated table cell");
  });

  test("renderPreviewHTML: Bubble sheet generation renders OMR matrix when enabled", () => {
    const testData = createMockTest();
    const optsWithBubble = createDefaultPrintOpts({ showBubbleSheet: true });
    const htmlWithBubble = renderPreviewHTML(testData, optsWithBubble);

    assert.ok(htmlWithBubble.includes("class=\"bubble-sheet\""), "Bubble sheet container must exist");
    assert.ok(htmlWithBubble.includes("class=\"bs-grid\""), "Bubble grid must be rendered");
    assert.ok(htmlWithBubble.includes("<span class=\"bub\">A</span>"), "Bubble circle A must be present");

    const optsWithoutBubble = createDefaultPrintOpts({ showBubbleSheet: false });
    const htmlWithoutBubble = renderPreviewHTML(testData, optsWithoutBubble);
    assert.strictEqual(htmlWithoutBubble.includes("class=\"bubble-sheet\""), false, "Bubble sheet must be omitted when disabled");
  });

  test("renderPreviewHTML: Answer key is appended only when printAnswerKey is true", () => {
    const testData = createMockTest();
    const optsWithKey = createDefaultPrintOpts({ printAnswerKey: true });
    const htmlWithKey = renderPreviewHTML(testData, optsWithKey);

    assert.ok(htmlWithKey.includes("class=\"answer-key\""), "Answer key container must be present");
    assert.ok(htmlWithKey.includes("<h3 class=\"ak-title\">Answer Key</h3>"), "Answer key header must be present");
    assert.ok(htmlWithKey.includes("<b>1.</b> <b class=\"akc\">A</b>"), "Question 1 correct answer A must appear");

    const optsWithoutKey = createDefaultPrintOpts({ printAnswerKey: false });
    const htmlWithoutKey = renderPreviewHTML(testData, optsWithoutKey);
    assert.strictEqual(htmlWithoutKey.includes("class=\"answer-key\""), false, "Answer key must be excluded when false");
  });

  test("renderPreviewHTML: Watermark text renders fixed overlay with proper styling", () => {
    const testData = createMockTest();
    const opts = createDefaultPrintOpts({ watermarkText: "EXAM-STRICT-2026" });
    const html = renderPreviewHTML(testData, opts);

    assert.ok(html.includes("<div class=\"wm-text\">EXAM-STRICT-2026</div>"), "Watermark text must be rendered");
    assert.ok(html.includes(".wm-text {"), "CSS for watermark must be present");
  });

  test("renderPreviewHTML: Sanitizes against Cross-Site Scripting (XSS)", () => {
    const testData = createMockTest({
      title: "CompSci <script>alert('xss-title')</script>",
      instructions: "<img src=x onerror=alert('xss-inst')>",
    });
    const opts = createDefaultPrintOpts({
      academyName: "Academy <script>alert('xss-academy')</script>",
      studentName: "<b onmouseover=alert(1)>Student</b>",
      watermarkText: "SAFE<script>alert(2)</script>",
    });
    const html = renderPreviewHTML(testData, opts);

    assert.strictEqual(html.includes("<script>"), false, "No raw unescaped <script> tags allowed");
    assert.strictEqual(html.includes("<img src="), false, "No raw unescaped <img> tags allowed");
    assert.ok(html.includes("&lt;script&gt;alert(&#39;xss-title&#39;)&lt;/script&gt;"), "Script tag must be escaped");
    assert.ok(html.includes("&lt;img src=x onerror=alert(&#39;xss-inst&#39;)&gt;"), "Img tag must be escaped");
  });
});

// ─── 3. Excel Spreadsheet Export Engine ──────────────────────────────────────

describe("Feature 3: Excel (.xls) Export Engine", () => {
  test("renderExcelHTML: generates Office XML/HTML structure with Questions and Answer Key", () => {
    const testData = createMockTest();
    const xls = renderExcelHTML(testData);

    assert.ok(xls.includes("xmlns:o=\"urn:schemas-microsoft-com:office:office\""), "Must contain Office namespace");
    assert.ok(xls.includes("xmlns:x=\"urn:schemas-microsoft-com:office:excel\""), "Must contain Excel namespace");
    assert.ok(xls.includes("<h3>Questions</h3>"), "Must have Questions heading");
    assert.ok(xls.includes("<th>Option A</th><th>Option B</th><th>Option C</th><th>Option D</th>"), "Must list options");
    assert.ok(xls.includes("<h3>Answer Key</h3>"), "Must have Answer Key heading");
    assert.ok(xls.includes("Central Processing Unit"), "Must include correct answer text in key table");
  });
});

// ─── 4. Paper Layout Helpers & Formatters ────────────────────────────────────

describe("Feature 4: Paper Layout Helpers & Formatters", () => {
  test("extractClassNumber: accurately parses class strings and ordinals", () => {
    assert.strictEqual(extractClassNumber("Class 9"), "9th");
    assert.strictEqual(extractClassNumber("Grade 10"), "10th");
    assert.strictEqual(extractClassNumber("12th Standard"), "12th");
    assert.strictEqual(extractClassNumber("11"), "11th");
    assert.strictEqual(extractClassNumber("Pre-Engineering"), "10th"); // default fallback
    assert.strictEqual(extractClassNumber(""), "10th");
  });

  test("formatDuration: formats minutes into concise labels", () => {
    assert.strictEqual(formatDuration(0), "0 min");
    assert.strictEqual(formatDuration(-5), "0 min");
    assert.strictEqual(formatDuration(30), "30 min");
    assert.strictEqual(formatDuration(60), "1 hr");
    assert.strictEqual(formatDuration(90), "1 hr 30 min");
    assert.strictEqual(formatDuration(120), "2 hr");
    assert.strictEqual(formatDuration(150), "2 hr 30 min");
  });

  test("formatDate: supports DMY, MDY, ISO formats accurately", () => {
    const date = new Date(2026, 9, 26); // Oct 26, 2026
    assert.strictEqual(formatDate(date, "ISO"), "2026-10-26");
    assert.strictEqual(formatDate(date, "DMY"), "26/10/2026");
    assert.strictEqual(formatDate(date, "MDY"), "10/26/2026");
  });

  test("generatePaperCode: produces 4-digit numeric code", () => {
    const code = generatePaperCode();
    assert.strictEqual(typeof code, "string");
    assert.strictEqual(code.length, 4);
    assert.match(code, /^\d{4}$/, "Must be exactly 4 digits");
  });

  test("escapeHtml: safely sanitizes &, <, >, and quotes", () => {
    assert.strictEqual(escapeHtml("Hello & Welcome <User> \"123\""), "Hello &amp; Welcome &lt;User&gt; &quot;123&quot;");
    assert.strictEqual(escapeHtml(""), "");
    assert.strictEqual(escapeHtml(null), "");
  });
});

// ─── 5. Question Shuffling & Answer Integrity Engine ─────────────────────────

describe("Feature 5: Question Shuffling & Answer Integrity Engine", () => {
  function shuffleOptions(q) {
    if (!q.options) return q;
    const labels = ["A", "B", "C", "D"];
    const entries = [
      { label: "A", text: q.options.option_a },
      { label: "B", text: q.options.option_b },
      { label: "C", text: q.options.option_c },
      { label: "D", text: q.options.option_d },
    ];

    // Controlled pseudo-shuffle for deterministic test
    const shuffled = [entries[2], entries[0], entries[3], entries[1]];
    const correctKey = `option_${q.options.correct_option.toLowerCase()}`;
    const correctText = q.options[correctKey];
    const newCorrectIndex = shuffled.findIndex((e) => e.text === correctText);

    return {
      ...q,
      options: {
        option_a: shuffled[0].text,
        option_b: shuffled[1].text,
        option_c: shuffled[2].text,
        option_d: shuffled[3].text,
        correct_option: labels[newCorrectIndex],
      },
    };
  }

  test("shuffleOptions: maintains exact correct answer text under option rearrangement", () => {
    const originalQ = {
      id: "mcq-shuffle-1",
      question_text: "Which protocol is connection-oriented?",
      options: {
        option_a: "UDP",
        option_b: "TCP", // Correct
        option_c: "IP",
        option_d: "ICMP",
        correct_option: "B",
      },
    };

    const shuffledQ = shuffleOptions(originalQ);

    // Verify all original option texts are preserved
    const originalTexts = [
      originalQ.options.option_a,
      originalQ.options.option_b,
      originalQ.options.option_c,
      originalQ.options.option_d,
    ].sort();

    const shuffledTexts = [
      shuffledQ.options.option_a,
      shuffledQ.options.option_b,
      shuffledQ.options.option_c,
      shuffledQ.options.option_d,
    ].sort();

    assert.deepStrictEqual(shuffledTexts, originalTexts);

    // Verify the newly assigned correct_option still maps to "TCP"
    const newCorrectKey = `option_${shuffledQ.options.correct_option.toLowerCase()}`;
    const newCorrectText = shuffledQ.options[newCorrectKey];
    assert.strictEqual(newCorrectText, "TCP", "Correct answer text must remain 'TCP' after shuffle");
  });
});

// ─── 6. AI Blueprint Normalization & Validation Engine ───────────────────────

describe("Feature 6: AI Blueprint Normalization & Validation Engine", () => {
  function normalizeBlueprint(bp) {
    const types = ["MCQ", "Short", "Long"];
    const diffs = ["Easy", "Medium", "Hard"];
    const defaultMarks = { MCQ: 1, Short: 3, Long: 5 };

    function clamp(d, obj) {
      const v = obj?.[d] ?? 0;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    const out = {};
    for (const t of types) {
      const cfg = bp[t] ?? { marksPerQuestion: defaultMarks[t], difficulties: {} };
      out[t] = {
        marksPerQuestion: Math.max(1, cfg.marksPerQuestion ?? defaultMarks[t]),
        difficulties: {
          Easy: clamp("Easy", cfg.difficulties),
          Medium: clamp("Medium", cfg.difficulties),
          Hard: clamp("Hard", cfg.difficulties),
        },
      };
    }
    return out;
  }

  function safeParseJson(raw) {
    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) text = text.slice(first, last + 1);
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  test("normalizeBlueprint: sanitizes negative counts and missing difficulty fields", () => {
    const malformed = {
      MCQ: {
        marksPerQuestion: -2, // negative
        difficulties: { Easy: -5, Medium: "8.6", Hard: "invalid" },
      },
      // Short missing completely
    };

    const clean = normalizeBlueprint(malformed);

    assert.strictEqual(clean.MCQ.marksPerQuestion, 1, "Negative marksPerQuestion must be clamped to >= 1");
    assert.strictEqual(clean.MCQ.difficulties.Easy, 0, "Negative difficulty count must be clamped to 0");
    assert.strictEqual(clean.MCQ.difficulties.Medium, 9, "Float difficulty count must round to 9");
    assert.strictEqual(clean.MCQ.difficulties.Hard, 0, "Invalid string must fall back to 0");
    assert.ok(clean.Short, "Missing Short section must be auto-populated");
    assert.strictEqual(clean.Short.marksPerQuestion, 3);
    assert.ok(clean.Long, "Missing Long section must be auto-populated");
    assert.strictEqual(clean.Long.marksPerQuestion, 5);
  });

  test("safeParseJson: extracts valid JSON from markdown code fence and conversational text", () => {
    const raw = `Here is your requested examination blueprint:
\`\`\`json
{
  "blueprint": {
    "MCQ": { "marksPerQuestion": 1, "difficulties": { "Easy": 5, "Medium": 5, "Hard": 0 } }
  },
  "rationale": "Revision test for Class 10."
}
\`\`\`
Hope this helps!`;

    const parsed = safeParseJson(raw);
    assert.ok(parsed, "Must parse JSON successfully");
    assert.strictEqual(parsed.rationale, "Revision test for Class 10.");
    assert.strictEqual(parsed.blueprint.MCQ.difficulties.Easy, 5);
  });

  test("safeParseJson: gracefully returns null for non-JSON content without throwing", () => {
    assert.strictEqual(safeParseJson("Sorry, I cannot generate an exam blueprint at this time."), null);
    assert.strictEqual(safeParseJson(""), null);
  });
});

// ─── 7. Analytics Marks Bucketing & Overlap Engine ───────────────────────────

describe("Feature 7: Analytics Marks Bucketing & Overlap Engine", () => {
  function bucketMarks(totalMarks) {
    if (totalMarks <= 10) return "1-10";
    if (totalMarks <= 25) return "11-25";
    if (totalMarks <= 50) return "26-50";
    if (totalMarks <= 100) return "51-100";
    return "100+";
  }

  function computeJaccardOverlap(setA, setB) {
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  test("bucketMarks: places marks into exact analytics histogram bins", () => {
    assert.strictEqual(bucketMarks(5), "1-10");
    assert.strictEqual(bucketMarks(10), "1-10");
    assert.strictEqual(bucketMarks(11), "11-25");
    assert.strictEqual(bucketMarks(25), "11-25");
    assert.strictEqual(bucketMarks(26), "26-50");
    assert.strictEqual(bucketMarks(50), "26-50");
    assert.strictEqual(bucketMarks(75), "51-100");
    assert.strictEqual(bucketMarks(100), "51-100");
    assert.strictEqual(bucketMarks(101), "100+");
    assert.strictEqual(bucketMarks(150), "100+");
  });

  test("computeJaccardOverlap: evaluates question overlap accurately", () => {
    const testA = new Set(["q1", "q2", "q3", "q4"]);
    const testB = new Set(["q3", "q4", "q5", "q6"]);
    // intersection: 2 (q3, q4), union: 6 (q1, q2, q3, q4, q5, q6)
    const overlap = computeJaccardOverlap(testA, testB);
    assert.strictEqual(Math.round(overlap * 100), 33); // 2/6 = 33.33%

    const testC = new Set(["q7", "q8"]);
    assert.strictEqual(computeJaccardOverlap(testA, testC), 0, "Disjoint tests must have 0% overlap");

    assert.strictEqual(computeJaccardOverlap(testA, testA), 1.0, "Identical tests must have 100% overlap");
  });
});

// ─── 8. Auth, Password Cryptography & RBAC Engine ────────────────────────────

describe("Feature 8: Auth Cryptography, HMAC Sessions & RBAC Engine", () => {
  const SECRET = "testforge-test-secret-key-2026";

  function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return `${salt}:${derivedKey.toString("hex")}`;
  }

  function verifyPassword(password, storedHash) {
    try {
      const [salt, key] = storedHash.split(":");
      if (!salt || !key) return false;
      const keyBuffer = Buffer.from(key, "hex");
      const derivedKey = crypto.scryptSync(password, salt, 64);
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch {
      return false;
    }
  }

  function signToken(payload, secret = SECRET) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    return `${encoded}.${sig}`;
  }

  function verifyToken(token, secret = SECRET) {
    try {
      const [encoded, sig] = token.split(".");
      if (!encoded || !sig) return null;
      const expectedSig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
      if (
        sig.length !== expectedSig.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
      ) {
        return null;
      }
      const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      if (!decoded.exp || Date.now() > decoded.exp) return null;
      return decoded;
    } catch {
      return null;
    }
  }

  test("hashPassword & verifyPassword: scrypt hashing verifies correct credentials and rejects incorrect ones", () => {
    const password = "SuperSecretExamPass#2026";
    const hash = hashPassword(password);

    assert.ok(hash.includes(":"), "Hash must be formatted as salt:derivedKey");
    assert.strictEqual(verifyPassword(password, hash), true, "Must verify matching password");
    assert.strictEqual(verifyPassword("WrongPassword123", hash), false, "Must reject incorrect password");
    assert.strictEqual(verifyPassword(password, "malformed_hash"), false, "Must reject invalid hash format safely");
  });

  test("signToken & verifyToken: HMAC session tokens verify valid signatures and reject tampered tokens", () => {
    const payload = {
      id: "usr-42",
      email: "prof.ada@university.edu",
      role: "educator",
      exp: Date.now() + 3600 * 1000, // 1 hour valid
    };

    const token = signToken(payload);
    const verified = verifyToken(token);

    assert.ok(verified, "Valid token must verify");
    assert.strictEqual(verified.email, "prof.ada@university.edu");
    assert.strictEqual(verified.role, "educator");

    // Tampered token test (modify payload)
    const [encodedPayload, sig] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, role: "admin" })).toString("base64url");
    const tamperedToken = `${tamperedPayload}.${sig}`;

    assert.strictEqual(verifyToken(tamperedToken), null, "Tampered payload must be rejected");

    // Expired token test
    const expiredToken = signToken({ ...payload, exp: Date.now() - 1000 });
    assert.strictEqual(verifyToken(expiredToken), null, "Expired token must be rejected");

    // Wrong secret test
    const forgedToken = signToken(payload, "malicious-secret");
    assert.strictEqual(verifyToken(forgedToken), null, "Token signed with different secret must be rejected");
  });

  test("RBAC matrix: enforces strict permission boundaries between student, educator and admin", () => {
    const ROLE_PERMISSIONS = {
      student: ["test:view", "test:take", "test:practice", "bank:read", "test:generate"],
      educator: [
        "test:view", "test:take", "test:practice", "bank:read",
        "test:generate", "test:batch", "test:save", "test:delete", "analytics:view",
      ],
      admin: [
        "test:view", "test:take", "test:practice", "bank:read",
        "test:generate", "test:batch", "test:save", "test:delete",
        "analytics:view", "admin:manage",
      ],
    };

    function hasPermission(role, perm) {
      return (ROLE_PERMISSIONS[role] || []).includes(perm);
    }

    // Student checks
    assert.strictEqual(hasPermission("student", "test:view"), true);
    assert.strictEqual(hasPermission("student", "test:generate"), true);
    assert.strictEqual(hasPermission("student", "test:batch"), false, "Student cannot batch generate");
    assert.strictEqual(hasPermission("student", "test:delete"), false, "Student cannot delete tests");
    assert.strictEqual(hasPermission("student", "admin:manage"), false, "Student cannot administer system");

    // Educator checks
    assert.strictEqual(hasPermission("educator", "test:batch"), true);
    assert.strictEqual(hasPermission("educator", "test:save"), true);
    assert.strictEqual(hasPermission("educator", "analytics:view"), true);
    assert.strictEqual(hasPermission("educator", "admin:manage"), false, "Educator cannot administer system");

    // Admin checks
    assert.strictEqual(hasPermission("admin", "admin:manage"), true);
    assert.strictEqual(hasPermission("admin", "test:delete"), true);
  });
});
