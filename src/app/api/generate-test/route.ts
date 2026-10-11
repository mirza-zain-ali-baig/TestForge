/**
 * POST /api/generate-test
 *
 * Thin route — delegates entirely to TestController.
 * Input validation stays here; business logic lives in the controller.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { generateTest } from "@/controllers/test.controller";
import { authorizeRequest, AuthError } from "@/controllers/auth.controller";
import type { GenerateTestRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

bootstrap();

export async function POST(request: Request) {
  try {
    // ── Authentication & Authorization: Only registered/signed-in users can generate tests ──
    await authorizeRequest(
      request,
      ["student", "educator", "admin"],
      "generate a test"
    );

    const body = (await request.json()) as GenerateTestRequest;

    // ── Validation ────────────────────────────────────────────────────────
    if (!body.classId || !body.subjectId) {
      return NextResponse.json(
        { error: "classId and subjectId are required" },
        { status: 400 }
      );
    }
    if (!body.blueprint) {
      return NextResponse.json({ error: "blueprint is required" }, { status: 400 });
    }
    const totalRequested = Object.values(body.blueprint).reduce(
      (s, t) => s + (t.difficulties.Easy + t.difficulties.Medium + t.difficulties.Hard),
      0
    );
    if (totalRequested <= 0) {
      return NextResponse.json(
        { error: "Request at least one question in the blueprint" },
        { status: 400 }
      );
    }

    // Normalize optional questionSources filter
    if (Array.isArray(body.questionSources)) {
      body.questionSources = body.questionSources
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0);
      if (body.questionSources.length === 0) delete body.questionSources;
    }

    // ── Delegate to controller ────────────────────────────────────────────
    const test = await generateTest(body);
    return NextResponse.json({ test });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
