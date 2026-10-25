"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Square,
  Sparkles,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ArrowDown,
  MessageSquare,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  ArrowLeft,
  Lock,
  History,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
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
    title: "Explain Concept Simply",
    desc: "RAM vs ROM & Memory Hierarchy",
    prompt:
      "Explain the differences between RAM and ROM, volatile vs non-volatile memory, and why cache memory is needed, using simple everyday analogies for a 9th class Computer Science student.",
  },
  {
    title: "Generate Exam MCQs",
    desc: "Functions & Loops in Python",
    prompt:
      "Generate 5 high-yield multiple-choice questions (MCQs) for 10th class Computer Science on 'Functions and Loops in Python'. Include 4 options and provide the correct option with a concise explanation.",
  },
  {
    title: "Step-by-Step Problem Solving",
    desc: "Binary, Hex & Number Conversions",
    prompt:
      "Convert the decimal number 218 into 8-bit Binary and Hexadecimal step-by-step. Also show its 2's complement representation with clear working.",
  },
  {
    title: "Short Question & Model Answer",
    desc: "Von Neumann Architecture (3 marks)",
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set default sidebar open on desktop once mounted
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setSidebarOpen(true);
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
      title: customTitle || "New Conversation",
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

  // Load sessions on mount or when user changes — always open with a fresh new conversation!
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

    // Fetch cloud sessions in background for history sidebar without overwriting new chat
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

  // Add new session (prevents duplicate empty chats!)
  const handleNewChat = () => {
    if (!user) {
      toast.error("Please sign in or create an account to start a new conversation.");
      onSignIn?.();
      return;
    }

    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }

    // If current session is already completely empty, reuse it!
    if (activeSession && (!activeSession.messages || activeSession.messages.length === 0)) {
      setInput("");
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
      setTimeout(() => textareaRef.current?.focus(), 50);
      return;
    }

    // Look for any existing empty session in the list
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

    const updatedMessages = [...messages, userMessage, initialAssistantMessage];

    // Determine session title if this is the first message
    const currentTitle =
      activeSession?.messages.length === 0
        ? prompt.slice(0, 32) + (prompt.length > 32 ? "…" : "")
        : activeSession?.title || "Conversation";

    let targetSessionId = activeSessionId;
    if (!targetSessionId || !sessions.some((s) => s.id === targetSessionId)) {
      const fresh = createNewSession(currentTitle);
      targetSessionId = fresh.id;
      setActiveSessionId(fresh.id);
      setSessions((prev) => [{ ...fresh, title: currentTitle, messages: updatedMessages, updatedAt: Date.now() }, ...prev]);
    } else {
      // Update existing session state
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
                    if (s.id !== activeSessionId) return s;
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

                // Intelligent auto-scroll: ONLY scroll if user hasn't scrolled up
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

        // If stream ended empty, execute non-streaming fallback
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
                  if (s.id !== activeSessionId) return s;
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
        // User aborted intentionally
      } else {
        const errorMsg = e instanceof Error ? e.message : "Failed to get AI response";
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSessionId) return s;
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
      // Sync active session with Supabase Cloud
      setSessions((currentSessions) => {
        const updated = currentSessions.find((s) => s.id === activeSessionId);
        if (updated) {
          syncSessionToCloud(updated);
        }
        return currentSessions;
      });
    }
  };

  return (
    <div
      className={`relative flex w-full overflow-hidden bg-card ${
        fullWindow
          ? "h-full rounded-none border-0 shadow-none"
          : "h-[calc(100vh-8.5rem)] min-h-[550px] rounded-2xl border border-border shadow-sm"
      }`}
    >
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* ─── Modern AI Sidebar ─── */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-0 md:w-0"
        } fixed md:relative inset-y-0 left-0 z-50 md:z-auto flex flex-col shrink-0 border-r border-border bg-background md:bg-muted/30 transition-transform duration-200 ease-in-out overflow-hidden shadow-2xl md:shadow-none`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold text-foreground">Chat History</span>
            {user && sessions.length > 0 && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{sessions.length}</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground md:hidden cursor-pointer"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close chat history"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* New Chat Option inside sidebar */}
        <div className="p-3 border-b border-border/60">
          <Button
            onClick={() => {
              handleNewChat();
              setSidebarOpen(false);
            }}
            className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </Button>
        </div>

        {/* Sessions History List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>Recent Conversations</span>
          </div>

          {!user ? (
            <div className="flex flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground my-auto space-y-2">
              <div className="h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                <Lock className="h-4 w-4" />
              </div>
              <p className="font-semibold text-foreground text-xs">Sign in to save history</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Your conversations are saved and synced across devices.
              </p>
              <Button
                size="sm"
                onClick={onSignIn}
                className="mt-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
              >
                Sign In
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No recent conversations yet.
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  onClick={() => {
                    handleSelectSession(sess.id);
                    setSidebarOpen(false);
                  }}
                  className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-semibold border border-emerald-500/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="flex-1 truncate text-left">{sess.title}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(sess.id, e)}
                    aria-label="Delete conversation"
                    title="Delete conversation"
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive rounded transition-opacity shrink-0 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* User Account / Email Scoped Indicator */}
        <div className="p-3 border-t border-border/60 bg-background/50">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-[11px] font-bold shadow-xs">
              {user ? (
                <span className="text-emerald-700 dark:text-emerald-300">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : user.email.slice(0, 2).toUpperCase()}
                </span>
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground text-[11px]">
                {user?.name || (user ? user.email.split("@")[0] : "Guest Mode")}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {user?.email || "Sign in to sync conversations"}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              Free AI quota active
            </span>
          </div>
        </div>
      </aside>

      {/* ─── Main Chat Interface ─── */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-background min-w-0 w-full">
        {/* Accessible Page Heading (Screen readers) */}
        <h1 className="sr-only">ExamForge AI: Academic and Exam Assistant</h1>

        {/* Top Navbar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/80 px-2 sm:px-4 bg-card/60 backdrop-blur-xs gap-2">
          {/* Left: Dashboard Back + Sidebar Toggle + Branding */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-8 gap-1 px-2 text-xs font-semibold text-foreground hover:bg-muted rounded-lg shrink-0 cursor-pointer"
                aria-label="Back to Dashboard"
                title="Back to Dashboard"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            )}

            {/* Intuitive Sidebar Toggle Icon */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg shrink-0 cursor-pointer"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Collapse conversation history" : "Expand conversation history"}
              title={sidebarOpen ? "Collapse history" : "Expand history"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4 text-emerald-600" />
              ) : (
                <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            <div className="flex items-center gap-2 min-w-0 ml-1">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-foreground leading-tight truncate">
                  ExamForge AI
                </h2>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium hidden md:block truncate">
                  Free Academic & Exam Assistant
                </p>
              </div>
            </div>
          </div>

          {/* Right: Instant "New Chat" Button + Clear Chat */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleNewChat}
              className="h-8 gap-1 px-2.5 sm:px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
              title="Start a new chat conversation"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">New Chat</span>
            </Button>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive cursor-pointer gap-1"
                onClick={handleClearCurrentChat}
                aria-label="Clear current conversation"
                title="Clear current conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
          </div>
        </header>

        {/* Messages Scroll Area */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-500/20 mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                How can ExamForge AI help you today?
              </h3>
              <p className="mt-1 max-w-md text-xs sm:text-sm text-muted-foreground">
                Ask any question, solve math & science problems step-by-step, generate board-exam MCQs, or review difficult concepts.
              </p>

              {/* Sign In Required Banner if guest */}
              {!user && (
                <div className="mt-4 mb-2 max-w-2xl w-full rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 text-center shadow-xs">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Sign In Required to Chat</h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    You must be signed in to ask questions, solve exam problems, and save your chat history with ExamForge AI.
                  </p>
                  <div className="mt-3 flex justify-center">
                    <Button
                      size="sm"
                      onClick={onSignIn}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
                    >
                      Sign In / Register
                    </Button>
                  </div>
                </div>
              )}

              {/* Starter Prompts */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl w-full text-left">
                {STARTER_PROMPTS.map((sp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!user) {
                        toast.info("Please sign in or create an account to chat with AI.");
                        onSignIn?.();
                        return;
                      }
                      handleSendMessage(sp.prompt);
                    }}
                    className="flex flex-col rounded-xl border border-border p-3 text-left transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/5 group cursor-pointer"
                  >
                    <span className="flex items-center justify-between text-xs font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      <span>{sp.title}</span>
                      {!user && <Lock className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {sp.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
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
                          ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`group relative min-w-0 max-w-[88%] sm:max-w-[85%] break-words overflow-hidden rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm ${
                        isUser
                          ? "bg-emerald-600 text-white rounded-tr-none"
                          : m.isError
                          ? "border border-destructive/30 bg-destructive/10 text-destructive rounded-tl-none"
                          : "border border-border/80 bg-muted/40 text-foreground rounded-tl-none"
                      }`}
                    >
                      {/* Assistant Header */}
                      {!isUser && (
                        <div className="mb-1.5 flex items-center justify-between border-b border-border/40 pb-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            ExamForge AI
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-600"
                            >
                              Free
                            </Badge>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(m.id || "", m.content)}
                            title="Copy message"
                            className="text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100 transition-opacity p-0.5"
                          >
                            {copiedId === m.id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* Content & Markdown */}
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      ) : !m.content && !m.reasoning && isGenerating && m.id === messages[messages.length - 1]?.id ? (
                        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          <span>ExamForge AI is formulating the answer...</span>
                        </div>
                      ) : !m.content && !m.reasoning ? (
                        <div className="py-1 text-xs text-muted-foreground flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                            <AlertCircle className="h-4 w-4" />
                            <span>No response was generated.</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-fit text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
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
          )}
        </div>

        {/* Floating Scroll to Bottom Button */}
        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-20 right-6 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-md text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}

        {/* Input Bar */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-border bg-card/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!user) {
                toast.info("Please sign in or create an account to chat with ExamForge AI.");
                onSignIn?.();
                return;
              }
              handleSendMessage();
            }}
            className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-xs outline-none focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-colors"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onFocus={() => {
                if (!user) {
                  toast.info("Please sign in to chat with ExamForge AI.");
                  onSignIn?.();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!user) {
                    toast.info("Please sign in to chat with ExamForge AI.");
                    onSignIn?.();
                    return;
                  }
                  handleSendMessage();
                }
              }}
              placeholder={user ? "Ask ExamForge AI... (Enter to send, Shift+Enter for new line)" : "Ask ExamForge AI a question... (Sign in to chat)"}
              rows={1}
              aria-label="Chat message input"
              className="chat-input-textarea min-h-[38px] max-h-[140px] flex-1 resize-none bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-none"
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
                className="h-9 w-9 shrink-0 rounded-xl cursor-pointer"
                aria-label="Stop generating"
                title="Stop generating"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : user ? (
              <Button
                type="submit"
                disabled={!input.trim()}
                className="h-9 w-9 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 cursor-pointer"
                aria-label="Send message"
                title="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onSignIn}
                className="h-9 px-3 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs cursor-pointer shadow-xs gap-1.5"
                aria-label="Sign in to chat"
                title="Sign in to chat"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Button>
            )}
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            ExamForge AI • Academic & Exam Preparation Assistant
          </p>
        </div>
      </div>

    </div>
  );
}
