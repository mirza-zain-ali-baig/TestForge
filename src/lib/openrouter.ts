/**
 * OpenRouter AI Integration for ExamForge
 * Provides smart model selection, dynamic free model discovery,
 * and automatic fallback routing to ensure reliable, high-quality answers.
 */

/**
 * Backend OpenRouter API Key provided for ExamForge.
 * Decoded at runtime so requests work automatically out-of-the-box on backend.
 */
const BACKEND_KEY_B64 =
  "c2stb3ItdjEtYzJlMjUxNDJjNjc0MDkxYjdhOWEwZGVkOTViOGU5Yzg4MWI1OTRhZGZlMThlMjFiMWFjM2I2NjQ4YWIxZDI2YQ==";

export const BACKEND_OPENROUTER_KEY =
  typeof Buffer !== "undefined"
    ? Buffer.from(BACKEND_KEY_B64, "base64").toString("utf-8")
    : typeof atob === "function"
    ? atob(BACKEND_KEY_B64)
    : "";

export function getDefaultOpenRouterKey(): string {
  if (typeof process !== "undefined" && process.env?.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY.trim();
  }
  return BACKEND_OPENROUTER_KEY;
}

export const DEFAULT_OPENROUTER_API_KEY = getDefaultOpenRouterKey();

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id?: string;
  role: ChatRole;
  content: string;
  modelUsed?: string;
  fallbackFrom?: string;
  timestamp?: number;
  isError?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  badge?: string;
  context_length?: number;
  quality?: number;
  isFree: boolean;
  category?: "recommended" | "live-free" | "paid" | "custom";
}

/**
 * Curated ranking of OpenRouter free models.
 * Higher quality score = tried first when in "Auto (Best Free Model)" mode.
 */
import { callGeminiChatCompletion } from "./gemini";

export const CURATED_FREE_MODELS: ModelInfo[] = [
  {
    id: "gemini-flash-lite-latest",
    name: "ExamForge AI (Google Gemini)",
    badge: "1,500 req/day (Fast)",
    quality: 105,
    isFree: true,
    category: "recommended",
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA Nemotron 3.5 Super VL",
    badge: "1M Context & Fast",
    quality: 100,
    isFree: true,
    category: "recommended",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "NVIDIA Nemotron 3 Super 120B",
    badge: "120B Reasoning",
    quality: 98,
    isFree: true,
    category: "recommended",
  },
  {
    id: "xingchen-agi/xing4.0-29b-a4b:free",
    name: "XingChen 29B Chat",
    badge: "29B Chat",
    quality: 95,
    isFree: true,
    category: "recommended",
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "LiquidAI LFM 2.5",
    badge: "Lightning Fast",
    quality: 92,
    isFree: true,
    category: "recommended",
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Google Gemma 4 26B",
    badge: "Google AI",
    quality: 90,
    isFree: true,
    category: "recommended",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google Gemma 4 31B",
    badge: "Google AI",
    quality: 88,
    isFree: true,
    category: "recommended",
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "Nemotron Omni 30B Reasoning",
    badge: "Reasoning",
    quality: 86,
    isFree: true,
    category: "recommended",
  },
  {
    id: "cohere/north-mini-code:free",
    name: "Cohere North Mini Code",
    badge: "Code Expert",
    quality: 84,
    isFree: true,
    category: "recommended",
  },
  {
    id: "thinkingmachines/inkling:free",
    name: "Thinking Machines Inkling",
    badge: "1M Context",
    quality: 82,
    isFree: true,
    category: "recommended",
  },
  {
    id: "openrouter/free",
    name: "OpenRouter Free Router",
    badge: "Auto-Free Router",
    quality: 70,
    isFree: true,
    category: "recommended",
  },
];

export const PAID_POPULAR_MODELS: ModelInfo[] = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", badge: "Paid", isFree: false, category: "paid" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", badge: "Paid", isFree: false, category: "paid" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", badge: "Paid", isFree: false, category: "paid" },
  { id: "openrouter/auto", name: "Auto Router", badge: "Paid", isFree: false, category: "paid" },
];

/**
 * Ordered fallback chain to ensure requests never fail when in "Auto" mode
 * or if a chosen free model is rate-limited (429), down (503), or deprecated (404).
 */
export const FALLBACK_CHAIN = [
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
  "liquid/lfm-2.5-2.6b:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "openrouter/free",
];

/**
 * Fetch live active models from OpenRouter and extract free models
 */
export async function fetchLiveOpenRouterModels(): Promise<{
  recommended: ModelInfo[];
  liveFree: ModelInfo[];
  paid: ModelInfo[];
}> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      return {
        recommended: CURATED_FREE_MODELS,
        liveFree: [],
        paid: PAID_POPULAR_MODELS,
      };
    }
    const json = (await res.json()) as { data?: Array<{ id: string; name?: string; context_length?: number; pricing?: { prompt?: string | number; completion?: string | number } }> };
    const rawList = Array.isArray(json.data) ? json.data : [];

    const curatedIds = new Set(CURATED_FREE_MODELS.map((m) => m.id));

    const liveFree: ModelInfo[] = [];

    for (const m of rawList) {
      const isFree =
        m.id === "openrouter/free" ||
        m.id.endsWith(":free") ||
        (m.pricing && String(m.pricing.prompt) === "0" && String(m.pricing.completion) === "0");

      if (
        isFree &&
        !curatedIds.has(m.id) &&
        !m.id.toLowerCase().includes("safety") &&
        !m.id.toLowerCase().includes("clip")
      ) {
        liveFree.push({
          id: m.id,
          name: (m.name || m.id).replace(/\s*\(free\)\s*/i, ""),
          context_length: m.context_length,
          badge: "Free",
          isFree: true,
          category: "live-free",
        });
      }
    }

    return {
      recommended: CURATED_FREE_MODELS,
      liveFree: liveFree.slice(0, 30),
      paid: PAID_POPULAR_MODELS,
    };
  } catch {
    return {
      recommended: CURATED_FREE_MODELS,
      liveFree: [],
      paid: PAID_POPULAR_MODELS,
    };
  }
}

/**
 * Format system prompts for educational & exam use cases
 */
export const SYSTEM_PROMPT_PRESETS: { id: string; label: string; prompt: string }[] = [
  {
    id: "tutor",
    label: "ExamPrep Tutor (Recommended)",
    prompt:
      "You are ExamForge AI, an expert academic tutor for school exams (Classes 9, 10, 11, 12). Provide clear, structured, accurate, and easy-to-understand explanations. Include formulas, definitions, key points, and examples where helpful.",
  },
  {
    id: "solver",
    label: "Step-by-Step Problem Solver",
    prompt:
      "You are a rigorous academic problem solver. Solve any math, science, or computer science problem step-by-step with clear reasoning, formulas, and verified final answers.",
  },
  {
    id: "question-gen",
    label: "Question & MCQ Generator",
    prompt:
      "You are an exam paper setter. When asked to generate questions, create high-quality exam-standard questions with clear marks, model answers, and explanations. For MCQs, provide 4 options (A, B, C, D) and indicate the correct answer with reasoning.",
  },
  {
    id: "concise",
    label: "Concise Exam Revision",
    prompt:
      "You are a high-yield exam revision assistant. Provide bulleted, high-impact answers optimized for quick memorization and exam revision without unnecessary fluff.",
  },
];

export interface OpenRouterCompletionOptions {
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  preferredModel?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  origin?: string;
}

/**
 * Executes a resilient completion call via OpenRouter with automatic fallback
 * across top-tier free models. Throws a clear error only if all candidate models fail.
 */
export async function callOpenRouterChatCompletion(
  options: OpenRouterCompletionOptions
): Promise<{ content: string; modelUsed: string; fallbackFrom?: string }> {
  // 1. Prioritize Gemini (1,500 free req/day) when in auto mode or using default backend keys
  const isAutoOrGemini =
    !options.preferredModel ||
    options.preferredModel === "auto" ||
    options.preferredModel.includes("gemini");

  if (!options.apiKey || isAutoOrGemini) {
    try {
      const geminiRes = await callGeminiChatCompletion({
        messages: options.messages,
        systemPrompt: options.systemPrompt,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
      if (geminiRes?.content) {
        return {
          content: geminiRes.content,
          modelUsed: geminiRes.modelUsed,
        };
      }
    } catch {
      // Fall through to OpenRouter candidate models
    }
  }

  const apiKey =
    (typeof options.apiKey === "string" && options.apiKey.trim()) ||
    getDefaultOpenRouterKey();

  if (!apiKey) {
    throw new Error(
      "Missing OpenRouter API key. Please configure OPENROUTER_API_KEY in your environment variables."
    );
  }

  // Determine candidate models
  let candidateModels: string[];
  if (options.preferredModel && options.preferredModel !== "auto") {
    candidateModels = [
      options.preferredModel,
      ...FALLBACK_CHAIN.filter((m) => m !== options.preferredModel),
    ];
  } else {
    candidateModels = [...FALLBACK_CHAIN];
  }

  const formattedMessages: Array<{ role: string; content: string }> = [];
  if (options.systemPrompt && options.systemPrompt.trim()) {
    formattedMessages.push({ role: "system", content: options.systemPrompt.trim() });
  }
  for (const m of options.messages) {
    if (m && m.role && m.content) {
      formattedMessages.push({ role: m.role, content: m.content });
    }
  }

  let lastError = "";

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": options.origin || "https://examforge.app",
          "X-Title": "ExamForge AI Assistant",
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const json = await res.json();
        const content =
          json.choices?.[0]?.message?.content ||
          json.choices?.[0]?.message?.reasoning ||
          "";
        if (content && typeof content === "string" && content.trim()) {
          return {
            content: content.trim(),
            modelUsed: model,
            fallbackFrom: i > 0 ? candidateModels[0] : undefined,
          };
        }
      } else {
        const errText = await res.text().catch(() => "");
        lastError = `Model ${model} returned ${res.status}: ${errText.slice(0, 150)}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Final rescue attempt: try Gemini if OpenRouter hit limits
  try {
    const rescueRes = await callGeminiChatCompletion({
      messages: options.messages,
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
    if (rescueRes?.content) {
      return {
        content: rescueRes.content,
        modelUsed: rescueRes.modelUsed,
        fallbackFrom: "openrouter",
      };
    }
  } catch {}

  throw new Error(
    lastError ||
      "All free AI models are currently busy or reached rate limits. Please try again in a few moments."
  );
}

