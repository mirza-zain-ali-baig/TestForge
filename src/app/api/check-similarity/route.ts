/**
 * POST /api/check-similarity
 *
 * Thin route — delegates to AnalyticsController.detectSimilarQuestions().
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { detectSimilarQuestions } from "@/controllers/analytics.controller";
import type { GeneratedQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

bootstrap();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { questions: GeneratedQuestion[] };

    if (!body.questions || body.questions.length < 2) {
      return NextResponse.json({ pairs: [] });
    }

    const pairs = await detectSimilarQuestions(body.questions);
    return NextResponse.json({ pairs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
