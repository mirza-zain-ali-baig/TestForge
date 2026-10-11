/**
 * GET /api/auth/me
 *
 * Thin route adapter — delegates to AuthController.authenticateSession().
 * Returns the currently authenticated user profile, or 401 if unauthenticated.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bootstrap } from "@/lib/bootstrap";
import { authenticateSession, SESSION_COOKIE_NAME } from "@/controllers/auth.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    // Optional Bearer token fallback for API consumers
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    const user = await authenticateSession(token);

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
