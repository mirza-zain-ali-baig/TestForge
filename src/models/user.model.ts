/**
 * user.model.ts — Model layer
 *
 * Direct Supabase Cloud persistence for User accounts and Sessions.
 * Keeps cross-device & cross-Vercel deployments synchronized permanently.
 */

import crypto from "crypto";
import { db, ensureDbInitialized } from "@/lib/db";
import { supabase } from "@/lib/supabase";

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

// In-memory fallback cache
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

/**
 * Finds a user by their unique email address.
 * Primary source: Supabase `app_users` table.
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.toLowerCase().trim();

  // 1. Query Supabase app_users table
  try {
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("email", normalized)
      .maybeSingle();

    if (!error && data) {
      const record: UserRecord = {
        id: data.id,
        email: data.email,
        name: data.name ?? null,
        passwordHash: data.password_hash,
        role: data.role || "educator",
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
      fallbackUsers.set(normalized, record);
      return record;
    }
  } catch (err) {
    console.warn("[UserModel] Supabase findUserByEmail error:", err);
  }

  // 2. Local fallback
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
    } catch {}
  }

  return fallbackUsers.get(normalized) ?? null;
}

/** Finds a user by their ID across Supabase Cloud and local fallback. */
export async function findUserById(id: string): Promise<UserRecord | null> {
  try {
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        email: data.email,
        name: data.name ?? null,
        passwordHash: data.password_hash,
        role: data.role || "educator",
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    }
  } catch (err) {
    console.warn("[UserModel] Supabase findUserById error:", err);
  }

  for (const u of fallbackUsers.values()) {
    if (u.id === id) return u;
  }

  await ensureDbInitialized();
  if (hasPrismaUserModels()) {
    try {
      const found = await db.user.findUnique({ where: { id } });
      if (found) return found;
    } catch {}
  }

  return null;
}

/**
 * Persists a new user record to Supabase app_users table.
 */
export async function createUser(data: {
  email: string;
  name?: string;
  passwordHash: string;
  role?: string;
  authProvider?: string;
}): Promise<UserRecord> {
  const normalizedEmail = data.email.toLowerCase().trim();
  const now = new Date();
  const userId = crypto.randomUUID();

  const finalRecord: UserRecord = {
    id: userId,
    email: normalizedEmail,
    name: data.name?.trim() || null,
    passwordHash: data.passwordHash,
    role: data.role || "educator",
    createdAt: now,
    updatedAt: now,
  };

  // 1. Save to Supabase Cloud
  try {
    const { data: inserted, error } = await supabase
      .from("app_users")
      .upsert(
        {
          id: finalRecord.id,
          email: normalizedEmail,
          name: finalRecord.name,
          password_hash: finalRecord.passwordHash,
          role: finalRecord.role,
          auth_provider: data.authProvider || "credentials",
          updated_at: now.toISOString(),
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (!error && inserted) {
      finalRecord.id = inserted.id;
    }
  } catch (err) {
    console.warn("[UserModel] Supabase createUser error:", err);
  }

  // 2. Save locally if available
  await ensureDbInitialized();
  if (hasPrismaUserModels()) {
    try {
      await db.user.upsert({
        where: { email: normalizedEmail },
        update: {
          name: finalRecord.name,
          passwordHash: finalRecord.passwordHash,
          role: finalRecord.role,
        },
        create: {
          id: finalRecord.id,
          email: normalizedEmail,
          name: finalRecord.name,
          passwordHash: finalRecord.passwordHash,
          role: finalRecord.role,
        },
      });
    } catch {}
  }

  fallbackUsers.set(normalizedEmail, finalRecord);
  return finalRecord;
}

/** Creates a new session associated with a user in Supabase. */
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
  const sessionId = crypto.randomUUID();

  // 1. Save to Supabase app_sessions
  try {
    await supabase.from("app_sessions").insert({
      id: sessionId,
      token: data.token,
      user_id: data.userId,
      expires_at: data.expiresAt.toISOString(),
    });
  } catch (err) {
    console.warn("[UserModel] Supabase createSession error:", err);
  }

  // 2. Memory cache
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

  // 3. Local DB
  await ensureDbInitialized();
  if (hasPrismaUserModels()) {
    try {
      await db.session.create({
        data: {
          id: sessionId,
          userId: data.userId,
          token: data.token,
          expiresAt: data.expiresAt,
        },
      });
    } catch {}
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

  // 1. Query Supabase app_sessions joined with app_users
  try {
    const { data, error } = await supabase
      .from("app_sessions")
      .select("id, token, user_id, expires_at, created_at, user:app_users(id, email, name, role, created_at)")
      .eq("token", token)
      .maybeSingle();

    if (!error && data && data.user) {
      const u = Array.isArray(data.user) ? data.user[0] : data.user;
      if (u) {
        const sessionRecord: SessionWithUser = {
          id: data.id,
          token: data.token,
          userId: data.user_id,
          expiresAt: new Date(data.expires_at),
          createdAt: new Date(data.created_at),
          user: {
            id: u.id,
            email: u.email,
            name: u.name ?? null,
            role: u.role || "educator",
            createdAt: new Date(u.created_at),
          },
        };
        fallbackSessions.set(token, sessionRecord);
        return sessionRecord;
      }
    }
  } catch (err) {
    console.warn("[UserModel] Supabase findSessionWithUser error:", err);
  }

  // 2. Check memory cache
  const cached = fallbackSessions.get(token);
  if (cached) return cached;

  // 3. Check local SQLite
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
    } catch {}
  }

  return null;
}

/** Deletes a session by token (sign-out). */
export async function deleteSession(token: string): Promise<void> {
  revokedTokens.add(token);
  fallbackSessions.delete(token);

  // 1. Delete from Supabase
  try {
    await supabase.from("app_sessions").delete().eq("token", token);
  } catch (err) {
    console.warn("[UserModel] Supabase deleteSession error:", err);
  }

  // 2. Delete locally
  await ensureDbInitialized();
  if (hasPrismaUserModels()) {
    try {
      await db.session.deleteMany({ where: { token } });
    } catch {}
  }
}

/** Purges expired sessions for database hygiene. */
export async function purgeExpiredSessions(): Promise<number> {
  try {
    const nowIso = new Date().toISOString();
    await supabase.from("app_sessions").delete().lt("expires_at", nowIso);
  } catch {}

  await ensureDbInitialized();
  if (hasPrismaUserModels()) {
    try {
      const result = await db.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return result.count;
    } catch {}
  }
  return 0;
}
