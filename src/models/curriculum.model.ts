/**
 * curriculum.model.ts — Model layer
 *
 * Provides the full curriculum hierarchy tree with per-leaf question counts.
 * Combines data from four Supabase tables into a single tree structure.
 */

import { supabase } from "@/lib/supabase";
import { fetchAllQuestionKeys } from "./question.model";
import type { ClassRow, SubjectRow, ChapterRow, TopicRow } from "@/lib/supabase";

export type CurriculumTopic = TopicRow & { questionCount: number };
export type CurriculumChapter = ChapterRow & {
  questionCount: number;
  topics: CurriculumTopic[];
};
export type CurriculumSubject = SubjectRow & {
  questionCount: number;
  chapters: CurriculumChapter[];
};
export type CurriculumClass = ClassRow & {
  questionCount: number;
  subjects: CurriculumSubject[];
};

export type CurriculumFilter = {
  classId?: string;
  subjectId?: string;
};

import defaultCurriculum from "@/data/curriculum-cache.json";

// In-memory cache seeded with precomputed static snapshot for instant 0ms responses on cold start
let cachedTree: CurriculumClass[] = defaultCurriculum as unknown as CurriculumClass[];
let lastTreeTime = Date.now();
const TREE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function invalidateCurriculumCache(): void {
  cachedTree = defaultCurriculum as unknown as CurriculumClass[];
  lastTreeTime = 0;
}

/**
 * Fetches the full class → subject → chapter → topic tree,
 * returning instantly from high-speed in-memory cache.
 */
export async function getCurriculumTree(
  filter: CurriculumFilter = {}
): Promise<CurriculumClass[]> {
  // Return cached tree instantly (0ms)
  let result = cachedTree;
  if (filter.classId) {
    result = result.filter((cls) => cls.id === filter.classId);
  }
  if (filter.subjectId) {
    result = result.map((cls) => ({
      ...cls,
      subjects: cls.subjects.filter((sub) => sub.id === filter.subjectId),
    }));
  }

  // If cache is fresh, return immediately
  if (Date.now() - lastTreeTime < TREE_CACHE_TTL_MS) {
    return result;
  }

  // Fetch full tree from Supabase so future requests are instantaneous
  // Classes
  let classQ = supabase.from("classes").select("*").order("class_name");
  const { data: classData, error: ce } = await classQ;
  if (ce) throw new Error(ce.message);
  const classes = ((classData as ClassRow[]) ?? []).sort((a, b) =>
    a.class_name.localeCompare(b.class_name, undefined, { numeric: true })
  );

  // Subjects
  let subjQ = supabase.from("subjects").select("*").order("subject_name");
  const { data: subjData, error: se } = await subjQ;
  if (se) throw new Error(se.message);
  const subjects = (subjData as SubjectRow[]) ?? [];

  const subjectIds = subjects.map((s) => s.id);

  // Chapters
  let chapters: ChapterRow[] = [];
  if (subjectIds.length) {
    const { data: chData, error: che } = await supabase
      .from("chapters")
      .select("*")
      .in("subject_id", subjectIds)
      .order("chapter_number");
    if (che) throw new Error(che.message);
    chapters = (chData as ChapterRow[]) ?? [];
  }

  // Topics
  const chapterIds = chapters.map((c) => c.id);
  let topics: TopicRow[] = [];
  if (chapterIds.length) {
    const { data: tData, error: te } = await supabase
      .from("topics")
      .select("*")
      .in("chapter_id", chapterIds)
      .order("topic_article_no");
    if (te) throw new Error(te.message);
    topics = (tData as TopicRow[]) ?? [];
  }

  // Question counts (paginated for accuracy)
  const countsByTopic: Record<string, number> = {};
  const countsByChapter: Record<string, number> = {};
  const countsBySubject: Record<string, number> = {};

  if (subjectIds.length) {
    const qData = await fetchAllQuestionKeys(subjectIds);
    for (const q of qData) {
      countsByTopic[q.topic_id] = (countsByTopic[q.topic_id] ?? 0) + 1;
      countsByChapter[q.chapter_id] = (countsByChapter[q.chapter_id] ?? 0) + 1;
      countsBySubject[q.subject_id] = (countsBySubject[q.subject_id] ?? 0) + 1;
    }
  }

  // Assemble indexes
  const topicsByChapter = new Map<string, TopicRow[]>();
  for (const t of topics) {
    const arr = topicsByChapter.get(t.chapter_id) ?? [];
    arr.push(t);
    topicsByChapter.set(t.chapter_id, arr);
  }

  const chaptersBySubject = new Map<string, ChapterRow[]>();
  for (const c of chapters) {
    const arr = chaptersBySubject.get(c.subject_id) ?? [];
    arr.push(c);
    chaptersBySubject.set(c.subject_id, arr);
  }

  const subjectsByClass = new Map<string, SubjectRow[]>();
  for (const s of subjects) {
    const arr = subjectsByClass.get(s.class_id) ?? [];
    arr.push(s);
    subjectsByClass.set(s.class_id, arr);
  }

  // Build tree
  const fullTree: CurriculumClass[] = classes.map((cls) => {
    const classSubjects = (subjectsByClass.get(cls.id) ?? []).map((sub) => {
      const subChapters = (chaptersBySubject.get(sub.id) ?? []).map((ch) => ({
        ...ch,
        questionCount: countsByChapter[ch.id] ?? 0,
        topics: (topicsByChapter.get(ch.id) ?? [])
          .sort((a, b) =>
            (a.topic_article_no || "").localeCompare(b.topic_article_no || "", undefined, { numeric: true })
          )
          .map((t) => ({
            ...t,
            questionCount: countsByTopic[t.id] ?? 0,
          })),
      }));
      return {
        ...sub,
        questionCount: countsBySubject[sub.id] ?? 0,
        chapters: subChapters,
      };
    });
    return {
      ...cls,
      questionCount: classSubjects.reduce((acc, s) => acc + s.questionCount, 0),
      subjects: classSubjects,
    };
  });

  cachedTree = fullTree;
  lastTreeTime = Date.now();

  let filteredResult = fullTree;
  if (filter.classId) {
    filteredResult = filteredResult.filter((cls) => cls.id === filter.classId);
  }
  if (filter.subjectId) {
    filteredResult = filteredResult.map((cls) => ({
      ...cls,
      subjects: cls.subjects.filter((sub) => sub.id === filter.subjectId),
    }));
  }

  return filteredResult;
}
