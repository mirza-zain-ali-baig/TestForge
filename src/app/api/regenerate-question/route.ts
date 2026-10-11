/**
 * POST /api/regenerate-question
 *
 * Thin route — delegates to QuestionController.regenerateQuestion().
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { regenerateQuestion } from "@/controllers/question.controller";
import { authorizeRequest, AuthError } from "@/controllers/auth.controller";
import type { QuestionTypeName, DifficultyName } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

bootstrap();

export async function POST(request: Request) {
  try {
    // ── Only registered/signed-in users can regenerate test questions ──
    await authorizeRequest(
      request,
      ["student", "educator", "admin"],
      "regenerate a question"
    );

    const body = (await request.json()) as {
      subjectName: string;
      className: string;
      chapterName?: string;
      topicName?: string;
      typeName: QuestionTypeName;
      difficultyName: DifficultyName;
      marks: number;
    };

    if (!body.subjectName || !body.className || !body.typeName || !body.difficultyName) {
      return NextResponse.json(
        { error: "subjectName, className, typeName and difficultyName are required" },
        { status: 400 }
      );
    }

    const question = await regenerateQuestion(body);

    if (!question) {
      return NextResponse.json(
        { error: "AI could not generate a question. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ question });
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
