/**
 * GET /api/questions/availability
 *
 * Fast batch aggregation endpoint for question bank counts
 * across all 9 cells (3 types × 3 difficulties).
 * Resolves instantly (<1ms) from in-memory pool.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { getQuestionsAvailability } from "@/models/question.model";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");
    if (!subjectId) {
      return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
    }
    const chapterIds = searchParams.get("chapterIds")?.split(",").filter(Boolean);
    const topicIds = searchParams.get("topicIds")?.split(",").filter(Boolean);

    const availability = await getQuestionsAvailability({ subjectId, chapterIds, topicIds });
    return NextResponse.json(availability, {
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
