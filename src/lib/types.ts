// Shared types for the test generator feature (used by API + client).

export type QuestionTypeName = "MCQ" | "Short" | "Long";
export type DifficultyName = "Easy" | "Medium" | "Hard";

export type BlueprintCell = {
  count: number;
};

export type BlueprintType = {
  marksPerQuestion: number;
  difficulties: Record<DifficultyName, number>; // counts per difficulty
};

export type Blueprint = Record<QuestionTypeName, BlueprintType>;

export type GenerateSource = "bank" | "ai" | "hybrid";

export type GenerateTestRequest = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  title?: string; // optional
  durationMins: number;
  instructions?: string;
  chapterIds: string[];
  topicIds: string[]; // empty => all topics within selected chapters
  blueprint: Blueprint;
  source: GenerateSource;
  shuffle: boolean;
  // Optional: bank question IDs to exclude (used by batch generation to keep
  // variants disjoint). AI fill is still allowed when the bank pool is exhausted.
  excludeQuestionIds?: string[];
  // Optional: filter bank questions by their `question_from` column (e.g.
  // "textbook", "additional", "exercise", "examples"). Empty => use all sources.
  questionSources?: string[];
};

export type GeneratedQuestion = {
  id: string; // supabase id or "ai-<n>"
  source: "bank" | "ai";
  question_text: string;
  type_name: QuestionTypeName;
  difficulty_name: DifficultyName;
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
    correct_option: string; // A|B|C|D
  } | null;
  // For Short/Long (AI generated) — model answer
  model_answer?: string | null;
};

export type TestSection = {
  type_name: QuestionTypeName;
  marksPerQuestion: number;
  questions: GeneratedQuestion[];
  sectionMarks: number;
};

export type GeneratedTest = {
  title: string;
  className: string;
  subjectName: string;
  subjectId?: string;
  durationMins: number;
  instructions: string;
  totalMarks: number;
  totalQuestions: number;
  source: GenerateSource;
  generatedAt: string;
  sections: TestSection[];
  meta: {
    requested: number;
    fromBank: number;
    fromAI: number;
    shortfalls: { type: QuestionTypeName; difficulty: DifficultyName; requested: number; got: number }[];
  };
};
