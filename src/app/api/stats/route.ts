/**
 * GET /api/stats
 *
 * Thin route — delegates to AnalyticsController.getBankStats().
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { getBankStats } from "@/controllers/analytics.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET() {
  try {
    const stats = await getBankStats();
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
