/**
 * question.controller.ts — Controller layer
 *
 * Business logic for question bank browsing and AI-powered
 * question regeneration. Coordinates between the question model,
 * lookup model, and the AI service.
 */

import { getLookups } from "@/models/lookup.model";
import { findQuestions, findMcqOptions } from "@/models/question.model";
import { generateAIQuestions } from "@/lib/ai-questions";
import { supabase } from "@/lib/supabase";
import type { QuestionRow } from "@/lib/supabase";
import type { GeneratedQuestion, QuestionTypeName, DifficultyName } from "@/lib/types";

// ─── Enriched question shape ─────────────────────────────────────────────────

export type EnrichedQuestion = {
  id: string;
  question_text: string;
  type_name: string;
  difficulty_name: string;
  marks: number;
  blooms_taxonomy: string | null;
  tags: string | null;
  topic_name: string | null;
  chapter_name: string | null;
  options: {
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
  } | null;
};

// ─── Question listing ─────────────────────────────────────────────────────────

export type QuestionListParams = {
  subjectId?: string;
  chapterIds?: string[];
  topicIds?: string[];
  questionType?: string;
  difficulty?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

/**
 * Returns a paginated, enriched list of questions from the bank.
 * Resolves type/difficulty names, topic/chapter names, and MCQ options.
 */
export async function listQuestions(params: QuestionListParams): Promise<{
  questions: EnrichedQuestion[];
  total: number;
  limit: number;
  offset: number;
}> {
  const lookups = await getLookups();

  const questionTypeId = params.questionType
    ? lookups.typeIdByName[params.questionType]
    : undefined;
  const difficultyId = params.difficulty
    ? lookups.difficultyIdByName[params.difficulty]
    : undefined;

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  const { rows, total } = await findQuestions({
    subjectId: params.subjectId,
    chapterIds: params.chapterIds,
    topicIds: params.topicIds,
    questionTypeId,
    difficultyId,
    search: params.search,
    limit,
    offset,
  });

  const enriched = await enrichPage(rows, lookups);

  return { questions: enriched, total, limit, offset };
}

/** Resolves topic/chapter names and MCQ options for a page of raw QuestionRows. */
async function enrichPage(
  rows: QuestionRow[],
  lookups: Awaited<ReturnType<typeof getLookups>>
): Promise<EnrichedQuestion[]> {
  if (rows.length === 0) return [];

  const topicIds = [...new Set(rows.map((r) => r.topic_id))];
  const chapterIds = [...new Set(rows.map((r) => r.chapter_id))];

  const [topicsRes, chaptersRes] = await Promise.all([
    topicIds.length
      ? supabase.from("topics").select("id,topic_name").in("id", topicIds)
      : Promise.resolve({ data: [], error: null }),
    chapterIds.length
      ? supabase.from("chapters").select("id,chapter_name").in("id", chapterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const topicMap = new Map(
    ((topicsRes.data as { id: string; topic_name: string }[]) ?? []).map((t) => [
      t.id,
      t.topic_name,
    ])
  );
  const chapterMap = new Map(
    ((chaptersRes.data as { id: string; chapter_name: string }[]) ?? []).map((c) => [
      c.id,
      c.chapter_name,
    ])
  );

  const mcqIds = rows
    .filter((r) => lookups.byType[r.question_type_id] === "MCQ")
    .map((r) => r.id);
  const options = await findMcqOptions(mcqIds);
  const optByQ = new Map(options.map((o) => [o.question_id, o]));

  return rows.map((r) => ({
    id: r.id,
    question_text: r.question_text,
    type_name: lookups.byType[r.question_type_id] ?? "Unknown",
    difficulty_name: lookups.byDifficulty[r.difficulty_level_id] ?? "Unknown",
    marks: r.marks,
    blooms_taxonomy: r.blooms_taxonomy ?? null,
    tags: r.tags ?? null,
    topic_name: topicMap.get(r.topic_id) ?? null,
    chapter_name: chapterMap.get(r.chapter_id) ?? null,
    options: optByQ.get(r.id)
      ? {
          option_a: optByQ.get(r.id)!.option_a,
          option_b: optByQ.get(r.id)!.option_b,
          option_c: optByQ.get(r.id)!.option_c,
          option_d: optByQ.get(r.id)!.option_d,
          correct_option: optByQ.get(r.id)!.correct_option,
        }
      : null,
  }));
}

// ─── AI regeneration ─────────────────────────────────────────────────────────

export type RegenerateOptions = {
  subjectName: string;
  className: string;
  chapterName?: string;
  topicName?: string;
  typeName: QuestionTypeName;
  difficultyName: DifficultyName;
  marks: number;
};

/**
 * Generates a single fresh AI question to replace an existing one.
 * Returns null if the AI could not produce a question.
 */
export async function regenerateQuestion(
  opts: RegenerateOptions
): Promise<GeneratedQuestion | null> {
  const questions = await generateAIQuestions({ ...opts, count: 1 });
  return questions[0] ?? null;
}
