/**
 * user.model.ts — Model layer
 *
 * Data-access operations for User accounts and Sessions (Prisma / SQLite).
 * Pure data tier: no HTTP or business orchestration logic lives here.
 */

import crypto from "crypto";
import { db, ensureDbInitialized } from "@/lib/db";

export type UserRecord = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionWithUser = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: Date;
  };
};

// In-memory fallback store in case a serverless environment has a stale Prisma client or read-only DB
const globalFallback = globalThis as unknown as {
  __tfUsers?: Map<string, UserRecord>;
  __tfSessions?: Map<string, SessionWithUser>;
  __tfRevokedTokens?: Set<string>;
};
const fallbackUsers = (globalFallback.__tfUsers ??= new Map<string, UserRecord>());
const fallbackSessions = (globalFallback.__tfSessions ??= new Map<string, SessionWithUser>());
export const revokedTokens = (globalFallback.__tfRevokedTokens ??= new Set<string>());

function hasPrismaUserModels(): boolean {
  const anyDb = db as unknown as Record<string, unknown>;
  return Boolean(anyDb && anyDb.user && anyDb.session);
}

/** Finds a user by their unique email address. */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.toLowerCase().trim();
  await ensureDbInitialized();

  if (hasPrismaUserModels()) {
    try {
      const found = await db.user.findUnique({
        where: { email: normalized },
      });
      if (found) {
        fallbackUsers.set(normalized, found);
        return found;
      }
    } catch (err) {
      console.warn("[UserModel] Prisma findUserByEmail fallback:", err);
    }
  }

  return fallbackUsers.get(normalized) ?? null;
}

/** Finds a user by their ID. */
export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureDbInitialized();

  if (hasPrismaUserModels()) {
    try {
      const found = await db.user.findUnique({
        where: { id },
      });
      if (found) return found;
    } catch (err) {
      console.warn("[UserModel] Prisma findUserById fallback:", err);
    }
  }

  for (const u of fallbackUsers.values()) {
    if (u.id === id) return u;
  }
  return null;
}

/** Persists a new user record. */
export async function createUser(data: {
  email: string;
  name?: string;
  passwordHash: string;
  role?: string;
}): Promise<UserRecord> {
  const normalizedEmail = data.email.toLowerCase().trim();
  const now = new Date();
  const fallbackRecord: UserRecord = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    name: data.name?.trim() || null,
    passwordHash: data.passwordHash,
    role: data.role || "educator",
    createdAt: now,
    updatedAt: now,
  };

  await ensureDbInitialized();

  if (hasPrismaUserModels()) {
    try {
      const created = await db.user.create({
        data: {
          email: normalizedEmail,
          name: data.name?.trim() || null,
          passwordHash: data.passwordHash,
          role: data.role || "educator",
        },
      });
      fallbackUsers.set(normalizedEmail, created);
      return created;
    } catch (err) {
      console.warn("[UserModel] Prisma createUser fallback:", err);
    }
  }

  fallbackUsers.set(normalizedEmail, fallbackRecord);
  return fallbackRecord;
}

/** Creates a new session associated with a user. */
export async function createSession(data: {
  userId: string;
  token: string;
  expiresAt: Date;
  userSnapshot?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: Date;
  };
}): Promise<{ id: string; token: string; expiresAt: Date }> {
  await ensureDbInitialized();

  const sessionId = crypto.randomUUID();
  if (data.userSnapshot) {
    fallbackSessions.set(data.token, {
      id: sessionId,
      token: data.token,
      userId: data.userId,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
      user: data.userSnapshot,
    });
  }

  if (hasPrismaUserModels()) {
    try {
      return await db.session.create({
        data: {
          userId: data.userId,
          token: data.token,
          expiresAt: data.expiresAt,
        },
        select: {
          id: true,
          token: true,
          expiresAt: true,
        },
      });
    } catch (err) {
      console.warn("[UserModel] Prisma createSession fallback:", err);
    }
  }

  return {
    id: sessionId,
    token: data.token,
    expiresAt: data.expiresAt,
  };
}

/** Resolves an active session and includes the sanitized user profile. */
export async function findSessionWithUser(token: string): Promise<SessionWithUser | null> {
  if (revokedTokens.has(token)) return null;

  await ensureDbInitialized();

  if (hasPrismaUserModels()) {
    try {
      const found = await db.session.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });
      if (found) return found;
    } catch (err) {
      console.warn("[UserModel] Prisma findSessionWithUser fallback:", err);
    }
  }

  return fallbackSessions.get(token) ?? null;
}

/** Deletes a session by token (sign-out). */
export async function deleteSession(token: string): Promise<void> {
  revokedTokens.add(token);
  fallbackSessions.delete(token);

  await ensureDbInitialized();

  if (hasPrismaUserModels()) {
    try {
      await db.session.deleteMany({
        where: { token },
      });
    } catch (err) {
      console.warn("[UserModel] Prisma deleteSession fallback:", err);
    }
  }
}

/** Purges expired sessions for database hygiene. */
export async function purgeExpiredSessions(): Promise<number> {
  await ensureDbInitialized();

  if (hasPrismaUserModels()) {
    try {
      const result = await db.session.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      return result.count;
    } catch {
      return 0;
    }
  }
  return 0;
}
