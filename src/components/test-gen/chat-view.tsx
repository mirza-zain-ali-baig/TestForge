"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  Send,
  Square,
  Sparkles,
  Settings,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChatMarkdown } from "./chat-markdown";
import {
  CURATED_FREE_MODELS,
  SYSTEM_PROMPT_PRESETS,
  getDefaultOpenRouterKey,
  type ChatMessage,
  type ModelInfo,
} from "@/lib/openrouter";

const STARTER_PROMPTS = [
  {
    title: "Explain Concept Simply",
    desc: "Newton's 3 Laws with daily life examples",
    prompt: "Explain Newton's three laws of motion in simple terms with everyday examples for a 9th class student.",
  },
  {
    title: "Generate Exam MCQs",
    desc: "5 Computer Science MCQs with answer key",
    prompt:
      "Generate 5 high-yield multiple-choice questions (MCQs) for 10th class Computer Science on 'Functions and Loops'. Include 4 options and provide the correct option with a concise explanation.",
  },
  {
    title: "Step-by-Step Problem Solving",
    desc: "Quadratic Equation math solution",
    prompt: "Solve the quadratic equation step-by-step: 2x² - 7x + 3 = 0 using both factorization and the quadratic formula.",
  },
  {
    title: "Short Question & Model Answer",
    desc: "3-mark board exam standard answer",
    prompt:
      "Write a 3-mark short question and a model answer on 'Difference between RAM and ROM' suitable for board exam preparation.",
  },
];

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeModel, setActiveModel] = useState("auto");
  const [customModelId, setCustomModelId] = useState("");
  const [models, setModels] = useState<{
    recommended: ModelInfo[];
    liveFree: ModelInfo[];
    paid: ModelInfo[];
  }>({
    recommended: CURATED_FREE_MODELS,
    liveFree: [],
    paid: [],
  });

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("tutor");
  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT_PRESETS[0].prompt);
  const [useStream, setUseStream] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("examforge_or_key");
      if (savedKey) {
        setApiKey(savedKey);
      } else {
        const defaultKey = getDefaultOpenRouterKey();
        if (defaultKey) setApiKey(defaultKey);
      }

      const savedModel = localStorage.getItem("examforge_or_model");
      if (savedModel) setActiveModel(savedModel);

      const savedHistory = localStorage.getItem("examforge_chat_history");
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }

    // Fetch models list from API
    fetch("/api/chat")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.recommended) {
          setModels(data);
        }
      })
      .catch(() => {});
  }, []);

  // Save history on change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem("examforge_chat_history", JSON.stringify(messages));
      } catch {}
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleModelChange = (val: string) => {
    setActiveModel(val);
    try {
      localStorage.setItem("examforge_or_model", val);
    } catch {}
  };

  const handleSaveApiKey = (keyVal: string) => {
    setApiKey(keyVal);
    try {
      localStorage.setItem("examforge_or_key", keyVal.trim());
    } catch {}
  };

  const handleClearHistory = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    try {
      localStorage.removeItem("examforge_chat_history");
    } catch {}
    toast.success("Chat conversation cleared");
  };

  const handlePresetSelect = (id: string) => {
    setSelectedPresetId(id);
    const p = SYSTEM_PROMPT_PRESETS.find((preset) => preset.id === id);
    if (p) {
      setSystemPrompt(p.prompt);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || isGenerating) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMessage: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    const assistantPlaceholderId = "a-" + Date.now();
    const modelToUse = activeModel === "custom" ? customModelId.trim() || "auto" : activeModel;

    const initialAssistantMessage: ChatMessage = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      modelUsed: modelToUse === "auto" ? "Best Free Model" : modelToUse,
      timestamp: Date.now(),
    };

    setMessages([...newMessages, initialAssistantMessage]);
    setIsGenerating(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: modelToUse,
          apiKey: apiKey.trim(),
          systemPrompt: systemPrompt.trim(),
          stream: useStream,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with ${response.status}`);
      }

      if (useStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue; // Skip comments/keepalives
            if (!trimmed.startsWith("data:")) continue;

            const payloadStr = trimmed.slice(5).trim();
            if (payloadStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payloadStr);

              // Check for metadata chunk
              if (parsed.meta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantPlaceholderId
                      ? {
                          ...m,
                          modelUsed: parsed.meta.model,
                          fallbackFrom: parsed.meta.fallbackFrom,
                        }
                      : m
                  )
                );
                continue;
              }

              // Text delta
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantPlaceholderId
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }

        if (!assistantContent) {
          assistantContent = "*(No response generated)*";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantPlaceholderId ? { ...m, content: assistantContent } : m
            )
          );
        }
      } else {
        const data = await response.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholderId
              ? {
                  ...m,
                  content: data.reply || "*(No response generated)*",
                  modelUsed: data.modelUsed,
                  fallbackFrom: data.fallbackFrom,
                }
              : m
          )
        );
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholderId
              ? {
                  ...m,
                  content: (m.content || "") + "\n\n*[Generation stopped by user]*",
                }
              : m
          )
        );
      } else {
        const errorMsg = (err as Error)?.message || "Failed to generate answer";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholderId
              ? {
                  ...m,
                  content: `⚠️ **Error:** ${errorMsg}\n\n*Tip:* You can change the model from the selector above, or verify your OpenRouter API key in settings.`,
                  isError: true,
                }
              : m
          )
        );
        toast.error("Generation failed: " + errorMsg);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Message copied to clipboard");
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[500px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                ExamForge AI Tutor
              </h2>
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold"
              >
                <Zap className="h-3 w-3 fill-emerald-500 text-emerald-500" /> Free AI Active
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Always routes to the highest-quality free models on OpenRouter
            </p>
          </div>
        </div>

        {/* Model Selector & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              aria-label="Select AI Model"
              value={activeModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="h-8 max-w-[170px] truncate rounded-lg border bg-background px-2.5 pr-7 text-xs font-medium text-foreground shadow-xs transition hover:bg-accent focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:max-w-[260px]"
            >
              <optgroup label="⭐ Recommended (Always Free)">
                <option value="auto">Auto (Best Free Model + Fallback)</option>
                {models.recommended.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.badge ? `(${m.badge})` : ""}
                  </option>
                ))}
              </optgroup>

              {models.liveFree.length > 0 && (
                <optgroup label="🌐 Live Free Models (OpenRouter)">
                  {models.liveFree.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Free)
                    </option>
                  ))}
                </optgroup>
              )}

              <optgroup label="💎 Paid Models (Requires Credits)">
                {models.paid.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>

              <option value="custom">Custom Model ID…</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          {activeModel === "custom" && (
            <Input
              value={customModelId}
              onChange={(e) => setCustomModelId(e.target.value)}
              placeholder="e.g. meta-llama/llama-3.3-70b-instruct"
              className="h-8 w-36 text-xs sm:w-48 font-mono"
            />
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="Settings & API Key"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
            title="Clear Chat"
            onClick={handleClearHistory}
            disabled={messages.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="mt-3 text-lg font-bold text-foreground">
              What would you like to learn or solve today?
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md">
              Ask any question, generate practice tests, solve complex problems step-by-step, or get
              concise exam revision notes.
            </p>

            {/* Starter Chips */}
            <div className="mt-6 grid grid-cols-1 gap-2.5 text-left sm:grid-cols-2 w-full">
              {STARTER_PROMPTS.map((starter, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(starter.prompt)}
                  className="group flex flex-col justify-between rounded-xl border border-border/80 bg-background/60 p-3.5 transition hover:border-emerald-500/50 hover:bg-emerald-50/40 hover:shadow-xs dark:hover:bg-emerald-950/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      {starter.title}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                  </div>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    {starter.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id || m.timestamp}
                className={`flex ${isUser ? "justify-end" : "justify-start"} group`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                    isUser
                      ? "rounded-tr-xs bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium"
                      : m.isError
                      ? "rounded-tl-xs border border-rose-500/40 bg-rose-50/60 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200"
                      : "rounded-tl-xs border bg-background text-foreground"
                  }`}
                >
                  {/* Assistant Header */}
                  {!isUser && (
                    <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-semibold text-foreground truncate">
                          {m.modelUsed || "AI Assistant"}
                        </span>
                        {m.fallbackFrom && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          >
                            Auto-Fallback
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyMessage(m.content)}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="Copy message"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                  )}

                  {/* Message Content */}
                  {isUser ? (
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {m.content}
                    </div>
                  ) : m.content ? (
                    <ChatMarkdown content={m.content} />
                  ) : (
                    <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
                      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
                      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
                      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-emerald-500" />
                      <span className="ml-1 text-[11px]">Thinking & generating...</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Composer Input Footer */}
      <div className="border-t bg-muted/20 p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="mx-auto max-w-4xl"
        >
          <div className="relative flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-xs transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <Textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask ExamForge anything... (Press Enter to send, Shift+Enter for new line)"
              className="min-h-[40px] max-h-40 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed shadow-none focus-visible:ring-0"
            />

            {isGenerating ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleStop}
                className="h-9 gap-1 rounded-xl px-3 font-semibold shadow-xs"
              >
                <Square className="h-3.5 w-3.5 fill-current" /> Stop
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim()}
                className="h-9 w-9 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-0 text-white shadow-xs transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-muted-foreground">
            <span>
              Model:{" "}
              <strong className="text-foreground font-mono">
                {activeModel === "auto" ? "Auto Free (Cascading)" : activeModel}
              </strong>
            </span>
            <span>Shift + Enter for new line</span>
          </div>
        </form>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings className="h-5 w-5 text-emerald-600" /> AI & OpenRouter Configuration
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage your OpenRouter API key, model settings, and tutor instructions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">OpenRouter API Key</Label>
              <div className="relative flex items-center">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="pr-16 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Configured with your free-tier key. Requests route through OpenRouter.
              </p>
            </div>

            {/* System Prompt Preset */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tutor Persona / Preset</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {SYSTEM_PROMPT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetSelect(p.id)}
                    className={`rounded-lg border p-2 text-left transition ${
                      selectedPresetId === p.id
                        ? "border-emerald-600 bg-emerald-50/50 font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="truncate font-medium">{p.label}</div>
                  </button>
                ))}
              </div>
              <Textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => {
                  setSystemPrompt(e.target.value);
                  setSelectedPresetId("custom");
                }}
                className="mt-1 text-xs"
                placeholder="Custom system instructions..."
              />
            </div>

            {/* Stream Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div>
                <div className="font-semibold text-foreground">Real-time Streaming</div>
                <div className="text-[11px] text-muted-foreground">
                  Stream words token-by-token as they generate
                </div>
              </div>
              <Switch checked={useStream} onCheckedChange={setUseStream} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" onClick={() => setSettingsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
