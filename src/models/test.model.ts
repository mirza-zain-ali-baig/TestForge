/**
 * test.model.ts — Model layer
 *
 * All persistence operations for locally-saved generated tests (Prisma / SQLite).
 * The Supabase question bank is read-only; generated test papers are stored here.
 */

import { db } from "@/lib/db";
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

/** Returns all saved tests ordered by creation date (newest first). */
export async function findAllTests(): Promise<SavedTestRecord[]> {
  return db.generatedTest.findMany({ orderBy: { createdAt: "desc" } });
}

/** Returns a single saved test by its ID, or null if not found. */
export async function findTestById(id: string): Promise<SavedTestRecord | null> {
  return db.generatedTest.findUnique({ where: { id } });
}

/** Persists a newly generated test and returns the saved record. */
export async function createTest(
  test: GeneratedTest,
  source?: string
): Promise<SavedTestRecord> {
  return db.generatedTest.create({
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
}

/** Deletes a saved test by its ID. */
export async function deleteTest(id: string): Promise<void> {
  await db.generatedTest.delete({ where: { id } });
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
