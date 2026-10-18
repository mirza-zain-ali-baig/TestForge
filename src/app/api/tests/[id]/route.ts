/**
 * GET    /api/tests/[id]  — fetch a saved test (open to students, educators, admins)
 * DELETE /api/tests/[id]  — delete a saved test (RBAC: educator | admin only)
 *
 * Thin route — delegates to TestModel and AuthController.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { findTestById, deleteTest, parseTestJson } from "@/models/test.model";
import { authorizeRequest, AuthError } from "@/controllers/auth.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const test = await findTestById(id);
    if (!test) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      test: { ...test, parsed: parseTestJson(test) },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Authorization: all authenticated users can delete saved tests ──
    await authorizeRequest(request, ["student", "educator", "admin"], "delete test papers");

    const { id } = await params;
    await deleteTest(id);
    return NextResponse.json({ ok: true });
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
