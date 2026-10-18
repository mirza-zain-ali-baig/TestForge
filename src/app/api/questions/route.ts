/**
 * GET /api/questions
 *
 * Thin route — delegates to QuestionController.
 * Parses and validates query parameters; business logic is in the controller.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { listQuestions } from "@/controllers/question.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      subjectId: searchParams.get("subjectId") ?? undefined,
      chapterIds: searchParams.get("chapterIds")?.split(",").filter(Boolean),
      topicIds: searchParams.get("topicIds")?.split(",").filter(Boolean),
      questionType: searchParams.get("questionType") ?? undefined,
      difficulty: searchParams.get("difficulty") ?? undefined,
      search: searchParams.get("search")?.trim() || undefined,
      limit: parseInt(searchParams.get("limit") ?? "50", 10) || 50,
      offset: parseInt(searchParams.get("offset") ?? "0", 10) || 0,
    };

    const result = await listQuestions(params);
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
