/**
 * GET    /api/tests/[id]  — fetch a saved test (full JSON)
 * DELETE /api/tests/[id]  — delete a saved test
 *
 * Thin route — delegates to TestModel.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { findTestById, deleteTest, parseTestJson } from "@/models/test.model";

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTest(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
