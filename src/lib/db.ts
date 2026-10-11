import { PrismaClient } from "@prisma/client";

/**
 * Resolves a writable SQLite URL for both local development and Vercel Serverless.
 * On Vercel, `/var/task` is read-only and `.env` may not define DATABASE_URL,
 * so we default to `file:/tmp/testforge.db` which is writable in serverless functions.
 */
function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  const isVercel = Boolean(process.env.VERCEL);

  if (isVercel) {
    if (!envUrl || envUrl.startsWith("file:.") || envUrl.startsWith("file:..")) {
      const vercelTmpUrl = "file:/tmp/testforge.db";
      process.env.DATABASE_URL = vercelTmpUrl;
      return vercelTmpUrl;
    }
  }

  if (!envUrl) {
    const fallbackUrl = isVercel ? "file:/tmp/testforge.db" : "file:../db/custom.db";
    process.env.DATABASE_URL = fallbackUrl;
    return fallbackUrl;
  }

  return envUrl;
}

const resolvedDbUrl = resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbInitialized: boolean | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolvedDbUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * Ensures SQLite tables exist (critical on Vercel where /tmp/testforge.db starts empty).
 * Safe to call repeatedly; executes DDL only once per process lifecycle.
 */
export async function ensureDbInitialized(): Promise<void> {
  if (globalForPrisma.dbInitialized) return;
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GeneratedTest" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "className" TEXT NOT NULL,
        "subjectName" TEXT NOT NULL,
        "totalMarks" INTEGER NOT NULL,
        "durationMins" INTEGER NOT NULL,
        "instructions" TEXT,
        "testJson" TEXT NOT NULL,
        "source" TEXT NOT NULL DEFAULT 'bank',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "name" TEXT,
        "passwordHash" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'educator',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "token" TEXT NOT NULL UNIQUE,
        "userId" TEXT NOT NULL,
        "expiresAt" DATETIME NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    globalForPrisma.dbInitialized = true;
  } catch (err) {
    console.warn("[DB Init] Non-fatal SQLite schema check warning:", err);
  }
}