/**
 * POST /api/auth/register
 *
 * Thin route adapter — delegates to AuthController.register().
 * Sets an HTTP-only session cookie upon successful account creation.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { register, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/controllers/auth.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await register({
      email: body.email,
      password: body.password,
      name: body.name,
      role: body.role,
    });

    const response = NextResponse.json({
      user: result.user,
      message: "Account registered successfully.",
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
    const message = error instanceof Error ? error.message : "Registration failed.";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
