"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Layers,
  ClipboardList,
  Sparkles,
  ChevronDown,
  Check,
  Clock,
  FileText,
  Wand2,
  Database,
  Bot,
  Shuffle,
  CheckCircle2,
  Info,
  Bookmark,
  X,
  Plus,
  CopyPlus,
  Filter,
  SquareStack,
  Settings2,
  Lock,
  LogIn,
  UserPlus,
  GraduationCap,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Play,
  Printer,
  ListTree,
  CheckSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  fetchCurriculum,
  generateTest,
  generateBatch,
  suggestBlueprint,
  fetchQuestionSources,
  TYPE_NAMES,
  DIFF_NAMES,
  TYPE_META,
  type CurriculumNode,
  type AuthUser,
} from "./lib";
import type {
  GenerateTestRequest,
  GeneratedTest,
  Blueprint,
  QuestionTypeName,
  DifficultyName,
  GenerateSource,
} from "@/lib/types";

export type WizardStep = "class" | "subject" | "syllabus" | "setup";

/* ----------------------------- Quick Presets ----------------------------- */

type PresetDef = {
  id: string;
  name: string;
  desc: string;
  marks: number;
  duration: number;
  questionCount: number;
  emoji: string;
  blueprint: Blueprint;
};

const PRESETS: PresetDef[] = [
  {
    id: "quick-quiz",
    name: "Quick Quiz",
    desc: "10 MCQ + 3 Short",
    marks: 19,
    duration: 30,
    questionCount: 13,
    emoji: "⚡",
    blueprint: {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 4, Medium: 4, Hard: 2 } },
      Short: { marksPerQuestion: 3, difficulties: { Easy: 1, Medium: 1, Hard: 1 } },
      Long: { marksPerQuestion: 5, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
    },
  },
  {
    id: "class-test",
    name: "Class Test",
    desc: "15 MCQ + 3 Short + 1 Long",
    marks: 35,
    duration: 60,
    questionCount: 19,
    emoji: "📘",
    blueprint: {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 5, Medium: 7, Hard: 3 } },
      Short: { marksPerQuestion: 3, difficulties: { Easy: 1, Medium: 1, Hard: 1 } },
      Long: { marksPerQuestion: 5, difficulties: { Easy: 0, Medium: 1, Hard: 0 } },
    },
  },
  {
    id: "full-exam",
    name: "Full Exam",
    desc: "25 MCQ + 5 Short + 3 Long",
    marks: 65,
    duration: 90,
    questionCount: 33,
    emoji: "🎓",
    blueprint: {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 8, Medium: 10, Hard: 7 } },
      Short: { marksPerQuestion: 3, difficulties: { Easy: 2, Medium: 2, Hard: 1 } },
      Long: { marksPerQuestion: 5, difficulties: { Easy: 1, Medium: 1, Hard: 1 } },
    },
  },
  {
    id: "mcq-only",
    name: "MCQ Only",
    desc: "20 MCQ",
    marks: 20,
    duration: 30,
    questionCount: 20,
    emoji: "✅",
    blueprint: {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 7, Medium: 8, Hard: 5 } },
      Short: { marksPerQuestion: 3, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
      Long: { marksPerQuestion: 5, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
    },
  },
];

/* ----------------------------- Source presets ----------------------------- */

const SOURCES: {
  id: GenerateSource;
  label: string;
  icon: typeof Database;
  desc: string;
}[] = [
  { id: "bank", label: "Bank", icon: Database, desc: "Curated bank questions. Fastest." },
  { id: "hybrid", label: "Hybrid", icon: Sparkles, desc: "Bank first, AI fills gaps." },
  { id: "ai", label: "AI", icon: Bot, desc: "Fully AI-generated. Slower." },
];

/* ----------------------------- Helpers ----------------------------- */

function emptyBlueprint(): Blueprint {
  return {
    MCQ: { marksPerQuestion: 1, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
    Short: { marksPerQuestion: 3, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
    Long: { marksPerQuestion: 5, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
  };
}

// Evenly distribute `total` questions across Easy / Medium / Hard.
function distributeEvenly(total: number): Record<DifficultyName, number> {
  const safe = Math.max(0, total);
  const easy = Math.ceil(safe / 3);
  const medium = Math.ceil((safe - easy) / 2);
  const hard = safe - easy - medium;
  return { Easy: easy, Medium: medium, Hard: hard };
}

/* ========================================================================= */
/*                              GeneratorWizard                              */
/* ========================================================================= */

export function GeneratorWizard({
  onGenerated,
  user,
  onRequireAuth,
}: {
  onGenerated: (variants: GeneratedTest[], mode?: "preview" | "practice" | "print") => void;
  user?: AuthUser | null;
  onRequireAuth?: (tab?: "login" | "register") => void;
}) {
  const [tree, setTree] = useState<CurriculumNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState<WizardStep>("class");

  // selection
  const [classId, setClassId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [topicIds, setTopicIds] = useState<string[]>([]);

  // details
  const [title, setTitle] = useState("");
  const [durationMins, setDurationMins] = useState(60);
  const [instructions, setInstructions] = useState(
    "Read each question carefully. Attempt all questions. Write your answers in the space provided. No electronic devices allowed."
  );

  // blueprint
  const [blueprint, setBlueprint] = useState<Blueprint>(emptyBlueprint());
  const [source, setSource] = useState<GenerateSource>("bank");
  const [shuffle, setShuffle] = useState(true);
  const [variantCount, setVariantCount] = useState(1);
  const [questionSources, setQuestionSources] = useState<string[]>([]);

  // UI state
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const generateBtnRef = useRef<HTMLDivElement>(null);

  /* -------------------- Mount: load curriculum -------------------- */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCurriculum()
      .then((d) => {
        if (!alive) return;
        setTree(d.tree);
        if (d.tree[0]) {
          if (!classId) {
            setClassId(d.tree[0].id);
            const firstSubject = d.tree[0].subjects?.[0];
            if (firstSubject) {
              setSubjectId(firstSubject.id);
              if (firstSubject.chapters?.length) {
                setChapterIds(firstSubject.chapters.map((c) => c.id));
              }
            }
          }
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const currentClass = tree.find((c) => c.id === classId) ?? tree[0];
  const currentSubject = currentClass?.subjects?.find((s) => s.id === subjectId) ?? currentClass?.subjects?.[0];
  const chapters = currentSubject?.chapters ?? [];
  const selectedChapters = chapters.filter((c) => chapterIds.includes(c.id));

  const allTopics = useMemo(
    () => selectedChapters.flatMap((c) => c.topics ?? []),
    [selectedChapters]
  );

  /* -------------------- When class changes, auto-pick first subject of new class -------------------- */
  useEffect(() => {
    if (!classId || tree.length === 0) return;
    const cls = tree.find((c) => c.id === classId);
    const subjects = cls?.subjects ?? [];
    if (subjects.length === 0) return;
    const stillValid = subjects.some((s) => s.id === subjectId);
    if (!stillValid) {
      setSubjectId(subjects[0].id);
    }
  }, [classId, tree, subjectId]);

  /* -------------------- When subject changes, auto-select all its chapters -------------------- */
  useEffect(() => {
    if (!subjectId || tree.length === 0) return;
    let found: CurriculumNode | undefined;
    for (const cls of tree) {
      found = cls.subjects?.find((s) => s.id === subjectId);
      if (found) break;
    }
    if (found?.chapters?.length) {
      setChapterIds(found.chapters.map((c) => c.id));
    } else {
      setChapterIds([]);
    }
    setTopicIds([]);
    setQuestionSources([]);
  }, [subjectId, tree]);

  const totalQuestions = useMemo(
    () =>
      TYPE_NAMES.reduce(
        (s, t) =>
          s +
          (blueprint[t].difficulties.Easy +
            blueprint[t].difficulties.Medium +
            blueprint[t].difficulties.Hard),
        0
      ),
    [blueprint]
  );

  const totalMarks = useMemo(
    () =>
      TYPE_NAMES.reduce(
        (s, t) =>
          s +
          (blueprint[t].difficulties.Easy +
            blueprint[t].difficulties.Medium +
            blueprint[t].difficulties.Hard) *
            blueprint[t].marksPerQuestion,
        0
      ),
    [blueprint]
  );

  /* -------------------- Blueprint setters -------------------- */
  const setTypeCount = (t: QuestionTypeName, total: number) => {
    setSelectedPreset("");
    setBlueprint({
      ...blueprint,
      [t]: {
        ...blueprint[t],
        difficulties: distributeEvenly(total),
      },
    });
  };

  const setCount = (t: QuestionTypeName, d: DifficultyName, v: number) => {
    setSelectedPreset("");
    setBlueprint({
      ...blueprint,
      [t]: {
        ...blueprint[t],
        difficulties: { ...blueprint[t].difficulties, [d]: Math.max(0, v) },
      },
    });
  };

  const setMarks = (t: QuestionTypeName, v: number) => {
    setSelectedPreset("");
    setBlueprint({
      ...blueprint,
      [t]: { ...blueprint[t], marksPerQuestion: Math.max(1, v) },
    });
  };

  /* -------------------- Chapter / topic toggles -------------------- */
  const toggleChapter = (id: string) => {
    setChapterIds(
      chapterIds.includes(id)
        ? chapterIds.filter((x) => x !== id)
        : [...chapterIds, id]
    );
  };
  const selectAllChapters = () => setChapterIds(chapters.map((c) => c.id));
  const toggleTopic = (id: string) => {
    setTopicIds(
      topicIds.includes(id) ? topicIds.filter((x) => x !== id) : [...topicIds, id]
    );
  };

  /* -------------------- Preset click -------------------- */
  const handlePresetClick = (preset: PresetDef) => {
    setSelectedPreset(preset.id);
    setBlueprint(preset.blueprint);
    setDurationMins(preset.duration);
  };

  /* -------------------- Generate (supports Online Practice or Print modes) -------------------- */
  const handleGenerate = async (mode: "preview" | "practice" | "print" = "preview") => {
    if (!user) {
      toast.error("Please sign in or register an account to generate tests.");
      onRequireAuth?.("login");
      return;
    }
    if (!currentClass || !currentSubject) {
      toast.error("Please select a class and subject first.");
      return;
    }
    if (chapterIds.length === 0) {
      toast.error("Please select at least one chapter from the syllabus.");
      setStep("syllabus");
      return;
    }
    if (totalQuestions === 0) {
      toast.error("Please add at least 1 question to the blueprint or pick a preset.");
      return;
    }
    setGenerating(true);
    try {
      const req: GenerateTestRequest = {
        classId,
        className: currentClass.class_name ?? "",
        subjectId,
        subjectName: currentSubject.subject_name ?? "",
        title: title.trim() || `${currentClass.class_name} ${currentSubject.subject_name} Exam`,
        durationMins,
        instructions,
        chapterIds,
        topicIds,
        blueprint,
        source,
        shuffle,
        questionSources:
          questionSources.length > 0 ? questionSources : undefined,
      };
      if (variantCount > 1) {
        const variants = await generateBatch(req, variantCount);
        toast.success(
          `Generated ${variants.length} variants — ${variants[0].totalQuestions} questions each`
        );
        onGenerated(variants, mode);
      } else {
        const test = await generateTest(req);
        toast.success(
          `Test generated — ${test.totalQuestions} questions, ${test.totalMarks} marks`
        );
        onGenerated([test], mode);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate =
    totalQuestions > 0 &&
    chapterIds.length > 0 &&
    !!currentClass &&
    !!currentSubject;

  const STEPS_CONFIG = [
    { id: "class" as const, num: 1, label: "Class", subtitle: currentClass?.class_name || "Select Grade" },
    { id: "subject" as const, num: 2, label: "Subject", subtitle: currentSubject?.subject_name || "Select Subject" },
    { id: "syllabus" as const, num: 3, label: "Syllabus", subtitle: `${chapterIds.length} Chapters` },
    { id: "setup" as const, num: 4, label: "Test Setup", subtitle: "Practice / Print" },
  ];

  return (
    <div className="space-y-6">
      {/* Auth required banner */}
      {!user && (
        <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-800/70 dark:bg-amber-950/30">
          <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                  Sign In Required to Generate Tests
                </div>
                <div className="text-xs text-amber-800/90 dark:text-amber-200/80">
                  Only registered and signed-in users can generate or practice tests.
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRequireAuth?.("register")}
                className="border-amber-400 bg-background text-xs hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
              >
                <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Register
              </Button>
              <Button
                size="sm"
                onClick={() => onRequireAuth?.("login")}
                className="bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              >
                <LogIn className="mr-1.5 h-3.5 w-3.5" /> Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stepper Navigation Bar */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center justify-between rounded-xl border bg-card p-2 sm:p-3 shadow-sm min-w-[550px]">
          {STEPS_CONFIG.map((s, idx) => {
            const isCurrent = step === s.id;
            const stepOrder: WizardStep[] = ["class", "subject", "syllabus", "setup"];
            const currentIndex = stepOrder.indexOf(step);
            const thisIndex = stepOrder.indexOf(s.id);
            const isCompleted = thisIndex < currentIndex;
            const isClickable =
              thisIndex < currentIndex ||
              (s.id === "subject" && !!classId) ||
              (s.id === "syllabus" && !!classId && !!subjectId);

            return (
              <div key={s.id} className="flex flex-1 items-center">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) {
                      setStep(s.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all ${
                    isCurrent
                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 font-semibold"
                      : isCompleted
                      ? "text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-pointer"
                      : "text-muted-foreground/60 cursor-not-allowed"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-600/20"
                        : isCompleted
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight">{s.label}</div>
                    <div className="truncate text-[11px] font-normal text-muted-foreground">
                      {s.subtitle}
                    </div>
                  </div>
                </button>
                {idx < STEPS_CONFIG.length - 1 && (
                  <div className="mx-2 h-4 w-px bg-border shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="space-y-4 p-8">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* STEP 1: CLASS SELECTION WINDOW                                            */}
          {/* ========================================================================= */}
          {step === "class" && (
            <div className="space-y-6">
              <div className="text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 mb-2">
                  <GraduationCap className="h-3.5 w-3.5" /> Step 1 of 4: Academic Level
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Select Your Class / Grade</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose your class level below to view subjects, chapters, and available question bank.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tree.map((cls) => {
                  const isSelected = classId === cls.id;
                  const subjectsCount = cls.subjects?.length ?? 0;
                  const qCount = cls.questionCount ?? 0;

                  return (
                    <div
                      key={cls.id}
                      onClick={() => {
                        setClassId(cls.id);
                        if (cls.subjects && cls.subjects.length > 0) {
                          setSubjectId(cls.subjects[0].id);
                          if (cls.subjects[0].chapters?.length) {
                            setChapterIds(cls.subjects[0].chapters.map((c) => c.id));
                          }
                        }
                        setStep("subject");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`group relative flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-600/20"
                          : "border-border bg-card hover:border-emerald-400 hover:bg-accent/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                            <GraduationCap className="h-6 w-6" />
                          </div>
                          {isSelected && (
                            <Badge className="bg-emerald-600 text-white border-0 text-xs">
                              Selected
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-lg font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {cls.class_name}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
                            <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                            {subjectsCount} {subjectsCount === 1 ? "Subject" : "Subjects"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
                            <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                            {qCount.toLocaleString()} Questions
                          </span>
                        </div>

                        {cls.subjects && cls.subjects.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {cls.subjects.slice(0, 4).map((sub) => (
                              <span
                                key={sub.id}
                                className="rounded-md border bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground"
                              >
                                {sub.subject_name}
                              </span>
                            ))}
                            {cls.subjects.length > 4 && (
                              <span className="rounded-md border bg-background/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                +{cls.subjects.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t pt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <span>Select Subject</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: SUBJECT SELECTION WINDOW                                          */}
          {/* ========================================================================= */}
          {step === "subject" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("class");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="mb-2 -ml-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Classes
                  </Button>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight">Select Subject</h2>
                    <Badge variant="secondary" className="font-semibold">
                      {currentClass?.class_name}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose a subject for {currentClass?.class_name} to view its syllabus and select chapters.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(currentClass?.subjects ?? []).map((sub) => {
                  const isSelected = subjectId === sub.id;
                  const chapCount = sub.chapters?.length ?? 0;
                  const qCount = sub.questionCount ?? 0;

                  return (
                    <div
                      key={sub.id}
                      onClick={() => {
                        setSubjectId(sub.id);
                        if (sub.chapters?.length) {
                          setChapterIds(sub.chapters.map((c) => c.id));
                        } else {
                          setChapterIds([]);
                        }
                        setStep("syllabus");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`group relative flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-600/20"
                          : "border-border bg-card hover:border-emerald-400 hover:bg-accent/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                            <BookOpen className="h-6 w-6" />
                          </div>
                          {isSelected && (
                            <Badge className="bg-emerald-600 text-white border-0 text-xs">
                              Selected
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-lg font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {sub.subject_name}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
                            <Layers className="h-3.5 w-3.5 text-emerald-600" />
                            {chapCount} {chapCount === 1 ? "Chapter" : "Chapters"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
                            <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                            {qCount.toLocaleString()} Questions
                          </span>
                        </div>

                        {sub.chapters && sub.chapters.length > 0 && (
                          <div className="mt-4 space-y-1">
                            <div className="text-[11px] font-medium text-muted-foreground">
                              Syllabus Preview:
                            </div>
                            <div className="space-y-1">
                              {sub.chapters.slice(0, 3).map((ch, idx) => (
                                <div
                                  key={ch.id}
                                  className="truncate text-xs text-muted-foreground/90"
                                >
                                  <span className="font-mono text-[10px] text-muted-foreground mr-1">
                                    Ch {ch.chapter_number || idx + 1}:
                                  </span>
                                  {ch.chapter_name}
                                </div>
                              ))}
                              {sub.chapters.length > 3 && (
                                <div className="text-[11px] text-muted-foreground font-medium">
                                  +{sub.chapters.length - 3} more chapters…
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t pt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <span>Select Syllabus & Topics</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SYLLABUS SELECTION WINDOW (CHAPTERS & SUBTOPICS IN CARDS)        */}
          {/* ========================================================================= */}
          {step === "syllabus" && (
            <div className="space-y-6">
              {/* Header with back button and breadcrumb */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("subject");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="mb-2 -ml-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Subjects
                  </Button>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight">Select Syllabus & Subtopics</h2>
                    <Badge variant="outline" className="font-semibold text-xs">
                      {currentClass?.class_name}
                    </Badge>
                    <span className="text-muted-foreground">›</span>
                    <Badge className="bg-emerald-600 text-white font-semibold text-xs border-0">
                      {currentSubject?.subject_name}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select the chapters and specific subtopics you want to include in this test or practice session.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllChapters}
                    className="text-xs"
                  >
                    <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Select All Chapters
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setChapterIds([]);
                      setTopicIds([]);
                    }}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-semibold">
                    {chapterIds.length} of {chapters.length} Chapters Selected
                  </Badge>
                  {topicIds.length > 0 ? (
                    <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 border-emerald-400">
                      {topicIds.length} Specific Subtopics Filtered
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      (All subtopics of selected chapters included by default)
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={chapterIds.length === 0}
                  onClick={() => {
                    setStep("setup");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-4"
                >
                  Continue to Test Setup <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Chapters List with Subtopics Cards */}
              <div className="space-y-4">
                {chapters.map((chap, idx) => {
                  const isChecked = chapterIds.includes(chap.id);
                  const topics = chap.topics ?? [];
                  const chapNo = chap.chapter_number || idx + 1;

                  return (
                    <Card
                      key={chap.id}
                      className={`overflow-hidden transition-all border-2 ${
                        isChecked
                          ? "border-emerald-500/80 bg-card shadow-sm ring-1 ring-emerald-500/20"
                          : "border-border bg-card/60 opacity-80 hover:opacity-100"
                      }`}
                    >
                      {/* Chapter Card Header */}
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-emerald-200/50 dark:border-emerald-900/50"
                            : "hover:bg-accent/40"
                        }`}
                        onClick={() => toggleChapter(chap.id)}
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleChapter(chap.id)}
                            className="mt-0.5 sm:mt-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={isChecked ? "default" : "secondary"}
                                className={isChecked ? "bg-emerald-600 text-white" : ""}
                              >
                                Chapter {chapNo}
                              </Badge>
                              <h3 className="text-base font-bold text-foreground">
                                {chap.chapter_name}
                              </h3>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {topics.length} Subtopics · {chap.questionCount ?? 0} Questions Available
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleChapter(chap.id);
                            }}
                            className="h-7 text-xs font-medium"
                          >
                            {isChecked ? "Deselect Chapter" : "Select Chapter"}
                          </Button>
                        </div>
                      </div>

                      {/* Subtopics Section inside Chapter Card */}
                      {isChecked && (
                        <div className="p-4 bg-background/50">
                          <div className="mb-2.5 flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <ListTree className="h-3.5 w-3.5 text-emerald-600" />
                              Subtopics / Articles ({topics.length})
                            </span>
                            {topics.length > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                Click any subtopic to include/exclude specifically
                              </span>
                            )}
                          </div>

                          {topics.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {topics.map((t, topicIdx) => {
                                const isTopicSelected = topicIds.includes(t.id);
                                const articleNo = t.topic_article_no || `${chapNo}.${topicIdx + 1}`;

                                return (
                                  <div
                                    key={t.id}
                                    onClick={() => {
                                      if (topicIds.includes(t.id)) {
                                        setTopicIds(topicIds.filter((id) => id !== t.id));
                                      } else {
                                        setTopicIds([...topicIds, t.id]);
                                      }
                                    }}
                                    className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition-all cursor-pointer ${
                                      isTopicSelected
                                        ? "border-emerald-600 bg-emerald-50 font-medium text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100"
                                        : "border-border bg-card hover:border-emerald-400 hover:bg-accent/50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Checkbox
                                        checked={isTopicSelected}
                                        onCheckedChange={() => {
                                          if (topicIds.includes(t.id)) {
                                            setTopicIds(topicIds.filter((id) => id !== t.id));
                                          } else {
                                            setTopicIds([...topicIds, t.id]);
                                          }
                                        }}
                                        className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 shrink-0"
                                      />
                                      <Badge
                                        variant="outline"
                                        className="font-mono text-[10px] px-1.5 py-0 shrink-0"
                                      >
                                        {articleNo}
                                      </Badge>
                                      <span className="truncate" title={t.topic_name}>
                                        {t.topic_name}
                                      </span>
                                    </div>
                                    {t.questionCount != null && t.questionCount > 0 && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] shrink-0"
                                      >
                                        {t.questionCount} Qs
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                              All questions in this chapter are included in the test pool.
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {/* Sticky / Prominent Bottom Continuation Bar */}
              <div className="sticky bottom-4 z-20 rounded-xl border-2 border-emerald-500/80 bg-card p-4 shadow-xl backdrop-blur">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">
                      {chapterIds.length} {chapterIds.length === 1 ? "Chapter" : "Chapters"} Selected
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {topicIds.length > 0
                        ? `${topicIds.length} specific subtopics selected`
                        : "All subtopics included across selected chapters"}
                    </div>
                  </div>

                  <Button
                    size="lg"
                    disabled={chapterIds.length === 0}
                    onClick={() => {
                      setStep("setup");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow"
                  >
                    Continue to Test Setup & Generation <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: TEST SETUP & GENERATION (PRACTICE ONLINE / PRINT EXPORT)          */}
          {/* ========================================================================= */}
          {step === "setup" && (
            <div className="space-y-6">
              {/* Header with back button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("syllabus");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="mb-2 -ml-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Syllabus Selection
                  </Button>
                  <h2 className="text-2xl font-bold tracking-tight">Configure Your Test</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set up your question counts, marks, difficulty, and choose whether to practice interactively online or generate a printable paper.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {currentClass?.class_name}
                  </Badge>
                  <span className="text-muted-foreground">›</span>
                  <Badge variant="outline" className="text-xs font-semibold">
                    {currentSubject?.subject_name}
                  </Badge>
                  <span className="text-muted-foreground">›</span>
                  <Badge className="bg-emerald-600 text-white text-xs border-0">
                    {chapterIds.length} Chapters
                  </Badge>
                </div>
              </div>

              {/* Section 1: Quick Presets */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wand2 className="h-4 w-4 text-emerald-600" /> Quick Exam Presets
                  </CardTitle>
                  <CardDescription>
                    Select a preset blueprint to configure question counts and timing in one click, or customize below.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {PRESETS.map((p) => {
                      const selected = selectedPreset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePresetClick(p)}
                          className={`flex min-h-[140px] flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                            selected
                              ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/30 dark:bg-emerald-950/40"
                              : "border-border bg-card hover:border-emerald-400 hover:bg-emerald-50/40 hover:shadow-sm dark:hover:bg-emerald-950/20"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-3xl" aria-hidden>
                              {p.emoji}
                            </span>
                            {selected && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold leading-tight">{p.name}</div>
                            <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                          </div>
                          <div className="mt-auto flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {p.marks} marks
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {p.duration} min
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Question Setup (MCQ, Short, Long) */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <SquareStack className="h-4 w-4 text-emerald-600" /> Question Breakdown
                      </CardTitle>
                      <CardDescription>
                        Set the number of questions and marks per question for each category.
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1">
                        Total Questions: <strong className="ml-1 text-emerald-600">{totalQuestions}</strong>
                      </Badge>
                      <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1">
                        Total Marks: <strong className="ml-1 text-emerald-600">{totalMarks}</strong>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {TYPE_NAMES.map((t) => {
                      const cfg = blueprint[t];
                      const meta = TYPE_META[t];
                      const typeCount =
                        cfg.difficulties.Easy +
                        cfg.difficulties.Medium +
                        cfg.difficulties.Hard;
                      const dimmed = typeCount === 0;
                      const colorVar = `var(--chart-${TYPE_NAMES.indexOf(t) + 1})`;
                      return (
                        <div
                          key={t}
                          className={`rounded-xl border-2 p-4 transition-all ${
                            dimmed ? "border-muted bg-muted/20 opacity-60" : "bg-card shadow-sm"
                          }`}
                          style={dimmed ? undefined : { borderColor: colorVar }}
                        >
                          <div className="mb-3 flex items-center gap-2.5">
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
                              style={{ background: colorVar }}
                            >
                              <TypeIcon name={t} />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold">
                                {meta.label}
                              </div>
                              <div className="truncate text-[11px] text-muted-foreground font-medium">
                                {typeCount} Questions · {typeCount * cfg.marksPerQuestion} Marks
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Questions
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                value={typeCount}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === "") return;
                                  const n = parseInt(raw, 10);
                                  if (!isNaN(n)) setTypeCount(t, Math.max(0, n));
                                }}
                                className="mt-1 h-9 text-sm font-bold"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Marks/Q
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                value={cfg.marksPerQuestion}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === "") return;
                                  const n = parseInt(raw, 10);
                                  if (!isNaN(n)) setMarks(t, Math.max(1, n));
                                }}
                                className="mt-1 h-9 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: Test Options & Advanced Customization */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings2 className="h-4 w-4 text-emerald-600" /> Exam Details & Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Title and Duration */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-xs font-semibold">
                        Test Title (Printed at top of paper)
                      </Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={`e.g. ${currentClass?.class_name ?? ""} ${currentSubject?.subject_name ?? ""} Examination`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2 text-xs font-semibold">
                        <Clock className="h-3.5 w-3.5 text-emerald-600" /> Exam Duration: {durationMins} minutes
                      </Label>
                      <div className="pt-2">
                        <Slider
                          value={[durationMins]}
                          onValueChange={(v) => setDurationMins(v[0])}
                          min={15}
                          max={180}
                          step={5}
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                          <span>15 min</span>
                          <span>90 min</span>
                          <span>180 min (3 hrs)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Question Source */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-semibold">Question Source</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {SOURCES.map((s) => {
                        const selected = source === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSource(s.id)}
                            title={s.desc}
                            className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center transition-all ${
                              selected
                                ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                                : "border-border hover:border-emerald-400 hover:bg-accent/40"
                            }`}
                          >
                            <s.icon className="h-4 w-4 text-emerald-600" />
                            <span className="text-xs font-bold">{s.label}</span>
                            <span className="text-[10px] text-muted-foreground line-clamp-1">{s.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Collapsible Advanced Settings (Difficulty, Source filter, Instructions, Templates) */}
                  <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        <ChevronDown
                          className={`mr-1.5 h-3.5 w-3.5 transition-transform ${
                            advancedOpen ? "rotate-180" : ""
                          }`}
                        />
                        {advancedOpen ? "Hide Advanced Options" : "Show Advanced Options (Difficulty, Filters, Instructions)"}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3 space-y-4 rounded-xl border bg-muted/20 p-4">
                        {/* Shuffle switch */}
                        <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                          <div className="flex items-center gap-2">
                            <Shuffle className="h-4 w-4 text-emerald-600" />
                            <div>
                              <div className="text-xs font-semibold">Shuffle Questions & Options</div>
                              <div className="text-[11px] text-muted-foreground">
                                Randomize order of questions and multiple choice options.
                              </div>
                            </div>
                          </div>
                          <Switch checked={shuffle} onCheckedChange={setShuffle} />
                        </div>

                        {/* Difficulty breakdown */}
                        <div className="rounded-lg border bg-card p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold flex items-center gap-2">
                              <Shuffle className="h-3.5 w-3.5 text-emerald-600" />
                              Difficulty Distribution (Easy / Medium / Hard)
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDifficultyOpen(!difficultyOpen)}
                              className="h-7 text-xs"
                            >
                              {difficultyOpen ? "Hide Details" : "Fine-Tune"}
                            </Button>
                          </div>
                          {difficultyOpen && (
                            <DifficultyEditor
                              blueprint={blueprint}
                              setBlueprint={(bp) => {
                                setSelectedPreset("");
                                setBlueprint(bp);
                              }}
                              setCount={setCount}
                              subjectId={subjectId}
                              chapterIds={chapterIds}
                              topicIds={topicIds}
                              selectedChapters={selectedChapters}
                              allTopics={allTopics}
                            />
                          )}
                          <DifficultyPreview
                            blueprint={blueprint}
                            totalQuestions={totalQuestions}
                            totalMarks={totalMarks}
                          />
                        </div>

                        {/* Question source filter (question_from) */}
                        <SourceFilterEditor
                          subjectId={subjectId}
                          chapterIds={chapterIds}
                          topicIds={topicIds}
                          questionSources={questionSources}
                          setQuestionSources={setQuestionSources}
                        />

                        {/* Instructions */}
                        <div className="rounded-lg border bg-card p-3">
                          <Label
                            htmlFor="instructions"
                            className="flex items-center gap-2 text-xs font-semibold"
                          >
                            <FileText className="h-3.5 w-3.5 text-emerald-600" /> Instructions for Students
                          </Label>
                          <Textarea
                            id="instructions"
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            rows={2}
                            className="mt-2 text-xs"
                            placeholder="General instructions printed at the top of the paper…"
                          />
                        </div>

                        {/* Templates & AI Suggester */}
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 rounded-lg border bg-card p-3">
                            <BlueprintTemplates
                              blueprint={blueprint}
                              onApply={(bp) => {
                                setBlueprint(bp);
                                setSelectedPreset("");
                                toast.success("Template applied");
                              }}
                            />
                          </div>
                          <div className="flex-1 rounded-lg border bg-card p-3 flex items-center justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAiOpen(true)}
                              className="text-xs w-full"
                            >
                              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                              Ask AI Blueprint Suggester
                            </Button>
                            <AIBlueprintSuggester
                              open={aiOpen}
                              setOpen={setAiOpen}
                              onApply={(bp) => {
                                setBlueprint(bp);
                                setSelectedPreset("");
                                toast.success("AI blueprint applied");
                              }}
                              className={currentClass?.class_name ?? ""}
                              subjectName={currentSubject?.subject_name ?? ""}
                              currentTotalMarks={totalMarks}
                            />
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              {/* Section 4: PRIMARY ACTION WINDOWS (Practice Online vs Print Export) */}
              <div className="space-y-4">
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-bold">Choose How You Want to Generate</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Practice the test interactively online in your browser or generate a printable paper with logo & formatting.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Action 1: Practice Online */}
                  <Card className="relative flex flex-col justify-between overflow-hidden border-2 border-blue-500/30 bg-gradient-to-br from-blue-50/50 via-background to-card shadow-sm hover:border-blue-500 hover:shadow-md transition-all dark:from-blue-950/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                          <Play className="h-5 w-5 fill-current" />
                        </div>
                        <Badge className="bg-blue-600 text-white border-0 text-[10px]">
                          Interactive Online
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mt-2 font-bold text-foreground">
                        Practice Online Test
                      </CardTitle>
                      <CardDescription className="text-xs leading-relaxed">
                        Solve MCQ, Short & Long questions directly in browser with timer, instant answer checking, and score summary.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>Live exam timer ({durationMins} minutes)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>Interactive MCQ choice selection & instant score</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>Short & Long questions with step-by-step answers</span>
                        </li>
                      </ul>

                      <Button
                        size="lg"
                        disabled={generating || (!!user && !canGenerate)}
                        onClick={() => handleGenerate("practice")}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow"
                      >
                        {!user ? (
                          <>
                            <Lock className="mr-2 h-4 w-4" /> Sign In to Practice Online
                          </>
                        ) : generating ? (
                          <>
                            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            Preparing Test…
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4 fill-current" /> Start Online Practice ({totalQuestions} Qs)
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Action 2: Generate & Print */}
                  <Card className="relative flex flex-col justify-between overflow-hidden border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 via-background to-card shadow-sm hover:border-emerald-500 hover:shadow-md transition-all dark:from-emerald-950/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <Printer className="h-5 w-5" />
                        </div>
                        <Badge className="bg-emerald-600 text-white border-0 text-[10px]">
                          Official Exam Paper
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mt-2 font-bold text-foreground">
                        Generate & Print Paper
                      </CardTitle>
                      <CardDescription className="text-xs leading-relaxed">
                        Create official school/college examination papers with logo, header, student details, 2-column layout, and PDF/Word export.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Custom school logo, institution name & details</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Single / 2-column compact layout with adjustable font size</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Export to PDF, Word (.docx), Excel, or print directly</span>
                        </li>
                      </ul>

                      <Button
                        size="lg"
                        disabled={generating || (!!user && !canGenerate)}
                        onClick={() => handleGenerate("print")}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 shadow"
                      >
                        {!user ? (
                          <>
                            <Lock className="mr-2 h-4 w-4" /> Sign In to Generate Paper
                          </>
                        ) : generating ? (
                          <>
                            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            Generating Paper…
                          </>
                        ) : (
                          <>
                            <Printer className="mr-2 h-4 w-4" /> Generate Printable Paper ({totalMarks} Marks)
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {!canGenerate && (
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    {chapterIds.length === 0
                      ? "Please select at least one chapter in the syllabus step."
                      : "Please configure at least 1 question in the question breakdown or pick a preset."}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ========================================================================= */
/*                          DifficultyEditor (Advanced)                       */
/* ========================================================================= */

function DifficultyEditor(props: {
  blueprint: Blueprint;
  setBlueprint: (bp: Blueprint) => void;
  setCount: (t: QuestionTypeName, d: DifficultyName, v: number) => void;
  subjectId: string;
  chapterIds: string[];
  topicIds: string[];
  selectedChapters: CurriculumNode[];
  allTopics: CurriculumNode[];
}) {
  const {
    blueprint,
    setBlueprint,
    setCount,
    subjectId,
    chapterIds,
    topicIds,
    selectedChapters,
    allTopics,
  } = props;
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [checking, setChecking] = useState(false);

  const hasAnyQuestions = useMemo(
    () =>
      TYPE_NAMES.some(
        (t) =>
          blueprint[t].difficulties.Easy +
            blueprint[t].difficulties.Medium +
            blueprint[t].difficulties.Hard >
          0
      ),
    [blueprint]
  );

  // Estimate available questions per (type,difficulty) cell from the selected chapters' counts
  const estimate = useMemo(() => {
    const est: Record<string, number> = {};
    const totalQ =
      (topicIds.length > 0
        ? allTopics
            .filter((t) => topicIds.includes(t.id))
            .reduce((s, t) => s + (t.questionCount ?? 0), 0)
        : selectedChapters.reduce((s, c) => s + (c.questionCount ?? 0), 0)) || 0;
    const typeShare: Record<QuestionTypeName, number> = {
      MCQ: 0.6,
      Short: 0.25,
      Long: 0.15,
    };
    const diffShare: Record<DifficultyName, number> = {
      Easy: 0.4,
      Medium: 0.4,
      Hard: 0.2,
    };
    for (const t of TYPE_NAMES)
      for (const d of DIFF_NAMES)
        est[`${t}-${d}`] = Math.round(totalQ * typeShare[t] * diffShare[d]);
    return est;
  }, [selectedChapters, allTopics, topicIds]);

  const checkAvailability = async () => {
    setChecking(true);
    try {
      const results: Record<string, number> = {};
      await Promise.all(
        TYPE_NAMES.flatMap((t) =>
          DIFF_NAMES.map(async (d) => {
            const res = await fetch(
              `/api/questions?subjectId=${subjectId}&chapterIds=${chapterIds.join(
                ","
              )}&topicIds=${topicIds.join(",")}&questionType=${t}&difficulty=${d}&limit=1`
            );
            const json = await res.json();
            results[`${t}-${d}`] = json.total ?? 0;
          })
        )
      );
      setAvailability(results);
      toast.success("Availability checked against the question bank");
    } catch {
      toast.error("Could not check availability");
    } finally {
      setChecking(false);
    }
  };

  if (!hasAnyQuestions) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        Set at least one question count above to enable difficulty distribution.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={checkAvailability}
          disabled={checking || !subjectId}
          className="text-xs"
        >
          {checking ? "Checking…" : "Check availability"}
        </Button>
      </div>
      {TYPE_NAMES.map((t) => {
        const cfg = blueprint[t];
        const meta = TYPE_META[t];
        const typeCount =
          cfg.difficulties.Easy + cfg.difficulties.Medium + cfg.difficulties.Hard;
        if (typeCount === 0) return null;
        return (
          <div key={t} className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md text-white"
                style={{ background: `var(--chart-${TYPE_NAMES.indexOf(t) + 1})` }}
              >
                <TypeIcon name={t} />
              </span>
              <span className="text-sm font-medium">{meta.label}</span>
              <Badge variant="secondary" className="text-[10px]">
                {typeCount} Q
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DIFF_NAMES.map((d) => {
                const key = `${t}-${d}`;
                const have = availability[key] ?? estimate[key] ?? 0;
                const need = cfg.difficulties[d];
                return (
                  <div key={d} className="rounded-md border bg-card p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {d}
                      </span>
                      <Badge
                        variant={have === 0 ? "destructive" : "outline"}
                        className="text-[9px]"
                      >
                        {Object.keys(availability).length > 0
                          ? `${have} avail`
                          : `~${have}`}
                      </Badge>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={need}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return;
                        const n = parseInt(raw, 10);
                        if (!isNaN(n)) setCount(t, d, Math.max(0, n));
                      }}
                      className="mt-1 h-8"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() =>
                  setBlueprint({
                    ...blueprint,
                    [t]: {
                      ...cfg,
                      difficulties: distributeEvenly(typeCount),
                    },
                  })
                }
              >
                <Shuffle className="mr-1 h-3 w-3" /> Balance
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() =>
                  setBlueprint({
                    ...blueprint,
                    [t]: {
                      ...cfg,
                      difficulties: { Easy: typeCount, Medium: 0, Hard: 0 },
                    },
                  })
                }
              >
                All Easy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() =>
                  setBlueprint({
                    ...blueprint,
                    [t]: {
                      ...cfg,
                      difficulties: { Easy: 0, Medium: typeCount, Hard: 0 },
                    },
                  })
                }
              >
                All Medium
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() =>
                  setBlueprint({
                    ...blueprint,
                    [t]: {
                      ...cfg,
                      difficulties: { Easy: 0, Medium: 0, Hard: typeCount },
                    },
                  })
                }
              >
                All Hard
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ========================================================================= */
/*                       SourceFilterEditor (Advanced)                        */
/* ========================================================================= */

function SourceFilterEditor(props: {
  subjectId: string;
  chapterIds: string[];
  topicIds: string[];
  questionSources: string[];
  setQuestionSources: (v: string[]) => void;
}) {
  const { subjectId, chapterIds, topicIds, questionSources, setQuestionSources } = props;
  const [sourceCounts, setSourceCounts] = useState<
    { name: string; count: number }[]
  >([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesFetched, setSourcesFetched] = useState(false);

  const loadSources = useCallback(async () => {
    if (!subjectId) return;
    setSourcesLoading(true);
    try {
      const data = await fetchQuestionSources({ subjectId, chapterIds, topicIds });
      setSourceCounts(data.sources);
      setSourcesFetched(true);
    } catch {
      toast.error("Could not load question sources");
    } finally {
      setSourcesLoading(false);
    }
  }, [subjectId, chapterIds, topicIds]);

  useEffect(() => {
    if (sourcesFetched) {
      loadSources();
    }
  }, [subjectId, chapterIds, topicIds, sourcesFetched, loadSources]);

  // Prune any selected sources that no longer exist after a re-fetch
  useEffect(() => {
    if (sourceCounts.length === 0) return;
    const valid = new Set(sourceCounts.map((s) => s.name));
    const pruned = questionSources.filter((s) => valid.has(s));
    if (pruned.length !== questionSources.length) {
      setQuestionSources(pruned);
    }
  }, [sourceCounts, questionSources, setQuestionSources]);

  const toggleSource = (name: string) => {
    if (questionSources.includes(name)) {
      setQuestionSources(questionSources.filter((s) => s !== name));
    } else {
      setQuestionSources([...questionSources, name]);
    }
  };

  return (
    <Collapsible
      open={sourcesOpen}
      onOpenChange={(o) => {
        setSourcesOpen(o);
        if (o && !sourcesFetched) loadSources();
      }}
    >
      <div className="rounded-md border bg-card p-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left"
          >
            <Filter className="h-4 w-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Question source filter</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {questionSources.length > 0
                  ? `${questionSources.length} source${
                      questionSources.length > 1 ? "s" : ""
                    } selected · ${questionSources.join(", ")}`
                  : "Optional — leave empty to use all questions"}
              </div>
            </div>
            {questionSources.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {questionSources.length} filtered
              </Badge>
            )}
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${
                sourcesOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 space-y-3">
            <p className="text-[12px] text-muted-foreground">
              Restrict bank questions to specific{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                question_from
              </code>{" "}
              categories. This is optional — if no sources are selected, all matching
              questions are used. Only applies when the source is{" "}
              <strong>Bank</strong> or <strong>Hybrid</strong>.
            </p>
            {sourcesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : sourceCounts.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                No question sources found in this scope.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {sourceCounts.map((s) => {
                    const checked = questionSources.includes(s.name);
                    return (
                      <label
                        key={s.name}
                        className={[
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                          checked
                            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                            : "border-border hover:border-emerald-400 hover:bg-accent",
                        ].join(" ")}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSource(s.name)}
                        />
                        <span className="font-medium capitalize">{s.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {s.count}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setQuestionSources(sourceCounts.map((s) => s.name))
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuestionSources([])}
                    disabled={questionSources.length === 0}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/* ----------------------- Type icon helper ---------------------------- */

function TypeIcon({ name }: { name: QuestionTypeName }) {
  if (name === "MCQ") return <Check className="h-4 w-4" />;
  if (name === "Short") return <FileText className="h-4 w-4" />;
  return <ClipboardList className="h-4 w-4" />;
}

/* ----------------------- Difficulty Preview ----------------------------- */

function DifficultyPreview({
  blueprint,
  totalQuestions,
  totalMarks,
}: {
  blueprint: Blueprint;
  totalQuestions: number;
  totalMarks: number;
}) {
  const stats = useMemo(() => {
    let easy = 0,
      medium = 0,
      hard = 0;
    let easyMarks = 0,
      mediumMarks = 0,
      hardMarks = 0;

    for (const t of TYPE_NAMES) {
      const cfg = blueprint[t];
      easy += cfg.difficulties.Easy;
      medium += cfg.difficulties.Medium;
      hard += cfg.difficulties.Hard;
      easyMarks += cfg.difficulties.Easy * cfg.marksPerQuestion;
      mediumMarks += cfg.difficulties.Medium * cfg.marksPerQuestion;
      hardMarks += cfg.difficulties.Hard * cfg.marksPerQuestion;
    }

    const total = easy + medium + hard;
    const weighted = easy * 1 + medium * 2 + hard * 3;
    const index = total > 0 ? Math.round((weighted / (total * 3)) * 100) : 0;
    const higherOrderPct =
      total > 0 ? Math.round(((medium + hard) / total) * 100) : 0;

    return {
      easy,
      medium,
      hard,
      easyMarks,
      mediumMarks,
      hardMarks,
      index,
      higherOrderPct,
      total,
    };
  }, [blueprint]);

  if (totalQuestions === 0) return null;

  const indexLabel =
    stats.index <= 33
      ? "Easy-leaning"
      : stats.index <= 66
      ? "Balanced"
      : "Rigorous";
  const indexColor =
    stats.index <= 33
      ? "text-emerald-600"
      : stats.index <= 66
      ? "text-amber-600"
      : "text-rose-600";

  const barWidth = (n: number) =>
    stats.total > 0 ? `${Math.max((n / stats.total) * 100, 2)}%` : "0%";

  // Silence unused-var warning when totalMarks isn't used in render
  void totalMarks;

  return (
    <div className="grid gap-3 rounded-lg border bg-gradient-to-br from-muted/40 to-muted/10 p-3 sm:grid-cols-[1fr_auto]">
      {/* Distribution bars */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Difficulty distribution
        </div>
        {[
          { label: "Easy", count: stats.easy, marks: stats.easyMarks, color: "var(--chart-1)" },
          { label: "Medium", count: stats.medium, marks: stats.mediumMarks, color: "var(--chart-2)" },
          { label: "Hard", count: stats.hard, marks: stats.hardMarks, color: "var(--chart-3)" },
        ].map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-medium">{d.label}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="flex h-full items-center justify-end rounded px-1.5 text-[10px] font-semibold text-white transition-all duration-300"
                style={{ width: barWidth(d.count), background: d.color }}
              >
                {d.count > 0 && d.count}
              </div>
            </div>
            <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground">
              {d.marks}m
            </span>
          </div>
        ))}
      </div>

      {/* Difficulty index gauge */}
      <div className="flex items-center gap-3 border-t pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <div className="text-center">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Difficulty index
          </div>
          <div className={`text-2xl font-bold tabular-nums ${indexColor}`}>
            {stats.index}
          </div>
          <div className={`text-[10px] font-medium ${indexColor}`}>{indexLabel}</div>
        </div>
        <div className="h-12 w-px bg-border" />
        <div className="text-center">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Higher-order
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.higherOrderPct}%
          </div>
          <div className="text-[10px] text-muted-foreground">Apply+</div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Blueprint templates ---------------------------- */

type SavedTemplate = {
  id: string;
  name: string;
  blueprint: Blueprint;
  createdAt: string;
};

const TEMPLATE_KEY = "examforge-blueprint-templates";

function loadTemplates(): SavedTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    return raw ? (JSON.parse(raw) as SavedTemplate[]) : [];
  } catch {
    return [];
  }
}

function saveTemplates(list: SavedTemplate[]) {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function BlueprintTemplates({
  blueprint,
  onApply,
}: {
  blueprint: Blueprint;
  onApply: (bp: Blueprint) => void;
}) {
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => loadTemplates());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleSave = () => {
    const n = name.trim() || `Template ${templates.length + 1}`;
    const next: SavedTemplate[] = [
      {
        id: `tpl-${Date.now()}`,
        name: n,
        blueprint,
        createdAt: new Date().toISOString(),
      },
      ...templates,
    ];
    saveTemplates(next);
    setTemplates(next);
    setName("");
    setOpen(false);
    toast.success(`Template “${n}” saved`);
  };

  const handleDelete = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    saveTemplates(next);
    setTemplates(next);
    toast.success("Template deleted");
  };

  const countFor = (bp: Blueprint) =>
    TYPE_NAMES.reduce(
      (s, t) => s + bp[t].difficulties.Easy + bp[t].difficulties.Medium + bp[t].difficulties.Hard,
      0
    );
  const marksFor = (bp: Blueprint) =>
    TYPE_NAMES.reduce(
      (s, t) =>
        s +
        (bp[t].difficulties.Easy + bp[t].difficulties.Medium + bp[t].difficulties.Hard) *
          bp[t].marksPerQuestion,
      0
    );

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium">My templates</span>
          <Badge variant="secondary" className="text-[10px]">
            {templates.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!open ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
              disabled={countFor(blueprint) === 0}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Save current
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name…"
                className="h-8 w-40"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
              <Button
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSave}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {templates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-3 pr-1.5 text-xs transition-colors hover:border-emerald-400"
            >
              <button
                onClick={() => onApply(t.blueprint)}
                className="font-medium hover:text-emerald-700 dark:hover:text-emerald-300"
                title={`Apply “${t.name}” — ${countFor(t.blueprint)} Q, ${marksFor(t.blueprint)} marks`}
              >
                {t.name}
                <span className="ml-1.5 text-muted-foreground">
                  {countFor(t.blueprint)}Q · {marksFor(t.blueprint)}m
                </span>
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="rounded-full p-0.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${t.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {templates.length === 0 && !open && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Configure a blueprint above, then “Save current” to reuse it later. Templates are stored
          in your browser.
        </p>
      )}
    </div>
  );
}

/* ----------------------- AI Blueprint Suggester ------------------------- */

function AIBlueprintSuggester({
  open,
  setOpen,
  onApply,
  className,
  subjectName,
  currentTotalMarks,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onApply: (bp: Blueprint) => void;
  className: string;
  subjectName: string;
  currentTotalMarks: number;
}) {
  const [targetMarks, setTargetMarks] = useState(
    currentTotalMarks > 0 ? currentTotalMarks : 35
  );
  const [difficulty, setDifficulty] = useState<
    "easy" | "balanced" | "hard" | "exam"
  >("balanced");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    blueprint: Blueprint;
    rationale: string;
  } | null>(null);

  const handleSuggest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await suggestBlueprint({
        totalMarks: targetMarks,
        difficultyTarget: difficulty,
        className,
        subjectName,
      });
      setResult(res);
      toast.success("AI blueprint generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setLoading(false);
    }
  };

  const profiles: {
    id: "easy" | "balanced" | "hard" | "exam";
    label: string;
    desc: string;
    emoji: string;
  }[] = [
    { id: "easy", label: "Easy-leaning", desc: "Practice / revision", emoji: "🌱" },
    { id: "balanced", label: "Balanced", desc: "Even mix", emoji: "⚖️" },
    { id: "hard", label: "Rigorous", desc: "Challenge exam", emoji: "🔥" },
    { id: "exam", label: "Board Exam", desc: "Standard style", emoji: "📋" },
  ];

  const calcTotal = (bp: Blueprint) =>
    TYPE_NAMES.reduce(
      (s, t) =>
        s +
        (bp[t].difficulties.Easy +
          bp[t].difficulties.Medium +
          bp[t].difficulties.Hard) *
          bp[t].marksPerQuestion,
      0
    );
  const calcQ = (bp: Blueprint) =>
    TYPE_NAMES.reduce(
      (s, t) =>
        s +
        bp[t].difficulties.Easy +
        bp[t].difficulties.Medium +
        bp[t].difficulties.Hard,
      0
    );

  return (
    <div className="rounded-lg border bg-gradient-to-br from-emerald-50 to-teal-50 p-3 dark:from-emerald-950/20 dark:to-teal-950/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <span className="text-sm font-semibold">AI Blueprint Suggester</span>
            <span className="ml-1.5 text-[11px] text-muted-foreground">
              Let AI design the optimal question distribution
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="border-emerald-400 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300"
        >
          {open ? "Close" : "Suggest"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Controls */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Target total marks</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={targetMarks}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return;
                  const n = parseInt(raw, 10);
                  if (!isNaN(n)) setTargetMarks(Math.max(1, n));
                }}
                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Difficulty profile</Label>
              <div className="flex flex-wrap gap-1">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setDifficulty(p.id)}
                    className={[
                      "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-all",
                      difficulty === p.id
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-border hover:border-emerald-400",
                    ].join(" ")}
                    title={p.desc}
                  >
                    <span>{p.emoji}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleSuggest}
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            {loading ? (
              <>
                <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                AI is designing your blueprint…
              </>
            ) : (
              <>
                <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Generate AI blueprint
              </>
            )}
          </Button>

          {/* Result */}
          {result && (
            <div className="animate-fade-in rounded-lg border border-emerald-300 bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Suggested distribution
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {calcQ(result.blueprint)} Q · {calcTotal(result.blueprint)} marks
                </Badge>
              </div>
              <div className="space-y-1.5">
                {TYPE_NAMES.map((t) => {
                  const cfg = result.blueprint[t];
                  const count =
                    cfg.difficulties.Easy +
                    cfg.difficulties.Medium +
                    cfg.difficulties.Hard;
                  return (
                    <div
                      key={t}
                      className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs"
                    >
                      <span className="w-16 font-medium">{t}</span>
                      <span className="text-muted-foreground">
                        {cfg.marksPerQuestion}m each:
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {cfg.difficulties.Easy}E · {cfg.difficulties.Medium}M ·{" "}
                        {cfg.difficulties.Hard}H
                      </span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {count} Q · {count * cfg.marksPerQuestion}m
                      </Badge>
                    </div>
                  );
                })}
              </div>
              {result.rationale && (
                <p className="mt-2 border-t pt-2 text-[11px] italic text-muted-foreground">
                  {result.rationale}
                </p>
              )}
              <Button
                size="sm"
                onClick={() => {
                  onApply(result.blueprint);
                  setOpen(false);
                }}
                className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Apply this blueprint
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
