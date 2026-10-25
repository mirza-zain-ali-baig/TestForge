"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  CheckCircle2,
  Database,
  RefreshCw,
  Bookmark,
  Star,
  StickyNote,
  Pencil,
  Lock,
  LogIn,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { renderInlineStyles } from "./chat-markdown";
import {
  fetchCurriculum,
  fetchQuestions,
  TYPE_NAMES,
  DIFF_NAMES,
  TYPE_META,
  DIFF_META,
  type CurriculumNode,
  type BankQuestion,
  type AuthUser,
} from "./lib";

const PAGE_SIZE = 20;

export function QuestionBank({
  user,
  onSignIn,
}: {
  user?: AuthUser | null;
  onSignIn?: () => void;
} = {}) {
  const [tree, setTree] = useState<CurriculumNode[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [typeName, setTypeName] = useState<string>("all");
  const [diffName, setDiffName] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showAnswers, setShowAnswers] = useState(true);
  const [page, setPage] = useState(0);

  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>(() => loadNotes());
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      onSignIn?.();
    }
  }, [user, onSignIn]);

  useEffect(() => {
    if (!user) return;
    fetchCurriculum()
      .then((d) => {
        const sortedTree = [...(d.tree || [])].sort((a, b) =>
          a.class_name.localeCompare(b.class_name, undefined, { numeric: true })
        );
        setTree(sortedTree);
        if (sortedTree.length > 0) {
          const firstClass = sortedTree[0];
          setClassId((prev) => prev || firstClass.id);
          if (firstClass.subjects && firstClass.subjects.length > 0) {
            setSubjectId((prev) => prev || firstClass.subjects![0].id);
          }
        }
      })
      .catch((e) => toast.error(e.message));
  }, [user]);

  const reqSeqRef = useRef(0);

  const handleClassChange = (newClassId: string) => {
    setClassId(newClassId);
    if (newClassId === "all") {
      setSubjectId("all");
    } else {
      const cls = tree.find((c) => c.id === newClassId);
      if (cls && cls.subjects && cls.subjects.length > 0) {
        setSubjectId(cls.subjects[0].id);
      } else {
        setSubjectId("all");
      }
    }
    setChapterIds([]);
    setPage(0);
  };

  const handleSubjectChange = (newSubId: string) => {
    setSubjectId(newSubId);
    setChapterIds([]);
    setPage(0);
  };

  const handleTypeChange = (newType: string) => {
    setTypeName(newType);
    setPage(0);
  };

  const handleDiffChange = (newDiff: string) => {
    setDiffName(newDiff);
    setPage(0);
  };

  const handleChapterToggle = (chId: string) => {
    setChapterIds((prev) =>
      prev.includes(chId) ? prev.filter((id) => id !== chId) : [...prev, chId]
    );
    setPage(0);
  };

  const handleSelectAllChapters = () => {
    setChapterIds([]);
    setPage(0);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!user) return;
      const reqSeq = ++reqSeqRef.current;
      setLoading(true);
      try {
        const res = await fetchQuestions({
          subjectId: subjectId && subjectId !== "all" ? subjectId : undefined,
          chapterIds: chapterIds.length > 0 ? chapterIds : undefined,
          questionType: typeName === "all" ? undefined : typeName,
          difficulty: diffName === "all" ? undefined : diffName,
          search: debouncedSearch || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          forceRefresh,
        });
        if (reqSeq === reqSeqRef.current) {
          setQuestions(res.questions ?? []);
          setTotal(res.total ?? 0);
        }
      } catch (e) {
        if (reqSeq === reqSeqRef.current) {
          toast.error(e instanceof Error ? e.message : "Failed to load questions");
        }
      } finally {
        if (reqSeq === reqSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [subjectId, chapterIds, typeName, diffName, debouncedSearch, page, user]
  );

  useEffect(() => {
    if (!user) return;
    load();
  }, [load, user]);

  const toggleFavorite = (id: string) => {
    if (!user) {
      toast.info("Please sign in or create an account to save favorite questions.");
      onSignIn?.();
      return;
    }
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info("Removed from favorites");
      } else {
        next.add(id);
        toast.success("Added to favorites");
      }
      saveFavorites(next);
      return next;
    });
  };

  const saveNote = (id: string, text: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) {
        next[id] = text.trim();
      } else {
        delete next[id];
      }
      saveNotes(next);
      return next;
    });
    setNoteEditingId(null);
    toast.success(text.trim() ? "Note saved" : "Note removed");
  };

  const currentClass =
    classId && classId !== "all" ? tree.find((c) => c.id === classId) : null;
  const subjects = currentClass
    ? currentClass.subjects ?? []
    : Array.from(
        new Map(
          tree.flatMap((c) => c.subjects ?? []).map((s) => [s.id, s])
        ).values()
      );
  const chapters =
    subjects.find((s) => s.id === subjectId)?.chapters ?? [];

  const toggleChapter = (id: string) => {
    setChapterIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const searchCountsByChapter = useMemo(() => {
    if (!debouncedSearch) return null;
    const counts: Record<string, number> = {};
    for (const q of questions) {
      const chId = (q as any).chapter_id;
      if (chId) {
        counts[chId] = (counts[chId] || 0) + 1;
      }
    }
    return counts;
  }, [debouncedSearch, questions]);

  const displayedQuestions = useMemo(() => {
    if (showFavOnly) {
      return questions.filter((q) => favorites.has(q.id));
    }
    return questions;
  }, [questions, showFavOnly, favorites]);

  if (!user) {
    return (
      <Card className="border-dashed border-emerald-500/30">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Sign in to access the Question Bank</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Browse thousands of curriculum questions, view solutions and answers, save favorite questions, and add custom notes.
            </p>
          </div>
          {onSignIn && (
            <Button
              onClick={onSignIn}
              className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <LogIn className="mr-2 h-4 w-4" /> Sign In / Sign Up
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-emerald-600" /> Question Bank
            </CardTitle>
            <CardDescription>
              Browse all {total.toLocaleString()} matching questions in the curriculum database.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={loading}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Refresh questions from database"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters row 1 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Class</Label>
              <Select value={classId || "all"} onValueChange={handleClassChange}>
                <SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {tree.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.class_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Select value={subjectId || "all"} onValueChange={handleSubjectChange}>
                <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.subject_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Question type</Label>
              <Select value={typeName} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {TYPE_NAMES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Difficulty</Label>
              <Select value={diffName} onValueChange={handleDiffChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  {DIFF_NAMES.map((d) => (
                    <SelectItem key={d} value={d}>{DIFF_META[d].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filters row 2 */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search question text, tags, blooms level…"
                  className="pl-8 text-base sm:text-sm"
                  type="search"
                  inputMode="search"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <KeyRound className="h-4 w-4 text-emerald-600" />
              <Label htmlFor="bk-ans" className="cursor-pointer text-sm">Show answers</Label>
              <Switch id="bk-ans" checked={showAnswers} onCheckedChange={setShowAnswers} />
            </div>
            <button
              type="button"
              aria-pressed={showFavOnly}
              onClick={() => setShowFavOnly((v) => !v)}
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                showFavOnly
                  ? "border-amber-500 bg-amber-500 text-white shadow-sm ring-1 ring-amber-500 dark:bg-amber-600"
                  : "border-border hover:border-amber-400 hover:bg-accent text-foreground",
              ].join(" ")}
              title="Show only favorited questions"
            >
              <Star className={`h-4 w-4 ${showFavOnly ? "fill-white text-white" : "text-amber-500"}`} />
              <span>Favorites</span>
              {favorites.size > 0 && (
                <Badge
                  variant={showFavOnly ? "default" : "secondary"}
                  className={`text-[10px] ${showFavOnly ? "bg-white text-amber-800" : ""}`}
                >
                  {favorites.size}
                </Badge>
              )}
            </button>
          </div>

          {/* Chapter chips - Horizontally scrollable on mobile (Chapter 13 Rec 2) */}
          {chapters.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Filter by Chapter:
                </span>
                <span className="text-[11px] sm:hidden text-muted-foreground/80">
                  Swipe horizontally →
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth sm:flex-wrap">
                <Button
                  size="sm"
                  variant={chapterIds.length === 0 ? "default" : "outline"}
                  className="h-7 shrink-0 rounded-full px-2.5 text-xs font-medium"
                  onClick={handleSelectAllChapters}
                >
                  All Chapters
                </Button>
                {chapters.map((c) => {
                  const count = searchCountsByChapter ? (searchCountsByChapter[c.id] || 0) : c.questionCount;
                  const isSelected = chapterIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChapter(c.id)}
                      className={cn(
                        "h-7 shrink-0 rounded-full border px-2.5 text-xs font-medium transition-colors whitespace-nowrap active:scale-95",
                        isSelected
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                          : "border-border hover:border-emerald-400 hover:bg-accent text-foreground"
                      )}
                      title={`Ch ${c.chapter_number}: ${c.chapter_name}`}
                    >
                      Ch{c.chapter_number}
                      <span className={cn(
                        "ml-1 text-[10px]",
                        isSelected ? "text-white/80" : "text-muted-foreground"
                      )}>
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              <strong className="text-foreground">
                {total === 0 ? 0 : page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, total)}
              </strong>{" "}
              of <strong className="text-foreground">{total}</strong> questions
            </div>
            <Button size="sm" variant="ghost" onClick={() => load(true)} disabled={loading}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`animate-fade-in rounded-lg border p-3 stagger-${Math.min(i + 1, 5)}`}
                >
                  <div className="flex gap-3">
                    <div className="shimmer h-6 w-6 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-1.5">
                        <div className="shimmer h-4 w-12 rounded" />
                        <div className="shimmer h-4 w-10 rounded" />
                        <div className="shimmer h-4 w-14 rounded" />
                      </div>
                      <div className="shimmer h-4 w-3/4 rounded" />
                      <div className="shimmer h-3 w-1/2 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Database className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No questions match your filters</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Try adjusting the search, type, difficulty, or chapter filters.
                </p>
              </div>
            </div>
          ) : showFavOnly && displayedQuestions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center animate-fade-in">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                <Star className="h-6 w-6 fill-amber-500/30" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No favorited questions found</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  {favorites.size === 0
                    ? "You haven't added any questions to your favorites yet. Click the star icon on any question to bookmark it."
                    : "None of your bookmarked favorites match the current search or filters."}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFavOnly(false)}
                className="text-xs mt-1 border-amber-500/40 text-amber-700 dark:text-amber-300"
              >
                View all questions
              </Button>
            </div>
          ) : (
            <ol className="space-y-3">
              {displayedQuestions.map((q, i) => (
                <BankQuestionCard
                  key={q.id}
                  q={q}
                  number={page * PAGE_SIZE + i + 1}
                  showAnswers={showAnswers}
                  isFavorite={favorites.has(q.id)}
                  onToggleFavorite={() => toggleFavorite(q.id)}
                  note={notes[q.id] ?? ""}
                  onEditNote={() => {
                    if (!user) {
                      toast.info("Please sign in or create an account to add question notes.");
                      onSignIn?.();
                      return;
                    }
                    setNoteEditingId(q.id);
                  }}
                />
              ))}
            </ol>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note editing dialog */}
      {noteEditingId && (
        <NoteDialog
          questionId={noteEditingId}
          currentNote={notes[noteEditingId] ?? ""}
          questionText={
            questions.find((q) => q.id === noteEditingId)?.question_text ?? ""
          }
          onClose={() => setNoteEditingId(null)}
          onSave={(text) => saveNote(noteEditingId, text)}
        />
      )}
    </div>
  );
}

function NoteDialog({
  questionId,
  currentNote,
  questionText,
  onClose,
  onSave,
}: {
  questionId: string;
  currentNote: string;
  questionText: string;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(currentNote);
  void questionId;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-blue-500" /> Question note
          </DialogTitle>
          <DialogDescription>
            Add a personal teaching note for this question. Notes are stored in your browser
            and visible only to you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-md border bg-muted/30 p-2.5 text-xs">
            <div className="mb-0.5 text-xs font-semibold text-muted-foreground">
              Question
            </div>
            <p className="leading-relaxed">{questionText}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-text">Your note</Label>
            <Textarea
              id="note-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="e.g. Students often confuse this with… / Good for revision before midterm…"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          {currentNote && (
            <Button
              variant="ghost"
              onClick={() => onSave("")}
              className="mr-auto text-destructive hover:bg-destructive/10"
            >
              Delete note
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(text)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <StickyNote className="mr-1 h-4 w-4" /> Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const typeBadgeStyles: Record<string, string> = {
  MCQ: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  Short: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  Long: "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
};

const diffBadgeStyles: Record<string, string> = {
  Easy: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
  Medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  Hard: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800",
};

function BankQuestionCard({
  q,
  number,
  showAnswers,
  isFavorite,
  onToggleFavorite,
  note,
  onEditNote,
}: {
  q: BankQuestion;
  number: number;
  showAnswers: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  note: string;
  onEditNote: () => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-3.5 sm:p-4 transition-colors hover:border-emerald-400/60 shadow-xs space-y-2.5 min-w-0 max-w-full overflow-hidden">
      {/* Question Header: Number, Badges, and Action Icons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {number}
          </span>
          <Badge
            variant="outline"
            className={cn("text-[10px] font-semibold border", typeBadgeStyles[q.type_name] ?? "")}
          >
            {q.type_name}
          </Badge>
          <Badge
            variant="outline"
            className={cn("text-[10px] font-semibold border", diffBadgeStyles[q.difficulty_name] ?? "")}
          >
            {q.difficulty_name}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-medium">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
          {q.blooms_taxonomy && (
            <Badge variant="secondary" className="text-[10px] font-medium hidden sm:inline-flex">{q.blooms_taxonomy}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEditNote}
            className={cn(
              "rounded-lg p-2 sm:p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors cursor-pointer",
              note
                ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                : "text-muted-foreground hover:text-emerald-600 hover:bg-muted"
            )}
            title={note ? "Edit note" : "Add note"}
            aria-label="Edit note"
          >
            <StickyNote className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleFavorite}
            className={cn(
              "rounded-lg p-2 sm:p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors cursor-pointer",
              isFavorite
                ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                : "text-muted-foreground hover:text-amber-500 hover:bg-muted"
            )}
            title={isFavorite ? "Remove favorite" : "Add to favorites"}
            aria-label="Toggle favorite"
          >
            <Star className={cn("h-4 w-4", isFavorite && "fill-amber-500")} />
          </button>
        </div>
      </div>

      {/* Chapter & Topic metadata */}
      {(q.chapter_name || q.topic_name) && (
        <div className="text-[11px] text-muted-foreground">
          {q.chapter_name && <span>{q.chapter_name}</span>}
          {q.chapter_name && q.topic_name && <span> · </span>}
          {q.topic_name && <span>{q.topic_name}</span>}
        </div>
      )}

      {/* Question Text */}
      <div className="text-sm leading-relaxed text-foreground break-words">
        {renderInlineStyles(q.question_text)}
      </div>

      {q.options && (
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {(["A", "B", "C", "D"] as const).map((l) => {
            const text = q.options![`option_${l.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"];
            const correct = l === q.options!.correct_option;
            return (
              <div
                key={l}
                className={[
                  "flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                  showAnswers && correct
                    ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100 font-medium"
                    : "border-border text-foreground",
                ].join(" ")}
              >
                <span className="font-bold text-muted-foreground">{l}.</span>
                <span className="flex-1 break-words">{renderInlineStyles(text)}</span>
                {showAnswers && correct && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {q.tags && (
        <div className="mt-1 flex flex-wrap gap-1">
          {q.tags.split(",").map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] font-normal">
              #{tag.trim()}
            </Badge>
          ))}
        </div>
      )}

      {note && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-2.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="flex-1 leading-relaxed text-emerald-950 dark:text-emerald-200">{note}</p>
          <button
            onClick={onEditNote}
            className="shrink-0 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 cursor-pointer"
            aria-label="Edit note"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

/* Favorites persistence (localStorage) */

const FAV_KEY = "examforge-question-favorites";

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(set: Set<string>) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/* Notes persistence (localStorage) — questionId → note text */

const NOTES_KEY = "examforge-question-notes";

function loadNotes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveNotes(notes: Record<string, string>) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    /* ignore */
  }
}
