"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Maximize2,
  Send,
  Square,
  Sparkles,
  Bot,
  Copy,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChatMarkdown } from "./chat-markdown";
import { getDefaultOpenRouterKey, type ChatMessage } from "@/lib/openrouter";

interface FloatingChatWidgetProps {
  onExpandToFullPage?: () => void;
}

export function FloatingChatWidget({ onExpandToFullPage }: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeModel, setActiveModel] = useState("auto");

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync messages from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("examforge_chat_history");
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
      const savedModel = localStorage.getItem("examforge_or_model");
      if (savedModel) setActiveModel(savedModel);
    } catch {}
  }, [isOpen]);

  // Persist messages
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
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, scrollToBottom]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    try {
      localStorage.removeItem("examforge_chat_history");
    } catch {}
    toast.success("Conversation cleared");
  };

  const handleSend = async (textToSend?: string) => {
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
    const initialAssistantMessage: ChatMessage = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      modelUsed: "Best Free Model",
      timestamp: Date.now(),
    };

    setMessages([...newMessages, initialAssistantMessage]);
    setIsGenerating(true);

    abortControllerRef.current = new AbortController();

    try {
      const savedKey =
        (typeof window !== "undefined" && localStorage.getItem("examforge_or_key")) ||
        getDefaultOpenRouterKey();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: activeModel,
          apiKey: savedKey,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Server error (${response.status})`);
      }

      if (response.body) {
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
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (!trimmed.startsWith("data:")) continue;

            const payloadStr = trimmed.slice(5).trim();
            if (payloadStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payloadStr);

              if (parsed.error) {
                throw new Error(parsed.error.message || "Model error");
              }

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

              const delta = parsed.choices?.[0]?.delta;
              const textChunk = delta?.content ?? delta?.text ?? parsed.choices?.[0]?.text ?? "";
              const reasoningChunk = delta?.reasoning ?? "";

              if (textChunk) {
                assistantContent += textChunk;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantPlaceholderId
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              } else if (reasoningChunk && !assistantContent) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantPlaceholderId
                      ? { ...m, content: (m.content || "") + reasoningChunk }
                      : m
                  )
                );
              }
            } catch (err) {
              if (err instanceof Error && err.message.includes("Model error")) {
                throw err;
              }
            }
          }
        }

        if (!assistantContent.trim()) {
          try {
            const fallbackRes = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
                model: activeModel,
                apiKey: savedKey,
                stream: false,
              }),
            });
            if (fallbackRes.ok) {
              const data = await fallbackRes.json();
              if (data.reply) {
                assistantContent = data.reply;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantPlaceholderId
                      ? {
                          ...m,
                          content: assistantContent,
                          modelUsed: data.modelUsed || m.modelUsed,
                          fallbackFrom: data.fallbackFrom || m.fallbackFrom,
                        }
                      : m
                  )
                );
              }
            }
          } catch {}
        }

        if (!assistantContent) {
          assistantContent = "*(The model didn't return text. Please try asking again or switch model from the full Chat page.)*";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantPlaceholderId ? { ...m, content: assistantContent } : m
            )
          );
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholderId
              ? { ...m, content: (m.content || "") + "\n\n*[Stopped]*" }
              : m
          )
        );
      } else {
        const errMsg = (err as Error)?.message || "Failed to generate";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholderId
              ? {
                  ...m,
                  content: `⚠️ ${errMsg}`,
                  isError: true,
                }
              : m
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Floating Popup Window */}
      {isOpen && (
        <div className="mb-3 flex h-[540px] w-[360px] sm:w-[410px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-muted/50 px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-foreground truncate">
                    ExamForge AI
                  </span>
                  <Badge
                    variant="outline"
                    className="h-4 px-1.5 text-[9px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 gap-0.5"
                  >
                    <Zap className="h-2.5 w-2.5 fill-current" /> Free
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                title="Clear chat"
                onClick={handleClear}
                disabled={messages.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              {onExpandToFullPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Expand to Full Page"
                  onClick={() => {
                    setIsOpen(false);
                    onExpandToFullPage();
                  }}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Close"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-4 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-xs">Exam Assistant</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Ask questions, verify formulas, or draft test questions.
                  </p>
                </div>

                <div className="space-y-1.5 w-full pt-1">
                  <button
                    type="button"
                    onClick={() => handleSend("Explain the difference between compiler and interpreter in 3 points.")}
                    className="w-full text-left rounded-lg border border-border/80 bg-background/50 p-2 text-[11px] text-foreground hover:border-emerald-500/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition"
                  >
                    💡 Compiler vs Interpreter (3 points)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Generate 3 multiple-choice questions on Database Keys with answers.")}
                    className="w-full text-left rounded-lg border border-border/80 bg-background/50 p-2 text-[11px] text-foreground hover:border-emerald-500/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition"
                  >
                    📝 3 MCQs on Database Keys
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("Explain photosynthesis in simple words with its chemical equation.")}
                    className="w-full text-left rounded-lg border border-border/80 bg-background/50 p-2 text-[11px] text-foreground hover:border-emerald-500/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition"
                  >
                    🌿 Photosynthesis & equation
                  </button>
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id || m.timestamp}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-xl px-3 py-2 leading-relaxed ${
                        isUser
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium"
                          : m.isError
                          ? "border border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200"
                          : "border bg-background text-foreground"
                      }`}
                    >
                      {!isUser && (
                        <div className="mb-1 flex items-center justify-between border-b pb-1 text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground truncate max-w-[180px]">
                            {m.modelUsed || "AI Tutor"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(m.content);
                              toast.success("Copied");
                            }}
                            className="hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      ) : m.content ? (
                        <ChatMarkdown content={m.content} />
                      ) : (
                        <div className="flex items-center gap-1 py-1 text-muted-foreground">
                          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
                          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
                          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Footer Composer */}
          <div className="border-t bg-muted/20 p-2.5">
            <div className="relative flex items-end gap-1.5 rounded-xl border bg-background p-1.5 shadow-xs focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20">
              <Textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI anything..."
                className="min-h-[32px] max-h-24 flex-1 resize-none border-0 bg-transparent px-1.5 py-1 text-xs leading-relaxed shadow-none focus-visible:ring-0"
              />

              {isGenerating ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleStop}
                  className="h-7 w-7 rounded-lg p-0"
                >
                  <Square className="h-3 w-3 fill-current" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!input.trim()}
                  onClick={() => handleSend()}
                  className="h-7 w-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white p-0 shadow-xs disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Launcher Button */}
      <Button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl transition-all duration-200 hover:scale-105 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        title="Open AI Chatbox"
      >
        {isOpen ? (
          <X className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
        ) : (
          <>
            <Bot className="h-6 w-6" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 border border-white dark:border-slate-900" />
            </span>
          </>
        )}
      </Button>
    </div>
  );
}
