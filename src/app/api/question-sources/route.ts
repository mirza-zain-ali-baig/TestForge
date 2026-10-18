/**
 * GET /api/question-sources
 *
 * Thin route — delegates to QuestionModel.findQuestionSources().
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { findQuestionSources } from "@/models/question.model";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");
    const chapterIds = searchParams.get("chapterIds")?.split(",").filter(Boolean);
    const topicIds = searchParams.get("topicIds")?.split(",").filter(Boolean);

    if (!subjectId) {
      return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
    }

    const result = await findQuestionSources({ subjectId, chapterIds, topicIds });
    return NextResponse.json(result, {
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
