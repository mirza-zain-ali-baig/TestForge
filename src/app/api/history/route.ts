/**
 * GET /api/history
 *
 * Thin route — delegates to AnalyticsController.getHistoryStats().
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { getHistoryStats } from "@/controllers/analytics.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("userEmail") || undefined;
    const history = await getHistoryStats(userEmail);
    return NextResponse.json(history);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
