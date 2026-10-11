/**
 * POST /api/suggest-blueprint
 *
 * Thin route — delegates to BlueprintController.suggestBlueprint().
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { suggestBlueprint } from "@/controllers/blueprint.controller";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

bootstrap();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      totalMarks: number;
      difficultyTarget: "easy" | "balanced" | "hard" | "exam";
      className: string;
      subjectName: string;
      chapters?: string[];
    };

    if (!body.totalMarks || body.totalMarks < 1) {
      return NextResponse.json({ error: "totalMarks must be >= 1" }, { status: 400 });
    }

    const result = await suggestBlueprint(body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
