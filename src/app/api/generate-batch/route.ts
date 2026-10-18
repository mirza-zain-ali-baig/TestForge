/**
 * POST /api/generate-batch
 *
 * Thin route — delegates entirely to TestController and AuthController.
 * RBAC: Multi-variant batch exam generation is restricted to educator | admin.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { generateBatch } from "@/controllers/test.controller";
import { authorizeRequest, AuthError } from "@/controllers/auth.controller";
import type { GenerateTestRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // allow up to 5 min for multi-variant + AI fill

bootstrap();

export async function POST(request: Request) {
  try {
    // ── Authorization: all authenticated users can generate batch exam variants ──
    await authorizeRequest(request, ["student", "educator", "admin"], "generate batch exam variants");

    const body = (await request.json()) as {
      request: GenerateTestRequest;
      variantCount: number;
    };

    // ── Validation ────────────────────────────────────────────────────────
    if (!body.request?.classId || !body.request?.subjectId) {
      return NextResponse.json(
        { error: "classId and subjectId are required" },
        { status: 400 }
      );
    }
    const variantCount = Math.max(
      1,
      Math.min(parseInt(String(body.variantCount ?? "1"), 10) || 1, 6)
    );

    // Normalize optional questionSources filter
    if (Array.isArray(body.request.questionSources)) {
      body.request.questionSources = body.request.questionSources
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0);
      if (body.request.questionSources.length === 0) delete body.request.questionSources;
    }

    // ── Delegate to controller ────────────────────────────────────────────
    const variants = await generateBatch(body.request, variantCount);
    return NextResponse.json({ variants });
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
