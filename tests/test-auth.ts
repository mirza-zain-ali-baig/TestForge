/**
 * Comprehensive Automated Authentication Test Suite
 */

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("=== STARTING AUTHENTICATION TEST SUITE ===\n");
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

  const testEmail = `test.educator.${Date.now()}@school.edu`;
  const testPassword = "SecurePassword123!";
  const testName = "Dr. Jane Doe";

  // Test 1: Unauthenticated /api/auth/me returns 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    assert(res.status === 401, "Test 1: Unauthenticated /api/auth/me returns 401");
  } catch (err) {
    assert(false, "Test 1: Unauthenticated /api/auth/me", String(err));
  }

  // Test 2: Validation rejection for invalid email
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email", password: "password123" }),
    });
    assert(res.status === 400, "Test 2: Rejects invalid email format with 400");
  } catch (err) {
    assert(false, "Test 2: Invalid email", String(err));
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
    assert(false, "Test 3: Short password", String(err));
  }

  // Test 4: Successful User Registration
  let sessionCookie = "";
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
        role: "educator",
      }),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    const body = await res.json();
    sessionCookie = setCookie.split(";")[0];

    assert(
      res.status === 200 &&
      body.user?.email === testEmail &&
      body.user?.name === testName &&
      !body.user?.passwordHash &&
      sessionCookie.includes("testforge_session="),
      "Test 4: Register user creates account, hides hash, and sets session cookie"
    );
  } catch (err) {
    assert(false, "Test 4: Register user", String(err));
  }

  // Test 5: Duplicate registration returns 409 Conflict
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    assert(res.status === 409, "Test 5: Duplicate registration rejected with 409 Conflict");
  } catch (err) {
    assert(false, "Test 5: Duplicate registration", String(err));
  }

  // Test 6: Login with incorrect password returns 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "WrongPassword!",
      }),
    });
    assert(res.status === 401, "Test 6: Login with incorrect password returns 401");
  } catch (err) {
    assert(false, "Test 6: Wrong password login", String(err));
  }

  // Test 7: Login with correct credentials
  let loginCookie = "";
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    loginCookie = setCookie.split(";")[0];
    const body = await res.json();

    assert(
      res.status === 200 &&
      body.user?.email === testEmail &&
      loginCookie.includes("testforge_session="),
      "Test 7: Login with correct credentials succeeds and returns session cookie"
    );
  } catch (err) {
    assert(false, "Test 7: Login credentials", String(err));
  }

  // Test 8: /api/auth/me with session cookie
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: loginCookie },
    });
    const body = await res.json();
    assert(
      res.status === 200 &&
      body.user?.email === testEmail &&
      body.user?.name === testName,
      "Test 8: Authenticated /api/auth/me returns current user profile"
    );
  } catch (err) {
    assert(false, "Test 8: Current user profile", String(err));
  }

  // Test 9: Logout clears session
  let logoutCookie = "";
  try {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: loginCookie },
    });
    const setCookie = res.headers.get("set-cookie") || "";
    logoutCookie = setCookie;
    assert(
      res.status === 200 && logoutCookie.includes("Max-Age=0"),
      "Test 9: Logout succeeds and clears session cookie (Max-Age=0)"
    );
  } catch (err) {
    assert(false, "Test 9: Logout", String(err));
  }

  // Test 10: /api/auth/me after logout returns 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: loginCookie },
    });
    assert(
      res.status === 401,
      "Test 10: /api/auth/me with revoked session token returns 401"
    );
  } catch (err) {
    assert(false, "Test 10: Revoked session", String(err));
  }

  console.log("\n==========================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==========================================");

  if (failed > 0) process.exit(1);
}

runTests();
