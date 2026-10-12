/**
 * test.model.ts — Model layer
 *
 * All persistence operations for locally-saved generated tests (Prisma / SQLite).
 * The Supabase question bank is read-only; generated test papers are stored here.
 */

import crypto from "crypto";
import { db, ensureDbInitialized } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { getCloudAnchor } from "./user.model";
import type { GeneratedTest } from "@/lib/types";

export type SavedTestRecord = {
  id: string;
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

const CLOUD_TEST_MARKER = "__tf_saved_test__";
const CLOUD_TEST_MARKS = -2;

function serializeSavedTestForCloud(record: SavedTestRecord): string {
  return JSON.stringify({
    ...record,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
  });
}

function deserializeSavedTestFromCloud(raw: string): SavedTestRecord | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.testJson) return null;
    return {
      id: String(parsed.id),
      title: String(parsed.title || "Untitled Test"),
      className: String(parsed.className || ""),
      subjectName: String(parsed.subjectName || ""),
      totalMarks: Number(parsed.totalMarks || 0),
      durationMins: Number(parsed.durationMins || 60),
      instructions: parsed.instructions ?? null,
      testJson: String(parsed.testJson),
      source: String(parsed.source || "bank"),
      createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date(),
      updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : new Date(),
    };
  } catch {
    return null;
  }
}

/** Returns all saved tests ordered by creation date (newest first) across Supabase Cloud + local SQLite. */
export async function findAllTests(): Promise<SavedTestRecord[]> {
  await ensureDbInitialized();
  const merged = new Map<string, SavedTestRecord>();

  try {
    const localRows = await db.generatedTest.findMany({ orderBy: { createdAt: "desc" } });
    for (const r of localRows) {
      merged.set(r.id, r);
    }
  } catch (err) {
    console.warn("[TestModel] Local findAllTests fallback:", err);
  }

  try {
    const { data } = await supabase
      .from("questions")
      .select("question_text")
      .eq("marks", CLOUD_TEST_MARKS)
      .eq("question_from", CLOUD_TEST_MARKER)
      .order("created_at", { ascending: false })
      .limit(200);
    for (const row of data ?? []) {
      const parsed = deserializeSavedTestFromCloud(row.question_text);
      if (parsed && !merged.has(parsed.id)) {
        merged.set(parsed.id, parsed);
      }
    }
  } catch (err) {
    console.warn("[TestModel] Cloud findAllTests warning:", err);
  }

  return Array.from(merged.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/** Returns a single saved test by its ID, or null if not found. */
export async function findTestById(id: string): Promise<SavedTestRecord | null> {
  await ensureDbInitialized();
  try {
    const local = await db.generatedTest.findUnique({ where: { id } });
    if (local) return local;
  } catch {
    // Fallback to cloud
  }

  try {
    const { data } = await supabase
      .from("questions")
      .select("question_text")
      .eq("marks", CLOUD_TEST_MARKS)
      .eq("question_from", CLOUD_TEST_MARKER)
      .eq("tags", id)
      .limit(1);
    if (data?.[0]) {
      return deserializeSavedTestFromCloud(data[0].question_text);
    }
  } catch {
    // Ignore
  }

  return null;
}

/** Persists a newly generated test to both local SQLite and Supabase Cloud. */
export async function createTest(
  test: GeneratedTest,
  source?: string
): Promise<SavedTestRecord> {
  await ensureDbInitialized();
  const now = new Date();
  let savedRecord: SavedTestRecord = {
    id: crypto.randomUUID(),
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

  try {
    savedRecord = await db.generatedTest.create({
      data: {
        title: test.title || "Untitled Test",
        className: test.className,
        subjectName: test.subjectName,
        totalMarks: test.totalMarks,
        durationMins: test.durationMins,
        instructions: test.instructions ?? "",
        testJson: JSON.stringify(test),
        source: source ?? test.source,
      },
    });
  } catch (err) {
    console.warn("[TestModel] Local createTest fallback:", err);
  }

  try {
    const anchor = await getCloudAnchor();
    if (anchor) {
      await supabase.from("questions").insert({
        ...anchor,
        marks: CLOUD_TEST_MARKS,
        question_from: CLOUD_TEST_MARKER,
        tags: savedRecord.id,
        blooms_taxonomy: savedRecord.source,
        question_text: serializeSavedTestForCloud(savedRecord),
      });
    }
  } catch (err) {
    console.warn("[TestModel] Cloud createTest sync warning:", err);
  }

  return savedRecord;
}

/** Deletes a saved test by its ID from both local SQLite and Supabase Cloud. */
export async function deleteTest(id: string): Promise<void> {
  await ensureDbInitialized();
  try {
    await db.generatedTest.deleteMany({ where: { id } });
  } catch {
    // Ignore if only present in cloud
  }

  try {
    await supabase
      .from("questions")
      .delete()
      .eq("marks", CLOUD_TEST_MARKS)
      .eq("question_from", CLOUD_TEST_MARKER)
      .eq("tags", id);
  } catch {
    // Ignore
  }
}

/**
 * Parses the testJson field of a saved record back into a GeneratedTest.
 * Returns null if the JSON is corrupted.
 */
export function parseTestJson(record: SavedTestRecord): GeneratedTest | null {
  try {
    return JSON.parse(record.testJson) as GeneratedTest;
  } catch {
    return null;
  }
}
