import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_OPENROUTER_API_KEY,
  FALLBACK_CHAIN,
  CURATED_FREE_MODELS,
  fetchLiveOpenRouterModels,
} from "@/lib/openrouter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/chat
 * Returns available models categorized for the frontend selector.
 */
export async function GET() {
  try {
    const data = await fetchLiveOpenRouterModels();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      recommended: CURATED_FREE_MODELS,
      liveFree: [],
      paid: [],
    });
  }
}

/**
 * POST /api/chat
 * Handles chat completions with smart model selection and automatic fallback.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages = [],
      model = "auto",
      apiKey: userApiKey,
      systemPrompt,
      stream = true,
    } = body;

    const clientKey =
      typeof userApiKey === "string" &&
      userApiKey.trim() &&
      userApiKey.trim() !== DEFAULT_OPENROUTER_API_KEY
        ? userApiKey.trim()
        : null;

    const apiKey =
      clientKey ||
      process.env.OPENROUTER_API_KEY?.trim() ||
      DEFAULT_OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing OpenRouter API key. Click the Key icon in AI Chat to paste your free OpenRouter API key, or set OPENROUTER_API_KEY in Vercel.",
        },
        { status: 401 }
      );
    }

    // Determine sequence of models to try
    let candidateModels: string[];
    const isAuto = !model || model === "auto";

    if (isAuto) {
      candidateModels = [...FALLBACK_CHAIN];
    } else {
      // If user selected a specific model, try it first, but fallback to free router if it fails
      candidateModels = [model];
      if (model.endsWith(":free") || model === "openrouter/free") {
        candidateModels.push("openrouter/free");
      }
    }

    // Build payload messages
    const formattedMessages: Array<{ role: string; content: string }> = [];
    if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim()) {
      formattedMessages.push({ role: "system", content: systemPrompt.trim() });
    }
    for (const m of messages) {
      if (m && m.role && m.content) {
        formattedMessages.push({ role: m.role, content: m.content });
      }
    }

    let activeModel = candidateModels[0];
    let fallbackFrom: string | undefined = undefined;
    let successfulResponse: Response | null = null;
    let lastError: string | null = null;

    // Loop through candidates to find one that succeeds
    for (let i = 0; i < candidateModels.length; i++) {
      const candidate = candidateModels[i];
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": req.headers.get("origin") || "https://examforge.app",
            "X-Title": "ExamForge AI Assistant",
          },
          body: JSON.stringify({
            model: candidate,
            messages: formattedMessages,
            stream: stream,
          }),
          signal: AbortSignal.timeout(25000),
        });

        if (res.ok) {
          activeModel = candidate;
          if (i > 0) {
            fallbackFrom = candidateModels[0];
          }
          successfulResponse = res;
          break;
        } else {
          // Model error (e.g. 429 rate limit, 503 capacity, 404 deprecated)
          const errText = await res.text().catch(() => "");
          if (res.status === 429) {
            lastError =
              "OpenRouter daily free-tier limit reached (50 requests/day). Click the Key icon at the top to enter your personal OpenRouter API key (free at openrouter.ai/keys) or upgrade credits.";
          } else {
            lastError = `Model ${candidate} returned ${res.status}: ${errText.slice(0, 150)}`;
          }
          // continue to next candidate
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!successfulResponse) {
      return NextResponse.json(
        {
          error:
            lastError ||
            "All free models are currently at capacity. Please try again in a few moments or click the Key icon to provide your personal OpenRouter key.",
        },
        { status: 503 }
      );
    }

    // If streaming was requested
    if (stream && successfulResponse.body) {
      const upstreamBody = successfulResponse.body;
      const encoder = new TextEncoder();

      // Transform stream to inject model metadata at the start
      const transformStream = new TransformStream({
        start(controller) {
          // First chunk announces model metadata
          const metaChunk = `data: ${JSON.stringify({
            meta: {
              model: activeModel,
              fallbackFrom: fallbackFrom || null,
            },
          })}\n\n`;
          controller.enqueue(encoder.encode(metaChunk));
        },
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
      });

      const readable = upstreamBody.pipeThrough(transformStream);

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Non-streaming JSON response
    const json = await successfulResponse.json();
    const reply =
      json.choices?.[0]?.message?.content ||
      json.choices?.[0]?.message?.reasoning ||
      "";
    const reasoning = json.choices?.[0]?.message?.reasoning || null;
    return NextResponse.json({
      reply,
      reasoning,
      modelUsed: activeModel,
      fallbackFrom: fallbackFrom || null,
      usage: json.usage || null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
