/**
 * Comprehensive Automated Authentication & RBAC Authorization Test Suite
 * Tests Student, Educator, and Admin roles and endpoint protection.
 */

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("=== STARTING AUTHENTICATION & RBAC AUTHORIZATION TEST SUITE ===\n");
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, extra?: string) => {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${extra || ""}`);
      failed++;
    }
  };

  const ts = Date.now();
  const studentEmail = `student.${ts}@school.edu`;
  const educatorEmail = `educator.${ts}@school.edu`;
  const adminEmail = `admin.${ts}@school.edu`;
  const testPassword = "SecurePassword123!";

  // Test 1: Unauthenticated /api/auth/me returns 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    assert(res.status === 401, "Test 1: Unauthenticated /api/auth/me returns 401");
  } catch (err) {
    assert(false, "Test 1", String(err));
  }

  // Test 2: Validation rejection for invalid email
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "password123" }),
    });
    assert(res.status === 400, "Test 2: Rejects invalid email format with 400");
  } catch (err) {
    assert(false, "Test 2", String(err));
  }

  // Test 3: Validation rejection for short password
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "valid@email.com", password: "123" }),
    });
    assert(res.status === 400, "Test 3: Rejects short password (< 6 chars) with 400");
  } catch (err) {
    assert(false, "Test 3", String(err));
  }

  // Test 4: Validation rejection for invalid role
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `hacker.${ts}@school.edu`,
        password: testPassword,
        role: "superhacker",
      }),
    });
    assert(res.status === 400, "Test 4: Rejects invalid role ('superhacker') with 400");
  } catch (err) {
    assert(false, "Test 4", String(err));
  }

  // Test 5: Register as STUDENT
  let studentCookie = "";
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: studentEmail,
        password: testPassword,
        name: "Ali Khan (Student)",
        role: "student",
      }),
    });
    studentCookie = (res.headers.get("set-cookie") || "").split(";")[0];
    const body = await res.json();
    const perms: string[] = body.user?.permissions || [];

    assert(
      res.status === 200 &&
        body.user?.role === "student" &&
        perms.includes("test:take") &&
        !perms.includes("test:save") &&
        !perms.includes("test:delete") &&
        studentCookie.includes("testforge_session="),
      "Test 5: Student registration succeeds with restricted student permissions"
    );
  } catch (err) {
    assert(false, "Test 5", String(err));
  }

  // Test 6: Register as EDUCATOR
  let educatorCookie = "";
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: educatorEmail,
        password: testPassword,
        name: "Dr. Jane Doe (Educator)",
        role: "educator",
      }),
    });
    educatorCookie = (res.headers.get("set-cookie") || "").split(";")[0];
    const body = await res.json();
    const perms: string[] = body.user?.permissions || [];

    assert(
      res.status === 200 &&
        body.user?.role === "educator" &&
        perms.includes("test:save") &&
        perms.includes("test:delete") &&
        perms.includes("test:batch") &&
        educatorCookie.includes("testforge_session="),
      "Test 6: Educator registration succeeds with full authoring permissions"
    );
  } catch (err) {
    assert(false, "Test 6", String(err));
  }

  // Test 7: Register as ADMIN
  let adminCookie = "";
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: testPassword,
        name: "Principal Admin",
        role: "admin",
      }),
    });
    adminCookie = (res.headers.get("set-cookie") || "").split(";")[0];
    const body = await res.json();
    const perms: string[] = body.user?.permissions || [];

    assert(
      res.status === 200 &&
        body.user?.role === "admin" &&
        perms.includes("admin:manage") &&
        adminCookie.includes("testforge_session="),
      "Test 7: Admin registration succeeds with admin:manage permission"
    );
  } catch (err) {
    assert(false, "Test 7", String(err));
  }

  // Test 8: Duplicate registration returns 409 Conflict
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: studentEmail,
        password: testPassword,
        role: "student",
      }),
    });
    assert(res.status === 409, "Test 8: Duplicate email registration rejected with 409 Conflict");
  } catch (err) {
    assert(false, "Test 8", String(err));
  }

  // Test 9: Login with incorrect password returns 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: studentEmail,
        password: "WrongPassword!",
      }),
    });
    assert(res.status === 401, "Test 9: Login with incorrect password returns 401");
  } catch (err) {
    assert(false, "Test 9", String(err));
  }

  // Test 10: Login as Student succeeds
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: studentEmail,
        password: testPassword,
      }),
    });
    const body = await res.json();
    assert(
      res.status === 200 && body.user?.role === "student",
      "Test 10: Student login succeeds and returns student role"
    );
  } catch (err) {
    assert(false, "Test 10", String(err));
  }

  // Sample test payload for RBAC checks
  const sampleTestPayload = {
    test: {
      title: "RBAC Security Verification Exam",
      className: "Class 10",
      subjectName: "Computer Science",
      subjectId: "test-sub-id",
      durationMins: 30,
      instructions: "Attempt all questions.",
      totalMarks: 5,
      totalQuestions: 1,
      source: "bank",
      generatedAt: new Date().toISOString(),
      sections: [],
      meta: { requested: 1, fromBank: 1, fromAI: 0, shortfalls: [] },
    },
    source: "bank",
  };

  // Test 11: RBAC — Unauthenticated user attempting POST /api/tests -> 401
  try {
    const res = await fetch(`${BASE_URL}/api/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleTestPayload),
    });
    assert(
      res.status === 401,
      "Test 11: RBAC blocks unauthenticated user from saving a test (401 Unauthorized)"
    );
  } catch (err) {
    assert(false, "Test 11", String(err));
  }

  // Test 12: RBAC — Student attempting POST /api/tests -> 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/tests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: studentCookie,
      },
      body: JSON.stringify(sampleTestPayload),
    });
    const body = await res.json();
    assert(
      res.status === 403 && body.error?.includes("Access denied"),
      "Test 12: RBAC blocks Student from saving official test papers (403 Forbidden)"
    );
  } catch (err) {
    assert(false, "Test 12", String(err));
  }

  // Test 13: RBAC — Student attempting POST /api/generate-batch -> 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/generate-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        request: { classId: "c1", subjectId: "s1" },
        variantCount: 2,
      }),
    });
    assert(
      res.status === 403,
      "Test 13: RBAC blocks Student from batch variant generation (403 Forbidden)"
    );
  } catch (err) {
    assert(false, "Test 13", String(err));
  }

  // Test 14: RBAC — Student reading GET /api/tests -> 200 OK
  try {
    const res = await fetch(`${BASE_URL}/api/tests`, {
      headers: { Cookie: studentCookie },
    });
    assert(
      res.status === 200,
      "Test 14: RBAC allows Student to view saved tests for practice (200 OK)"
    );
  } catch (err) {
    assert(false, "Test 14", String(err));
  }

  // Test 15: RBAC — Educator attempting POST /api/tests -> 201 Created
  let savedTestId = "";
  try {
    const res = await fetch(`${BASE_URL}/api/tests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: educatorCookie,
      },
      body: JSON.stringify(sampleTestPayload),
    });
    const body = await res.json();
    savedTestId = body.test?.id || "";
    assert(
      res.status === 201 && Boolean(savedTestId),
      "Test 15: RBAC allows Educator to save official test paper (201 Created)"
    );
  } catch (err) {
    assert(false, "Test 15", String(err));
  }

  // Test 16: RBAC — Student attempting DELETE /api/tests/[id] -> 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/tests/${savedTestId}`, {
      method: "DELETE",
      headers: { Cookie: studentCookie },
    });
    assert(
      res.status === 403,
      "Test 16: RBAC blocks Student from deleting a saved test paper (403 Forbidden)"
    );
  } catch (err) {
    assert(false, "Test 16", String(err));
  }

  // Test 17: RBAC — Educator/Admin attempting DELETE /api/tests/[id] -> 200 OK
  try {
    const res = await fetch(`${BASE_URL}/api/tests/${savedTestId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(
      res.status === 200,
      "Test 17: RBAC allows Admin/Educator to delete saved test paper (200 OK)"
    );
  } catch (err) {
    assert(false, "Test 17", String(err));
  }

  // Test 18: Logout revokes session
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: studentCookie },
    });
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: studentCookie },
    });
    assert(
      logoutRes.status === 200 && meRes.status === 401,
      "Test 18: Logout clears cookie and revokes session token in database"
    );
  } catch (err) {
    assert(false, "Test 18", String(err));
  }

  console.log("\n==========================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==========================================");

  if (failed > 0) process.exit(1);
}

runTests();
