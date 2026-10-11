/**
 * POST /api/explain-question
 *
 * Thin route — delegates to AnalyticsController.explainQuestion().
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { explainQuestion } from "@/controllers/analytics.controller";
import type { GeneratedQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

bootstrap();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question: GeneratedQuestion;
      className?: string;
      subjectName?: string;
    };

    if (!body.question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const explanation = await explainQuestion(body);
    return NextResponse.json({ explanation });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
