/**
 * GET /api/curriculum
 *
 * Thin route — delegates to CurriculumModel.getCurriculumTree().
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { getCurriculumTree } from "@/models/curriculum.model";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId") ?? undefined;
    const subjectId = searchParams.get("subjectId") ?? undefined;

    const tree = await getCurriculumTree({ classId, subjectId });
    return NextResponse.json(
      { tree },
      {
        headers: {
          "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
