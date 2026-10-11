/**
 * user.model.ts — Model layer
 *
 * Data-access operations for User accounts and Sessions (Prisma / SQLite).
 * Pure data tier: no HTTP or business orchestration logic lives here.
 */

import { db } from "@/lib/db";

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

/** Finds a user by their unique email address. */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
}

/** Finds a user by their ID. */
export async function findUserById(id: string): Promise<UserRecord | null> {
  return db.user.findUnique({
    where: { id },
  });
}

/** Persists a new user record. */
export async function createUser(data: {
  email: string;
  name?: string;
  passwordHash: string;
  role?: string;
}): Promise<UserRecord> {
  return db.user.create({
    data: {
      email: data.email.toLowerCase().trim(),
      name: data.name?.trim() || null,
      passwordHash: data.passwordHash,
      role: data.role || "educator",
    },
  });
}

/** Creates a new session associated with a user. */
export async function createSession(data: {
  userId: string;
  token: string;
  expiresAt: Date;
}): Promise<{ id: string; token: string; expiresAt: Date }> {
  return db.session.create({
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
}

/** Resolves an active session and includes the sanitized user profile. */
export async function findSessionWithUser(token: string): Promise<SessionWithUser | null> {
  return db.session.findUnique({
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
}

/** Deletes a session by token (sign-out). */
export async function deleteSession(token: string): Promise<void> {
  await db.session.deleteMany({
    where: { token },
  });
}

/** Purges expired sessions for database hygiene. */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await db.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
