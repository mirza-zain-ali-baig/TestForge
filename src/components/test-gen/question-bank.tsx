"use client";

import { useEffect, useState, useCallback } from "react";
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
import {
  fetchCurriculum,
  fetchQuestions,
  TYPE_NAMES,
  DIFF_NAMES,
  TYPE_META,
  DIFF_META,
  type CurriculumNode,
  type BankQuestion,
} from "./lib";

const PAGE_SIZE = 20;

export function QuestionBank() {
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
    fetchCurriculum()
      .then((d) => {
        setTree(d.tree);
        if (d.tree && d.tree.length > 0) {
          const firstClass = d.tree[0];
          setClassId((prev) => prev || firstClass.id);
          if (firstClass.subjects && firstClass.subjects.length > 0) {
            setSubjectId((prev) => prev || firstClass.subjects![0].id);
          }
        }
      })
      .catch((e) => toast.error(e.message));
  }, []);

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
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setChapterIds([]);
  }, [subjectId]);

  useEffect(() => {
    setPage(0);
  }, [classId, subjectId, chapterIds, typeName, diffName, debouncedSearch]);

  const load = useCallback(async () => {
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
      });
      setQuestions(res.questions ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [subjectId, chapterIds, typeName, diffName, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
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

  const toggleChapter = (id: string) =>
    setChapterIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-emerald-600" /> Question Bank
          </CardTitle>
          <CardDescription>
            Browse all {total.toLocaleString()} matching questions in the curriculum database.
          </CardDescription>
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
              <Select value={subjectId || "all"} onValueChange={setSubjectId}>
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
              <Select value={typeName} onValueChange={setTypeName}>
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
              <Select value={diffName} onValueChange={setDiffName}>
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
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <KeyRound className="h-4 w-4 text-emerald-600" />
              <Label htmlFor="bk-ans" className="cursor-pointer text-sm">Show answers</Label>
              <Switch id="bk-ans" checked={showAnswers} onCheckedChange={setShowAnswers} />
            </div>
            <button
              onClick={() => setShowFavOnly((v) => !v)}
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                showFavOnly
                  ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                  : "hover:border-amber-400 hover:bg-accent",
              ].join(" ")}
              title="Show only favorited questions"
            >
              <Star className={`h-4 w-4 ${showFavOnly ? "fill-amber-500 text-amber-500" : ""}`} />
              <span>Favorites</span>
              {favorites.size > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {favorites.size}
                </Badge>
              )}
            </button>
          </div>

          {/* Chapter chips */}
          {chapters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Filter className="h-3 w-3" /> Chapters:
              </span>
              <Button
                size="sm"
                variant={chapterIds.length === 0 ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => setChapterIds([])}
              >
                All
              </Button>
              {chapters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleChapter(c.id)}
                  className={[
                    "h-7 rounded-full border px-2.5 text-xs transition-colors",
                    chapterIds.includes(c.id)
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-border hover:border-emerald-400",
                  ].join(" ")}
                  title={`Ch ${c.chapter_number}: ${c.chapter_name}`}
                >
                  Ch{c.chapter_number}
                  <span className="ml-1 opacity-70">({c.questionCount})</span>
                </button>
              ))}
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
                {total === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}
              </strong>{" "}
              of <strong className="text-foreground">{total}</strong> questions
            </div>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
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
          ) : (
            <ol className="space-y-3">
              {(showFavOnly
                ? questions.filter((q) => favorites.has(q.id))
                : questions
              ).map((q, i) => (
                <BankQuestionCard
                  key={q.id}
                  q={q}
                  number={page * PAGE_SIZE + i + 1}
                  showAnswers={showAnswers}
                  isFavorite={favorites.has(q.id)}
                  onToggleFavorite={() => toggleFavorite(q.id)}
                  note={notes[q.id] ?? ""}
                  onEditNote={() => setNoteEditingId(q.id)}
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
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
    <li className="rounded-lg border bg-card p-3 transition-colors hover:border-emerald-300">
      <div className="flex gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium border", typeBadgeStyles[q.type_name] ?? "")}
            >
              {q.type_name}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium border", diffBadgeStyles[q.difficulty_name] ?? "")}
            >
              {q.difficulty_name}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
            {q.blooms_taxonomy && (
              <Badge variant="outline" className="text-[10px]">{q.blooms_taxonomy}</Badge>
            )}
            {q.chapter_name && (
              <span className="text-[10px] text-muted-foreground">· {q.chapter_name}</span>
            )}
            {q.topic_name && (
              <span className="text-[10px] text-muted-foreground">· {q.topic_name}</span>
            )}
            <button
              onClick={onEditNote}
              className={[
                "ml-auto rounded-md p-1 transition-colors",
                note
                  ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  : "text-muted-foreground/40 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
              ].join(" ")}
              title={note ? "Edit note" : "Add note"}
              aria-label="Edit note"
            >
              <StickyNote className={`h-3.5 w-3.5 ${note ? "fill-emerald-100 dark:fill-emerald-950/40" : ""}`} />
            </button>
            <button
              onClick={onToggleFavorite}
              className={[
                "rounded-md p-1 transition-colors",
                isFavorite
                  ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  : "text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30",
              ].join(" ")}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              aria-label="Toggle favorite"
            >
              <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-amber-500" : ""}`} />
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{q.question_text}</p>

          {q.options && (
            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {(["A", "B", "C", "D"] as const).map((l) => {
                const text = q.options![`option_${l.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"];
                const correct = l === q.options!.correct_option;
                return (
                  <div
                    key={l}
                    className={[
                      "flex items-start gap-2 rounded-md border px-2 py-1 text-xs",
                      showAnswers && correct
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-border",
                    ].join(" ")}
                  >
                    <span className="font-semibold text-muted-foreground">{l}.</span>
                    <span className="flex-1">{text}</span>
                    {showAnswers && correct && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {q.tags && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {q.tags.split(",").map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  #{tag.trim()}
                </Badge>
              ))}
            </div>
          )}

          {note && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-emerald-200/80 bg-emerald-50/50 p-2 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="flex-1 leading-relaxed text-emerald-950 dark:text-emerald-200">{note}</p>
              <button
                onClick={onEditNote}
                className="shrink-0 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                aria-label="Edit note"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
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
