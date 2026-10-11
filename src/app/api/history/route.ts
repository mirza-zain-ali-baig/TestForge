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

export async function GET() {
  try {
    const history = await getHistoryStats();
    return NextResponse.json(history);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
