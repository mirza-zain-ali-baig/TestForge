/**
 * question.model.ts — Model layer
 *
 * All data-access operations against the Supabase question bank.
 * No business logic lives here — only reads/writes to the database
 * and shape normalisation.
 */

import { supabase } from "@/lib/supabase";
import type {
  ClassRow,
  SubjectRow,
  ChapterRow,
  TopicRow,
  QuestionRow,
  McqOptionRow,
} from "@/lib/supabase";
import defaultQuestionCache from "@/data/questions-cache.json";
import { getLookups } from "./lookup.model";

// ─── Pre-seeded In-Memory Cache (0ms response time) ─────────────────────────

let cachedQuestions: QuestionRow[] = (defaultQuestionCache.questions as unknown as QuestionRow[]) ?? [];
let cachedMcqOptions: McqOptionRow[] = (defaultQuestionCache.mcqOptions as unknown as McqOptionRow[]) ?? [];

const mcqOptionMap = new Map<string, McqOptionRow>(
  cachedMcqOptions.map((o) => [o.question_id, o])
);

export function invalidateQuestionCache(): void {
  cachedQuestions = (defaultQuestionCache.questions as unknown as QuestionRow[]) ?? [];
  cachedMcqOptions = (defaultQuestionCache.mcqOptions as unknown as McqOptionRow[]) ?? [];
  mcqOptionMap.clear();
  for (const o of cachedMcqOptions) {
    mcqOptionMap.set(o.question_id, o);
  }
}

// ─── Hierarchy ──────────────────────────────────────────────────────────────

export async function findAllClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("class_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ClassRow[]) ?? [];
}

export async function findSubjectsByClass(classId: string): Promise<SubjectRow[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("class_id", classId)
    .order("subject_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as SubjectRow[]) ?? [];
}

export async function findAllSubjects(): Promise<SubjectRow[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .order("subject_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as SubjectRow[]) ?? [];
}

export async function findChaptersBySubject(subjectId: string): Promise<ChapterRow[]> {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("subject_id", subjectId)
    .order("chapter_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ChapterRow[]) ?? [];
}

export async function findTopicsByChapters(chapterIds: string[]): Promise<TopicRow[]> {
  if (chapterIds.length === 0) return [];
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .in("chapter_id", chapterIds)
    .order("topic_article_no", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as TopicRow[]) ?? [];
}

// ─── Questions ───────────────────────────────────────────────────────────────

export type QuestionFilter = {
  subjectId?: string;
  chapterIds?: string[];
  topicIds?: string[];
  questionTypeId?: string;
  difficultyId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

/**
 * Returns a paginated list of questions with an exact total count.
 * Returns instantly from the in-memory cache (<1ms).
 */
export async function findQuestions(filter: QuestionFilter): Promise<{
  rows: QuestionRow[];
  total: number;
}> {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
  const offset = Math.max(filter.offset ?? 0, 0);

  if (cachedQuestions.length > 0) {
    let filtered = cachedQuestions;

    if (filter.subjectId) {
      filtered = filtered.filter((q) => q.subject_id === filter.subjectId);
    }
    if (filter.chapterIds && filter.chapterIds.length > 0) {
      const set = new Set(filter.chapterIds);
      filtered = filtered.filter((q) => set.has(q.chapter_id));
    }
    if (filter.topicIds && filter.topicIds.length > 0) {
      const set = new Set(filter.topicIds);
      filtered = filtered.filter((q) => set.has(q.topic_id));
    }
    if (filter.questionTypeId) {
      filtered = filtered.filter((q) => q.question_type_id === filter.questionTypeId);
    }
    if (filter.difficultyId) {
      filtered = filtered.filter((q) => q.difficulty_level_id === filter.difficultyId);
    }
    if (filter.search) {
      const term = filter.search.toLowerCase();
      filtered = filtered.filter((q) => {
        return (
          q.question_text?.toLowerCase().includes(term) ||
          q.tags?.toLowerCase().includes(term) ||
          q.blooms_taxonomy?.toLowerCase().includes(term)
        );
      });
    }

    const total = filtered.length;
    const rows = filtered.slice(offset, offset + limit);
    return { rows, total };
  }

  // Fallback to Supabase if cache is somehow empty
  let q = supabase.from("questions").select("*", { count: "exact" }).gte("marks", 1);

  if (filter.subjectId) q = q.eq("subject_id", filter.subjectId);
  if (filter.chapterIds?.length) q = q.in("chapter_id", filter.chapterIds);
  if (filter.topicIds?.length) q = q.in("topic_id", filter.topicIds);
  if (filter.questionTypeId) q = q.eq("question_type_id", filter.questionTypeId);
  if (filter.difficultyId) q = q.eq("difficulty_level_id", filter.difficultyId);
  if (filter.search) {
    const term = filter.search.replace(/,/g, "\\,").replace(/%/g, "\\%");
    q = q.or(
      `question_text.ilike.%${term}%,tags.ilike.%${term}%,blooms_taxonomy.ilike.%${term}%`
    );
  }

  q = q.order("created_at", { ascending: true }).range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);

  return { rows: (data as QuestionRow[]) ?? [], total: count ?? 0 };
}

/**
 * Fetches all questions in one type × difficulty cell, resolved instantly (<1ms)
 * from the in-memory pool for shuffling.
 */
export async function findQuestionsByCellPaged(opts: {
  subjectId: string;
  typeId: string;
  diffId: string;
  chapterIds: string[];
  topicIds: string[];
  questionSources?: string[];
  excludeIds?: Set<string>;
}): Promise<QuestionRow[]> {
  if (cachedQuestions.length > 0) {
    const chapterSet = opts.chapterIds.length > 0 ? new Set(opts.chapterIds) : null;
    const topicSet = opts.topicIds.length > 0 ? new Set(opts.topicIds) : null;
    const sourceSet =
      opts.questionSources && opts.questionSources.length > 0
        ? new Set(opts.questionSources)
        : null;

    return cachedQuestions.filter((q) => {
      if (q.subject_id !== opts.subjectId) return false;
      if (q.question_type_id !== opts.typeId) return false;
      if (q.difficulty_level_id !== opts.diffId) return false;
      if (chapterSet && !chapterSet.has(q.chapter_id)) return false;
      if (topicSet && !topicSet.has(q.topic_id)) return false;
      if (sourceSet && (!q.question_from || !sourceSet.has(q.question_from))) return false;
      if (opts.excludeIds?.has(q.id)) return false;
      return true;
    });
  }

  const PAGE = 1_000;
  let offset = 0;
  const out: QuestionRow[] = [];
  const sourceFilter =
    opts.questionSources && opts.questionSources.length > 0 ? opts.questionSources : null;

  while (true) {
    let q = supabase
      .from("questions")
      .select("*")
      .gte("marks", 1)
      .eq("subject_id", opts.subjectId)
      .eq("question_type_id", opts.typeId)
      .eq("difficulty_level_id", opts.diffId);

    if (opts.chapterIds.length) q = q.in("chapter_id", opts.chapterIds);
    if (opts.topicIds.length) q = q.in("topic_id", opts.topicIds);
    if (sourceFilter) q = q.in("question_from", sourceFilter);

    q = q.order("id", { ascending: true }).range(offset, offset + PAGE - 1);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data as QuestionRow[]) ?? [];
    const filtered = opts.excludeIds?.size
      ? rows.filter((r) => !opts.excludeIds!.has(r.id))
      : rows;
    out.push(...filtered);

    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return out;
}

/**
 * Fetches ALL question keys (id + FKs) for the given subjects.
 */
export async function fetchAllQuestionKeys(
  subjectIds: string[]
): Promise<{ id: string; subject_id: string; chapter_id: string; topic_id: string }[]> {
  if (subjectIds.length === 0) return [];

  if (cachedQuestions.length > 0) {
    const set = new Set(subjectIds);
    return cachedQuestions
      .filter((q) => set.has(q.subject_id))
      .map((q) => ({
        id: q.id,
        subject_id: q.subject_id,
        chapter_id: q.chapter_id,
        topic_id: q.topic_id,
      }));
  }

  const PAGE = 1_000;
  let offset = 0;
  const out: { id: string; subject_id: string; chapter_id: string; topic_id: string }[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("questions")
      .select("id,subject_id,chapter_id,topic_id")
      .gte("marks", 1)
      .in("subject_id", subjectIds)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(error.message);
    const rows = (data as typeof out) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return out;
}

// ─── MCQ Options ─────────────────────────────────────────────────────────────

/**
 * Returns MCQ options for given question IDs.
 * Resolves instantly from in-memory cache, querying Supabase only for missing rows.
 */
export async function findMcqOptions(questionIds: string[]): Promise<McqOptionRow[]> {
  if (questionIds.length === 0) return [];

  const found: McqOptionRow[] = [];
  const missingIds: string[] = [];

  for (const id of questionIds) {
    const opt = mcqOptionMap.get(id);
    if (opt) {
      found.push(opt);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) {
    return found;
  }

  const { data, error } = await supabase
    .from("mcq_options")
    .select("*")
    .in("question_id", missingIds);
  if (error) throw new Error(error.message);

  const fresh = (data as McqOptionRow[]) ?? [];
  for (const o of fresh) {
    mcqOptionMap.set(o.question_id, o);
    found.push(o);
  }

  return found;
}

// ─── Question Sources ─────────────────────────────────────────────────────────

/**
 * Returns the distinct `question_from` values and their counts,
 * scoped to a given subject/chapter/topic filter.
 * Resolves in <1ms from memory.
 */
export async function findQuestionSources(opts: {
  subjectId: string;
  chapterIds?: string[];
  topicIds?: string[];
}): Promise<{ sources: { name: string; count: number }[]; total: number; nullCount: number }> {
  if (cachedQuestions.length > 0) {
    const chapterSet = opts.chapterIds?.length ? new Set(opts.chapterIds) : null;
    const topicSet = opts.topicIds?.length ? new Set(opts.topicIds) : null;

    const counts = new Map<string, number>();
    let nullCount = 0;
    let total = 0;

    for (const q of cachedQuestions) {
      if (q.subject_id !== opts.subjectId) continue;
      if (chapterSet && !chapterSet.has(q.chapter_id)) continue;
      if (topicSet && !topicSet.has(q.topic_id)) continue;

      total++;
      if (!q.question_from) {
        nullCount++;
      } else {
        counts.set(q.question_from, (counts.get(q.question_from) ?? 0) + 1);
      }
    }

    const sources = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { sources, total, nullCount };
  }

  const PAGE = 1_000;
  let offset = 0;
  const counts = new Map<string, number>();
  let nullCount = 0;
  let total = 0;

  while (true) {
    let q = supabase
      .from("questions")
      .select("question_from")
      .gte("marks", 1)
      .eq("subject_id", opts.subjectId);
    if (opts.chapterIds?.length) q = q.in("chapter_id", opts.chapterIds);
    if (opts.topicIds?.length) q = q.in("topic_id", opts.topicIds);
    q = q.order("id", { ascending: true }).range(offset, offset + PAGE - 1);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data as { question_from: string | null }[]) ?? [];
    for (const r of rows) {
      total += 1;
      if (!r.question_from) {
        nullCount += 1;
      } else {
        counts.set(r.question_from, (counts.get(r.question_from) ?? 0) + 1);
      }
    }

    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  const sources = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { sources, total, nullCount };
}

// ─── Fast Availability Aggregation ──────────────────────────────────────────

/**
 * Computes question availability counts for all 9 cells (3 types × 3 difficulties)
 * in a single sub-millisecond pass over memory.
 */
export async function getQuestionsAvailability(opts: {
  subjectId: string;
  chapterIds?: string[];
  topicIds?: string[];
}): Promise<Record<string, number>> {
  const lookups = await getLookups();
  const chapterSet = opts.chapterIds?.length ? new Set(opts.chapterIds) : null;
  const topicSet = opts.topicIds?.length ? new Set(opts.topicIds) : null;

  const result: Record<string, number> = {};
  for (const t of ["MCQ", "Short", "Long"]) {
    for (const d of ["Easy", "Medium", "Hard"]) {
      result[`${t}-${d}`] = 0;
    }
  }

  for (const q of cachedQuestions) {
    if (q.subject_id !== opts.subjectId) continue;
    if (chapterSet && !chapterSet.has(q.chapter_id)) continue;
    if (topicSet && !topicSet.has(q.topic_id)) continue;

    const tName = lookups.byType[q.question_type_id];
    const dName = lookups.byDifficulty[q.difficulty_level_id];
    if (tName && dName) {
      const key = `${tName}-${dName}`;
      result[key] = (result[key] ?? 0) + 1;
    }
  }

  return result;
}
