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
 */
export async function findQuestions(filter: QuestionFilter): Promise<{
  rows: QuestionRow[];
  total: number;
}> {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
  const offset = Math.max(filter.offset ?? 0, 0);

  let q = supabase.from("questions").select("*", { count: "exact" });

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
 * Fetches all questions in one type × difficulty cell, paginating past
 * Supabase's 1 000-row hard cap so the full pool is available for shuffling.
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
  const PAGE = 1_000;
  let offset = 0;
  const out: QuestionRow[] = [];
  const sourceFilter =
    opts.questionSources && opts.questionSources.length > 0 ? opts.questionSources : null;

  while (true) {
    let q = supabase
      .from("questions")
      .select("*")
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
 * Paginates past the 1 000-row cap for accurate counts.
 */
export async function fetchAllQuestionKeys(
  subjectIds: string[]
): Promise<{ id: string; subject_id: string; chapter_id: string; topic_id: string }[]> {
  if (subjectIds.length === 0) return [];

  const PAGE = 1_000;
  let offset = 0;
  const out: { id: string; subject_id: string; chapter_id: string; topic_id: string }[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("questions")
      .select("id,subject_id,chapter_id,topic_id")
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

export async function findMcqOptions(questionIds: string[]): Promise<McqOptionRow[]> {
  if (questionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("mcq_options")
    .select("*")
    .in("question_id", questionIds);
  if (error) throw new Error(error.message);
  return (data as McqOptionRow[]) ?? [];
}

// ─── Question Sources ─────────────────────────────────────────────────────────

/**
 * Returns the distinct `question_from` values and their counts,
 * scoped to a given subject/chapter/topic filter.
 * Paginates past Supabase's 1 000-row cap for accuracy.
 */
export async function findQuestionSources(opts: {
  subjectId: string;
  chapterIds?: string[];
  topicIds?: string[];
}): Promise<{ sources: { name: string; count: number }[]; total: number; nullCount: number }> {
  const PAGE = 1_000;
  let offset = 0;
  const counts = new Map<string, number>();
  let nullCount = 0;
  let total = 0;

  while (true) {
    let q = supabase
      .from("questions")
      .select("question_from")
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
