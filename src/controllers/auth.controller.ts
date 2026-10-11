/**
 * auth.controller.ts — Controller layer
 *
 * Business logic and orchestration for User Authentication and Sessions.
 * Handles password hashing, verification, session issuance, and event emission.
 */

import crypto from "crypto";
import {
  createUser,
  findUserByEmail,
  createSession,
  findSessionWithUser,
  deleteSession,
} from "@/models/user.model";
import { eventBus } from "@/events/event-bus";
import { EVENTS } from "@/events/events";

export const SESSION_COOKIE_NAME = "testforge_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── Cryptographic Password Hashing ──────────────────────────────────────────

/**
 * Derives a secure password hash using scrypt + 16-byte cryptographically secure salt.
 * Formatted as: "<salt_hex>:<hash_hex>"
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Timing-safe password verification comparing scrypt derived keys.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/** Generates a 256-bit cryptographically secure session token. */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
    throw new Error("Please enter a valid email address.");
  }
  return trimmed;
}

function validatePassword(password: string): void {
  if (!password || typeof password !== "string" || password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }
}

// ─── Controller Methods ──────────────────────────────────────────────────────

export type SanitizedUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export type AuthResult = {
  user: SanitizedUser;
  token: string;
  expiresAt: Date;
};

/**
 * Registers a new user account, creates an initial active session,
 * and emits the USER_REGISTERED background event.
 */
export async function register(data: {
  email: string;
  password: string;
  name?: string;
  role?: string;
}): Promise<AuthResult> {
  const email = validateEmail(data.email);
  validatePassword(data.password);

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with this email address already exists.");
  }

  const passwordHash = hashPassword(data.password);
  const user = await createUser({
    email,
    name: data.name,
    passwordHash,
    role: data.role || "educator",
  });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await createSession({
    userId: user.id,
    token,
    expiresAt,
  });

  const sanitized: SanitizedUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  // Emit event for background audit / telemetry
  eventBus.emit(EVENTS.USER_REGISTERED, {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return { user: sanitized, token, expiresAt };
}

/**
 * Authenticates user credentials, generates a new session,
 * and emits the USER_LOGIN background event.
 */
export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = validateEmail(data.email);
  if (!data.password) {
    throw new Error("Password is required.");
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(data.password, user.passwordHash)) {
    throw new Error("Invalid email or password.");
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await createSession({
    userId: user.id,
    token,
    expiresAt,
  });

  const sanitized: SanitizedUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  // Emit event for background audit / telemetry
  eventBus.emit(EVENTS.USER_LOGIN, {
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { user: sanitized, token, expiresAt };
}

/**
 * Resolves the authenticated user from a session token.
 * Returns null if token is missing, invalid, or expired.
 */
export async function authenticateSession(token?: string | null): Promise<SanitizedUser | null> {
  if (!token) return null;

  const session = await findSessionWithUser(token);
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    // Session expired; clean up
    await deleteSession(token);
    return null;
  }

  return session.user;
}

/**
 * Invalidates a session and emits the USER_LOGOUT background event.
 */
export async function logout(token?: string | null): Promise<void> {
  if (!token) return;

  const session = await findSessionWithUser(token);
  await deleteSession(token);

  if (session) {
    eventBus.emit(EVENTS.USER_LOGOUT, {
      userId: session.userId,
    });
  }
}
