/**
 * POST /api/auth/logout
 *
 * Thin route adapter — delegates to AuthController.logout().
 * Clears the session cookie.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bootstrap } from "@/lib/bootstrap";
import { logout, SESSION_COOKIE_NAME } from "@/controllers/auth.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await logout(token);
    }

    const response = NextResponse.json({
      message: "Logged out successfully.",
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
