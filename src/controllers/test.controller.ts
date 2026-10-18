/**
 * test.controller.ts — Controller layer
 *
 * Orchestrates test generation (single and batch variants).
 * Coordinates between the question bank model, AI service, and
 * the event bus so callers (API routes) stay thin.
 *
 * After a test is generated the controller emits a
 * TEST_GENERATION_COMPLETED event for any interested handlers.
 */

import { getLookups } from "@/models/lookup.model";
import { findQuestionsByCellPaged, findMcqOptions } from "@/models/question.model";
import { generateAIQuestions } from "@/lib/ai-questions";
import { eventBus } from "@/events/event-bus";
import { EVENTS } from "@/events/events";
import { supabase } from "@/lib/supabase";
import type {
  GenerateTestRequest,
  GeneratedTest,
  GeneratedQuestion,
  TestSection,
  QuestionTypeName,
  DifficultyName,
} from "@/lib/types";
import type { QuestionRow, ChapterRow, TopicRow } from "@/lib/supabase";

const TYPE_ORDER: QuestionTypeName[] = ["MCQ", "Short", "Long"];
const DIFF_ORDER: DifficultyName[] = ["Easy", "Medium", "Hard"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleOptions(q: GeneratedQuestion): GeneratedQuestion {
  if (!q.options) return q;
  const labels = ["A", "B", "C", "D"] as const;
  const entries = [
    { label: "A", text: q.options.option_a },
    { label: "B", text: q.options.option_b },
    { label: "C", text: q.options.option_c },
    { label: "D", text: q.options.option_d },
  ];
  const shuffled = shuffleArray(entries);
  const correctText =
    q.options[
      `option_${q.options.correct_option.toLowerCase()}` as
        | "option_a"
        | "option_b"
        | "option_c"
        | "option_d"
    ];
  const newCorrectIndex = shuffled.findIndex((e) => e.text === correctText);
  return {
    ...q,
    options: {
      option_a: shuffled[0].text,
      option_b: shuffled[1].text,
      option_c: shuffled[2].text,
      option_d: shuffled[3].text,
      correct_option: labels[newCorrectIndex],
    },
  };
}

async function enrichBankPicks(
  picks: (QuestionRow | GeneratedQuestion)[],
  lookups: Awaited<ReturnType<typeof getLookups>>,
  topicMap: Map<string, TopicRow>,
  chapterMap: Map<string, ChapterRow>,
  marks: number,
  typeName: QuestionTypeName,
  diffName: DifficultyName
): Promise<GeneratedQuestion[]> {
  const bankRows = picks.filter(
    (p): p is QuestionRow => "question_type_id" in p
  );
  const aiItems = picks.filter(
    (p): p is GeneratedQuestion => "source" in p && p.source === "ai"
  );

  const mcqBankIds = bankRows
    .filter((r) => lookups.byType[r.question_type_id] === "MCQ")
    .map((r) => r.id);
  const options = await findMcqOptions(mcqBankIds);
  const optByQ = new Map(options.map((o) => [o.question_id, o]));

  const enriched: GeneratedQuestion[] = bankRows.map((r) => ({
    id: r.id,
    source: "bank",
    question_text: r.question_text,
    type_name: typeName,
    difficulty_name: diffName,
    marks,
    blooms_taxonomy: r.blooms_taxonomy ?? null,
    tags: r.tags ?? null,
    topic_name: topicMap.get(r.topic_id)?.topic_name ?? null,
    chapter_name: chapterMap.get(r.chapter_id)?.chapter_name ?? null,
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

  return [...enriched, ...aiItems];
}

// ─── Core generation ─────────────────────────────────────────────────────────

/**
 * Generates a single test from the question bank and/or AI,
 * following the blueprint specification in the request.
 *
 * After successful generation it emits a TEST_GENERATION_COMPLETED
 * event for background handlers (e.g. analytics aggregation).
 */
import defaultCurriculum from "@/data/curriculum-cache.json";

// In-memory index of all chapters and topics for 0ms lookup
const staticChapterMap = new Map<string, ChapterRow>();
const staticTopicMap = new Map<string, TopicRow>();

for (const cls of defaultCurriculum as any[]) {
  for (const sub of cls.subjects ?? []) {
    for (const ch of sub.chapters ?? []) {
      staticChapterMap.set(ch.id, {
        id: ch.id,
        subject_id: ch.subject_id,
        chapter_number: ch.chapter_number,
        chapter_name: ch.chapter_name,
        created_at: ch.created_at,
      });
      for (const top of ch.topics ?? []) {
        staticTopicMap.set(top.id, {
          id: top.id,
          chapter_id: top.chapter_id,
          topic_name: top.topic_name,
          topic_article_no: top.topic_article_no,
          created_at: top.created_at,
        });
      }
    }
  }
}

/**
 * Generates a single test paper based on the requested blueprint.
 * Optimized with candidate pool pre-fetching and in-memory hierarchy lookups.
 */
export async function generateTest(req: GenerateTestRequest): Promise<GeneratedTest> {
  const lookups = await getLookups();

  // Resolve chapter and topic objects in 0ms from in-memory cache
  const chapterMap = new Map<string, ChapterRow>();
  for (const cid of req.chapterIds) {
    const ch = staticChapterMap.get(cid);
    if (ch) chapterMap.set(cid, ch);
  }
  const chapters = Array.from(chapterMap.values());

  const topicMap = new Map<string, TopicRow>();
  for (const top of staticTopicMap.values()) {
    if (req.chapterIds.includes(top.chapter_id)) {
      topicMap.set(top.id, top);
    }
  }
  const allTopics = Array.from(topicMap.values());
  const effectiveTopicIds =
    req.topicIds.length > 0 ? req.topicIds : allTopics.map((t) => t.id);

  // Pre-fetch candidate pool for this subject & chapters in a single fast query
  let candidatePool: QuestionRow[] = [];
  if (req.source !== "ai") {
    let q = supabase
      .from("questions")
      .select("*")
      .gte("marks", 1)
      .eq("subject_id", req.subjectId)
      .in("chapter_id", req.chapterIds);

    if (effectiveTopicIds.length > 0 && effectiveTopicIds.length < allTopics.length) {
      q = q.in("topic_id", effectiveTopicIds);
    }
    if (req.questionSources && req.questionSources.length > 0) {
      q = q.in("question_from", req.questionSources);
    }

    const { data } = await q;
    candidatePool = (data as QuestionRow[]) ?? [];
  }

  const excludeSet = new Set(req.excludeQuestionIds ?? []);
  const sections: TestSection[] = [];
  const shortfalls: GeneratedTest["meta"]["shortfalls"] = [];
  let fromBank = 0;
  let fromAI = 0;
  let requestedTotal = 0;

  for (const typeName of TYPE_ORDER) {
    const typeCfg = req.blueprint[typeName];
    if (!typeCfg) continue;
    const typeId = lookups.typeIdByName[typeName];
    const collected: GeneratedQuestion[] = [];

    for (const diffName of DIFF_ORDER) {
      const need = typeCfg.difficulties[diffName] ?? 0;
      if (need <= 0) continue;
      requestedTotal += need;

      const diffId = lookups.difficultyIdByName[diffName];

      // Pull from pre-fetched pool in 0ms (skip if source === "ai")
      let bankRows: QuestionRow[] = [];
      if (req.source !== "ai") {
        bankRows = candidatePool.filter(
          (r) =>
            r.question_type_id === typeId &&
            r.difficulty_level_id === diffId &&
            !excludeSet.has(r.id)
        );
      }

      const picked: (QuestionRow | GeneratedQuestion)[] = shuffleArray(bankRows).slice(0, need);
      const bankGot = picked.length;

      // AI fill for any shortfall (skip if source === "bank")
      if (bankGot < need && req.source !== "bank") {
        const shortfall = need - bankGot;
        const aiQs = await generateAIQuestions({
          subjectName: req.subjectName,
          className: req.className,
          chapterName: chapters[0]?.chapter_name,
          topicName: topicMap.get(effectiveTopicIds[0] ?? "")?.topic_name,
          typeName,
          difficultyName: diffName,
          count: shortfall,
          marks: typeCfg.marksPerQuestion,
        });
        picked.push(...aiQs);
      }

      const finalGot = picked.length;
      if (finalGot < need) {
        shortfalls.push({ type: typeName, difficulty: diffName, requested: need, got: finalGot });
      }

      const enriched = await enrichBankPicks(
        picked,
        lookups,
        topicMap,
        chapterMap,
        typeCfg.marksPerQuestion,
        typeName,
        diffName
      );
      collected.push(...enriched);
    }

    if (collected.length === 0) continue;

    const ordered = req.shuffle ? shuffleArray(collected) : collected;
    const sectionMarks = ordered.reduce((s, q) => s + q.marks, 0);

    sections.push({
      type_name: typeName,
      marksPerQuestion: typeCfg.marksPerQuestion,
      questions: ordered.map((q) => (req.shuffle ? shuffleOptions(q) : q)),
      sectionMarks,
    });

    fromBank += collected.filter((q) => q.source === "bank").length;
    fromAI += collected.filter((q) => q.source === "ai").length;
  }

  const totalMarks = sections.reduce((s, sec) => s + sec.sectionMarks, 0);
  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0);

  const result: GeneratedTest = {
    title: req.title || `${req.subjectName} Examination`,
    className: req.className,
    subjectName: req.subjectName,
    subjectId: req.subjectId,
    durationMins: req.durationMins,
    instructions: req.instructions ?? "",
    totalMarks,
    totalQuestions,
    source: req.source,
    generatedAt: new Date().toISOString(),
    sections,
    meta: { requested: requestedTotal, fromBank, fromAI, shortfalls },
  };

  // Emit event for background handlers (non-blocking)
  eventBus.emit(EVENTS.TEST_GENERATION_COMPLETED, {
    test: result,
    request: req,
    fromBank,
    fromAI,
  });

  return result;
}

/**
 * Generates multiple variants of the same blueprint.
 * The base test is generated once; additional variants re-shuffle
 * the same question pool (questions are not re-fetched).
 */
export async function generateBatch(
  req: GenerateTestRequest,
  variantCount: number
): Promise<GeneratedTest[]> {
  if (variantCount <= 0) return [];

  const baseTest = await generateTest(req);
  if (variantCount === 1) return [baseTest];

  const variants: GeneratedTest[] = [baseTest];

  for (let i = 1; i < variantCount; i++) {
    const shuffledSections = baseTest.sections.map((sec) => {
      const shuffledQuestions = shuffleArray(sec.questions);
      return {
        ...sec,
        questions: req.shuffle
          ? shuffledQuestions.map((q) => shuffleOptions(q))
          : shuffledQuestions,
      };
    });

    variants.push({
      ...baseTest,
      title: `${req.title} — Variant ${String.fromCharCode(65 + i)}`,
      sections: shuffledSections,
      generatedAt: new Date().toISOString(),
    });
  }

  return variants;
}
