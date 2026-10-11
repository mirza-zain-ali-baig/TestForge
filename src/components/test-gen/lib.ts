import type {
  GenerateTestRequest,
  GeneratedTest,
  QuestionTypeName,
  DifficultyName,
} from "@/lib/types";

/* --------------------------- API fetch helpers -------------------------- */

export async function fetchStats() {
  const res = await fetch("/api/stats", { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json() as Promise<{
    counts: { classes: number; subjects: number; chapters: number; topics: number; questions: number };
    byType: { name: string; count: number }[];
    byDifficulty: { name: string; count: number }[];
    byBloom: { name: string; count: number }[];
  }>;
}

export type CurriculumNode = {
  id: string;
  class_name?: string;
  subject_name?: string;
  chapter_name?: string;
  topic_name?: string;
  chapter_number?: number;
  topic_article_no?: string;
  created_at: string;
  class_id?: string;
  subject_id?: string;
  chapter_id?: string;
  questionCount: number;
  subjects?: CurriculumNode[];
  chapters?: CurriculumNode[];
  topics?: CurriculumNode[];
};

export async function fetchCurriculum(classId?: string) {
  const qs = classId ? `?classId=${classId}` : "";
  const res = await fetch(`/api/curriculum${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json() as Promise<{ tree: CurriculumNode[] }>;
}

export type BankQuestion = {
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

export async function fetchQuestions(params: {
  subjectId?: string;
  chapterIds?: string[];
  topicIds?: string[];
  questionType?: string;
  difficulty?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params.subjectId) sp.set("subjectId", params.subjectId);
  if (params.chapterIds?.length) sp.set("chapterIds", params.chapterIds.join(","));
  if (params.topicIds?.length) sp.set("topicIds", params.topicIds.join(","));
  if (params.questionType) sp.set("questionType", params.questionType);
  if (params.difficulty) sp.set("difficulty", params.difficulty);
  if (params.search) sp.set("search", params.search);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));
  const res = await fetch(`/api/questions?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json() as Promise<{ questions: BankQuestion[]; total: number; limit: number; offset: number }>;
}

export async function generateTest(req: GenerateTestRequest): Promise<GeneratedTest> {
  const res = await fetch("/api/generate-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to generate test");
  }
  return (await res.json()).test as GeneratedTest;
}

export async function generateBatch(
  req: GenerateTestRequest,
  variantCount: number
): Promise<GeneratedTest[]> {
  const res = await fetch("/api/generate-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: req, variantCount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to generate batch");
  }
  return (await res.json()).variants as GeneratedTest[];
}

export async function regenerateQuestion(opts: {
  subjectName: string;
  className: string;
  chapterName?: string;
  topicName?: string;
  typeName: string;
  difficultyName: string;
  marks: number;
}): Promise<GeneratedQuestion> {
  const res = await fetch("/api/regenerate-question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to regenerate question");
  }
  return (await res.json()).question as GeneratedQuestion;
}

export type SavedTest = {
  id: string;
  title: string;
  className: string;
  subjectName: string;
  totalMarks: number;
  durationMins: number;
  instructions: string | null;
  testJson: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchSavedTests() {
  const res = await fetch("/api/tests", { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json() as Promise<{ tests: SavedTest[] }>;
}

export async function saveTest(test: GeneratedTest) {
  const res = await fetch("/api/tests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json() as Promise<{ test: SavedTest }>;
}

export async function deleteTest(id: string) {
  const res = await fetch(`/api/tests/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json();
}

export type TestHistory = {
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

export async function fetchHistory(): Promise<TestHistory> {
  const res = await fetch("/api/history", { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json() as Promise<TestHistory>;
}

export async function suggestBlueprint(opts: {
  totalMarks: number;
  difficultyTarget: "easy" | "balanced" | "hard" | "exam";
  className: string;
  subjectName: string;
  chapters?: string[];
}): Promise<{ blueprint: import("@/lib/types").Blueprint; rationale: string }> {
  const res = await fetch("/api/suggest-blueprint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to suggest blueprint");
  }
  return res.json();
}

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

export async function checkSimilarity(
  questions: GeneratedQuestion[]
): Promise<SimilarityPair[]> {
  const res = await fetch("/api/check-similarity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to check similarity");
  }
  return (await res.json()).pairs as SimilarityPair[];
}

export async function explainQuestion(opts: {
  question: GeneratedQuestion;
  className?: string;
  subjectName?: string;
}): Promise<string> {
  const res = await fetch("/api/explain-question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to generate explanation");
  }
  return (await res.json()).explanation as string;
}

/**
 * Fetch distinct `question_from` values and their counts, scoped to the given
 * subject/chapter/topic filter. Used by the Blueprint step to render the
 * optional "Filter questions by source" UI with live count badges.
 */
export async function fetchQuestionSources(params: {
  subjectId: string;
  chapterIds?: string[];
  topicIds?: string[];
}): Promise<{
  sources: { name: string; count: number }[];
  total: number;
  nullCount: number;
}> {
  const sp = new URLSearchParams();
  sp.set("subjectId", params.subjectId);
  if (params.chapterIds?.length)
    sp.set("chapterIds", params.chapterIds.join(","));
  if (params.topicIds?.length)
    sp.set("topicIds", params.topicIds.join(","));
  const res = await fetch(`/api/question-sources?${sp.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json();
}

/* ------------------------------ Utilities ------------------------------- */

export const TYPE_NAMES: QuestionTypeName[] = ["MCQ", "Short", "Long"];
export const DIFF_NAMES: DifficultyName[] = ["Easy", "Medium", "Hard"];

export const TYPE_META: Record<
  QuestionTypeName,
  { label: string; desc: string; defaultMarks: number; color: string }
> = {
  MCQ: { label: "Multiple Choice", desc: "Single-correct objective questions", defaultMarks: 1, color: "emerald" },
  Short: { label: "Short Answer", desc: "Brief 2–4 sentence responses", defaultMarks: 3, color: "amber" },
  Long: { label: "Long Answer", desc: "Detailed descriptive answers", defaultMarks: 5, color: "rose" },
};

export const DIFF_META: Record<DifficultyName, { label: string; color: string }> = {
  Easy: { label: "Easy", color: "emerald" },
  Medium: { label: "Medium", color: "amber" },
  Hard: { label: "Hard", color: "rose" },
};

export function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
