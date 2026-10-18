/**
 * GET  /api/tests   — list saved tests (open to students, educators, admins)
 * POST /api/tests   — persist a generated test (RBAC: educator | admin only)
 *
 * Thin route — delegates to TestModel for DB operations and AuthController for RBAC.
 * Emits TEST_SAVED event after a successful save.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { findAllTests, createTest } from "@/models/test.model";
import { authorizeRequest, AuthError } from "@/controllers/auth.controller";
import { eventBus } from "@/events/event-bus";
import { EVENTS } from "@/events/events";
import type { GeneratedTest } from "@/lib/types";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("userEmail") || undefined;
    const tests = await findAllTests(userEmail);
    return NextResponse.json({ tests });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // ── RBAC Authorization: all registered users (student, educator, admin) can save their test papers ──
    const user = await authorizeRequest(request, ["student", "educator", "admin"], "save test papers");

    const body = (await request.json()) as { test: GeneratedTest; source?: string };

    if (!body.test) {
      return NextResponse.json({ error: "test is required" }, { status: 400 });
    }

    // ── Delegate to model ─────────────────────────────────────────────────
    const created = await createTest(body.test, body.source, user.email);

    // ── Emit event (non-blocking) ─────────────────────────────────────────
    eventBus.emit(EVENTS.TEST_SAVED, {
      savedId: created.id,
      title: created.title,
      source: created.source,
      totalMarks: created.totalMarks,
      className: created.className,
      subjectName: created.subjectName,
    });

    return NextResponse.json({ test: created }, { status: 201 });
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
