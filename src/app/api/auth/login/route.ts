/**
 * POST /api/auth/login
 *
 * Thin route adapter — delegates to AuthController.login().
 * Sets an HTTP-only session cookie upon successful authentication.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { login, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/controllers/auth.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await login({
      email: body.email,
      password: body.password,
    });

    const response = NextResponse.json({
      user: result.user,
      message: "Logged in successfully.",
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
