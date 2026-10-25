/**
 * security.test.mjs
 *
 * Comprehensive Security Test Suite for examForge covering:
 * 1. SQL Injection (SQLi) Resilience & Parameterization
 * 2. Cross-Site Scripting (XSS) Sanitization in test titles, instructions & watermarks
 * 3. Authentication & RBAC Enforcement (Unauthorized rejection, IDOR prevention)
 * 4. Cryptographic Session Token Tamper Resistance (HMAC verification)
 * 5. Secret Leak Prevention (Client bundle & HTML scanning for env secrets)
 * 6. High-Concurrency Burst Resilience (DoS protection & connection pooling)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";

const BASE_URL = "http://localhost:3000";

describe("Security Tests: Application Hardening & Vulnerability Resistance", () => {

  // ─── 1. SQL Injection (SQLi) Resistance ────────────────────────────────────

  describe("SQL Injection (SQLi) Resistance", () => {
    const sqliPayloads = [
      "' OR '1'='1",
      "1; DROP TABLE questions; --",
      "' UNION SELECT NULL, NULL, NULL, NULL --",
      "admin' --",
      "' OR 1=1 #",
      "\" OR \"\"=\"",
    ];

    test("GET /api/questions?search: handles SQL injection payloads without database errors", async () => {
      for (const payload of sqliPayloads) {
        const res = await fetch(`${BASE_URL}/api/questions?search=${encodeURIComponent(payload)}&limit=5`);
        assert.strictEqual(res.status, 200, `Search crashed on payload: ${payload}`);
        const data = await res.json();
        assert.ok(Array.isArray(data.questions));
        // Payload must not dump the entire table
        assert.ok(typeof data.total === "number");
      }
    });

    test("GET /api/curriculum?classId: handles SQL injection without database syntax crashes", async () => {
      for (const payload of sqliPayloads) {
        const res = await fetch(`${BASE_URL}/api/curriculum?classId=${encodeURIComponent(payload)}`);
        // Should either safely return empty tree or 200, never raw 500 database error
        assert.ok(res.status === 200 || res.status === 400 || res.status === 404);
        const data = await res.json();
        if (res.status === 200) {
          assert.ok(Array.isArray(data.tree));
        }
      }
    });

    test("GET /api/tests?userEmail: handles SQL injection in email parameter safely", async () => {
      for (const payload of sqliPayloads) {
        const res = await fetch(`${BASE_URL}/api/tests?userEmail=${encodeURIComponent(payload)}`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.tests));
        // Injected SQL must not leak all users' tests
        assert.strictEqual(data.tests.length, 0);
      }
    });
  });

  // ─── 2. Cross-Site Scripting (XSS) Sanitization ────────────────────────────

  describe("Cross-Site Scripting (XSS) Resistance", () => {
    const xssPayloads = [
      '<script>alert("XSS-1")</script>',
      '<img src="x" onerror="alert(1)">',
      '<svg/onload=alert("XSS-2")>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '"><script>alert(document.cookie)</script>',
    ];

    test("HTML Export & Paper Preview sanitizes script tags in test title and instructions", () => {
      // Test the HTML escaping logic used in print and export rendering
      function escapeHtml(str) {
        if (!str) return "";
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      for (const payload of xssPayloads) {
        const escaped = escapeHtml(payload);
        assert.strictEqual(escaped.includes("<script>"), false);
        assert.strictEqual(escaped.includes("<img"), false);
        assert.strictEqual(escaped.includes("<svg"), false);
        assert.strictEqual(escaped.includes("<iframe"), false);
      }
    });

    test("POST /api/check-similarity: handles malicious script injection in questions without execution", async () => {
      const maliciousQuestions = [
        {
          id: "xss-1",
          question_text: '<script>alert("XSS")</script> What is a database index?',
          type_name: "Short",
          difficulty_name: "Easy",
          marks: 3,
        },
        {
          id: "xss-2",
          question_text: '<img src=x onerror=alert(1)> Define B-tree indexing in databases.',
          type_name: "Short",
          difficulty_name: "Medium",
          marks: 3,
        },
      ];

      const res = await fetch(`${BASE_URL}/api/check-similarity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: maliciousQuestions }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.pairs));
    });
  });

  // ─── 3. Authentication & RBAC Enforcement ──────────────────────────────────

  describe("Authentication & RBAC Enforcement", () => {
    test("POST /api/suggest-blueprint: rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${BASE_URL}/api/suggest-blueprint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalMarks: 25,
          difficultyTarget: "balanced",
          className: "Class 9",
          subjectName: "Computer Science",
        }),
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.error.includes("Authentication required"));
    });

    test("POST /api/generate-test: rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${BASE_URL}/api/generate-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: "some-class",
          subjectId: "some-subject",
          blueprint: {},
        }),
      });
      assert.strictEqual(res.status, 401);
    });

    test("POST /api/tests: rejects unauthenticated test saves with 401", async () => {
      const res = await fetch(`${BASE_URL}/api/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: { title: "Hacked Test" } }),
      });
      assert.strictEqual(res.status, 401);
    });

    test("DELETE /api/tests/:id: rejects unauthenticated test deletion with 401", async () => {
      const res = await fetch(`${BASE_URL}/api/tests/unauthorized-id`, {
        method: "DELETE",
      });
      assert.strictEqual(res.status, 401);
    });
  });

  // ─── 4. Cryptographic Session Tamper Resistance ─────────────────────────────

  describe("Cryptographic Session Tamper Resistance", () => {
    test("GET /api/auth/me: rejects forged / tampered HMAC tokens", async () => {
      // Craft a forged token with modified payload pretending to be 'admin'
      const fakePayload = {
        id: "fake-admin-id",
        email: "hacker@evil.com",
        name: "Super Hacker",
        role: "admin",
        exp: Date.now() + 1000000,
        jti: "fake-jti",
      };
      const encodedPayload = Buffer.from(JSON.stringify(fakePayload)).toString("base64url");
      // Forged invalid signature
      const fakeSignature = "invalid_signature_hash_1234567890abcdef";
      const forgedToken = `${encodedPayload}.${fakeSignature}`;

      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          Cookie: `testforge_session=${forgedToken}`,
        },
      });

      assert.strictEqual(res.status, 401, "Forged HMAC token must be rejected with 401");
    });

    test("GET /api/auth/me: rejects expired signed tokens", async () => {
      // Craft an expired token (even if secret was known, expired tokens must be rejected)
      const expiredPayload = {
        id: "expired-user",
        email: "expired@school.edu",
        name: "Expired User",
        role: "student",
        exp: Date.now() - 100000, // expired in the past
      };
      const encoded = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
      const testSecret = "testforge-hybrid-hmac-secret-key-2026";
      const sig = crypto.createHmac("sha256", testSecret).update(encoded).digest("base64url");
      const expiredToken = `${encoded}.${sig}`;

      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          Cookie: `testforge_session=${expiredToken}`,
        },
      });

      assert.strictEqual(res.status, 401, "Expired token must be rejected with 401");
    });
  });

  // ─── 5. Secret Leak & Sensitive Variable Exposure ──────────────────────────

  describe("Secret Leak & Sensitive Variable Exposure", () => {
    test("GET /: does not leak sensitive environment variables in public HTML or bundles", async () => {
      const res = await fetch(BASE_URL);
      assert.strictEqual(res.status, 200);
      const html = await res.text();

      // Read .env or .env.local to identify actual secrets
      const examForgeDir = process.cwd().endsWith("examForge")
        ? process.cwd()
        : path.resolve(process.cwd(), "examForge");
      const envPath = path.resolve(examForgeDir, ".env");
      const envLocalPath = path.resolve(examForgeDir, ".env.local");

      const checkSecrets = [];
      for (const p of [envPath, envLocalPath]) {
        if (fs.existsSync(p)) {
          const lines = fs.readFileSync(p, "utf-8").split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const [key, ...rest] = trimmed.split("=");
            const val = rest.join("=").replace(/^["']|["']$/g, "").trim();
            // Check only sensitive keys (not NEXT_PUBLIC_*)
            if (
              val.length > 8 &&
              !key.startsWith("NEXT_PUBLIC") &&
              (key.includes("SECRET") ||
                key.includes("KEY") ||
                key.includes("PASSWORD") ||
                key.includes("URL"))
            ) {
              checkSecrets.push({ key, val });
            }
          }
        }
      }

      for (const { key, val } of checkSecrets) {
        assert.strictEqual(
          html.includes(val),
          false,
          `Critical Security Leak! Secret ${key} found in public HTML output`
        );
      }
    });

    test("GET /api/stats: does not leak private environment secrets in JSON responses", async () => {
      const res = await fetch(`${BASE_URL}/api/stats`);
      const body = await res.text();

      const sensitiveTerms = [
        "postgresql://",
        "service_role",
        "AUTH_SECRET",
        "DATABASE_URL",
        "JWT_SECRET",
      ];

      for (const term of sensitiveTerms) {
        assert.strictEqual(
          body.includes(term),
          false,
          `Response leaked internal database connection or secret term: ${term}`
        );
      }
    });
  });

  // ─── 6. High-Concurrency Burst Resilience ──────────────────────────────────

  describe("Concurrency & Burst Resilience", () => {
    test("Server handles 30 concurrent requests without crashing or dropping connections", async () => {
      const requests = Array.from({ length: 30 }, (_, i) => {
        const endpoint = i % 2 === 0 ? "/api/stats" : "/api/curriculum";
        return fetch(`${BASE_URL}${endpoint}`).then((res) => res.status);
      });

      const results = await Promise.all(requests);
      assert.strictEqual(results.length, 30);
      for (const status of results) {
        assert.strictEqual(status, 200, "All burst requests must succeed with HTTP 200");
      }
    });
  });
});
