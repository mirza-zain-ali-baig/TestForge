import ZAI from "z-ai-web-dev-sdk";
import type {
  QuestionTypeName,
  DifficultyName,
  GeneratedQuestion,
} from "./types";

/**
 * AI-powered question generation using z-ai-web-dev-sdk (backend only).
 * Generates fresh questions for a given topic/chapter when the question bank
 * doesn't have enough, or when the user explicitly chooses "AI" source.
 */

type AIQuestionRaw = {
  question_text: string;
  blooms_taxonomy?: string;
  tags?: string;
  model_answer?: string;
  options?: {
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: "A" | "B" | "C" | "D";
  };
};

export async function generateAIQuestions(opts: {
  subjectName: string;
  className: string;
  chapterName?: string;
  topicName?: string;
  typeName: QuestionTypeName;
  difficultyName: DifficultyName;
  count: number;
  marks: number;
}): Promise<GeneratedQuestion[]> {
  const { subjectName, className, chapterName, topicName, typeName, difficultyName, count, marks } =
    opts;

  const zai = await ZAI.create();

  const context = [
    `Class: ${className}`,
    `Subject: ${subjectName}`,
    chapterName ? `Chapter: ${chapterName}` : null,
    topicName ? `Topic: ${topicName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const formatSpec =
    typeName === "MCQ"
      ? `Each MCQ must include exactly 4 options (option_a, option_b, option_c, option_d) and a "correct_option" field whose value is one of "A","B","C","D". Do NOT include an "options" wrapper for non-MCQ.`
      : `Each ${typeName} question must include a "model_answer" field with a concise model answer (2-4 sentences for Short, 1 paragraph for Long). Do NOT include "options".`;

  const prompt = `You are an expert examination question setter for school level computer science.
Create ${count} original ${difficultyName} difficulty ${typeName} question(s) for the following context:

${context}

Each question should be worth ${marks} mark(s).

Requirements:
- Questions must be academically accurate, clearly worded, and appropriate for the stated class level.
- Difficulty "${difficultyName}" must be respected: Easy = recall/remember, Medium = understand/apply, Hard = analyze/evaluate.
- Vary the questions; do not repeat the same stem.
- Tag each question with a relevant "blooms_taxonomy" level (Remember/Understand/Apply/Analyze/Evaluate/Create) and 1-3 comma-separated "tags".
${formatSpec}

Return STRICT JSON ONLY (no markdown fences, no commentary) in this exact shape:
{"questions":[
  ${typeName === "MCQ"
    ? '{"question_text":"...","blooms_taxonomy":"...","tags":"...","options":{"option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A"}}'
    : '{"question_text":"...","blooms_taxonomy":"...","tags":"...","model_answer":"..."}'}
]}`;

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: "assistant",
        content:
          "You are a precise JSON generator for exam questions. Output only valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    thinking: { type: "disabled" },
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = safeParseQuestions(raw);

  return parsed.slice(0, count).map<GeneratedQuestion>((q, i) => ({
    id: `ai-${Date.now()}-${i}`,
    source: "ai",
    question_text: q.question_text,
    type_name: typeName,
    difficulty_name: difficultyName,
    marks,
    blooms_taxonomy: q.blooms_taxonomy ?? null,
    tags: q.tags ?? null,
    topic_name: topicName ?? null,
    chapter_name: chapterName ?? null,
    options: q.options
      ? {
          option_a: q.options.option_a,
          option_b: q.options.option_b,
          option_c: q.options.option_c,
          option_d: q.options.option_d,
          correct_option: q.options.correct_option,
        }
      : null,
    model_answer: q.model_answer ?? null,
  }));
}

function safeParseQuestions(raw: string): AIQuestionRaw[] {
  // Strip markdown code fences if present
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Find first { ... last }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  try {
    const obj = JSON.parse(text) as { questions?: AIQuestionRaw[] };
    if (obj.questions && Array.isArray(obj.questions)) return obj.questions;
  } catch {
    /* fall through */
  }
  return [];
}
