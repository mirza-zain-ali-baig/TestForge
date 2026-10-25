"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Maximize2,
  Send,
  Square,
  Sparkles,
  Copy,
  Trash2,
  ArrowDown,
  User,
  RotateCcw,
  Lock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChatMarkdown } from "./chat-markdown";
import { type ChatMessage } from "@/lib/openrouter";
import type { AuthUser } from "./lib";

interface FloatingChatWidgetProps {
  user?: AuthUser | null;
  onExpandToFullPage?: () => void;
  onSignIn?: () => void;
}

export function FloatingChatWidget({ user, onExpandToFullPage, onSignIn }: FloatingChatWidgetProps) {
  const userEmail = user?.email ? user.email.toLowerCase().trim() : "guest";
  const SESSIONS_KEY = `examforge_chat_sessions_${userEmail}`;
  const ACTIVE_KEY = `examforge_active_session_${userEmail}`;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Scroll tracking
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const isAtBottomRef = useRef(true);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync messages from localStorage scoped to user
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const activeId = localStorage.getItem(ACTIVE_KEY) || parsed[0].id;
          const current = parsed.find((s: { id: string }) => s.id === activeId) || parsed[0];
          setMessages(current.messages || []);
        }
      }
    } catch {}
  }, [isOpen, SESSIONS_KEY, ACTIVE_KEY]);

  const handleScroll = () => {
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 60;
    isAtBottomRef.current = atBottom;
    setShowScrollBottomBtn(!atBottom);
  };

  const scrollToBottom = (smooth = true) => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
      isAtBottomRef.current = true;
      setShowScrollBottomBtn(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [isOpen]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
    setMessages([]);
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const activeId = localStorage.getItem(ACTIVE_KEY);
        const updated = parsed.map((s: { id: string; messages: unknown[] }) =>
          s.id === activeId ? { ...s, messages: [] } : s
        );
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
      }
    } catch {}
    toast.success("Conversation cleared");
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (textToSend?: string) => {
    if (!user) {
      toast.error("Please sign in or create an account to chat with ExamForge AI.");
      onSignIn?.();
      return;
    }

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

    const assistantPlaceholderId = "a-" + Date.now();
    const initialAssistantMessage: ChatMessage = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      modelUsed: "ExamForge AI",
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage, initialAssistantMessage];
    setMessages(newMessages);
    setIsGenerating(true);
    isAtBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 50);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: "auto",
          systemPrompt:
            "You are ExamForge AI, an expert school exam tutor. Answer questions accurately and concisely. Render math using LaTeX ($...$ or $$...$$) and render comparisons using Markdown tables.",
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
        let assistantReasoning = "";
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

              const delta = parsed.choices?.[0]?.delta;
              const textChunk = delta?.content ?? delta?.text ?? parsed.choices?.[0]?.text ?? "";
              const reasoningChunk = delta?.reasoning ?? delta?.reasoning_content ?? "";

              if (reasoningChunk) {
                assistantReasoning += reasoningChunk;
              }

              if (textChunk) {
                assistantContent += textChunk;
              }

              if (textChunk || reasoningChunk) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantPlaceholderId
                      ? {
                          ...m,
                          content: assistantContent,
                          reasoning: assistantReasoning || undefined,
                          modelUsed: "ExamForge AI",
                        }
                      : m
                  )
                );

                if (isAtBottomRef.current) {
                  scrollToBottom(false);
                }
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message.includes("Model error")) {
                throw parseErr;
              }
            }
          }
        }

        // Persist completed chat to user sessions in localStorage
        try {
          const finalMessages = [
            ...messages,
            userMessage,
            {
              id: assistantPlaceholderId,
              role: "assistant" as const,
              content: assistantContent,
              reasoning: assistantReasoning || undefined,
              modelUsed: "ExamForge AI",
              timestamp: Date.now(),
            },
          ];
          const raw = localStorage.getItem(SESSIONS_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            const activeId = localStorage.getItem(ACTIVE_KEY) || parsed[0]?.id;
            const updated = parsed.map((s: { id: string; messages: unknown[] }) =>
              s.id === activeId ? { ...s, messages: finalMessages, updatedAt: Date.now() } : s
            );
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
          }
        } catch {}
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        // User aborted intentionally
      } else {
        const errorMsg = e instanceof Error ? e.message : "Failed to get AI response";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholderId
              ? {
                  ...m,
                  content: `⚠️ ${errorMsg}`,
                  isError: true,
                }
              : m
          )
        );
        toast.error(errorMsg);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <>
      {/* Floating Launcher Pill Button (Desktop & Tablet; on Mobile, Chat is accessible via Bottom Nav) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="no-print fixed hidden md:flex bottom-6 right-6 z-40 items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 active:scale-95 cursor-pointer border border-emerald-500/30"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="h-4 w-4" />
          <span>Ask ExamForge AI</span>
        </button>
      )}

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div className="no-print fixed bottom-20 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex h-[min(540px,calc(100vh-140px))] sm:h-[580px] w-auto sm:w-[390px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-opacity">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-xs font-bold text-foreground">ExamForge AI</h3>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-600">
                    Free
                  </Badge>
                </div>
                <p className="truncate text-[10px] text-muted-foreground">
                  {user?.email || "Guest Session"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  title="Clear conversation"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              {onExpandToFullPage && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onExpandToFullPage();
                  }}
                  title="Open full page chat"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div
            ref={chatScrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar bg-background text-xs"
          >
            {!user ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-4 my-auto">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-2.5">
                  <Lock className="h-5 w-5" />
                </div>
                <p className="font-semibold text-foreground text-xs">Sign In Required</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px] leading-relaxed">
                  Please sign in or create an account to chat with ExamForge AI, ask questions, and solve exam problems.
                </p>
                <Button
                  size="sm"
                  onClick={onSignIn}
                  className="mt-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
                >
                  Sign In / Register
                </Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 mb-2">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="font-semibold text-foreground text-xs">Hi! How can I help you today?</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px]">
                  Ask about formulas, definitions, questions, or get step-by-step solutions.
                </p>
                <div className="mt-4 flex flex-col gap-1.5 w-full">
                  <button
                    onClick={() => handleSend("Explain Newton's second law with formula")}
                    className="flex items-center gap-2 rounded-lg border border-border p-2 text-left text-[11px] text-muted-foreground hover:border-emerald-500 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Explain Newton&apos;s second law with formula</span>
                  </button>
                  <button
                    onClick={() => handleSend("Give 3 MCQs on Computer Networks with answers")}
                    className="flex items-center gap-2 rounded-lg border border-border p-2 text-left text-[11px] text-muted-foreground hover:border-emerald-500 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span>Generate 3 MCQs on Computer Networks</span>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-2 ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isUser
                          ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {isUser ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                    </div>

                    <div
                      className={`group relative min-w-0 max-w-[88%] sm:max-w-[85%] break-words overflow-hidden rounded-xl px-3 py-2 text-xs ${
                        isUser
                          ? "bg-emerald-600 text-white rounded-tr-none shadow-xs"
                          : m.isError
                          ? "bg-destructive/10 text-destructive rounded-tl-none"
                          : "bg-muted/60 text-foreground rounded-tl-none shadow-xs"
                      }`}
                    >
                      {!isUser && (
                        <div className="mb-1 flex items-center justify-between pb-0.5 text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">ExamForge AI</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(m.id || "", m.content)}
                            title="Copy message"
                            className="opacity-70 group-hover:opacity-100 transition p-0.5"
                          >
                            {copiedId === m.id ? (
                              <Copy className="h-2.5 w-2.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-2.5 w-2.5" />
                            )}
                          </button>
                        </div>
                      )}

                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      ) : !m.content && !m.reasoning && isGenerating && m.id === messages[messages.length - 1]?.id ? (
                        <div className="flex items-center gap-1.5 py-1 text-muted-foreground text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                          <span>Thinking...</span>
                        </div>
                      ) : (
                        <ChatMarkdown
                          content={m.content}
                          reasoning={m.reasoning}
                          isStreaming={isGenerating && m.id === messages[messages.length - 1]?.id}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Floating Scroll Bottom Button */}
          {showScrollBottomBtn && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-16 right-4 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-md text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Scroll to bottom"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Input Footer */}
          <div className="border-t border-border bg-card/60 p-2.5">
            {!user ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 px-3 py-2 text-xs">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  Sign in to chat with AI
                </span>
                <Button
                  size="sm"
                  onClick={onSignIn}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  Sign In
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-end gap-1.5 rounded-xl border border-border bg-background p-1.5 shadow-none outline-none focus-within:ring-0 focus-within:border-border"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask ExamForge AI... (Enter to send)"
                  rows={1}
                  className="chat-input-textarea min-h-[34px] max-h-[100px] flex-1 resize-none bg-transparent px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-none"
                  style={{
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                  }}
                />
                {isGenerating ? (
                  <Button
                    type="button"
                    onClick={handleStop}
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!input.trim()}
                    className="h-8 w-8 shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
