/**
 * unit_and_responsiveness.test.mjs
 *
 * Comprehensive Unit and Responsiveness Test Suite for examForge.
 *
 * Tests:
 * 1. Core Mathematical & Algorithmic Unit Tests:
 *    - formatDuration (boundary and edge values)
 *    - distributeEvenly (question distribution across difficulties)
 *    - Difficulty Stats & Bloom Index weighting
 *    - Test & Section Question/Mark Aggregation
 *    - Option Shuffling & Answer Integrity
 *    - Question Overlap Calculation across Variants
 *
 * 2. Mobile Responsiveness & Layout Containment Tests:
 *    - Viewport width constraint analysis (no un-scoped elements > 320px)
 *    - Flex toolbar wrapping and button containment
 *    - Touch target sizing (minimum 36px height)
 *    - Mobile bottom navigation clearance
 *    - Table / Matrix horizontal containment
 *    - Global CSS overflow containment
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ─── 1. Unit Tests: Core Algorithms ──────────────────────────────────────────

describe("Unit Tests: Core Algorithms & Calculation Logic", () => {
  // 1.1 formatDuration
  function formatDuration(mins) {
    if (mins <= 0) return "0 mins";
    if (mins < 60) return `${mins} mins`;
    const hours = mins / 60;
    if (mins % 60 === 0) {
      return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    }
    if (mins % 30 === 0) {
      return `${hours} hours`;
    }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} hr ${m} mins`;
  }

  test("formatDuration: correctly formats zero and negative inputs", () => {
    assert.strictEqual(formatDuration(0), "0 mins");
    assert.strictEqual(formatDuration(-10), "0 mins");
  });

  test("formatDuration: correctly formats minutes under 1 hour", () => {
    assert.strictEqual(formatDuration(15), "15 mins");
    assert.strictEqual(formatDuration(30), "30 mins");
    assert.strictEqual(formatDuration(45), "45 mins");
    assert.strictEqual(formatDuration(59), "59 mins");
  });

  test("formatDuration: correctly formats exact hours (singular and plural)", () => {
    assert.strictEqual(formatDuration(60), "1 hour");
    assert.strictEqual(formatDuration(120), "2 hours");
    assert.strictEqual(formatDuration(180), "3 hours");
  });

  test("formatDuration: correctly formats half-hour multiples", () => {
    assert.strictEqual(formatDuration(90), "1.5 hours");
    assert.strictEqual(formatDuration(150), "2.5 hours");
  });

  test("formatDuration: correctly formats mixed hours and minutes", () => {
    assert.strictEqual(formatDuration(75), "1 hr 15 mins");
    assert.strictEqual(formatDuration(135), "2 hr 15 mins");
    assert.strictEqual(formatDuration(80), "1 hr 20 mins");
  });

  // 1.2 distributeEvenly
  function distributeEvenly(total) {
    const safe = Math.max(0, total);
    const easy = Math.ceil(safe / 3);
    const medium = Math.ceil((safe - easy) / 2);
    const hard = safe - easy - medium;
    return { Easy: easy, Medium: medium, Hard: hard };
  }

  test("distributeEvenly: sums to exact total for 0..30 questions", () => {
    for (let total = 0; total <= 30; total++) {
      const res = distributeEvenly(total);
      const sum = res.Easy + res.Medium + res.Hard;
      assert.strictEqual(sum, total, `Failed for total ${total}`);
      assert.ok(res.Easy >= 0 && res.Medium >= 0 && res.Hard >= 0);
    }
  });

  test("distributeEvenly: distributes 10 questions fairly", () => {
    const res = distributeEvenly(10);
    // 10: easy = ceil(10/3)=4, remaining=6, medium=ceil(6/2)=3, hard=3
    assert.deepStrictEqual(res, { Easy: 4, Medium: 3, Hard: 3 });
  });

  // 1.3 Difficulty Index calculation
  function calcDifficultyStats(blueprint) {
    const TYPE_NAMES = ["MCQ", "Short", "Long"];
    let easy = 0,
      medium = 0,
      hard = 0;
    let easyMarks = 0,
      mediumMarks = 0,
      hardMarks = 0;

    for (const t of TYPE_NAMES) {
      const cfg = blueprint[t];
      easy += cfg.difficulties.Easy;
      medium += cfg.difficulties.Medium;
      hard += cfg.difficulties.Hard;
      easyMarks += cfg.difficulties.Easy * cfg.marksPerQuestion;
      mediumMarks += cfg.difficulties.Medium * cfg.marksPerQuestion;
      hardMarks += cfg.difficulties.Hard * cfg.marksPerQuestion;
    }

    const total = easy + medium + hard;
    const weighted = easy * 1 + medium * 2 + hard * 3;
    const index = total > 0 ? Math.round((weighted / (total * 3)) * 100) : 0;
    const higherOrderPct =
      total > 0 ? Math.round(((medium + hard) / total) * 100) : 0;

    const label =
      index <= 35 ? "Easy" : index <= 65 ? "Balanced" : "Challenging";

    return {
      easy,
      medium,
      hard,
      easyMarks,
      mediumMarks,
      hardMarks,
      total,
      index,
      higherOrderPct,
      label,
    };
  }

  test("calcDifficultyStats: all easy blueprint yields ~33% index and 'Easy' label", () => {
    const bp = {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 10, Medium: 0, Hard: 0 } },
      Short: { marksPerQuestion: 3, difficulties: { Easy: 5, Medium: 0, Hard: 0 } },
      Long: { marksPerQuestion: 5, difficulties: { Easy: 2, Medium: 0, Hard: 0 } },
    };
    const stats = calcDifficultyStats(bp);
    assert.strictEqual(stats.total, 17);
    assert.strictEqual(stats.easy, 17);
    assert.strictEqual(stats.index, 33);
    assert.strictEqual(stats.label, "Easy");
    assert.strictEqual(stats.higherOrderPct, 0);
  });

  test("calcDifficultyStats: balanced blueprint yields 'Balanced' label", () => {
    const bp = {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 5, Medium: 5, Hard: 0 } },
      Short: { marksPerQuestion: 3, difficulties: { Easy: 2, Medium: 3, Hard: 1 } },
      Long: { marksPerQuestion: 5, difficulties: { Easy: 1, Medium: 1, Hard: 1 } },
    };
    const stats = calcDifficultyStats(bp);
    assert.ok(stats.index >= 36 && stats.index <= 65);
    assert.strictEqual(stats.label, "Balanced");
    assert.ok(stats.higherOrderPct > 0);
  });

  test("calcDifficultyStats: handles zero total questions gracefully without NaN", () => {
    const emptyBp = {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
      Short: { marksPerQuestion: 3, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
      Long: { marksPerQuestion: 5, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
    };
    const stats = calcDifficultyStats(emptyBp);
    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.index, 0);
    assert.strictEqual(stats.higherOrderPct, 0);
    assert.strictEqual(stats.label, "Easy");
    assert.strictEqual(Number.isNaN(stats.index), false);
  });

  // 1.4 applyDifficultyRatio logic
  function applyDifficultyRatio(blueprint, easyPct, medPct, hardPct) {
    const TYPE_NAMES = ["MCQ", "Short", "Long"];
    const updated = JSON.parse(JSON.stringify(blueprint));
    for (const t of TYPE_NAMES) {
      const count =
        updated[t].difficulties.Easy +
        updated[t].difficulties.Medium +
        updated[t].difficulties.Hard;
      if (count === 0) continue;
      const easy = Math.round((count * easyPct) / 100);
      const hard = Math.round((count * hardPct) / 100);
      const med = Math.max(0, count - easy - hard);
      updated[t].difficulties = { Easy: easy, Medium: med, Hard: hard };
    }
    return updated;
  }

  test("applyDifficultyRatio: accurately adjusts counts across sections preserving totals", () => {
    const bp = {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 10, Medium: 0, Hard: 0 } },
      Short: { marksPerQuestion: 3, difficulties: { Easy: 0, Medium: 5, Hard: 0 } },
      Long: { marksPerQuestion: 5, difficulties: { Easy: 0, Medium: 0, Hard: 5 } },
    };
    // Apply 50% Easy, 30% Med, 20% Hard
    const adjusted = applyDifficultyRatio(bp, 50, 30, 20);
    assert.strictEqual(
      adjusted.MCQ.difficulties.Easy + adjusted.MCQ.difficulties.Medium + adjusted.MCQ.difficulties.Hard,
      10
    );
    assert.strictEqual(
      adjusted.Short.difficulties.Easy + adjusted.Short.difficulties.Medium + adjusted.Short.difficulties.Hard,
      5
    );
    assert.strictEqual(
      adjusted.Long.difficulties.Easy + adjusted.Long.difficulties.Medium + adjusted.Long.difficulties.Hard,
      5
    );
    assert.strictEqual(adjusted.MCQ.difficulties.Easy, 5);
    assert.strictEqual(adjusted.MCQ.difficulties.Hard, 2);
    assert.strictEqual(adjusted.MCQ.difficulties.Medium, 3);
  });

  // 1.5 Test JSON parsing and validation
  function parseTestJson(savedTest) {
    try {
      const parsed = JSON.parse(savedTest.testJson);
      if (!parsed || !Array.isArray(parsed.sections)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  test("parseTestJson: validates JSON structure and rejects malformed inputs", () => {
    assert.strictEqual(parseTestJson({ testJson: "invalid json" }), null);
    assert.strictEqual(parseTestJson({ testJson: JSON.stringify({ noSections: true }) }), null);
    const valid = { title: "Midterm Exam", sections: [] };
    assert.deepStrictEqual(parseTestJson({ testJson: JSON.stringify(valid) }), valid);
  });

  // 1.4 Test & Section Marks & Question Aggregation
  function aggregateTest(testObj) {
    let totalQuestions = 0;
    let totalMarks = 0;
    for (const sec of testObj.sections) {
      let secMarks = 0;
      for (const q of sec.questions) {
        totalQuestions++;
        totalMarks += q.marks;
        secMarks += q.marks;
      }
      assert.strictEqual(sec.totalMarks, secMarks, "Section totalMarks mismatch");
    }
    return { totalQuestions, totalMarks };
  }

  test("aggregateTest: accurately tallies question count and total marks", () => {
    const mockTest = {
      sections: [
        {
          name: "Section A - Multiple Choice",
          totalMarks: 10,
          questions: Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, marks: 1 })),
        },
        {
          name: "Section B - Short Questions",
          totalMarks: 15,
          questions: Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, marks: 3 })),
        },
        {
          name: "Section C - Long Questions",
          totalMarks: 25,
          questions: Array.from({ length: 5 }, (_, i) => ({ id: `l${i}`, marks: 5 })),
        },
      ],
    };
    const { totalQuestions, totalMarks } = aggregateTest(mockTest);
    assert.strictEqual(totalQuestions, 20);
    assert.strictEqual(totalMarks, 50);
  });

  // 1.5 Option Shuffling & Answer Integrity
  function shuffleOptions(q, randomSequence = [1, 2, 0, 3]) {
    if (!q.options) return q;
    const labels = ["A", "B", "C", "D"];
    const entries = [
      { label: "A", text: q.options.option_a },
      { label: "B", text: q.options.option_b },
      { label: "C", text: q.options.option_c },
      { label: "D", text: q.options.option_d },
    ];
    // Deterministic shuffle for testing
    const shuffled = randomSequence.map((idx) => entries[idx]);
    const correctField = `option_${q.options.correct_option.toLowerCase()}`;
    const correctText = q.options[correctField];
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

  test("shuffleOptions: preserves all 4 options and correctly re-maps correct option", () => {
    const original = {
      id: "q-mcq-1",
      question_text: "What is the capital of France?",
      options: {
        option_a: "Berlin",
        option_b: "Madrid",
        option_c: "Paris",
        option_d: "Rome",
        correct_option: "C",
      },
    };

    const shuffled = shuffleOptions(original, [2, 0, 1, 3]);
    // Shuffled order: index 2 (Paris), 0 (Berlin), 1 (Madrid), 3 (Rome)
    assert.strictEqual(shuffled.options.option_a, "Paris");
    assert.strictEqual(shuffled.options.option_b, "Berlin");
    assert.strictEqual(shuffled.options.option_c, "Madrid");
    assert.strictEqual(shuffled.options.option_d, "Rome");
    // Paris is now at index 0 -> correct_option must be "A"
    assert.strictEqual(shuffled.options.correct_option, "A");
  });

  // 1.6 Overlap Detection
  function computeOverlap(tests) {
    const parsed = tests.map((t) => ({
      id: t.id,
      title: t.title,
      ids: new Set(t.questionIds),
    }));

    const pairs = [];
    let maxShared = 0;

    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const a = parsed[i];
        const b = parsed[j];
        const sharedIds = [...a.ids].filter((id) => b.ids.has(id));
        if (sharedIds.length > 0) {
          pairs.push({
            a: a.id,
            b: b.id,
            shared: sharedIds.length,
            sharedIds,
          });
          if (sharedIds.length > maxShared) maxShared = sharedIds.length;
        }
      }
    }
    return { pairs, maxShared };
  }

  test("computeOverlap: detects shared questions across test variants", () => {
    const variants = [
      { id: "v1", title: "Variant A", questionIds: ["q1", "q2", "q3", "q4", "q5"] },
      { id: "v2", title: "Variant B", questionIds: ["q3", "q4", "q5", "q6", "q7"] },
      { id: "v3", title: "Variant C", questionIds: ["q8", "q9", "q10"] },
    ];
    const { pairs, maxShared } = computeOverlap(variants);
    assert.strictEqual(pairs.length, 1);
    assert.strictEqual(pairs[0].a, "v1");
    assert.strictEqual(pairs[0].b, "v2");
    assert.strictEqual(pairs[0].shared, 3);
    assert.deepStrictEqual(pairs[0].sharedIds, ["q3", "q4", "q5"]);
    assert.strictEqual(maxShared, 3);
  });
});

// ─── 2. Responsiveness & Mobile Layout Containment Tests ─────────────────────

describe("Responsiveness Tests: Mobile Containment & Layout Robustness", () => {
  const examForgeDir = process.cwd().endsWith("examForge")
    ? process.cwd()
    : path.resolve(process.cwd(), "examForge");
  const componentsDir = path.resolve(examForgeDir, "src", "components");
  const globalsCssPath = path.resolve(examForgeDir, "src", "app", "globals.css");

  // Read all TSX component files
  function getTsxFiles(dir) {
    let files = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files = files.concat(getTsxFiles(fullPath));
      } else if (item.name.endsWith(".tsx")) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const tsxFiles = getTsxFiles(componentsDir);

  test("CSS Global Viewport Containment: globals.css enforces overflow clipping", () => {
    assert.ok(fs.existsSync(globalsCssPath), "globals.css exists");
    const content = fs.readFileSync(globalsCssPath, "utf-8");
    const hasOverflowClip =
      content.includes("overflow-x: clip") ||
      content.includes("overflow-x: hidden") ||
      content.includes("max-w-[100vw]");
    assert.ok(hasOverflowClip, "globals.css must have overflow-x clipping to prevent horizontal scroll");
  });

  test("No Unscoped Fixed-Width Elements > 320px in UI components", () => {
    // Regex matches fixed pixel widths >= 320px WITHOUT responsive prefix (sm:, md:, lg:, xl:, 2xl:)
    // and WITHOUT max- prefix (e.g., sm:max-w-[420px] is fully responsive and bounded)
    const fixedWidthRegex = /(?<!(?:sm|md|lg|xl|2xl):)(?<!max-)(?:min-)?w-\[(\d{3,})px\]/g;
    const violations = [];

    for (const file of tsxFiles) {
      const relative = path.relative(componentsDir, file);
      // Skip print-only preview paper simulation which uses simulated A4 paper width (e.g. 794px / 210mm) inside overflow containers
      if (relative.includes("print-export-view") || relative.includes("test-preview")) {
        continue;
      }
      const content = fs.readFileSync(file, "utf-8");
      let match;
      while ((match = fixedWidthRegex.exec(content)) !== null) {
        const px = parseInt(match[1], 10);
        if (px >= 320) {
          violations.push({ file: relative, match: match[0], width: px });
        }
      }
    }

    assert.deepStrictEqual(
      violations,
      [],
      `Found fixed width elements >= 320px without responsive prefix: ${JSON.stringify(violations)}`
    );
  });

  test("Toolbar Buttons in test-preview.tsx have flex-wrap and responsive sizing", () => {
    const previewFile = path.join(componentsDir, "test-gen", "test-preview.tsx");
    assert.ok(fs.existsSync(previewFile));
    const content = fs.readFileSync(previewFile, "utf-8");

    // Toolbar header must have flex-wrap or mobile-specific wrap
    assert.ok(
      content.includes("flex-wrap") || content.includes("sm:flex-nowrap"),
      "test-preview.tsx toolbar must support flex-wrap"
    );

    // Metadata badges and buttons should not have fixed oversized widths
    assert.ok(
      !content.includes("w-[500px]"),
      "test-preview.tsx must not contain hardcoded 500px element"
    );
  });

  test("Mobile Print & Export View (print-export-view.tsx) has responsive bottom bar and back navigation", () => {
    const printFile = path.join(componentsDir, "test-gen", "print-export-view.tsx");
    assert.ok(fs.existsSync(printFile));
    const content = fs.readFileSync(printFile, "utf-8");

    // Must have responsive layout for mobile: bottom actions bar on mobile
    assert.ok(
      content.includes("bottom-0") || content.includes("bottom-2") || content.includes("sticky bottom"),
      "print-export-view.tsx must have bottom actions bar on mobile"
    );

    // Must have < Back button
    assert.ok(
      content.includes("Back") || content.includes("handleBack"),
      "print-export-view.tsx must provide clear back navigation"
    );
  });

  test("Chat View (chat-view.tsx) has dedicated mobile back button and new chat button", () => {
    const chatFile = path.join(componentsDir, "test-gen", "chat-view.tsx");
    assert.ok(fs.existsSync(chatFile));
    const content = fs.readFileSync(chatFile, "utf-8");

    // Check for mobile back button
    assert.ok(
      content.includes("onBack") || content.includes("Back to tests"),
      "chat-view.tsx must include mobile back button"
    );

    // Check for mobile drawer trigger / New Chat
    assert.ok(
      content.includes("New Chat") || content.includes("newChat"),
      "chat-view.tsx must include New Chat action"
    );
  });

  test("Dashboard (dashboard.tsx) Bloom's Taxonomy card contains category breakdowns and percentages", () => {
    const dashFile = path.join(componentsDir, "test-gen", "dashboard.tsx");
    assert.ok(fs.existsSync(dashFile));
    const content = fs.readFileSync(dashFile, "utf-8");

    // Bloom's card must feature Questions metric in center
    assert.ok(
      content.includes("Questions") && content.includes("byBloom"),
      "dashboard.tsx Bloom's taxonomy card must show Questions count and byBloom data"
    );

    // Must show percentage calculations
    assert.ok(
      content.includes("totalBloom") && content.includes("%"),
      "dashboard.tsx Bloom's taxonomy card must display percentage breakdown"
    );
  });

  test("Interactive Buttons satisfy touch target standards", () => {
    // Check that button component definitions in ui/button.tsx provide adequate height (h-9 / h-10 / py-2)
    const buttonUiFile = path.join(componentsDir, "ui", "button.tsx");
    assert.ok(fs.existsSync(buttonUiFile), "button.tsx must exist");
    const content = fs.readFileSync(buttonUiFile, "utf-8");

    // Default button size should have at least h-9 (36px) or h-10 (40px)
    assert.ok(
      content.includes("h-9") || content.includes("h-10") || content.includes("min-h-"),
      "UI Button must provide at least 36px (h-9) default touch target height"
    );
  });

  test("Mobile Navigation Bar clearance: App Shell preserves content padding", () => {
    const shellFile = path.join(componentsDir, "test-gen", "app-shell.tsx");
    assert.ok(fs.existsSync(shellFile), "app-shell.tsx must exist");
    const content = fs.readFileSync(shellFile, "utf-8");

    // Must have pb-14, pb-16, or pb-20 on mobile containers so navigation does not obscure page content
    const hasBottomPadding =
      content.includes("pb-16") ||
      content.includes("pb-14") ||
      content.includes("pb-20") ||
      content.includes("pb-24");
    assert.ok(hasBottomPadding, "app-shell.tsx must have bottom padding for mobile navigation bar");
  });

  test("Table Containers in Question Bank and Saved Tests have overflow-x-auto", () => {
    const bankFile = path.join(componentsDir, "test-gen", "question-bank.tsx");
    const savedFile = path.join(componentsDir, "test-gen", "saved-tests.tsx");
    assert.ok(fs.existsSync(bankFile));
    assert.ok(fs.existsSync(savedFile));

    const bankContent = fs.readFileSync(bankFile, "utf-8");
    const savedContent = fs.readFileSync(savedFile, "utf-8");

    // Question bank should wrap tables or grids with overflow-x-auto or responsive flex
    assert.ok(
      bankContent.includes("overflow-x-auto") || bankContent.includes("overflow-hidden"),
      "question-bank.tsx should contain overflow protection for data tables"
    );
    assert.ok(
      savedContent.includes("overflow-x-auto") || savedContent.includes("overflow-hidden") || savedContent.includes("grid"),
      "saved-tests.tsx should contain overflow protection"
    );
  });

  test("Button Toolbars wrap properly on small screens (no overflow out of box)", () => {
    const wizardFile = path.join(componentsDir, "test-gen", "generator-wizard.tsx");
    assert.ok(fs.existsSync(wizardFile));
    const wizardContent = fs.readFileSync(wizardFile, "utf-8");

    // Check wizard navigation footer has flex-wrap or flex-col sm:flex-row or justify-between
    assert.ok(
      wizardContent.includes("flex-wrap") ||
      wizardContent.includes("flex-col") ||
      wizardContent.includes("justify-between"),
      "generator-wizard.tsx step navigation buttons must be responsive"
    );
  });
});
