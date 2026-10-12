/**
 * user.model.ts — Model layer
 *
 * Data-access operations for User accounts and Sessions (Prisma / SQLite).
 * Pure data tier: no HTTP or business orchestration logic lives here.
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

const CLOUD_USER_MARKER = "__tf_user__";
const CLOUD_USER_MARKS = -1;

// Default FK anchor IDs from the Supabase question bank for cloud metadata rows
let cachedAnchor: {
  subject_id: string;
  chapter_id: string;
  topic_id: string;
  question_type_id: string;
  difficulty_level_id: string;
} | null = {
  subject_id: "197cbe8d-0432-48e7-8afb-b9e33a48e021",
  chapter_id: "ebcca7dc-81f2-47fe-af70-b1aba01c2aca",
  topic_id: "6cce0421-87ee-4918-8f18-01f29c604d26",
  question_type_id: "adcc43f1-f0a9-4940-bf76-b6873367813a",
  difficulty_level_id: "aeeda179-d03f-4d48-a5b5-80c27d6867bd",
};

export async function getCloudAnchor() {
  if (cachedAnchor) return cachedAnchor;
  const { data } = await supabase
    .from("questions")
    .select("subject_id,chapter_id,topic_id,question_type_id,difficulty_level_id")
    .gte("marks", 1)
    .limit(1);
  if (data?.[0]) {
    cachedAnchor = data[0];
  }
  return cachedAnchor;
}

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

function serializeUserForCloud(user: UserRecord): string {
  return JSON.stringify({
    id: user.id,
    email: user.email.toLowerCase().trim(),
    name: user.name,
    passwordHash: user.passwordHash,
    role: user.role,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : String(user.updatedAt),
  });
}

function deserializeUserFromCloud(raw: string): UserRecord | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email || !parsed.passwordHash) return null;
    return {
      id: String(parsed.id),
      email: String(parsed.email).toLowerCase().trim(),
      name: parsed.name ?? null,
      passwordHash: String(parsed.passwordHash),
      role: String(parsed.role || "student"),
      createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date(),
      updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : new Date(),
    };
  } catch {
    return null;
  }
}

async function saveUserToCloud(user: UserRecord): Promise<void> {
  try {
    const anchor = await getCloudAnchor();
    if (!anchor) return;
    const normalizedEmail = user.email.toLowerCase().trim();

    // Remove any older duplicate cloud record for this email first
    await supabase
      .from("questions")
      .delete()
      .eq("marks", CLOUD_USER_MARKS)
      .eq("question_from", CLOUD_USER_MARKER)
      .eq("tags", normalizedEmail);

    await supabase.from("questions").insert({
      ...anchor,
      marks: CLOUD_USER_MARKS,
      question_from: CLOUD_USER_MARKER,
      tags: normalizedEmail,
      blooms_taxonomy: user.role,
      question_text: serializeUserForCloud(user),
    });
  } catch (err) {
    console.warn("[UserModel] Cloud user sync warning:", err);
  }
}

async function findUserInCloudByEmail(email: string): Promise<UserRecord | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from("questions")
      .select("question_text")
      .eq("marks", CLOUD_USER_MARKS)
      .eq("question_from", CLOUD_USER_MARKER)
      .eq("tags", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data?.length) return null;
    return deserializeUserFromCloud(data[0].question_text);
  } catch {
    return null;
  }
}

/**
 * Finds a user by their unique email address.
 * Checks Supabase Cloud (shared across all devices & Vercel instances) + local SQLite.
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.toLowerCase().trim();
  await ensureDbInitialized();

  // 1. Check shared Supabase Cloud store first so cross-device login always has the latest account
  const cloudUser = await findUserInCloudByEmail(normalized);
  if (cloudUser) {
    fallbackUsers.set(normalized, cloudUser);
    if (hasPrismaUserModels()) {
      try {
        await db.user.upsert({
          where: { email: normalized },
          update: {
            name: cloudUser.name,
            passwordHash: cloudUser.passwordHash,
            role: cloudUser.role,
          },
          create: {
            id: cloudUser.id,
            email: cloudUser.email,
            name: cloudUser.name,
            passwordHash: cloudUser.passwordHash,
            role: cloudUser.role,
          },
        });
      } catch {
        // Ignore non-fatal local cache sync error
      }
    }
    return cloudUser;
  }

  // 2. Check local SQLite via Prisma (and sync to Supabase Cloud if found locally)
  if (hasPrismaUserModels()) {
    try {
      const found = await db.user.findUnique({
        where: { email: normalized },
      });
      if (found) {
        fallbackUsers.set(normalized, found);
        await saveUserToCloud(found);
        return found;
      }
    } catch (err) {
      console.warn("[UserModel] Prisma findUserByEmail fallback:", err);
    }
  }

  return fallbackUsers.get(normalized) ?? null;
}

/** Finds a user by their ID across local SQLite, memory, and Supabase Cloud. */
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

  try {
    const { data } = await supabase
      .from("questions")
      .select("question_text")
      .eq("marks", CLOUD_USER_MARKS)
      .eq("question_from", CLOUD_USER_MARKER)
      .ilike("question_text", `%"id":"${id}"%`)
      .limit(1);
    if (data?.[0]) {
      const cloudUser = deserializeUserFromCloud(data[0].question_text);
      if (cloudUser) {
        fallbackUsers.set(cloudUser.email, cloudUser);
        return cloudUser;
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Persists a new user record to BOTH Supabase Cloud (for multi-device login)
 * and local SQLite (Prisma).
 */
export async function createUser(data: {
  email: string;
  name?: string;
  passwordHash: string;
  role?: string;
}): Promise<UserRecord> {
  const normalizedEmail = data.email.toLowerCase().trim();
  const now = new Date();
  let finalRecord: UserRecord = {
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
      finalRecord = created;
    } catch (err) {
      console.warn("[UserModel] Prisma createUser fallback:", err);
    }
  }

  fallbackUsers.set(normalizedEmail, finalRecord);
  await saveUserToCloud(finalRecord);
  return finalRecord;
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
