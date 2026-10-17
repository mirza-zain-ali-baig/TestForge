/**
 * blueprint.controller.ts — Controller layer
 *
 * Business logic for AI-powered blueprint suggestion.
 * Takes a total-marks target and a difficulty profile, and uses
 * the LLM to return an optimal question distribution.
 */

import { callOpenRouterChatCompletion } from "@/lib/openrouter";
import type { Blueprint, QuestionTypeName, DifficultyName } from "@/lib/types";

export type BlueprintSuggestionRequest = {
  totalMarks: number;
  difficultyTarget: "easy" | "balanced" | "hard" | "exam";
  className: string;
  subjectName: string;
  chapters?: string[];
};

export type BlueprintSuggestionResult = {
  blueprint: Blueprint;
  rationale: string;
};

const PROFILES: Record<string, { label: string; desc: string }> = {
  easy: {
    label: "Easy-leaning",
    desc: "Mostly Easy questions for practice/revision (≈60% Easy, 30% Medium, 10% Hard)",
  },
  balanced: {
    label: "Balanced",
    desc: "Even mix of difficulties (≈40% Easy, 40% Medium, 20% Hard)",
  },
  hard: {
    label: "Rigorous",
    desc: "Challenging exam with emphasis on analysis (≈20% Easy, 30% Medium, 50% Hard)",
  },
  exam: {
    label: "Board Exam Style",
    desc: "Standard board exam distribution with MCQ, Short, and Long sections",
  },
};

/**
 * Asks the LLM to suggest an optimal blueprint for the given parameters.
 * Returns the normalised blueprint and a one-sentence rationale.
 */
export async function suggestBlueprint(
  req: BlueprintSuggestionRequest
): Promise<BlueprintSuggestionResult> {
  if (!req.totalMarks || req.totalMarks < 1) {
    throw new Error("totalMarks must be >= 1");
  }

  const profile = PROFILES[req.difficultyTarget] ?? PROFILES.balanced;

  const prompt = `You are an expert examination designer for school-level computer science.
Design a test blueprint for the following:

Class: ${req.className}
Subject: ${req.subjectName}
Target total marks: ${req.totalMarks}
Difficulty profile: ${profile.label} — ${profile.desc}

Rules:
- Use three question types: MCQ (1 mark each), Short (3 marks each), Long (5 marks each).
- Distribute the total marks across types and difficulties so the SUM of all (count × marksPerQuestion) equals exactly ${req.totalMarks}.
- For a board-exam style, aim for roughly 40% MCQ, 30% Short, 30% Long marks. For others, prioritize the difficulty profile.
- Counts must be non-negative integers.
- Difficulty names are exactly: Easy, Medium, Hard.

Return STRICT JSON ONLY (no markdown, no commentary) in this exact shape:
{
  "blueprint": {
    "MCQ": { "marksPerQuestion": 1, "difficulties": { "Easy": 0, "Medium": 0, "Hard": 0 } },
    "Short": { "marksPerQuestion": 3, "difficulties": { "Easy": 0, "Medium": 0, "Hard": 0 } },
    "Long": { "marksPerQuestion": 5, "difficulties": { "Easy": 0, "Medium": 0, "Hard": 0 } }
  },
  "rationale": "1-2 sentence explanation of the distribution choice"
}`;

  const { content } = await callOpenRouterChatCompletion({
    messages: [{ role: "user", content: prompt }],
    systemPrompt: "You are a precise JSON generator for exam blueprints. Output only valid JSON.",
    preferredModel: "nvidia/nemotron-3.5-super-vl:free",
    temperature: 0.2,
  });

  const parsed = safeParse(content);

  if (!parsed?.blueprint) {
    throw new Error("AI could not generate a valid blueprint. Please try again.");
  }

  const blueprint = normalizeBlueprint(parsed.blueprint);
  return { blueprint, rationale: parsed.rationale ?? "AI-suggested distribution." };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParse(raw: string): { blueprint?: Blueprint; rationale?: string } | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) text = text.slice(first, last + 1);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeBlueprint(bp: Partial<Blueprint>): Blueprint {
  const types: QuestionTypeName[] = ["MCQ", "Short", "Long"];
  const diffs: DifficultyName[] = ["Easy", "Medium", "Hard"];
  const defaultMarks: Record<QuestionTypeName, number> = { MCQ: 1, Short: 3, Long: 5 };

  const out = {} as Blueprint;
  for (const t of types) {
    const cfg = bp[t] ?? { marksPerQuestion: defaultMarks[t], difficulties: {} };
    out[t] = {
      marksPerQuestion: Math.max(1, cfg.marksPerQuestion ?? defaultMarks[t]),
      difficulties: {
        Easy: clamp("Easy", cfg.difficulties),
        Medium: clamp("Medium", cfg.difficulties),
        Hard: clamp("Hard", cfg.difficulties),
      },
    };
  }
  return out;
}

function clamp(d: DifficultyName, obj?: Partial<Record<DifficultyName, number>>): number {
  const v = obj?.[d] ?? 0;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
