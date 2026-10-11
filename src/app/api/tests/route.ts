/**
 * GET  /api/tests   — list saved tests
 * POST /api/tests   — persist a generated test
 *
 * Thin route — delegates to TestModel for DB operations.
 * Emits TEST_SAVED event after a successful save.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { findAllTests, createTest } from "@/models/test.model";
import { eventBus } from "@/events/event-bus";
import { EVENTS } from "@/events/events";
import type { GeneratedTest } from "@/lib/types";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET() {
  try {
    const tests = await findAllTests();
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
    const body = (await request.json()) as { test: GeneratedTest; source?: string };

    if (!body.test) {
      return NextResponse.json({ error: "test is required" }, { status: 400 });
    }

    // ── Delegate to model ─────────────────────────────────────────────────
    const created = await createTest(body.test, body.source);

    // ── Emit event (non-blocking) ─────────────────────────────────────────
    eventBus.emit(EVENTS.TEST_SAVED, {
      savedId: created.id,
      title: created.title,
      source: created.source,
      totalMarks: created.totalMarks,
      className: created.className,
      subjectName: created.subjectName,
    });

    return NextResponse.json({ test: created });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
