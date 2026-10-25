/**
 * integration.test.mjs
 *
 * Full Integration Test Suite for examForge covering every core feature:
 * 1. Curriculum Hierarchy API (classes, subjects, chapters, topics)
 * 2. Question Bank Querying & Filtering (pagination, types, difficulty, search)
 * 3. Question Bank Cell Availability & Sources API
 * 4. Authentication Lifecycle (register, session verification, login, logout)
 * 5. AI & Heuristic Blueprint Suggestion
 * 6. Test Generation (single & batch variants)
 * 7. Test Persistence (saving, listing, and deleting tests)
 * 8. Analytics & Overlap Detection (dashboard stats, history, overlap, similarity)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:3000";

describe("Integration Tests: Full Feature Endpoints", () => {
  let sessionCookie = "";
  let userEmail = "";
  let classId = "";
  let subjectId = "";
  let chapterId = "";
  let generatedTest = null;
  let savedTestId = "";

  const ts = Date.now();
  userEmail = `educator.${ts}@school.edu`;
  const userPassword = "IntegrationPass123!";

  // ─── 1. Curriculum API ─────────────────────────────────────────────────────

  test("GET /api/curriculum: returns complete curriculum tree hierarchy", async () => {
    const res = await fetch(`${BASE_URL}/api/curriculum`);
    assert.strictEqual(res.status, 200, "Expected HTTP 200");
    const data = await res.json();
    assert.ok(Array.isArray(data.tree), "Expected tree to be an array");
    assert.ok(data.tree.length > 0, "Tree must have at least one class");

    const firstClass = data.tree[0];
    assert.ok(firstClass.id, "Class must have an id");
    assert.ok(firstClass.class_name, "Class must have class_name");
    assert.ok(Array.isArray(firstClass.subjects), "Class must have subjects array");
    assert.ok(firstClass.subjects.length > 0, "Class must have at least one subject");

    const firstSubject = firstClass.subjects[0];
    assert.ok(firstSubject.id, "Subject must have an id");
    assert.ok(firstSubject.subject_name, "Subject must have subject_name");
    assert.ok(Array.isArray(firstSubject.chapters), "Subject must have chapters array");

    classId = firstClass.id;
    subjectId = firstSubject.id;
    if (firstSubject.chapters.length > 0) {
      chapterId = firstSubject.chapters[0].id;
    }
  });

  test("GET /api/curriculum?classId=...: returns filtered curriculum for specific class", async () => {
    assert.ok(classId, "classId must be populated from previous test");
    const res = await fetch(`${BASE_URL}/api/curriculum?classId=${classId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.tree));
    assert.strictEqual(data.tree.length, 1);
    assert.strictEqual(data.tree[0].id, classId);
  });

  // ─── 2. Question Bank & Availability ───────────────────────────────────────

  test("GET /api/questions: supports pagination and returns questions with metadata", async () => {
    const res = await fetch(`${BASE_URL}/api/questions?limit=5&offset=0`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.total === "number", "Total must be a number");
    assert.ok(data.total > 0, "Question bank must contain questions");
    assert.strictEqual(data.questions.length, 5, "Should return exactly 5 questions");

    const q = data.questions[0];
    assert.ok(q.id, "Question must have id");
    assert.ok(q.question_text, "Question must have question_text");
    assert.ok(q.type_name, "Question must have type_name");
    assert.ok(q.difficulty_name, "Question must have difficulty_name");
    assert.ok(typeof q.marks === "number", "Question marks must be a number");
  });

  test("GET /api/questions?questionType=MCQ: filters by question type and includes options", async () => {
    const res = await fetch(`${BASE_URL}/api/questions?questionType=MCQ&limit=3`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    for (const q of data.questions) {
      assert.strictEqual(q.type_name, "MCQ");
      assert.ok(q.options, "MCQ question must have options object");
      assert.ok(q.options.option_a, "MCQ must have option_a");
      assert.ok(q.options.correct_option, "MCQ must have correct_option");
    }
  });

  test("GET /api/questions?difficulty=Easy: filters questions by difficulty", async () => {
    const res = await fetch(`${BASE_URL}/api/questions?difficulty=Easy&limit=3`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    for (const q of data.questions) {
      assert.strictEqual(q.difficulty_name, "Easy");
    }
  });

  test("GET /api/questions/availability: returns count matrix for subject", async () => {
    assert.ok(subjectId);
    const res = await fetch(`${BASE_URL}/api/questions/availability?subjectId=${subjectId}`);
    assert.strictEqual(res.status, 200);
    const counts = await res.json();
    assert.ok(typeof counts === "object", "Availability counts must be an object");
    const keys = Object.keys(counts);
    assert.ok(keys.length > 0, "Should have count entries");
  });

  test("GET /api/question-sources: returns sources breakdown for subject", async () => {
    assert.ok(subjectId);
    const res = await fetch(`${BASE_URL}/api/question-sources?subjectId=${subjectId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.sources), "Sources must be an array");
    assert.ok(typeof data.total === "number");
  });

  // ─── 3. Authentication & RBAC ──────────────────────────────────────────────

  test("POST /api/auth/register: registers new educator and sets session cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail,
        password: userPassword,
        name: "Dr. Educator",
        role: "educator",
      }),
    });
    assert.strictEqual(res.status, 200, `Registration failed with status ${res.status}`);
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie, "Must set session cookie on registration");
    sessionCookie = setCookie.split(";")[0];

    const data = await res.json();
    assert.ok(data.user, "Must return user object");
    assert.strictEqual(data.user.email, userEmail.toLowerCase());
    assert.strictEqual(data.user.role, "educator");
  });

  test("GET /api/auth/me: verifies active session", async () => {
    assert.ok(sessionCookie, "sessionCookie must be present");
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.user);
    assert.strictEqual(data.user.email, userEmail.toLowerCase());
    assert.strictEqual(data.user.role, "educator");
  });

  test("POST /api/auth/login: successfully authenticates with valid credentials", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail,
        password: userPassword,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.user);
    assert.strictEqual(data.user.email, userEmail.toLowerCase());
  });

  test("POST /api/auth/login: rejects incorrect password", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail,
        password: "WrongPassword999!",
      }),
    });
    assert.strictEqual(res.status, 401);
  });

  // ─── 4. Blueprint Suggestion & Test Generation ─────────────────────────────

  test("POST /api/suggest-blueprint: generates blueprint with educational rationale", async () => {
    assert.ok(sessionCookie);
    const res = await fetch(`${BASE_URL}/api/suggest-blueprint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        totalMarks: 30,
        difficultyTarget: "balanced",
        className: "Class 9",
        subjectName: "Computer Science",
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.blueprint, "Must return blueprint object");
    assert.ok(data.blueprint.MCQ, "Blueprint must have MCQ configuration");
    assert.ok(data.blueprint.Short, "Blueprint must have Short configuration");
    assert.ok(data.blueprint.Long, "Blueprint must have Long configuration");
    assert.ok(typeof data.rationale === "string", "Must return educational rationale");
  });

  test("POST /api/generate-test: generates full test with sections, questions and duration", async () => {
    assert.ok(sessionCookie);
    assert.ok(classId && subjectId);

    const genRequest = {
      classId: classId,
      className: "Class 9",
      subjectId: subjectId,
      subjectName: "Computer Science",
      chapterIds: chapterId ? [chapterId] : [],
      topicIds: [],
      sources: ["past_paper", "textbook_exercise"],
      title: "Class 9 Computer Science Term Assessment",
      durationMins: 60,
      instructions: "Attempt all questions. Calculators not allowed.",
      blueprint: {
        MCQ: { marksPerQuestion: 1, difficulties: { Easy: 2, Medium: 2, Hard: 1 } },
        Short: { marksPerQuestion: 3, difficulties: { Easy: 1, Medium: 1, Hard: 1 } },
        Long: { marksPerQuestion: 5, difficulties: { Easy: 1, Medium: 0, Hard: 0 } },
      },
    };

    const res = await fetch(`${BASE_URL}/api/generate-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify(genRequest),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.test, "Must return generated test object");
    assert.ok(Array.isArray(data.test.sections), "Test must have sections array");
    assert.ok(data.test.sections.length > 0, "Test must contain at least 1 section");
    assert.ok(data.test.totalMarks > 0, "Total marks must be > 0");

    generatedTest = data.test;
  });

  // ─── 5. Test Persistence (Save, Fetch, Delete) ────────────────────────────

  test("POST /api/tests: saves generated test for authenticated user", async () => {
    assert.ok(generatedTest, "generatedTest must exist from previous step");
    const res = await fetch(`${BASE_URL}/api/tests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ test: generatedTest }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.test, "Must return saved test object");
    assert.ok(data.test.id, "Saved test must have id");
    savedTestId = data.test.id;
  });

  test("GET /api/tests: lists user's saved tests", async () => {
    const res = await fetch(`${BASE_URL}/api/tests?userEmail=${encodeURIComponent(userEmail)}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.tests), "Tests must be an array");
    const found = data.tests.find((t) => t.id === savedTestId);
    assert.ok(found, "Saved test must be present in user's test list");
  });

  // ─── 6. Analytics, Stats & Overlap ─────────────────────────────────────────

  test("GET /api/stats: returns aggregated dashboard metrics", async () => {
    const res = await fetch(`${BASE_URL}/api/stats`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.counts.questions > 0);
    assert.ok(data.counts.classes > 0);
    assert.ok(data.byType.length > 0);
    assert.ok(data.byDifficulty.length > 0);
    assert.ok(data.byBloom.length > 0);
  });

  test("GET /api/history: aggregates user test history", async () => {
    const res = await fetch(`${BASE_URL}/api/history?userEmail=${encodeURIComponent(userEmail)}`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.totalTests === "number");
    assert.ok(Array.isArray(data.trend));
    assert.ok(Array.isArray(data.marksBuckets));
  });

  test("POST /api/check-similarity: evaluates question similarity", async () => {
    const questions = [
      {
        id: "1",
        question_text: "What is an Operating System?",
        type_name: "Short",
        difficulty_name: "Easy",
        marks: 3,
      },
      {
        id: "2",
        question_text: "Define Operating System and state its functions.",
        type_name: "Short",
        difficulty_name: "Medium",
        marks: 3,
      },
    ];

    const res = await fetch(`${BASE_URL}/api/check-similarity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ questions }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.pairs), "Must return pairs array");
  });

  test("GET /api/test-overlap: detects question overlap across saved tests", async () => {
    const res = await fetch(`${BASE_URL}/api/test-overlap?userEmail=${encodeURIComponent(userEmail)}`, {
      headers: { Cookie: sessionCookie },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.pairs), "Must return pairs array");
    assert.ok(typeof data.totalTests === "number");
  });

  // ─── 7. Cleanup & Logout ───────────────────────────────────────────────────

  test("DELETE /api/tests/:id: deletes saved test", async () => {
    assert.ok(savedTestId);
    const res = await fetch(`${BASE_URL}/api/tests/${savedTestId}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
  });

  test("POST /api/auth/logout: invalidates session cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
  });
});
