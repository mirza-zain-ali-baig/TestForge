"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Wand2,
  Database,
  FolderOpen,
  GraduationCap,
  Menu,
  X,
  Github,
  BarChart3,
  Copy,
  Keyboard,
  Command,
  History,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorBoundary } from "@/components/error-boundary";
import { Dashboard } from "./dashboard";
import { GeneratorWizard } from "./generator-wizard";
import { TestPreview } from "./test-preview";
import { QuestionBank } from "./question-bank";
import { SavedTests } from "./saved-tests";
import { TestHistoryView } from "./test-history";
import { PrintExportView } from "./print-export-view";
import { ScrollToTop } from "./scroll-to-top";
import { ChatView } from "./chat-view";
import { FloatingChatWidget } from "./floating-chat-widget";
import { AuthDialog } from "./auth-dialog";
import { fetchCurrentUser, logoutApi, oauthSyncApi, type AuthUser } from "./lib";
import { supabaseBrowser } from "@/lib/supabase-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogIn, LogOut, User as UserIcon, Bot } from "lucide-react";
import type { GeneratedTest } from "@/lib/types";

type View = "dashboard" | "generate" | "bank" | "chat" | "saved" | "history" | "print";

const NAV: { id: View; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Overview & stats" },
  { id: "generate", label: "Generate", icon: Wand2, desc: "Build a new paper" },
  { id: "bank", label: "Question Bank", icon: Database, desc: "Browse questions" },
  { id: "chat", label: "AI Chat", icon: Bot, desc: "AI tutor & solver" },
  { id: "history", label: "History", icon: History, desc: "Generation trends" },
  { id: "saved", label: "Saved Papers", icon: FolderOpen, desc: "Saved papers & bookmarks" },
];

const BOTTOM_NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "generate", label: "Generate", icon: Wand2 },
  { id: "bank", label: "Bank", icon: Database },
  { id: "chat", label: "Chat", icon: Bot },
  { id: "saved", label: "Saved", icon: FolderOpen },
];

export function TestGeneratorApp() {
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [variants, setVariants] = useState<GeneratedTest[]>([]);
  const [activeVariant, setActiveVariant] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [initialVariantCount, setInitialVariantCount] = useState<number>(1);

  // Authentication state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<"login" | "register">("login");
  const syncedTokenRef = useRef<string | null>(null);
  const pendingNavRef = useRef<View | null>(null);

  // Sync view state with browser URL (?view=...) (Bug 16)
  const setViewWithUrl = useCallback((nextView: View, replace = false) => {
    setView(nextView);
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      if (nextView === "dashboard") {
        currentUrl.searchParams.delete("view");
      } else {
        currentUrl.searchParams.set("view", nextView);
      }
      const newUrl =
        currentUrl.pathname +
        (currentUrl.searchParams.toString() ? `?${currentUrl.searchParams.toString()}` : "") +
        currentUrl.hash;
      if (replace) {
        window.history.replaceState({ view: nextView }, "", newUrl);
      } else {
        window.history.pushState({ view: nextView }, "", newUrl);
      }
    }
  }, []);

  // Handle browser Back / Forward buttons (popstate) & initial deep link (Bug 16)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialView = params.get("view") as View | null;
    if (initialView && NAV.some((n) => n.id === initialView)) {
      setView(initialView);
    }

    const handlePopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const v = currentParams.get("view") as View | null;
      if (v && NAV.some((n) => n.id === v)) {
        setView(v);
      } else {
        setView("dashboard");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Load authenticated user on mount & listen for Google OAuth redirect
  useEffect(() => {
    fetchCurrentUser().then((u) => {
      if (u) setUser(u);
    });

    if (typeof window !== "undefined") {
      const syncOAuth = async (session: any) => {
        if (!session?.user?.email) return;
        const token = session.access_token || session.user.id;
        if (syncedTokenRef.current === token) return;
        syncedTokenRef.current = token;

        const u = session.user;
        try {
          const synced = await oauthSyncApi({
            email: u.email,
            name: u.user_metadata?.full_name || u.user_metadata?.name || u.email.split("@")[0],
            provider: "google",
          });
          setUser(synced);
          toast.success(`Welcome, ${synced.name || synced.email}!`, { id: "auth-welcome" });
          if (window.location.hash.includes("access_token=")) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (e) {
          console.error("OAuth sync failed:", e);
        }
      };

      const { data: authListener } = supabaseBrowser.auth.onAuthStateChange(
        (event, session) => {
          if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
            syncOAuth(session);
          }
        }
      );

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, []);

  const preview = variants[activeVariant] ?? null;

  // Check for shared test in URL hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#share=")) {
      const encoded = hash.slice(7);
      import("./test-preview").then(({ decodeTestFromShare }) => {
        const test = decodeTestFromShare(encoded);
        if (test) {
          setVariants([test]);
          setActiveVariant(0);
          setViewWithUrl("generate");
          toast.success("Shared test loaded");
          window.history.replaceState(null, "", window.location.pathname);
        }
      });
    }
  }, [setViewWithUrl]);

  const goGenerate = (opts?: { batch?: boolean }) => {
    if (!user) {
      toast.info("Please sign in or create an account to generate exam papers.");
      setAuthDefaultTab("login");
      setAuthOpen(true);
      pendingNavRef.current = "generate";
      return;
    }
    if (opts?.batch) {
      setInitialVariantCount(3);
    } else {
      setInitialVariantCount(1);
    }
    setVariants([]);
    setActiveVariant(0);
    setViewWithUrl("generate");
    setMobileNav(false);
  };

  // Return to the generate setup view with all inputs preserved (Bug 3)
  const backToSetup = () => {
    setVariants([]);
    setActiveVariant(0);
    setViewWithUrl("generate");
    setMobileNav(false);
  };

  const goPrint = () => {
    setViewWithUrl("print");
    setMobileNav(false);
  };

  const backToPreview = () => {
    setViewWithUrl("generate");
    setMobileNav(false);
  };

  const [previousView, setPreviousView] = useState<View>("dashboard");

  const navigate = useCallback((v: View) => {
    if (v === "bank" && !user) {
      toast.info("Please sign in or create an account to access the Question Bank.");
      setAuthDefaultTab("login");
      setAuthOpen(true);
      pendingNavRef.current = "bank";
      return;
    }
    if (v === "generate") {
      goGenerate();
      return;
    }
    setView((curr) => {
      if (curr !== v && curr !== "chat") {
        setPreviousView(curr);
      }
      return curr;
    });
    setViewWithUrl(v);
    setMobileNav(false);
  }, [user, goGenerate, setViewWithUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas or when a dialog/overlay is open
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;
      const overlayOpen =
        document.querySelector("[role='dialog']") ||
        document.querySelector(".fixed.inset-0.z-50");

      // "?" always works (unless typing) → help
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }
      // Escape closes help
      if (e.key === "Escape" && showHelp) {
        setShowHelp(false);
        return;
      }
      // Don't interfere with other shortcuts when typing or overlay is open
      if (isTyping || overlayOpen) return;

      // g + letter → navigate (vim-style)
      if (e.key === "g") {
        // wait for next key — use a simple approach: set a flag via dataset
        const onNext = (ev: KeyboardEvent) => {
          const map: Record<string, View> = {
            d: "dashboard",
            g: "generate",
            b: "bank",
            c: "chat",
            h: "history",
            s: "saved",
          };
          const v = map[ev.key.toLowerCase()];
          if (v) {
            ev.preventDefault();
            navigate(v);
          }
          window.removeEventListener("keydown", onNext, true);
        };
        window.addEventListener("keydown", onNext, { capture: true, once: true });
        e.preventDefault();
        return;
      }

      // Number keys 1-6 → quick nav
      const numMap: Record<string, View> = {
        "1": "dashboard",
        "2": "generate",
        "3": "bank",
        "4": "chat",
        "5": "history",
        "6": "saved",
      };
      if (numMap[e.key]) {
        e.preventDefault();
        navigate(numMap[e.key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, showHelp]);

  const [initialPreviewMode, setInitialPreviewMode] = useState<"preview" | "practice" | "print">("preview");

  const handleGenerated = (
    newVariants: GeneratedTest[],
    mode: "preview" | "practice" | "print" = "preview"
  ) => {
    setVariants(newVariants);
    setActiveVariant(0);
    setInitialPreviewMode(mode);
    if (mode === "print") {
      setView("print");
    } else {
      setView("generate");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSaved = (test: GeneratedTest) => {
    setVariants([test]);
    setActiveVariant(0);
    setView("generate");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateCurrentVariant = (t: GeneratedTest) => {
    setVariants((prev) => {
      const next = [...prev];
      next[activeVariant] = t;
      return next;
    });
  };

  return (
    <div className={cn("flex min-h-screen flex-col bg-background", view === "chat" && "h-screen overflow-hidden")}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:font-semibold focus:text-xs focus:rounded-lg focus:shadow-xl focus:outline-none"
      >
        Skip to content
      </a>
      {/* Unified Persistent Header across all pages except print view */}
      {view !== "print" && (
        <header className="no-print sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md shadow-xs">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            {/* Logo & Brand */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate("dashboard")}
                className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl p-1 min-h-[44px] shrink-0 cursor-pointer"
                aria-label="ExamForge Home"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shrink-0">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-bold tracking-tight sm:text-base flex items-center gap-1.5 text-foreground">
                    ExamForge
                    {view === "generate" && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 hidden sm:inline-flex border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                        {preview ? "Preview" : "Setup"}
                      </Badge>
                    )}
                  </div>
                  <div className="hidden text-[11px] text-muted-foreground sm:block whitespace-nowrap">
                    AI Test Generator
                  </div>
                </div>
              </button>
            </div>

            {/* Desktop Navigation (Visible at md: 768px+) */}
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main Navigation">
              {NAV.map((n) => {
                const isActive = view === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      if (n.id === "generate") {
                        if (variants.length > 0) {
                          setViewWithUrl("generate");
                        } else {
                          goGenerate();
                        }
                      } else {
                        navigate(n.id);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs lg:text-sm lg:px-3 font-medium transition-colors whitespace-nowrap min-h-[38px] cursor-pointer",
                      isActive
                        ? "bg-emerald-50 text-emerald-800 font-semibold dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <n.icon className="h-4 w-4 shrink-0" />
                    {n.label}
                  </button>
                );
              })}
            </nav>

            {/* Right Header Utilities */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative flex h-9 items-center gap-2 rounded-full p-0 px-2 ring-1 ring-border hover:ring-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white">
                          {user.name
                            ? user.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()
                            : user.email.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-[120px] truncate text-xs font-medium sm:inline-block">
                        {user.name || user.email.split("@")[0]}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64" align="end">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-semibold leading-none truncate">
                          {user.name || "Signed-in User"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("saved")} className="cursor-pointer">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      <span>Saved Papers</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("history")} className="cursor-pointer">
                      <History className="mr-2 h-4 w-4" />
                      <span>Generation History</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          await logoutApi();
                        } catch {}
                        try {
                          await supabaseBrowser.auth.signOut();
                        } catch {}
                        syncedTokenRef.current = null;
                        setUser(null);
                        navigate("dashboard");
                        setVariants([]);
                        setActiveVariant(0);
                        toast.success("Signed out successfully.");
                      }}
                      className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setAuthDefaultTab("login");
                    setAuthOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-semibold h-9 px-3.5 cursor-pointer"
                  aria-label="Sign In"
                  title="Sign In"
                >
                  <LogIn className="h-4 w-4 mr-1.5 shrink-0" />
                  <span>Sign In</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="hidden h-9 w-9 sm:flex focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none cursor-pointer"
                onClick={() => setShowHelp(true)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="h-[1.15rem] w-[1.15rem]" />
              </Button>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 sm:h-9 sm:w-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 md:hidden cursor-pointer"
                onClick={() => setMobileNav((v) => !v)}
                aria-label="Toggle menu"
              >
                {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Polished Mobile Drawer Overlay */}
          {mobileNav && (
            <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-start">
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                onClick={() => setMobileNav(false)}
                aria-hidden="true"
              />
              <div className="relative z-10 w-full bg-card border-b border-border shadow-2xl p-4 safe-area-bottom space-y-3 animate-fade-in">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-sm">Navigation</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileNav(false)}
                    className="h-8 w-8 rounded-lg cursor-pointer"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <nav className="grid grid-cols-1 gap-1" aria-label="Mobile Navigation">
                  {NAV.map((n) => {
                    const isActive = view === n.id;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => {
                          if (n.id === "generate") {
                            if (variants.length > 0) {
                              setViewWithUrl("generate");
                            } else {
                              goGenerate();
                            }
                          } else {
                            navigate(n.id);
                          }
                          setMobileNav(false);
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors min-h-[44px]",
                          isActive
                            ? "bg-emerald-50 text-emerald-800 font-bold dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "text-foreground hover:bg-muted font-medium"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <n.icon className={cn("h-4 w-4", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                          <div>
                            <div className="text-sm font-semibold">{n.label}</div>
                            <div className="text-[11px] text-muted-foreground font-normal">{n.desc}</div>
                          </div>
                        </div>
                        {isActive && (
                          <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </nav>

                {/* Mobile Drawer Auth */}
                <div className="pt-2 border-t">
                  {user ? (
                    <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white">
                            {user.name
                              ? user.name.slice(0, 2).toUpperCase()
                              : user.email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate text-foreground">{user.name || "User"}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          setMobileNav(false);
                          try { await logoutApi(); } catch {}
                          try { await supabaseBrowser.auth.signOut(); } catch {}
                          syncedTokenRef.current = null;
                          setUser(null);
                          navigate("dashboard");
                          setVariants([]);
                          setActiveVariant(0);
                          toast.success("Signed out successfully.");
                        }}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setMobileNav(false);
                        setAuthDefaultTab("login");
                        setAuthOpen(true);
                      }}
                      className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      <LogIn className="h-4 w-4 mr-2" /> Sign In / Register
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </header>
      )}

      {/* Main Content with ErrorBoundary */}
      <main
        id="main-content"
        className={cn(
          "flex-1",
          view === "chat"
            ? "w-full h-[calc(100dvh-4rem)] pb-14 md:pb-0 p-0 m-0 overflow-hidden"
            : "mx-auto w-full max-w-7xl px-4 py-5 pb-24 md:pb-10 sm:px-6 lg:px-8"
        )}
      >
        <ErrorBoundary>
          {view === "dashboard" && (
            <Dashboard
              onStart={() => goGenerate()}
              onNavigate={(v, opts) => {
                if (v === "generate") {
                  goGenerate(opts);
                } else {
                  navigate(v);
                }
              }}
            />
          )}
          {view === "generate" && (
            <>
              {/* Wizard kept mounted so config/breakdown state is 100% preserved on Back (Bug 3) */}
              <div className={preview ? "hidden" : "block"}>
                <GeneratorWizard
                  onGenerated={handleGenerated}
                  user={user}
                  initialVariantCount={initialVariantCount}
                  onRequireAuth={(tab = "login") => {
                    setAuthDefaultTab(tab);
                    setAuthOpen(true);
                  }}
                  onExit={() => navigate(previousView === "generate" ? "dashboard" : previousView)}
                />
              </div>
              {preview && (
                <>
                  {variants.length > 1 && (
                    <VariantTabs
                      variants={variants}
                      active={activeVariant}
                      onSelect={setActiveVariant}
                    />
                  )}
                  <TestPreview
                    test={preview}
                    onTestChange={updateCurrentVariant}
                    onBack={backToSetup}
                    onRegenerate={backToSetup}
                    onPrintExport={goPrint}
                    initialMode={initialPreviewMode}
                    onExit={() => navigate(previousView === "generate" ? "dashboard" : previousView)}
                    user={user}
                    onRequireAuth={(tab = "login") => {
                      setAuthDefaultTab(tab);
                      setAuthOpen(true);
                    }}
                  />
                </>
              )}
            </>
          )}
          {view === "bank" && (
            <QuestionBank
              user={user}
              onSignIn={() => {
                setAuthDefaultTab("login");
                setAuthOpen(true);
              }}
            />
          )}
          {view === "chat" && (
            <ChatView
              user={user}
              onBack={() => navigate(previousView === "chat" ? "dashboard" : previousView)}
              onSignIn={() => {
                setAuthDefaultTab("login");
                setAuthOpen(true);
              }}
              fullWindow
            />
          )}
          {view === "history" && (
            <TestHistoryView
              user={user}
              onSignIn={() => {
                setAuthDefaultTab("login");
                setAuthOpen(true);
              }}
            />
          )}
          {view === "print" && preview && (
            <PrintExportView test={preview} onClose={backToPreview} />
          )}
          {view === "saved" && (
            <SavedTests
              onOpen={openSaved}
              user={user}
              onSignIn={() => {
                setAuthDefaultTab("login");
                setAuthOpen(true);
              }}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      {!["chat", "print"].includes(view) && (
        <footer className="no-print mt-auto border-t bg-card/60 backdrop-blur-sm pb-20 md:pb-0">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                <GraduationCap className="h-3.5 w-3.5" />
              </div>
              <span>
                <strong className="text-foreground font-semibold">ExamForge AI</strong>: Enterprise Examination Paper Generation Studio
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Question Bank Active</span>
              </span>
              <span className="text-border">|</span>
              <span>Next.js 16</span>
              <span className="text-border">|</span>
              <span>Supabase</span>
            </div>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Navigation Bar (Chapter 13 Rec 1: Native Thumb-Zone Navigation) */}
      {view !== "print" && (
        <nav
          className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md shadow-lg px-2 py-1 safe-area-bottom flex items-center justify-around"
          aria-label="Mobile Bottom Navigation"
        >
          {BOTTOM_NAV.map((item) => {
            const isActive = view === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  if (item.id === "bank") {
                    if (!user) {
                      toast.info("Please sign in or create an account to access the Question Bank.");
                      setAuthDefaultTab("login");
                      setAuthOpen(true);
                      pendingNavRef.current = "bank";
                      return;
                    }
                    navigate("bank");
                    return;
                  }
                  if (item.id === "generate") {
                    if (variants.length > 0) {
                      setViewWithUrl("generate");
                    } else {
                      goGenerate();
                    }
                    return;
                  }
                  navigate(item.id);
                }}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-1 px-1 min-h-[48px] rounded-xl transition-colors active:scale-95 cursor-pointer",
                  isActive
                    ? "text-emerald-700 dark:text-emerald-400 font-bold"
                    : "text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    isActive ? "bg-emerald-500/15" : "bg-transparent"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                </span>
                <span className="text-[10px] tracking-tight truncate max-w-[62px]">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Floating scroll-to-top */}
      {!["chat", "print"].includes(view) && <ScrollToTop />}

      {/* Floating AI Chatbox Widget */}
      {!["chat", "print"].includes(view) && (
        <FloatingChatWidget
          user={user}
          onExpandToFullPage={() => navigate("chat")}
          onSignIn={() => {
            setAuthDefaultTab("login");
            setAuthOpen(true);
          }}
        />
      )}

      {/* Keyboard shortcuts help */}
      <KeyboardHelpDialog open={showHelp} onOpenChange={setShowHelp} />

      {/* Authentication Dialog */}
      <AuthDialog
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          pendingNavRef.current = null;
        }}
        onSuccess={(u) => {
          setUser(u);
          if (pendingNavRef.current) {
            const dest = pendingNavRef.current;
            pendingNavRef.current = null;
            setTimeout(() => {
              if (dest === "generate") {
                setVariants([]);
                setActiveVariant(0);
                setViewWithUrl("generate");
              } else {
                setView((curr) => {
                  if (curr !== dest && curr !== "chat") {
                    setPreviousView(curr);
                  }
                  return curr;
                });
                setViewWithUrl(dest);
              }
            }, 50);
          }
        }}
        defaultTab={authDefaultTab}
      />
    </div>
  );
}

/* --------------------------- Keyboard help ------------------------------ */

function KeyboardHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const shortcuts: {
    keys: string[];
    label: string;
    group: string;
  }[] = [
    { keys: ["1"], label: "Go to Dashboard", group: "Navigation" },
    { keys: ["2"], label: "Go to Generate Test", group: "Navigation" },
    { keys: ["3"], label: "Go to Question Bank", group: "Navigation" },
    { keys: ["4"], label: "Go to AI Chat", group: "Navigation" },
    { keys: ["5"], label: "Go to History", group: "Navigation" },
    { keys: ["6"], label: "Go to My Tests", group: "Navigation" },
    { keys: ["g", "d"], label: "Go to Dashboard (vim)", group: "Navigation" },
    { keys: ["g", "g"], label: "Go to Generate (vim)", group: "Navigation" },
    { keys: ["g", "b"], label: "Go to Bank (vim)", group: "Navigation" },
    { keys: ["g", "c"], label: "Go to AI Chat (vim)", group: "Navigation" },
    { keys: ["g", "h"], label: "Go to History (vim)", group: "Navigation" },
    { keys: ["g", "s"], label: "Go to Saved (vim)", group: "Navigation" },
    { keys: ["?"], label: "Show this help", group: "Help" },
    { keys: ["Esc"], label: "Close dialog / overlay", group: "Help" },
  ];

  const groups = [...new Set(shortcuts.map((s) => s.group))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border/80">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="h-4 w-4 text-emerald-600" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="text-xs">
            Navigate ExamForge faster with these shortcuts. Keys work anywhere except when
            typing in input fields.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-2 text-[11px] font-semibold text-muted-foreground">
                {group}
              </div>
              <div className="space-y-1.5">
                {shortcuts
                  .filter((s) => s.group === group)
                  .map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <span className="text-sm">{s.label}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, j) => (
                          <span key={j} className="flex items-center gap-1">
                            {j > 0 && (
                              <span className="text-[10px] text-muted-foreground">then</span>
                            )}
                            <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border bg-muted px-1.5 font-mono text-xs font-semibold shadow-sm">
                              {k}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-border/80 p-3.5 px-5 text-xs text-muted-foreground bg-muted/30">
          <Command className="h-3.5 w-3.5" />
          Tip: press <kbd className="rounded border bg-muted px-1 font-mono">?</kbd> anytime to
          open this dialog.
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Variant selector shown when multiple variants were generated */

function VariantTabs({
  variants,
  active,
  onSelect,
}: {
  variants: GeneratedTest[];
  active: number;
  onSelect: (i: number) => void;
}) {
  return (
    <Card className="no-print animate-fade-in mb-4 border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-emerald-600" />
          <div>
            <div className="text-sm font-semibold">
              {variants.length} test variants generated
            </div>
            <div className="text-[11px] text-muted-foreground">
              Questions are unique across variants. Switch tabs to preview, edit or print each one.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {variants.map((v, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                active === i
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-border bg-card hover:border-emerald-400 hover:bg-accent"
              )}
            >
              <span className="font-semibold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="opacity-80">
                {v.totalQuestions}Q · {v.totalMarks}m
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
