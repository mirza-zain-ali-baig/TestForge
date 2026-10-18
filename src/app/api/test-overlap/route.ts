/**
 * GET /api/test-overlap
 *
 * Thin route — delegates to AnalyticsController.getTestOverlap().
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { getTestOverlap } from "@/controllers/analytics.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("userEmail") || undefined;
    const result = await getTestOverlap(userEmail);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
