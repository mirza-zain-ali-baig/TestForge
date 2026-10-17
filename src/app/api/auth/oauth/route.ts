/**
 * POST /api/auth/oauth
 *
 * Handles Google OAuth and external provider session synchronization.
 * Upserts the user record in Supabase app_users and creates an authenticated HTTP-only session cookie.
 */

import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { findUserByEmail, createUser, createSession } from "@/models/user.model";
import { generateToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/controllers/auth.controller";

export const dynamic = "force-dynamic";

bootstrap();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.toLowerCase().trim();
    const name = body.name?.trim() || null;
    const provider = body.provider || "google";

    if (!email) {
      return NextResponse.json({ error: "Email is required for OAuth synchronization." }, { status: 400 });
    }

    // 1. Find or create user in Supabase app_users
    let user = await findUserByEmail(email);
    if (!user) {
      user = await createUser({
        email,
        name: name || email.split("@")[0],
        passwordHash: `oauth:${provider}:${Date.now()}`,
        role: "educator",
        authProvider: provider,
      });
    }

    // 2. Generate signed session token
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      exp: expiresAt.getTime(),
    });

    // 3. Persist session in Supabase app_sessions
    await createSession({
      userId: user.id,
      token,
      expiresAt,
      userSnapshot: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });

    const sanitizedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };

    const response = NextResponse.json({
      user: sanitizedUser,
      message: `Signed in with ${provider}.`,
    });

    // 4. Set HTTP-only cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth synchronization failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
