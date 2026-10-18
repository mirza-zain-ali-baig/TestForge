/**
 * Google AI Studio / Gemini Integration for ExamForge
 * Provides 1,500 requests/day free tier with high speed, no 50/day cutoff,
 * and OpenAI-compatible SSE streaming conversion for seamless frontend compatibility.
 */

const BACKEND_GEMINI_B64 =
  "QVEuQWI4Uk42TERXdjRWbktOeEpVWHoxVU53ak9oaXVINGNidHZsdURsRVhpaFdoeUt1ZXc=";

export const BACKEND_GEMINI_KEY =
  typeof Buffer !== "undefined"
    ? Buffer.from(BACKEND_GEMINI_B64, "base64").toString("utf-8")
    : typeof atob === "function"
    ? atob(BACKEND_GEMINI_B64)
    : "";

export function getGeminiApiKey(): string {
  if (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) {
    const envKey = process.env.GEMINI_API_KEY.trim();
    if (envKey) return envKey;
  }
  return BACKEND_GEMINI_KEY;
}

export const GEMINI_PRIMARY_MODEL = "gemini-flash-lite-latest";
export const GEMINI_BACKUP_MODEL = "gemma-4-26b-a4b-it";

export interface GeminiMessage {
  role: string;
  content: string;
}

export interface GeminiCompletionOptions {
  messages: GeminiMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  responseMimeType?: string;
  preferredModel?: string;
}

export interface GeminiContentPart {
  text: string;
}

export interface GeminiContentItem {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

/**
 * Transforms standard chat messages into Gemini's strictly alternating turn format
 */
export function formatGeminiContents(messages: GeminiMessage[]): GeminiContentItem[] {
  const contents: GeminiContentItem[] = [];

  for (const m of messages) {
    if (!m || !m.content || !m.content.trim()) continue;
    const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
    const text = m.content.trim();

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      // Merge consecutive same-role messages
      contents[contents.length - 1].parts[0].text += "\n\n" + text;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  // Gemini requires the first turn to be 'user'
  if (contents.length > 0 && contents[0].role === "model") {
    contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
  }

  return contents;
}

/**
 * Executes a resilient non-streaming Gemini completion call with automatic model fallback
 */
export async function callGeminiChatCompletion(
  options: GeminiCompletionOptions
): Promise<{ content: string; modelUsed: string }> {
  const apiKey = options.apiKey?.trim() || getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key.");
  }

  const modelsToTry = [
    options.preferredModel || GEMINI_PRIMARY_MODEL,
    GEMINI_BACKUP_MODEL,
  ];

  const contents = formatGeminiContents(options.messages);
  if (contents.length === 0) {
    throw new Error("Cannot send empty messages to Gemini.");
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 2048,
    },
  };

  if (options.systemPrompt && options.systemPrompt.trim()) {
    payload.system_instruction = {
      parts: [{ text: options.systemPrompt.trim() }],
    };
  }

  if (options.responseMimeType) {
    (payload.generationConfig as Record<string, unknown>).response_mime_type =
      options.responseMimeType;
  }

  let lastError = "";

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const json = await res.json();
        const text =
          json?.candidates?.[0]?.content?.parts?.[0]?.text ||
          json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ||
          "";

        if (text && typeof text === "string" && text.trim()) {
          return {
            content: text.trim(),
            modelUsed: model,
          };
        }
      } else {
        const errText = await res.text().catch(() => "");
        lastError = `Gemini (${model}) status ${res.status}: ${errText.slice(0, 150)}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastError || "Failed to generate completion from Gemini.");
}

/**
 * Connects to Gemini streamGenerateContent SSE endpoint and transforms chunks
 * into OpenAI-compatible format ({ choices: [{ delta: { content } }] })
 * so the frontend requires zero changes.
 */
export async function streamGeminiChatCompletion(
  options: GeminiCompletionOptions
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = options.apiKey?.trim() || getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key.");
  }

  const model = options.preferredModel || GEMINI_PRIMARY_MODEL;
  const contents = formatGeminiContents(options.messages);

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 2048,
    },
  };

  if (options.systemPrompt && options.systemPrompt.trim()) {
    payload.system_instruction = {
      parts: [{ text: options.systemPrompt.trim() }],
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini stream failed (${res.status}): ${errText.slice(0, 150)}`);
  }

  if (!res.body) {
    throw new Error("No response body received from Gemini stream.");
  }

  const upstreamReader = res.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let sseBuffer = "";
  let metaSent = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // Send initial meta chunk indicating model
      if (!metaSent) {
        metaSent = true;
        const metaEvent = `data: ${JSON.stringify({
          meta: {
            model: "ExamForge AI",
            provider: "gemini",
          },
        })}\n\n`;
        controller.enqueue(encoder.encode(metaEvent));
      }
    },

    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read();

        if (done) {
          // Send final [DONE] marker
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
              const openAiChunk = `data: ${JSON.stringify({
                choices: [
                  {
                    delta: {
                      content: text,
                    },
                  },
                ],
              })}\n\n`;
              controller.enqueue(encoder.encode(openAiChunk));
            }
          } catch {
            // ignore non-json SSE lines
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },

    cancel() {
      upstreamReader.cancel();
    },
  });
}
