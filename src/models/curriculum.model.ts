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

/**
 * Fetches the full class → subject → chapter → topic tree from Supabase,
 * annotating each node with an accurate question count.
 */
export async function getCurriculumTree(
  filter: CurriculumFilter = {}
): Promise<CurriculumClass[]> {
  // Classes
  let classQ = supabase.from("classes").select("*").order("class_name");
  if (filter.classId) classQ = classQ.eq("id", filter.classId);
  const { data: classData, error: ce } = await classQ;
  if (ce) throw new Error(ce.message);
  const classes = (classData as ClassRow[]) ?? [];

  // Subjects
  let subjQ = supabase.from("subjects").select("*").order("subject_name");
  if (filter.classId) subjQ = subjQ.eq("class_id", filter.classId);
  if (filter.subjectId) subjQ = subjQ.eq("id", filter.subjectId);
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
  return classes.map((cls) => ({
    ...cls,
    questionCount: 0,
    subjects: (subjectsByClass.get(cls.id) ?? []).map((sub) => ({
      ...sub,
      questionCount: countsBySubject[sub.id] ?? 0,
      chapters: (chaptersBySubject.get(sub.id) ?? []).map((ch) => ({
        ...ch,
        questionCount: countsByChapter[ch.id] ?? 0,
        topics: (topicsByChapter.get(ch.id) ?? []).map((t) => ({
          ...t,
          questionCount: countsByTopic[t.id] ?? 0,
        })),
      })),
    })),
  }));
}
