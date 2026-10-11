/**
 * auth.controller.ts — Controller layer
 *
 * Business logic and orchestration for User Authentication, Sessions, and
 * Role-Based Access Control (RBAC / Authorization).
 */

import crypto from "crypto";
import { cookies } from "next/headers";
import {
  createUser,
  findUserByEmail,
  createSession,
  findSessionWithUser,
  deleteSession,
  revokedTokens,
} from "@/models/user.model";
import { eventBus } from "@/events/event-bus";
import { EVENTS } from "@/events/events";

export const SESSION_COOKIE_NAME = "testforge_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

const SESSION_SIGNING_SECRET =
  process.env.AUTH_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "testforge-hybrid-hmac-secret-key-2026";

// ─── Role-Based Access Control (RBAC) ────────────────────────────────────────

export const VALID_ROLES = ["student", "educator", "admin"] as const;
export type Role = (typeof VALID_ROLES)[number];

export type Permission =
  | "test:view"
  | "test:take"
  | "test:practice"
  | "bank:read"
  | "test:generate"
  | "test:batch"
  | "test:save"
  | "test:delete"
  | "analytics:view"
  | "admin:manage";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  student: ["test:view", "test:take", "test:practice", "bank:read", "test:generate"],
  educator: [
    "test:view",
    "test:take",
    "test:practice",
    "bank:read",
    "test:generate",
    "test:batch",
    "test:save",
    "test:delete",
    "analytics:view",
  ],
  admin: [
    "test:view",
    "test:take",
    "test:practice",
    "bank:read",
    "test:generate",
    "test:batch",
    "test:save",
    "test:delete",
    "analytics:view",
    "admin:manage",
  ],
};

export function getPermissionsForRole(role: string): Permission[] {
  if (VALID_ROLES.includes(role as Role)) {
    return ROLE_PERMISSIONS[role as Role];
  }
  return ROLE_PERMISSIONS.student;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: 401 | 403 = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

// ─── Cryptographic Password Hashing & Signed Session Tokens ──────────────────

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

/**
 * Generates a cryptographically signed session token that is both stored in SQLite
 * and self-verifiable across stateless Vercel Serverless Function instances.
 */
export function generateToken(payload?: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  exp: number;
}): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  if (!payload) return nonce;
  const encoded = Buffer.from(JSON.stringify({ ...payload, jti: nonce })).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SESSION_SIGNING_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function verifySignedToken(token: string): {
  id: string;
  email: string;
  name: string | null;
  role: string;
  exp: number;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac("sha256", SESSION_SIGNING_SECRET)
      .update(encoded)
      .digest("base64url");
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!decoded.exp || Date.now() > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
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

function validateRole(role?: string): Role {
  if (!role) return "student";
  const normalized = role.trim().toLowerCase();
  if (!VALID_ROLES.includes(normalized as Role)) {
    throw new Error(`Invalid role "${role}". Allowed roles: ${VALID_ROLES.join(", ")}.`);
  }
  return normalized as Role;
}

// ─── Controller Methods ──────────────────────────────────────────────────────

export type SanitizedUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  permissions: Permission[];
};

export type AuthResult = {
  user: SanitizedUser;
  token: string;
  expiresAt: Date;
};

/**
 * Registers a new user account (student, educator, or admin), creates an active session,
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
  const role = validateRole(data.role);

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with this email address already exists.");
  }

  const passwordHash = hashPassword(data.password);
  const user = await createUser({
    email,
    name: data.name,
    passwordHash,
    role,
  });

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: expiresAt.getTime(),
  });

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

  const sanitized: SanitizedUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    permissions: getPermissionsForRole(user.role),
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

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: expiresAt.getTime(),
  });

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

  const sanitized: SanitizedUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    permissions: getPermissionsForRole(user.role),
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
  if (!token || revokedTokens.has(token)) return null;

  const session = await findSessionWithUser(token);
  if (session) {
    if (session.expiresAt < new Date()) {
      await deleteSession(token);
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as Role,
      permissions: getPermissionsForRole(session.user.role),
    };
  }

  // Fallback for multi-instance Vercel Serverless containers: verify HMAC-signed token
  const signedPayload = verifySignedToken(token);
  if (!signedPayload) return null;

  return {
    id: signedPayload.id,
    email: signedPayload.email,
    name: signedPayload.name,
    role: signedPayload.role as Role,
    permissions: getPermissionsForRole(signedPayload.role),
  };
}

/**
 * Extracts session token from HTTP cookies or Authorization Bearer header.
 */
export async function extractTokenFromRequest(request: Request): Promise<string | undefined> {
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }
  return token;
}

/**
 * Role-Based Access Control (RBAC) Guard for API endpoints.
 * Verifies authentication (401) and role authorization (403).
 */
export async function authorizeRequest(
  request: Request,
  allowedRoles: Role[],
  resourceName: string
): Promise<SanitizedUser> {
  const token = await extractTokenFromRequest(request);
  const user = await authenticateSession(token);

  if (!user) {
    throw new AuthError("Authentication required. Please sign in to continue.", 401);
  }

  if (!allowedRoles.includes(user.role)) {
    eventBus.emit(EVENTS.AUTH_ACCESS_DENIED, {
      userId: user.id,
      email: user.email,
      role: user.role,
      requiredRoles: allowedRoles,
      resource: resourceName,
    });
    throw new AuthError(
      `Access denied: role "${user.role}" is not authorized to ${resourceName}. Required role: ${allowedRoles.join(" or ")}.`,
      403
    );
  }

  return user;
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
