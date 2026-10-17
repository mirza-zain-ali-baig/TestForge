"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Dashboard } from "./dashboard";
import { GeneratorWizard } from "./generator-wizard";
import { TestPreview } from "./test-preview";
import { QuestionBank } from "./question-bank";
import { SavedTests } from "./saved-tests";
import { TestAnalytics } from "./test-analytics";
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
import { LogIn, LogOut, User as UserIcon, Shield, Bot } from "lucide-react";
import type { GeneratedTest } from "@/lib/types";

type View = "dashboard" | "generate" | "bank" | "chat" | "saved" | "analytics" | "history" | "print";

const NAV: { id: View; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Overview & stats" },
  { id: "generate", label: "Generate", icon: Wand2, desc: "Build a new paper" },
  { id: "bank", label: "Question Bank", icon: Database, desc: "Browse questions" },
  { id: "chat", label: "AI Chat", icon: Bot, desc: "AI tutor & solver" },
  { id: "analytics", label: "Analytics", icon: BarChart3, desc: "Test coverage insights" },
  { id: "history", label: "History", icon: History, desc: "Generation trends" },
  { id: "saved", label: "Saved Papers", icon: FolderOpen, desc: "Saved papers & bookmarks" },
];

export function TestGeneratorApp() {
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [variants, setVariants] = useState<GeneratedTest[]>([]);
  const [activeVariant, setActiveVariant] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Authentication state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<"login" | "register">("login");

  // Load authenticated user on mount & listen for Google OAuth redirect
  useEffect(() => {
    // 1. Initial check via session cookie
    fetchCurrentUser().then((u) => {
      if (u) setUser(u);
    });

    // 2. Handle Google OAuth redirect (Supabase token in URL hash / storage)
    if (typeof window !== "undefined") {
      const syncOAuth = async (session: any) => {
        if (!session?.user?.email) return;
        const u = session.user;
        try {
          const synced = await oauthSyncApi({
            email: u.email,
            name: u.user_metadata?.full_name || u.user_metadata?.name || u.email.split("@")[0],
            provider: "google",
          });
          setUser(synced);
          toast.success(`Welcome, ${synced.name || synced.email}!`);
          if (window.location.hash.includes("access_token=")) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (e) {
          console.error("OAuth sync failed:", e);
        }
      };

      supabaseBrowser.auth.getSession().then(({ data }) => {
        if (data?.session) {
          syncOAuth(data.session);
        }
      });

      const { data: authListener } = supabaseBrowser.auth.onAuthStateChange(
        (event, session) => {
          if (event === "SIGNED_IN" && session) {
            syncOAuth(session);
          }
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
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
          setView("generate");
          toast.success("Shared test loaded");
          // Clean the URL so it doesn't reload on refresh
          window.history.replaceState(null, "", window.location.pathname);
        }
      });
    }
  }, []);

  const goGenerate = () => {
    setVariants([]);
    setActiveVariant(0);
    setView("generate");
    setMobileNav(false);
  };

  const goPrint = () => {
    setView("print");
    setMobileNav(false);
  };

  // Return to the generate/preview view (not curriculum) — used by Print & Export close
  const backToPreview = () => {
    setView("generate");
    setMobileNav(false);
  };

  const navigate = useCallback((v: View) => {
    if (v === "generate") {
      goGenerate();
    } else {
      setView(v);
    }
    setMobileNav(false);
  }, []);

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
            a: "analytics",
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

      // Number keys 1-7 → quick nav
      const numMap: Record<string, View> = {
        "1": "dashboard",
        "2": "generate",
        "3": "bank",
        "4": "chat",
        "5": "analytics",
        "6": "history",
        "7": "saved",
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="no-print sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight sm:text-base">
                ExamForge
              </div>
              <div className="hidden text-[11px] text-muted-foreground sm:block whitespace-nowrap">
                AI Test Generator
              </div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (n.id === "generate") goGenerate();
                  else setView(n.id);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs lg:text-sm lg:px-3 font-medium transition-colors whitespace-nowrap",
                  view === n.id
                    ? "bg-emerald-50 text-emerald-800 font-semibold shadow-xs dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                {n.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* User Auth Avatar / Sign In */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative flex h-9 items-center gap-2 rounded-full p-0 px-2 ring-1 ring-border hover:ring-emerald-500/50"
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
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">
                        {user.name || "Signed-in User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await logoutApi();
                      setUser(null);
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-medium"
              >
                <LogIn className="mr-1.5 h-3.5 w-3.5" /> Sign In
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 sm:flex"
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
              className="md:hidden"
              onClick={() => setMobileNav((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileNav && (
          <div className="border-t md:hidden">
            <nav className="mx-auto grid max-w-7xl grid-cols-2 gap-1 p-3">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.id === "generate") goGenerate();
                    else setView(n.id);
                    setMobileNav(false);
                  }}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    view === n.id
                      ? "bg-emerald-50 text-emerald-800 font-semibold dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <n.icon className="h-4 w-4" />
                    {n.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{n.desc}</span>
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {view === "dashboard" && <Dashboard onStart={goGenerate} />}
        {view === "generate" &&
          (preview ? (
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
                onBack={goGenerate}
                onRegenerate={goGenerate}
                onPrintExport={goPrint}
                initialMode={initialPreviewMode}
              />
            </>
          ) : (
            <GeneratorWizard
              onGenerated={handleGenerated}
              user={user}
              onRequireAuth={(tab = "login") => {
                setAuthDefaultTab(tab);
                setAuthOpen(true);
              }}
            />
          ))}
        {view === "bank" && <QuestionBank />}
        {view === "chat" && <ChatView user={user} />}
        {view === "analytics" && <TestAnalytics test={preview} onStart={backToPreview} />}
        {view === "history" && <TestHistoryView />}
        {view === "print" && preview && (
          <PrintExportView test={preview} onClose={backToPreview} />
        )}
        {view === "saved" && <SavedTests onOpen={openSaved} />}
      </main>

      {/* Footer */}
      <footer className="no-print mt-auto border-t bg-muted/30">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-emerald-600" />
            <span>
              <strong className="text-foreground">ExamForge</strong> — AI-powered test generator
              for classes.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>Powered by Supabase · Next.js · ExamForge AI</span>
          </div>
        </div>
      </footer>

      {/* Floating scroll-to-top */}
      <ScrollToTop />

      {/* Floating AI Chatbox Widget (shown on all pages except full Chat page) */}
      {view !== "chat" && (
        <FloatingChatWidget user={user} onExpandToFullPage={() => setView("chat")} />
      )}

      {/* Keyboard shortcuts help */}
      <KeyboardHelpDialog open={showHelp} onOpenChange={setShowHelp} />

      {/* Authentication Dialog */}
      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={(u) => setUser(u)}
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
    { keys: ["5"], label: "Go to Analytics", group: "Navigation" },
    { keys: ["6"], label: "Go to History", group: "Navigation" },
    { keys: ["7"], label: "Go to My Tests", group: "Navigation" },
    { keys: ["g", "d"], label: "Go to Dashboard (vim)", group: "Navigation" },
    { keys: ["g", "g"], label: "Go to Generate (vim)", group: "Navigation" },
    { keys: ["g", "b"], label: "Go to Bank (vim)", group: "Navigation" },
    { keys: ["g", "c"], label: "Go to AI Chat (vim)", group: "Navigation" },
    { keys: ["g", "a"], label: "Go to Analytics (vim)", group: "Navigation" },
    { keys: ["g", "h"], label: "Go to History (vim)", group: "Navigation" },
    { keys: ["g", "s"], label: "Go to Saved (vim)", group: "Navigation" },
    { keys: ["?"], label: "Show this help", group: "Help" },
    { keys: ["Esc"], label: "Close dialog / overlay", group: "Help" },
  ];

  const groups = [...new Set(shortcuts.map((s) => s.group))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-emerald-600" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Navigate ExamForge faster with these shortcuts. Keys work anywhere except when
            typing in input fields.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
        <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
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
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
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
