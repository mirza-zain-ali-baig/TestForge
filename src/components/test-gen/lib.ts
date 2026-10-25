import type {
  GenerateTestRequest,
  GeneratedTest,
  GeneratedQuestion,
  QuestionTypeName,
  DifficultyName,
} from "@/lib/types";

export type { GeneratedQuestion };

/* --------------------------- API fetch helpers -------------------------- */

let statsClientCache: unknown = null;
let statsClientCacheTime = 0;

export async function fetchStats() {
  if (statsClientCache && Date.now() - statsClientCacheTime < 30 * 60 * 1000) {
    return statsClientCache as Promise<{
      counts: { classes: number; subjects: number; chapters: number; topics: number; questions: number };
      byType: { name: string; count: number }[];
      byDifficulty: { name: string; count: number }[];
      byBloom: { name: string; count: number }[];
    }>;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("ef_stats_cache");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.t < 30 * 60 * 1000) {
          statsClientCache = parsed.d;
          statsClientCacheTime = parsed.t;
          return parsed.d;
        }
      }
    } catch {}
  }
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  const data = await res.json();
  statsClientCache = data;
  statsClientCacheTime = Date.now();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("ef_stats_cache", JSON.stringify({ d: data, t: Date.now() }));
    } catch {}
  }
  return data as {
    counts: { classes: number; subjects: number; chapters: number; topics: number; questions: number };
    byType: { name: string; count: number }[];
    byDifficulty: { name: string; count: number }[];
    byBloom: { name: string; count: number }[];
  };
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

let curriculumClientCache: { tree: CurriculumNode[] } | null = null;
let curriculumClientCacheTime = 0;

export async function fetchCurriculum(classId?: string) {
  if (!classId && curriculumClientCache && Date.now() - curriculumClientCacheTime < 60 * 60 * 1000) {
    return curriculumClientCache;
  }
  if (!classId && typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("ef_curriculum_cache");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.t < 60 * 60 * 1000) {
          curriculumClientCache = parsed.d;
          curriculumClientCacheTime = parsed.t;
          return parsed.d;
        }
      }
    } catch {}
  }
  const qs = classId ? `?classId=${classId}` : "";
  const res = await fetch(`/api/curriculum${qs}`);
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  const data = (await res.json()) as { tree: CurriculumNode[] };
  if (!classId) {
    curriculumClientCache = data;
    curriculumClientCacheTime = Date.now();
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("ef_curriculum_cache", JSON.stringify({ d: data, t: Date.now() }));
      } catch {}
    }
  }
  return data;
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

const questionClientCache = new Map<
  string,
  {
    data: { questions: BankQuestion[]; total: number; limit: number; offset: number };
    timestamp: number;
  }
>();
const QUESTION_CLIENT_TTL_MS = 20 * 60 * 1000; // 20 minutes

export function clearQuestionClientCache(): void {
  questionClientCache.clear();
  if (typeof window !== "undefined") {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("ef_qc_")) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {}
  }
}

export async function fetchQuestions(params: {
  subjectId?: string;
  chapterIds?: string[];
  topicIds?: string[];
  questionType?: string;
  difficulty?: string;
  search?: string;
  limit?: number;
  offset?: number;
  forceRefresh?: boolean;
}) {
  const sp = new URLSearchParams();
  if (params.subjectId) sp.set("subjectId", params.subjectId);
  if (params.chapterIds?.length) sp.set("chapterIds", params.chapterIds.slice().sort().join(","));
  if (params.topicIds?.length) sp.set("topicIds", params.topicIds.slice().sort().join(","));
  if (params.questionType) sp.set("questionType", params.questionType);
  if (params.difficulty) sp.set("difficulty", params.difficulty);
  if (params.search) sp.set("search", params.search);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));

  const cacheKey = sp.toString();

  if (!params.forceRefresh) {
    const memoryCached = questionClientCache.get(cacheKey);
    if (memoryCached && Date.now() - memoryCached.timestamp < QUESTION_CLIENT_TTL_MS) {
      return memoryCached.data;
    }

    if (typeof window !== "undefined") {
      try {
        const item = sessionStorage.getItem(`ef_qc_${cacheKey}`);
        if (item) {
          const parsed = JSON.parse(item);
          if (Date.now() - parsed.timestamp < QUESTION_CLIENT_TTL_MS) {
            questionClientCache.set(cacheKey, parsed);
            return parsed.data;
          }
        }
      } catch {}
    }
  }

  const res = await fetch(`/api/questions?${cacheKey}`);
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  const data = (await res.json()) as {
    questions: BankQuestion[];
    total: number;
    limit: number;
    offset: number;
  };

  questionClientCache.set(cacheKey, { data, timestamp: Date.now() });
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`ef_qc_${cacheKey}`, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  }

  return data;
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

export async function fetchSavedTests(userEmail?: string) {
  if (!userEmail) return { tests: [] };
  const res = await fetch(`/api/tests?userEmail=${encodeURIComponent(userEmail)}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json() as Promise<{ tests: SavedTest[] }>;
}

export async function saveTest(test: GeneratedTest) {
  const res = await fetch("/api/tests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ test }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  return res.json() as Promise<{ test: SavedTest }>;
}

export async function deleteTest(id: string) {
  const res = await fetch(`/api/tests/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
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

export async function fetchHistory(userEmail?: string): Promise<TestHistory> {
  if (!userEmail) {
    return {
      totalTests: 0,
      totalQuestions: 0,
      totalMarks: 0,
      trend: [],
      bySource: [],
      byClass: [],
      bySubject: [],
      marksBuckets: [],
      avgMarks: 0,
      avgQuestions: 0,
    };
  }
  const res = await fetch(`/api/history?userEmail=${encodeURIComponent(userEmail)}`, { cache: "no-store" });
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

const sourcesClientCache = new Map<
  string,
  {
    data: { sources: { name: string; count: number }[]; total: number; nullCount: number };
    timestamp: number;
  }
>();
const SOURCES_CLIENT_TTL_MS = 20 * 60 * 1000;

/**
 * Fetch distinct `question_from` values and their counts, scoped to the given
 * subject/chapter/topic filter. Cached in memory for 0ms loads.
 */
export async function fetchQuestionSources(params: {
  subjectId: string;
  chapterIds?: string[];
  topicIds?: string[];
  forceRefresh?: boolean;
}): Promise<{
  sources: { name: string; count: number }[];
  total: number;
  nullCount: number;
}> {
  const sp = new URLSearchParams();
  sp.set("subjectId", params.subjectId);
  if (params.chapterIds?.length)
    sp.set("chapterIds", params.chapterIds.slice().sort().join(","));
  if (params.topicIds?.length)
    sp.set("topicIds", params.topicIds.slice().sort().join(","));

  const cacheKey = sp.toString();
  if (!params.forceRefresh) {
    const cached = sourcesClientCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SOURCES_CLIENT_TTL_MS) {
      return cached.data;
    }
  }

  const res = await fetch(`/api/question-sources?${cacheKey}`);
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
  const data = await res.json();
  sourcesClientCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

/**
 * Fetch question availability counts across all 9 cells in a single fast call.
 */
export async function fetchQuestionsAvailability(params: {
  subjectId: string;
  chapterIds?: string[];
  topicIds?: string[];
}): Promise<Record<string, number>> {
  const sp = new URLSearchParams();
  sp.set("subjectId", params.subjectId);
  if (params.chapterIds?.length)
    sp.set("chapterIds", params.chapterIds.slice().sort().join(","));
  if (params.topicIds?.length)
    sp.set("topicIds", params.topicIds.slice().sort().join(","));

  const res = await fetch(`/api/questions/availability?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to check question availability");
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

/* ----------------------- Authentication & RBAC -------------------------- */

export type UserRole = "student" | "educator" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  permissions?: string[];
};

export function hasPermission(user: AuthUser | null, _perm?: string): boolean {
  if (!user) return false;
  return true;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.user as AuthUser) ?? null;
  } catch {
    return null;
  }
}

export async function registerApi(data: {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
}) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Registration failed.");
  return json.user as AuthUser;
}

export async function loginApi(data: { email: string; password: string }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Login failed.");
  return json.user as AuthUser;
}

export async function logoutApi() {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Logout failed.");
  return true;
}

export async function oauthSyncApi(data: { email: string; name?: string; provider?: string }) {
  const res = await fetch("/api/auth/oauth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "OAuth sign-in failed.");
  return json.user as AuthUser;
}

