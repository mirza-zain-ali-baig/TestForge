/**
 * test.model.ts — Model layer
 *
 * Persistence operations for generated tests using Supabase `app_generated_tests` table.
 * Fully persistent across all Vercel serverless deployments.
 */

import crypto from "crypto";
import { db, ensureDbInitialized } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { GeneratedTest } from "@/lib/types";

export type SavedTestRecord = {
  id: string;
  userEmail?: string;
  title: string;
  className: string;
  subjectName: string;
  totalMarks: number;
  durationMins: number;
  instructions: string | null;
  testJson: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Returns all saved tests ordered by creation date (newest first). Filtered strictly by userEmail. */
export async function findAllTests(userEmail?: string): Promise<SavedTestRecord[]> {
  if (!userEmail) {
    return [];
  }

  const normalizedEmail = userEmail.toLowerCase().trim();
  const merged = new Map<string, SavedTestRecord>();

  // 1. Query Supabase app_generated_tests strictly for this user
  try {
    const { data, error } = await supabase
      .from("app_generated_tests")
      .select("*")
      .eq("user_email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      for (const row of data) {
        merged.set(row.id, {
          id: row.id,
          userEmail: row.user_email,
          title: row.title,
          className: row.class_name,
          subjectName: row.subject_name,
          totalMarks: row.total_marks,
          durationMins: row.duration_mins,
          instructions: row.instructions,
          testJson: row.test_json,
          source: row.source || "bank",
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        });
      }
    }
  } catch (err) {
    console.warn("[TestModel] Supabase findAllTests error:", err);
  }

  return Array.from(merged.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/** Returns a single saved test by its ID, or null if not found. */
export async function findTestById(id: string): Promise<SavedTestRecord | null> {
  // 1. Query Supabase app_generated_tests
  try {
    const { data, error } = await supabase
      .from("app_generated_tests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        userEmail: data.user_email,
        title: data.title,
        className: data.class_name,
        subjectName: data.subject_name,
        totalMarks: data.total_marks,
        durationMins: data.duration_mins,
        instructions: data.instructions,
        testJson: data.test_json,
        source: data.source || "bank",
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    }
  } catch (err) {
    console.warn("[TestModel] Supabase findTestById error:", err);
  }

  // 2. Check local SQLite
  await ensureDbInitialized();
  try {
    const local = await db.generatedTest.findUnique({ where: { id } });
    if (local) return local;
  } catch {}

  return null;
}

/** Persists a newly generated test to Supabase Cloud and local database. */
export async function createTest(
  test: GeneratedTest,
  source?: string,
  userEmail?: string
): Promise<SavedTestRecord> {
  const now = new Date();
  const testId = crypto.randomUUID();
  const normalizedEmail = (userEmail || "guest@examforge.test").toLowerCase().trim();

  let savedRecord: SavedTestRecord = {
    id: testId,
    userEmail: normalizedEmail,
    title: test.title || "Untitled Test",
    className: test.className,
    subjectName: test.subjectName,
    totalMarks: test.totalMarks,
    durationMins: test.durationMins,
    instructions: test.instructions ?? "",
    testJson: JSON.stringify(test),
    source: source ?? test.source,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Persist to Supabase app_generated_tests
  try {
    const { data: inserted, error } = await supabase
      .from("app_generated_tests")
      .insert({
        id: savedRecord.id,
        user_email: normalizedEmail,
        title: savedRecord.title,
        class_name: savedRecord.className,
        subject_name: savedRecord.subjectName,
        total_marks: savedRecord.totalMarks,
        duration_mins: savedRecord.durationMins,
        instructions: savedRecord.instructions,
        test_json: savedRecord.testJson,
        source: savedRecord.source,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (!error && inserted) {
      savedRecord.id = inserted.id;
    }
  } catch (err) {
    console.warn("[TestModel] Supabase createTest error:", err);
  }

  // 2. Save to local SQLite
  await ensureDbInitialized();
  try {
    await db.generatedTest.create({
      data: {
        id: savedRecord.id,
        title: savedRecord.title,
        className: savedRecord.className,
        subjectName: savedRecord.subjectName,
        totalMarks: savedRecord.totalMarks,
        durationMins: savedRecord.durationMins,
        instructions: savedRecord.instructions ?? "",
        testJson: savedRecord.testJson,
        source: savedRecord.source,
      },
    });
  } catch {}

  return savedRecord;
}

/** Deletes a saved test by its ID across Supabase Cloud and local database. */
export async function deleteTest(id: string): Promise<boolean> {
  let deleted = false;

  // 1. Delete from Supabase app_generated_tests
  try {
    const { error } = await supabase
      .from("app_generated_tests")
      .delete()
      .eq("id", id);
    if (!error) deleted = true;
  } catch (err) {
    console.warn("[TestModel] Supabase deleteTest error:", err);
  }

  // 2. Delete from local SQLite
  await ensureDbInitialized();
  try {
    await db.generatedTest.delete({ where: { id } });
    deleted = true;
  } catch {}

  return deleted;
}

/** Parses the JSON payload stored inside a SavedTestRecord into a GeneratedTest object. */
export function parseTestJson(record: SavedTestRecord): GeneratedTest | null {
  try {
    return JSON.parse(record.testJson) as GeneratedTest;
  } catch {
    return null;
  }
}
