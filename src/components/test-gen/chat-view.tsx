"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Square,
  Sparkles,
  Trash2,
  Copy,
  Check,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Plus,
  User,
  RotateCcw,
  AlertCircle,
  ArrowLeft,
  Clock,
  X,
  Paperclip,
  Lightbulb,
  ListChecks,
  Calculator,
  PenTool,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChatMarkdown } from "./chat-markdown";
import { type ChatMessage } from "@/lib/openrouter";
import type { AuthUser } from "./lib";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  model?: string;
}

const STARTER_PROMPTS = [
  {
    title: "Explain a concept simply",
    desc: "RAM vs ROM & memory hierarchy",
    icon: Lightbulb,
    prompt:
      "Explain the differences between RAM and ROM, volatile vs non-volatile memory, and why cache memory is needed, using simple everyday analogies for a 9th class Computer Science student.",
  },
  {
    title: "Generate exam MCQs",
    desc: "Functions & loops in Python",
    icon: ListChecks,
    prompt:
      "Generate 5 high-yield multiple-choice questions (MCQs) for 10th class Computer Science on 'Functions and Loops in Python'. Include 4 options and provide the correct option with a concise explanation.",
  },
  {
    title: "Solve step by step",
    desc: "Binary, hex & number conversions",
    icon: Calculator,
    prompt:
      "Convert the decimal number 218 into 8-bit Binary and Hexadecimal step-by-step. Also show its 2's complement representation with clear working.",
  },
  {
    title: "Short question & model answer",
    desc: "Von Neumann architecture (3 marks)",
    icon: PenTool,
    prompt:
      "Write a 3-mark board exam standard short question and a complete model answer on 'Von Neumann Architecture and the role of ALU, CU, and Registers'.",
  },
];

interface ChatViewProps {
  user?: AuthUser | null;
  onBack?: () => void;
  fullWindow?: boolean;
  onSignIn?: () => void;
}

export function ChatView({ user, onBack, fullWindow = false, onSignIn }: ChatViewProps) {
  const userEmail = user?.email ? user.email.toLowerCase().trim() : "guest";
  const SESSIONS_KEY = `examforge_chat_sessions_${userEmail}`;
  const ACTIVE_KEY = `examforge_active_session_${userEmail}`;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Default sidebar closed on mobile screens
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

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

  // Active session and its messages
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages ?? [];

  // Helper to create a new session
  const createNewSession = useCallback((customTitle?: string): ChatSession => {
    return {
      id: "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      title: customTitle || "New conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      model: "auto",
    };
  }, []);

  // Cloud sync helper
  const syncSessionToCloud = useCallback((sess: ChatSession) => {
    if (!userEmail) return;
    fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, session: sess }),
    }).catch(() => {});
  }, [userEmail]);

  // Load sessions on mount or when user changes
  useEffect(() => {
    let isCancelled = false;
    let currentNewId = "";

    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      let toSet: ChatSession[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          toSet = parsed;
        }
      }

      // Check if an empty session already exists
      const existingEmpty = toSet.find((s) => !s.messages || s.messages.length === 0);
      if (existingEmpty) {
        currentNewId = existingEmpty.id;
        const others = toSet.filter((s) => s.id !== existingEmpty.id);
        setSessions([existingEmpty, ...others]);
        setActiveSessionId(existingEmpty.id);
      } else {
        const fresh = createNewSession();
        currentNewId = fresh.id;
        setSessions([fresh, ...toSet]);
        setActiveSessionId(fresh.id);
      }
    } catch {
      const fresh = createNewSession();
      currentNewId = fresh.id;
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    }

    // Fetch cloud sessions in background
    if (userEmail) {
      fetch(`/api/chat/sessions?email=${encodeURIComponent(userEmail)}`)
        .then((r) => r.json())
        .then((data) => {
          if (isCancelled) return;
          if (Array.isArray(data.sessions) && data.sessions.length > 0) {
            setSessions((prev) => {
              const active = prev.find((s) => s.id === currentNewId);
              if (active) {
                const cloudOthers = data.sessions.filter((s: ChatSession) => s.id !== currentNewId);
                return [active, ...cloudOthers];
              }
              return data.sessions;
            });
          }
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
    };
  }, [SESSIONS_KEY, createNewSession, userEmail]);

  // Persist sessions
  useEffect(() => {
    if (sessions.length > 0) {
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      } catch {}
    }
  }, [sessions, SESSIONS_KEY]);

  // Persist active session id
  useEffect(() => {
    if (activeSessionId) {
      try {
        localStorage.setItem(ACTIVE_KEY, activeSessionId);
      } catch {}
    }
  }, [activeSessionId, ACTIVE_KEY]);

  // Handle scroll detection
  const handleScroll = () => {
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 70;
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

  // Switch session
  const handleSelectSession = (id: string) => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
    setActiveSessionId(id);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    setTimeout(() => scrollToBottom(false), 50);
  };

  // Add new session
  const handleNewChat = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }

    // If current session is already completely empty, reuse it
    if (activeSession && (!activeSession.messages || activeSession.messages.length === 0)) {
      setInput("");
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
      setTimeout(() => textareaRef.current?.focus(), 50);
      return;
    }

    // Check for any existing empty session
    const existingEmpty = sessions.find((s) => !s.messages || s.messages.length === 0);
    if (existingEmpty) {
      setActiveSessionId(existingEmpty.id);
      setInput("");
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
      setTimeout(() => textareaRef.current?.focus(), 50);
      return;
    }

    const fresh = createNewSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setInput("");
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    setTimeout(() => {
      textareaRef.current?.focus();
      scrollToBottom(false);
    }, 50);
  };

  // Delete session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (userEmail) {
      fetch(`/api/chat/sessions?id=${encodeURIComponent(id)}&email=${encodeURIComponent(userEmail)}`, {
        method: "DELETE",
      }).catch(() => {});
    }

    const remaining = sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const fresh = createNewSession();
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    } else {
      setSessions(remaining);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
    }
    toast.success("Conversation removed");
  };

  // Clear current chat
  const handleClearCurrentChat = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [], updatedAt: Date.now() }
          : s
      )
    );
    toast.success("Conversation cleared");
  };

  // Stop generation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  // Copy message
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    if (!user) {
      toast.info("Please sign in or create an account to chat with ExamForge AI.");
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

    const updatedMessages = [...messages, userMessage, initialAssistantMessage];

    // Determine session title
    const currentTitle =
      activeSession?.messages.length === 0
        ? prompt.slice(0, 34) + (prompt.length > 34 ? "…" : "")
        : activeSession?.title || "Conversation";

    let targetSessionId = activeSessionId;
    if (!targetSessionId || !sessions.some((s) => s.id === targetSessionId)) {
      const fresh = createNewSession(currentTitle);
      targetSessionId = fresh.id;
      setActiveSessionId(fresh.id);
      setSessions((prev) => [{ ...fresh, title: currentTitle, messages: updatedMessages, updatedAt: Date.now() }, ...prev]);
    } else {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                title: currentTitle,
                messages: updatedMessages,
                updatedAt: Date.now(),
              }
            : s
        )
      );
    }

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
            "You are ExamForge AI, an expert academic tutor for school exams (Classes 9, 10, 11, 12). Provide clear, structured, accurate, and easy-to-understand explanations. Format math using LaTeX ($...$ or $$...$$), use clean markdown tables where comparing concepts, and provide step-by-step reasoning for problems.",
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with ${response.status}`);
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
                setSessions((prev) =>
                  prev.map((s) => {
                    if (s.id !== targetSessionId) return s;
                    return {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === assistantPlaceholderId
                          ? {
                              ...m,
                              content: assistantContent,
                              reasoning: assistantReasoning || undefined,
                              modelUsed: "ExamForge AI",
                            }
                          : m
                      ),
                    };
                  })
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

        // Fallback for empty stream
        if (!assistantContent.trim() && !assistantReasoning.trim()) {
          const fallbackRes = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [...messages, userMessage].map((m) => ({
                role: m.role,
                content: m.content,
              })),
              model: "auto",
              stream: false,
            }),
          });
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            if (data.reply) {
              assistantContent = data.reply;
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id !== targetSessionId) return s;
                  return {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantPlaceholderId
                        ? {
                            ...m,
                            content: assistantContent,
                            modelUsed: "ExamForge AI",
                          }
                        : m
                    ),
                  };
                })
              );
            }
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        // aborted
      } else {
        const errorMsg = e instanceof Error ? e.message : "Failed to get AI response";
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== targetSessionId) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantPlaceholderId
                  ? {
                      ...m,
                      content: `⚠️ ${errorMsg}`,
                      isError: true,
                    }
                  : m
              ),
            };
          })
        );
        toast.error(errorMsg);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      setSessions((currentSessions) => {
        const updated = currentSessions.find((s) => s.id === targetSessionId);
        if (updated) {
          syncSessionToCloud(updated);
        }
        return currentSessions;
      });
    }
  };

  // Grouping sessions into Today and Earlier
  const now = new Date();
  const isToday = (ts: number) => {
    const d = new Date(ts);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const todaySessions = sessions.filter((s) => isToday(s.updatedAt || s.createdAt));
  const earlierSessions = sessions.filter((s) => !isToday(s.updatedAt || s.createdAt));

  // User presentation tokens
  const displayName = user?.name || (user?.email ? user.email.split("@")[0] : "Zain");
  const displayEmail = user?.email || (user ? "" : "baigzain498@gmail.com");
  const firstName = displayName.split(" ")[0] || "Zain";
  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ||
    (user?.email ? user.email.slice(0, 2).toUpperCase() : "ZA");

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-background/80 z-50 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar (Exact layout from Desktop Image) */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0 w-72 md:w-64 border-r border-border" : "-translate-x-full w-0 md:w-0 border-r-0 border-transparent pointer-events-none"
        } fixed md:relative inset-y-0 left-0 z-50 md:z-auto flex flex-col shrink-0 bg-card transition-transform duration-200 ease-in-out overflow-hidden shadow-2xl md:shadow-none`}
      >
        {/* Top Branding */}
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-bold shadow-xs">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="text-xs font-bold text-foreground tracking-tight">ExamForge</div>
                <div className="text-[10px] text-muted-foreground">AI Test Generator</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              aria-label="Close history"
              title="Close history"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Back to Dashboard Button */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full flex items-center gap-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 px-3.5 py-2.5 text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Back to Dashboard</span>
            </button>
          )}

          {/* + New chat Button */}
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-500/60 px-3.5 py-2.5 text-xs font-semibold transition-colors mt-2.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New chat</span>
          </button>
        </div>

        {/* Sessions History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 custom-scrollbar">
          {/* Today Group */}
          <div>
            <div className="px-2 text-xs font-semibold text-muted-foreground mb-1.5">
              Today
            </div>
            <div className="space-y-0.5">
              {(todaySessions.length > 0 ? todaySessions : [activeSession || { id: "new", title: "New conversation" }]).map((sess) => {
                const isActive = sess.id === activeSessionId || (todaySessions.length === 0 && !sess.id);
                return (
                  <div
                    key={sess.id}
                    onClick={() => handleSelectSession(sess.id)}
                    className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs cursor-pointer transition-colors ${
                      isActive
                        ? "bg-muted/60 text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                  >
                    <span className="truncate flex-1">{sess.title || "New conversation"}</span>
                    {sess.messages && sess.messages.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        aria-label="Delete conversation"
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0 ml-1 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Earlier Group */}
          {earlierSessions.length > 0 && (
            <div>
              <div className="px-2 text-xs font-semibold text-muted-foreground mb-1.5">
                Earlier
              </div>
              <div className="space-y-0.5">
                {earlierSessions.map((sess) => {
                  const isActive = sess.id === activeSessionId;
                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleSelectSession(sess.id)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                        isActive
                          ? "bg-muted/60 text-foreground font-semibold"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      }`}
                    >
                      <span className="truncate flex-1">{sess.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        aria-label="Delete conversation"
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0 ml-1 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border bg-transparent">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-[11px] px-3 py-1 font-medium mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
            <span>Free AI quota active</span>
          </div>

          {/* User Account Strip */}
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-900/60 text-emerald-200 border border-emerald-500/30 text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground truncate">{displayName}</div>
              <div className="text-[10px] text-muted-foreground truncate">{displayEmail}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Pane */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-background min-w-0 w-full">
        {/* Accessible screen reader heading */}
        <h1 className="sr-only">ExamForge AI: Academic and Exam Assistant</h1>

        {/* Top Bar for Mobile & when Sidebar is collapsed on Desktop */}
        <div className={`items-center justify-between p-3 border-b border-border shrink-0 bg-background ${sidebarOpen ? "hidden md:hidden" : "flex"}`}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              aria-label="Open chat history"
              title="Open chat history"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>History</span>
            </button>
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40 px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              aria-label="New chat"
              title="New chat"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New chat</span>
            </button>
          </div>
        </div>

        {/* Mobile-only Header when Sidebar is open (overlay mode) */}
        <div className={`md:hidden flex items-center justify-between p-3 border-b border-border shrink-0 bg-background ${sidebarOpen ? "flex" : "hidden"}`}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              aria-label="Open chat history"
              title="Open chat history"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>History</span>
            </button>
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40 px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              aria-label="New chat"
              title="New chat"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New chat</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {messages.length === 0 ? (
          /* Empty Hero State (Desktop Image 1 & Mobile Image 2) */
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:py-6 flex flex-col items-center max-w-4xl mx-auto w-full custom-scrollbar">
            <div className="my-auto flex flex-col items-center text-center w-full max-w-2xl py-2">
              {/* Centered Sparkle Icon */}
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 mb-3.5 shrink-0 shadow-inner">
                <Sparkles className="h-5 w-5" />
              </div>

              {/* Headline with Serif & Italic Emerald */}
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-serif tracking-tight text-foreground font-normal leading-tight w-full max-w-3xl">
                What are we <span className="italic text-emerald-400 font-serif">studying</span> today{firstName ? `, ${firstName}` : ""}?
              </h2>

              {/* Subtitle */}
              <p className="mt-2 max-w-md sm:max-w-lg text-xs sm:text-sm text-muted-foreground leading-relaxed font-sans">
                Solve problems step by step, draft board-exam MCQs, or break a tough concept down until it clicks.
              </p>

              {/* Main Center Composer Box */}
              <div className="chat-composer w-full rounded-2xl border border-border bg-card p-3 sm:p-3.5 shadow-xs focus-within:border-muted-foreground/30 transition-colors text-left mt-5 sm:mt-6">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask ExamForge AI anything…"
                  rows={2}
                  aria-label="Ask ExamForge AI anything"
                  className="chat-input w-full resize-none bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 border-0 shadow-none"
                  style={{ outline: "none", boxShadow: "none", border: "none" }}
                />
                <div className="mt-1.5 flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => toast.info("Attachments will be supported in upcoming release.")}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg cursor-pointer"
                    aria-label="Attach file"
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline text-[11px] text-muted-foreground font-sans">
                      Enter to send · Shift+Enter for new line
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim()}
                      className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                      aria-label="Send prompt"
                      title="Send prompt"
                    >
                      <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Try one of these */}
              <div className="text-left w-full mt-4 sm:mt-5">
                <div className="text-xs font-semibold text-muted-foreground mb-2 px-0.5">
                  Try one of these
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  {STARTER_PROMPTS.map((sp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(sp.prompt)}
                      className="group flex items-center justify-between rounded-2xl border border-border bg-card hover:bg-muted/30 p-2.5 sm:p-3 text-left transition-colors hover:border-emerald-500/50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-400">
                          <sp.icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-emerald-400 transition-colors truncate">
                            {sp.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {sp.desc}
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-emerald-400 transition-colors shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Tagline */}
              <p className="mt-4 sm:mt-5 text-center text-[10px] text-muted-foreground/60">
                ExamForge AI · Academic & Exam Preparation Assistant
              </p>
            </div>
          </div>
        ) : (
          /* Active Chat Messages Stream */
          <>
            {/* In-chat Desktop Top Action Bar */}
            <div className="hidden md:flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                {!sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer mr-1"
                    aria-label="Open chat history"
                    title="Open chat history"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>History</span>
                  </button>
                )}
                <span className="text-xs font-semibold text-foreground truncate max-w-md">
                  {activeSession?.title || "Conversation"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleNewChat}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Chat</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCurrentChat}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </Button>
              </div>
            </div>

            {/* Scrollable Conversation */}
            <div
              ref={chatScrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar"
            >
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      className={`flex items-start gap-3 ${
                        isUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-xs ${
                          isUser
                            ? "bg-emerald-600 text-white"
                            : "bg-card border border-emerald-500/30 text-emerald-400"
                        }`}
                      >
                        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`group relative min-w-0 max-w-[88%] sm:max-w-[85%] break-words overflow-hidden rounded-2xl px-4 py-3 text-xs sm:text-sm ${
                          isUser
                            ? "bg-emerald-600 text-white rounded-tr-none shadow-xs"
                            : m.isError
                            ? "border border-destructive/30 bg-destructive/10 text-destructive rounded-tl-none"
                            : "border border-border bg-card text-foreground rounded-tl-none shadow-xs"
                        }`}
                      >
                        {!isUser && (
                          <div className="mb-1.5 flex items-center justify-between border-b border-border/40 pb-1 text-[11px] text-muted-foreground">
                            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                              ExamForge AI
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              >
                                Free
                              </Badge>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(m.id || "", m.content)}
                              aria-label="Copy message"
                              title="Copy message"
                              className="text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                            >
                              {copiedId === m.id ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}

                        {isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        ) : !m.content && !m.reasoning && isGenerating && m.id === messages[messages.length - 1]?.id ? (
                          <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>ExamForge AI is formulating the answer…</span>
                          </div>
                        ) : !m.content && !m.reasoning ? (
                          <div className="py-1 text-xs text-muted-foreground flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-amber-400 font-medium">
                              <AlertCircle className="h-4 w-4" />
                              <span>No response was generated.</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-fit text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                              onClick={() => {
                                const idx = messages.findIndex((msg) => msg.id === m.id);
                                const prevUser = idx > 0 ? messages[idx - 1] : null;
                                if (prevUser?.content) {
                                  handleSendMessage(prevUser.content);
                                }
                              }}
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                              Retry Request
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <ChatMarkdown
                              content={m.content}
                              reasoning={m.reasoning}
                              isStreaming={isGenerating && m.id === messages[messages.length - 1]?.id}
                            />
                            {m.isError && (
                              <div className="mt-2.5 pt-2 border-t border-destructive/20 flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    const userMsg = messages[messages.length - 2];
                                    if (userMsg?.content) {
                                      handleSendMessage(userMsg.content);
                                    }
                                  }}
                                >
                                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                  Retry
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>
            </div>

            {/* Floating Scroll to Bottom */}
            {showScrollBottomBtn && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-24 right-6 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Scroll to bottom"
                title="Scroll to bottom"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}

            {/* Bottom Fixed Composer Bar in Active Chat */}
            <div className="shrink-0 p-3 sm:p-4 border-t border-border bg-background">
              <div className="chat-composer w-full max-w-3xl mx-auto rounded-2xl border border-border bg-card p-3 shadow-xs focus-within:border-muted-foreground/30 transition-colors text-left">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask ExamForge AI anything…"
                  rows={1}
                  aria-label="Ask ExamForge AI anything"
                  className="chat-input w-full resize-none bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 border-0 shadow-none max-h-[140px]"
                  style={{ outline: "none", boxShadow: "none", border: "none" }}
                />
                <div className="mt-1 flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => toast.info("Attachments will be supported in upcoming release.")}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg cursor-pointer"
                    aria-label="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline text-[11px] text-muted-foreground font-sans">
                      Enter to send · Shift+Enter for new line
                    </span>
                    {isGenerating ? (
                      <button
                        type="button"
                        onClick={handleStop}
                        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-destructive text-white font-bold transition-transform active:scale-95 cursor-pointer"
                        aria-label="Stop generating"
                      >
                        <Square className="h-4 w-4 fill-current" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendMessage()}
                        disabled={!input.trim()}
                        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                        aria-label="Send message"
                      >
                        <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
                ExamForge AI · Academic & Exam Preparation Assistant
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
