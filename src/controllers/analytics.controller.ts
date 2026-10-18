/**
 * analytics.controller.ts — Controller layer
 *
 * Business logic for all analytics and reporting features:
 *  - Dashboard stats (question bank counts by type / difficulty / bloom)
 *  - Generation history aggregation (trend, by source, by class/subject)
 *  - Test-pair question overlap
 *  - LLM-powered question similarity detection
 */

import { supabase } from "@/lib/supabase";
import { findAllTests, parseTestJson } from "@/models/test.model";
import { callOpenRouterChatCompletion } from "@/lib/openrouter";
import type { GeneratedTest, GeneratedQuestion } from "@/lib/types";

// ─── Dashboard stats ─────────────────────────────────────────────────────────

export type BankStats = {
  counts: {
    classes: number;
    subjects: number;
    chapters: number;
    topics: number;
    questions: number;
  };
  byType: { name: string; count: number }[];
  byDifficulty: { name: string; count: number }[];
  byBloom: { name: string; count: number }[];
};

import defaultBankStats from "@/data/bank-stats-cache.json";

// In-memory cache seeded with precomputed static snapshot for instant 0ms responses on cold start
let cachedStats: BankStats = defaultBankStats as BankStats;
let lastStatsTime = Date.now();
const STATS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function invalidateBankStatsCache(): void {
  cachedStats = defaultBankStats as BankStats;
  lastStatsTime = 0;
}

/** Fetches aggregated statistics, returning instantly from high-speed in-memory cache. */
export async function getBankStats(): Promise<BankStats> {
  if (Date.now() - lastStatsTime < STATS_CACHE_TTL_MS) {
    return cachedStats;
  }

  const [classes, subjects, chapters, topics, questions, types, diffs] =
    await Promise.all([
      supabase.from("classes").select("*", { count: "exact", head: true }),
      supabase.from("subjects").select("*", { count: "exact", head: true }),
      supabase.from("chapters").select("*", { count: "exact", head: true }),
      supabase.from("topics").select("*", { count: "exact", head: true }),
      supabase.from("questions").select("*", { count: "exact", head: true }).gte("marks", 1),
      supabase.from("question_types").select("*"),
      supabase.from("difficulty_levels").select("*"),
    ]);

  const error =
    classes.error ||
    subjects.error ||
    chapters.error ||
    topics.error ||
    questions.error ||
    types.error ||
    diffs.error;
  if (error) throw new Error(error.message);

  const typeRows = (types.data as { id: string; name: string }[]) ?? [];
  const diffRows = (diffs.data as { id: string; name: string }[]) ?? [];

  const [byType, byDifficulty, byBloom] = await Promise.all([
    Promise.all(
      typeRows.map(async (t) => {
        const { count } = await supabase
          .from("questions")
          .select("*", { count: "exact", head: true })
          .gte("marks", 1)
          .eq("question_type_id", t.id);
        return { name: t.name, count: count ?? 0 };
      })
    ),
    Promise.all(
      diffRows.map(async (d) => {
        const { count } = await supabase
          .from("questions")
          .select("*", { count: "exact", head: true })
          .gte("marks", 1)
          .eq("difficulty_level_id", d.id);
        return { name: d.name, count: count ?? 0 };
      })
    ),
    (async () => {
      const { data } = await supabase.from("questions").select("blooms_taxonomy").gte("marks", 1);
      const map = new Map<string, number>();
      for (const r of data ?? []) {
        const k =
          (r as { blooms_taxonomy: string | null }).blooms_taxonomy ?? "Unspecified";
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    })(),
  ]);

  cachedStats = {
    counts: {
      classes: classes.count ?? 0,
      subjects: subjects.count ?? 0,
      chapters: chapters.count ?? 0,
      topics: topics.count ?? 0,
      questions: questions.count ?? 0,
    },
    byType,
    byDifficulty,
    byBloom,
  };
  lastStatsTime = Date.now();

  return cachedStats;
}

// ─── Generation history ───────────────────────────────────────────────────────

export type HistoryStats = {
  totalTests: number;
  totalQuestions: number;
  totalMarks: number;
  trend: { date: string; label: string; count: number }[];
  bySource: { name: string; count: number }[];
  byClass: { name: string; count: number }[];
  bySubject: { name: string; count: number }[];
  marksBuckets: { range: string; count: number }[];
  avgMarks: number;
  avgQuestions: number;
};

/** Aggregates saved-test history for the analytics dashboard strictly for the authenticated user. */
export async function getHistoryStats(userEmail?: string): Promise<HistoryStats> {
  if (!userEmail) {
    return {
      totalTests: 0,
      totalQuestions: 0,
      totalMarks: 0,
      trend: [],
      bySource: [],
      byClass: [],
      bySubject: [],
      marksBuckets: [
        { range: "1-10", count: 0 },
        { range: "11-25", count: 0 },
        { range: "26-50", count: 0 },
        { range: "51-100", count: 0 },
        { range: "100+", count: 0 },
      ],
      avgMarks: 0,
      avgQuestions: 0,
    };
  }

  const tests = await findAllTests(userEmail);

  let totalQuestions = 0;
  let totalMarks = 0;
  const sourceCount: Record<string, number> = { bank: 0, hybrid: 0, ai: 0 };
  const classCount: Record<string, number> = {};
  const subjectCount: Record<string, number> = {};
  const marksBuckets: { range: string; count: number }[] = [
    { range: "1-10", count: 0 },
    { range: "11-25", count: 0 },
    { range: "26-50", count: 0 },
    { range: "51-100", count: 0 },
    { range: "100+", count: 0 },
  ];

  // Build the last 14-day trend
  const trend: { date: string; label: string; count: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    trend.push({ date: dateStr, label, count: 0 });
  }
  const trendMap = new Map(trend.map((t) => [t.date, t]));

  for (const t of tests) {
    const parsed = parseTestJson(t);
    if (!parsed) continue;

    totalQuestions += parsed.totalQuestions;
    totalMarks += parsed.totalMarks;
    sourceCount[t.source] = (sourceCount[t.source] ?? 0) + 1;

    const ck = parsed.className || "Unknown";
    classCount[ck] = (classCount[ck] ?? 0) + 1;

    const sk = parsed.subjectName || "Unknown";
    subjectCount[sk] = (subjectCount[sk] ?? 0) + 1;

    const m = parsed.totalMarks;
    if (m <= 10) marksBuckets[0].count++;
    else if (m <= 25) marksBuckets[1].count++;
    else if (m <= 50) marksBuckets[2].count++;
    else if (m <= 100) marksBuckets[3].count++;
    else marksBuckets[4].count++;

    const dateStr = t.createdAt.toISOString().slice(0, 10);
    const trendEntry = trendMap.get(dateStr);
    if (trendEntry) trendEntry.count++;
  }

  return {
    totalTests: tests.length,
    totalQuestions,
    totalMarks,
    trend,
    bySource: Object.entries(sourceCount)
      .filter(([, c]) => c > 0)
      .map(([name, count]) => ({ name, count })),
    byClass: Object.entries(classCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    bySubject: Object.entries(subjectCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    marksBuckets,
    avgMarks: tests.length > 0 ? Math.round(totalMarks / tests.length) : 0,
    avgQuestions: tests.length > 0 ? Math.round(totalQuestions / tests.length) : 0,
  };
}

// ─── Test-pair overlap ────────────────────────────────────────────────────────

export type OverlapPair = {
  a: string;
  b: string;
  aTitle: string;
  bTitle: string;
  shared: number;
  sharedIds: string[];
};

/** Computes question-ID overlap between every pair of saved tests for the authenticated user. */
export async function getTestOverlap(userEmail?: string): Promise<{
  pairs: OverlapPair[];
  maxShared: number;
  totalTests: number;
}> {
  if (!userEmail) {
    return { pairs: [], maxShared: 0, totalTests: 0 };
  }

  const tests = await findAllTests(userEmail);

  const parsed = tests
    .map((t) => {
      const p = parseTestJson(t);
      if (!p) return null;
      const ids = new Set(p.sections.flatMap((s) => s.questions.map((q) => q.id)));
      return { id: t.id, title: t.title, ids };
    })
    .filter((x): x is { id: string; title: string; ids: Set<string> } => !!x);

  const pairs: OverlapPair[] = [];
  let maxShared = 0;

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i];
      const b = parsed[j];
      const sharedIds = [...a.ids].filter((id) => b.ids.has(id));
      if (sharedIds.length > 0) {
        pairs.push({ a: a.id, b: b.id, aTitle: a.title, bTitle: b.title, shared: sharedIds.length, sharedIds });
        if (sharedIds.length > maxShared) maxShared = sharedIds.length;
      }
    }
  }

  pairs.sort((x, y) => y.shared - x.shared);
  return { pairs, maxShared, totalTests: parsed.length };
}

// ─── Similarity detection ─────────────────────────────────────────────────────

export type SimilarityPair = {
  a: string;
  b: string;
  aIndex: number;
  bIndex: number;
  aText: string;
  bText: string;
  similarity: "high" | "medium" | "low";
  reason: string;
};

/** Uses the LLM to detect near-duplicate questions in a test. */
export async function detectSimilarQuestions(
  questions: GeneratedQuestion[]
): Promise<SimilarityPair[]> {
  if (questions.length < 2) return [];

  const qs = questions.slice(0, 30);

  const questionList = qs
    .map((q, i) => `${i + 1}. [${q.type_name}/${q.difficulty_name}] ${q.question_text}`)
    .join("\n");

  const prompt = `You are an expert exam reviewer. Analyze the following ${qs.length} exam questions and identify pairs that are near-duplicates or overly similar (i.e., testing the same concept with very similar wording or asking essentially the same thing).

Questions:
${questionList}

Rules:
- Only flag pairs with meaningful similarity (not just sharing a keyword).
- "high" = near-duplicate (same question rephrased), "medium" = significant overlap in concept/answer, "low" = related but acceptable.
- Return at most 8 pairs, prioritized by similarity level.
- If no similar pairs exist, return an empty array.

Return STRICT JSON ONLY (no markdown, no commentary) in this exact shape:
{"pairs":[{"a":1,"b":2,"similarity":"high","reason":"Both ask about the definition of an operating system"}]}

The "a" and "b" values are the 1-based question numbers from the list above.`;

  try {
    const { content } = await callOpenRouterChatCompletion({
      messages: [{ role: "user", content: prompt }],
      systemPrompt: "You are a precise JSON generator for exam quality analysis. Output only valid JSON.",
      preferredModel: "auto",
      temperature: 0.1,
    });

    const parsed = safeParse(content);
    if (!parsed?.pairs || !Array.isArray(parsed.pairs)) return [];

    return (parsed.pairs as { a: number; b: number; similarity?: string; reason?: string }[])
      .filter((p) => p.a >= 1 && p.a <= qs.length && p.b >= 1 && p.b <= qs.length)
      .map((p) => ({
        a: qs[p.a - 1].id,
        b: qs[p.b - 1].id,
        aIndex: p.a - 1,
        bIndex: p.b - 1,
        aText: qs[p.a - 1].question_text,
        bText: qs[p.b - 1].question_text,
        similarity: (p.similarity ?? "medium") as "high" | "medium" | "low",
        reason: p.reason ?? "Similar question content",
      }));
  } catch {
    return [];
  }
}

// ─── LLM answer explanation ───────────────────────────────────────────────────

/**
 * Generates a teaching explanation for why the correct answer is correct.
 * Useful for answer keys and teacher review.
 */
export async function explainQuestion(opts: {
  question: GeneratedQuestion;
  className?: string;
  subjectName?: string;
}): Promise<string> {
  const { question: q } = opts;

  let prompt: string;
  if (q.options) {
    const correctLetter = (q.options.correct_option || "A").toUpperCase();
    const correctText =
      q.options[
        `option_${correctLetter.toLowerCase()}` as
          | "option_a"
          | "option_b"
          | "option_c"
          | "option_d"
      ] || "";
    prompt = `You are an expert teacher. Explain why the correct answer to this MCQ is correct, in 2-3 clear, educational sentences suitable for a school student.

Question: ${q.question_text}
A. ${q.options.option_a}
B. ${q.options.option_b}
C. ${q.options.option_c}
D. ${q.options.option_d}
Correct answer: Option ${correctLetter}. ${correctText}

Context: ${opts.className ?? ""} ${opts.subjectName ?? ""}

Write a clear, concise explanation. Do NOT repeat the question or all options. Start directly with why the answer is correct and explain the core concept.`;
  } else {
    prompt = `You are an expert teacher. Provide a brief teaching note and explanation (2-3 sentences) for this ${q.type_name} question, explaining what a good answer must cover.

Question: ${q.question_text}
${q.model_answer ? `Model answer: ${q.model_answer}` : ""}

Context: ${opts.className ?? ""} ${opts.subjectName ?? ""}

Write a clear, concise teaching note. Do NOT repeat the question. Start directly with the explanation.`;
  }

  const { content } = await callOpenRouterChatCompletion({
    messages: [{ role: "user", content: prompt }],
    systemPrompt: "You are an expert educator who writes clear, concise teaching explanations and exam answer keys.",
    preferredModel: "auto",
    temperature: 0.3,
  });

  if (!content) {
    throw new Error("AI could not generate an explanation. Please try again.");
  }
  return content;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParse(raw: string): { pairs?: unknown[] } | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
