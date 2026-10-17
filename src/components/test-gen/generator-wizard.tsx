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
  Minus,
  SlidersHorizontal,
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
  BarChart3,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    marks: 16,
    duration: 20,
    questionCount: 13,
    emoji: "⚡",
    blueprint: {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 4, Medium: 4, Hard: 2 } },
      Short: { marksPerQuestion: 2, difficulties: { Easy: 1, Medium: 1, Hard: 1 } },
      Long: { marksPerQuestion: 8, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
    },
  },
  {
    id: "class-test",
    name: "Class Test",
    desc: "15 MCQ + 4 Short + 1 Long",
    marks: 31,
    duration: 45,
    questionCount: 20,
    emoji: "📘",
    blueprint: {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 5, Medium: 7, Hard: 3 } },
      Short: { marksPerQuestion: 2, difficulties: { Easy: 2, Medium: 1, Hard: 1 } },
      Long: { marksPerQuestion: 8, difficulties: { Easy: 0, Medium: 1, Hard: 0 } },
    },
  },
  {
    id: "full-exam",
    name: "Full Exam",
    desc: "20 MCQ + 6 Short + 2 Long",
    marks: 48,
    duration: 90,
    questionCount: 28,
    emoji: "🎓",
    blueprint: {
      MCQ: { marksPerQuestion: 1, difficulties: { Easy: 8, Medium: 8, Hard: 4 } },
      Short: { marksPerQuestion: 2, difficulties: { Easy: 2, Medium: 3, Hard: 1 } },
      Long: { marksPerQuestion: 8, difficulties: { Easy: 1, Medium: 1, Hard: 0 } },
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
      Short: { marksPerQuestion: 2, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
      Long: { marksPerQuestion: 8, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
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
    Short: { marksPerQuestion: 2, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
    Long: { marksPerQuestion: 8, difficulties: { Easy: 0, Medium: 0, Hard: 0 } },
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

export function formatDuration(mins: number): string {
  if (mins <= 0) return "0 mins";
  if (mins < 60) return `${mins} mins`;
  const hours = mins / 60;
  if (mins % 60 === 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  if (mins % 30 === 0) {
    return `${hours} hours`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} hr ${m} mins`;
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
        const sorted = [...d.tree].sort((a, b) => {
          const numA = parseInt(a.class_name?.match(/\d+/)?.[0] ?? "999", 10);
          const numB = parseInt(b.class_name?.match(/\d+/)?.[0] ?? "999", 10);
          if (numA !== numB) return numA - numB;
          return (a.class_name ?? "").localeCompare(b.class_name ?? "");
        });
        setTree(sorted);
        if (sorted[0]) {
          if (!classId) {
            setClassId(sorted[0].id);
            const firstSubject = sorted[0].subjects?.[0];
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

  const sortedTree = useMemo(() => {
    return [...tree].sort((a, b) => {
      const numA = parseInt(a.class_name?.match(/\d+/)?.[0] ?? "999", 10);
      const numB = parseInt(b.class_name?.match(/\d+/)?.[0] ?? "999", 10);
      if (numA !== numB) return numA - numB;
      return (a.class_name ?? "").localeCompare(b.class_name ?? "");
    });
  }, [tree]);

  const currentClass = sortedTree.find((c) => c.id === classId) ?? sortedTree[0];
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

  /* -------------------- When subject changes, deselect chapters by default -------------------- */
  useEffect(() => {
    if (!subjectId || tree.length === 0) return;
    setChapterIds([]);
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

  /* -------------------- Difficulty Analytics for Card 3 -------------------- */
  const difficultyStats = useMemo(() => {
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
      total,
      index,
      higherOrderPct,
    };
  }, [blueprint]);

  const difficultyIndexLabel =
    difficultyStats.index <= 35
      ? "Easy"
      : difficultyStats.index <= 65
      ? "Balanced"
      : "Challenging";
  const difficultyIndexColor =
    difficultyStats.index <= 35
      ? "text-emerald-600"
      : difficultyStats.index <= 65
      ? "text-amber-600"
      : "text-rose-600";

  const applyDifficultyRatio = (easyPct: number, medPct: number, hardPct: number) => {
    setSelectedPreset("");
    const updated = { ...blueprint };
    for (const t of TYPE_NAMES) {
      const count =
        updated[t].difficulties.Easy +
        updated[t].difficulties.Medium +
        updated[t].difficulties.Hard;
      if (count === 0) continue;
      const easy = Math.round((count * easyPct) / 100);
      const hard = Math.round((count * hardPct) / 100);
      const med = Math.max(0, count - easy - hard);
      updated[t] = {
        ...updated[t],
        difficulties: { Easy: easy, Medium: med, Hard: hard },
      };
    }
    setBlueprint(updated);
    toast.success("Difficulty distribution updated");
  };

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

  const incrementTypeCount = (t: QuestionTypeName, delta: number) => {
    setSelectedPreset("");
    const cfg = blueprint[t];
    const current = cfg.difficulties.Easy + cfg.difficulties.Medium + cfg.difficulties.Hard;
    const next = Math.max(0, current + delta);
    setBlueprint({
      ...blueprint,
      [t]: {
        ...blueprint[t],
        difficulties: distributeEvenly(next),
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
      [t]: { ...blueprint[t], marksPerQuestion: Math.max(0, v) },
    });
  };

  /* -------------------- Chapter / topic toggles -------------------- */
  const allTopicIds = useMemo(
    () => chapters.flatMap((c) => c.topics?.map((t) => t.id) ?? []),
    [chapters]
  );

  const areAllChaptersSelected =
    chapters.length > 0 && chapterIds.length === chapters.length;

  const toggleSelectAllChapters = () => {
    if (areAllChaptersSelected) {
      setChapterIds([]);
      setTopicIds([]);
    } else {
      setChapterIds(chapters.map((c) => c.id));
      setTopicIds(allTopicIds);
    }
  };

  const toggleChapter = (id: string) => {
    const isAdding = !chapterIds.includes(id);
    const newChaps = isAdding
      ? [...chapterIds, id]
      : chapterIds.filter((x) => x !== id);
    setChapterIds(newChaps);

    const chap = chapters.find((c) => c.id === id);
    const chapTopicIds = chap?.topics?.map((t) => t.id) ?? [];
    if (isAdding) {
      setTopicIds((prev) => Array.from(new Set([...prev, ...chapTopicIds])));
    } else {
      setTopicIds((prev) => prev.filter((tId) => !chapTopicIds.includes(tId)));
    }
  };

  const toggleTopic = (chapId: string, topicId: string) => {
    if (topicIds.includes(topicId)) {
      const nextTopics = topicIds.filter((x) => x !== topicId);
      setTopicIds(nextTopics);
      const chap = chapters.find((c) => c.id === chapId);
      const remainingInChap = (chap?.topics ?? []).filter((t) => nextTopics.includes(t.id));
      if (remainingInChap.length === 0) {
        setChapterIds((prev) => prev.filter((x) => x !== chapId));
      }
    } else {
      setTopicIds((prev) => [...prev, topicId]);
      setChapterIds((prev) => (prev.includes(chapId) ? prev : [...prev, chapId]));
    }
  };

  const handleStepNavigate = (targetStep: WizardStep) => {
    setStep(targetStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        title: `${currentClass.class_name ?? ""} ${currentSubject.subject_name ?? ""} Examination`,
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

  const stepOrder: WizardStep[] = ["class", "subject", "syllabus", "setup"];
  const currentStepIdx = stepOrder.indexOf(step);

  const STEPS_CONFIG = [
    {
      id: "class" as const,
      num: 1,
      label: "Class",
      subtitle: currentClass?.class_name || "Select Class",
    },
    {
      id: "subject" as const,
      num: 2,
      label: "Subject",
      subtitle: currentStepIdx >= 1 && currentSubject ? currentSubject.subject_name : "Choose Subject",
    },
    {
      id: "syllabus" as const,
      num: 3,
      label: "Syllabus",
      subtitle: currentStepIdx >= 2 ? `${chapterIds.length} Chapters` : "Select Chapters",
    },
    {
      id: "setup" as const,
      num: 4,
      label: "Test Setup",
      subtitle: currentStepIdx >= 3 ? `${totalQuestions} Qs · ${totalMarks}m` : "Configure & Generate",
    },
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

      {/* Stepper Navigation Bar with Filled Progress Connectors */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center justify-between rounded-2xl border bg-card p-3 shadow-xs min-w-[620px]">
          {STEPS_CONFIG.map((s, idx) => {
            const isCurrent = step === s.id;
            const thisIndex = stepOrder.indexOf(s.id);
            const isCompleted = thisIndex < currentStepIdx;
            const isClickable =
              thisIndex < currentStepIdx ||
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
                  className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all ${
                    isCurrent
                      ? "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100 font-semibold ring-1 ring-emerald-500/20"
                      : isCompleted
                      ? "text-slate-700 dark:text-slate-200 hover:bg-muted/60 cursor-pointer"
                      : "text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-600/20"
                        : isCompleted
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : s.num}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">{s.label}</div>
                    <div
                      className={`truncate text-[11px] ${
                        isCurrent
                          ? "text-emerald-700 dark:text-emerald-300 font-medium"
                          : isCompleted
                          ? "text-slate-600 dark:text-slate-300 font-medium"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {s.subtitle}
                    </div>
                  </div>
                </button>
                {idx < STEPS_CONFIG.length - 1 && (
                  <div className="flex-1 mx-2 sm:mx-3 h-1 min-w-[20px] rounded-full bg-muted overflow-hidden shrink-0">
                    <div
                      className={`h-full transition-all duration-300 ${
                        thisIndex < currentStepIdx ? "bg-emerald-600 w-full" : "w-0"
                      }`}
                    />
                  </div>
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
              <WizardBreadcrumbs
                step="class"
                onNavigate={handleStepNavigate}
                chapterCount={chapterIds.length}
              />
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Select Class</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick a class to continue.
                </p>
              </div>

              <div
                className={`grid gap-5 ${
                  sortedTree.length <= 1
                    ? "grid-cols-1 max-w-md mx-auto"
                    : sortedTree.length === 2
                    ? "grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {sortedTree.map((cls) => {
                  const isSelected = classId === cls.id;
                  const subjectsCount = cls.subjects?.length ?? 0;
                  const totalChapters = cls.subjects?.reduce((acc, s) => acc + (s.chapters?.length ?? 0), 0) ?? 0;
                  const qCount = cls.questionCount ?? 0;

                  return (
                    <div
                      key={cls.id}
                      onClick={() => {
                        setClassId(cls.id);
                        if (cls.subjects && cls.subjects.length > 0) {
                          setSubjectId(cls.subjects[0].id);
                        }
                        setChapterIds([]);
                        setTopicIds([]);
                      }}
                      className={`group relative flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-600/20"
                          : "border-border bg-card hover:border-emerald-400 hover:bg-accent/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
                              isSelected
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            <GraduationCap className="h-6 w-6" />
                          </div>
                          {isSelected ? (
                            <Badge className="bg-emerald-600 text-white border-0 text-xs font-semibold px-2.5 py-0.5">
                              ✓ Selected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 border-slate-300 dark:border-slate-700 text-xs">
                              Click to Select
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-xl font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {cls.class_name}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-200">
                            <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                            {subjectsCount > 1 ? `${subjectsCount} Subjects · ` : ""}{totalChapters} {totalChapters === 1 ? "Chapter" : "Chapters"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-200">
                            <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                            {qCount.toLocaleString()} Questions
                          </span>
                        </div>

                        {cls.subjects && cls.subjects.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {cls.subjects.slice(0, 4).map((sub) => (
                              <span
                                key={sub.id}
                                className="rounded-md border border-slate-200 dark:border-slate-700 bg-background/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300"
                              >
                                {sub.subject_name}
                              </span>
                            ))}
                            {cls.subjects.length > 4 && (
                              <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-background/90 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                +{cls.subjects.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 border-t pt-3.5">
                        {isSelected ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStep("subject");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs shadow-xs"
                          >
                            <span>Continue to Subjects</span>
                            <ArrowRight className="ml-1.5 h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClassId(cls.id);
                              if (cls.subjects && cls.subjects.length > 0) {
                                setSubjectId(cls.subjects[0].id);
                              }
                              setChapterIds([]);
                              setTopicIds([]);
                            }}
                            className="w-full text-xs font-semibold hover:border-emerald-500 hover:text-emerald-600 h-9"
                          >
                            <span>Select {cls.class_name}</span>
                          </Button>
                        )}
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
              <WizardBreadcrumbs
                step="subject"
                currentClass={currentClass}
                onNavigate={handleStepNavigate}
                chapterCount={chapterIds.length}
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight">Select Subject</h2>
                    <Badge variant="secondary" className="font-semibold text-xs">
                      {currentClass?.class_name}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose a subject for {currentClass?.class_name} to view its syllabus.
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
                        setChapterIds([]);
                        setTopicIds([]);
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
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
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
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium text-slate-700 dark:text-slate-200">
                            <Layers className="h-3.5 w-3.5 text-emerald-600" />
                            {chapCount} {chapCount === 1 ? "Chapter" : "Chapters"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium text-slate-700 dark:text-slate-200">
                            <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                            {qCount.toLocaleString()} Questions
                          </span>
                        </div>

                        {sub.chapters && sub.chapters.length > 0 && (
                          <div className="mt-4 space-y-1">
                            <div className="text-[11px] font-medium text-muted-foreground">
                              Syllabus:
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
                        <span>Select Syllabus</span>
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
              <WizardBreadcrumbs
                step="syllabus"
                currentClass={currentClass}
                currentSubject={currentSubject}
                onNavigate={handleStepNavigate}
                chapterCount={chapterIds.length}
              />
              {/* Header with back button and breadcrumb */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight">Select Syllabus</h2>
                    <Badge variant="outline" className="font-semibold text-xs">
                      {currentClass?.class_name}
                    </Badge>
                    <span className="text-muted-foreground text-xs">›</span>
                    <Badge className="bg-emerald-600 text-white font-semibold text-xs border-0">
                      {currentSubject?.subject_name}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select chapters and subtopics for your test.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={toggleSelectAllChapters}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                      areAllChaptersSelected
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100 ring-1 ring-emerald-500/20"
                        : "border-border bg-card hover:bg-accent/40 text-foreground"
                    }`}
                  >
                    <Checkbox
                      checked={areAllChaptersSelected}
                      onCheckedChange={toggleSelectAllChapters}
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                    <span>
                      {areAllChaptersSelected ? "Deselect All" : "Select All"}
                    </span>
                    <Badge variant="secondary" className="text-[10px] ml-1 font-bold">
                      {chapterIds.length}/{chapters.length}
                    </Badge>
                  </button>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-semibold">
                    {chapterIds.length} of {chapters.length} Chapters Selected
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      topicIds.length > 0
                        ? "text-emerald-700 dark:text-emerald-300 border-emerald-400 font-semibold"
                        : "text-muted-foreground"
                    }
                  >
                    {topicIds.length} of {allTopicIds.length} Subtopics Included
                  </Badge>
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
                  const formattedChapNo = String(chapNo).padStart(2, "0");
                  const selectedTopicsInChap = topics.filter((t) => topicIds.includes(t.id));

                  return (
                    <Card
                      key={chap.id}
                      className={`overflow-hidden transition-all border-2 ${
                        isChecked
                          ? "border-emerald-500/80 bg-card shadow-sm ring-1 ring-emerald-500/20"
                          : "border-border bg-card/60 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {/* Chapter Card Header */}
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-emerald-200/50 dark:border-emerald-900/50"
                            : "border-b border-border/40 hover:bg-accent/40"
                        }`}
                        onClick={() => toggleChapter(chap.id)}
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleChapter(chap.id)}
                            className="mt-1 sm:mt-0 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 shrink-0"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-xs font-black tracking-wider uppercase ${
                                  isChecked
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                CH {formattedChapNo}
                              </span>
                              <h3 className="text-base sm:text-lg font-bold text-foreground">
                                {chap.chapter_name}
                              </h3>
                            </div>
                            <div className="text-xs text-muted-foreground font-medium mt-1">
                              {topics.length} Subtopics · {chap.questionCount ?? 0} Questions Available
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <Button
                            type="button"
                            size="sm"
                            variant={isChecked ? "outline" : "secondary"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleChapter(chap.id);
                            }}
                            className={`h-7 text-xs font-semibold ${
                              isChecked
                                ? "border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50"
                                : "hover:bg-accent"
                            }`}
                          >
                            {isChecked ? "Deselect Chapter" : "Select Chapter"}
                          </Button>
                        </div>
                      </div>

                      {/* Subtopics Section inside Chapter Card (always visible by default) */}
                      <div className="p-4 bg-background/50">
                        <div className="mb-2.5 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <ListTree className="h-3.5 w-3.5 text-emerald-600" />
                            Subtopics ({selectedTopicsInChap.length}/{topics.length} selected)
                          </span>
                          {topics.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              Click any subtopic to select chapter & topic
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
                                  onClick={() => toggleTopic(chap.id, t.id)}
                                  className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition-all cursor-pointer ${
                                    isTopicSelected
                                      ? "border-emerald-600 bg-emerald-50 font-medium text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100 ring-1 ring-emerald-500/20"
                                      : "border-border bg-card hover:border-emerald-400 hover:bg-accent/50 text-foreground"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Checkbox
                                      checked={isTopicSelected}
                                      onCheckedChange={() => toggleTopic(chap.id, t.id)}
                                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 shrink-0"
                                    />
                                    <Badge
                                      variant="outline"
                                      className="font-mono text-[10px] px-1.5 py-0 shrink-0 font-bold bg-muted/60"
                                    >
                                      {articleNo}
                                    </Badge>
                                    <span className="truncate font-medium" title={t.topic_name}>
                                      {t.topic_name}
                                    </span>
                                  </div>
                                  {t.questionCount != null && t.questionCount > 0 && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] shrink-0 font-semibold"
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
                    Continue to Test Setup <ArrowRight className="ml-2 h-4 w-4" />
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
              <WizardBreadcrumbs
                step="setup"
                currentClass={currentClass}
                currentSubject={currentSubject}
                chapterCount={chapterIds.length}
                onNavigate={handleStepNavigate}
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Test Setup</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure question counts, marks, duration, and generate your test.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/40 p-1.5 text-xs">
                  <Badge variant="outline" className="bg-background font-semibold">
                    {currentClass?.class_name}
                  </Badge>
                  <span className="text-muted-foreground">›</span>
                  <Badge variant="outline" className="bg-background font-semibold">
                    {currentSubject?.subject_name}
                  </Badge>
                  <span className="text-muted-foreground">›</span>
                  <Badge className="bg-emerald-600 text-white font-semibold border-0">
                    {chapterIds.length} Chapters
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStepNavigate("syllabus")}
                    className="h-6 px-2 text-[11px] text-emerald-700 dark:text-emerald-300 hover:text-emerald-800"
                  >
                    Change
                  </Button>
                </div>
              </div>

              {/* 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ================= LEFT COLUMN: CONFIGURATION ================= */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Card 1: Question Source Filter, Presets & Duration */}
                  <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-3.5">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <SlidersHorizontal className="h-4 w-4 text-emerald-600" /> Exam Setup
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Source filter, exam preset & time duration.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {formatDuration(durationMins)} · {selectedPreset || "Custom"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Dropdown 1: Question Source Filter */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <Filter className="h-3.5 w-3.5 text-emerald-600" />
                          Source Filter
                        </Label>
                        <SourceFilterDropdown
                          subjectId={subjectId}
                          chapterIds={chapterIds}
                          topicIds={topicIds}
                          questionSources={questionSources}
                          setQuestionSources={setQuestionSources}
                        />
                      </div>

                      {/* Dropdown 2: Exam Preset */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <Wand2 className="h-3.5 w-3.5 text-emerald-600" />
                          Preset
                        </Label>
                        <Select
                          value={selectedPreset || "custom"}
                          onValueChange={(val) => {
                            if (val === "custom") {
                              setSelectedPreset("");
                            } else {
                              const p = PRESETS.find((x) => x.id === val);
                              if (p) handlePresetClick(p);
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs font-semibold bg-background">
                            <SelectValue placeholder="Custom" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom" className="text-xs font-medium">
                              ⚙️ Custom
                            </SelectItem>
                            {PRESETS.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                                {p.emoji} {p.name} ({p.marks}m)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Dropdown 3: Exam Duration */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-emerald-600" />
                          Duration
                        </Label>
                        <DurationDropdown
                          durationMins={durationMins}
                          setDurationMins={setDurationMins}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Question Breakdown */}
                  <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <SquareStack className="h-4 w-4 text-emerald-600" /> Question Breakdown
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Adjust question counts easily with <strong className="text-foreground">+</strong> and <strong className="text-foreground">-</strong> buttons.
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-bold text-xs">
                        {totalQuestions} Questions · {totalMarks} Marks
                      </Badge>
                    </div>

                    {/* Question Breakdown Stepper Rows */}
                    <div className="space-y-3">
                      {TYPE_NAMES.map((t) => {
                        const cfg = blueprint[t];
                        const meta = TYPE_META[t];
                        const count = cfg.difficulties.Easy + cfg.difficulties.Medium + cfg.difficulties.Hard;
                        const subtotalMarks = count * (cfg.marksPerQuestion || 0);
                        const colorVar = `var(--chart-${TYPE_NAMES.indexOf(t) + 1})`;

                        return (
                          <div
                            key={t}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                              count > 0
                                ? "border-emerald-500/30 bg-background shadow-xs"
                                : "border-border/60 bg-muted/15 opacity-70"
                            }`}
                          >
                            {/* Left: Icon, Name & Marks Per Question */}
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                                style={{ background: colorVar }}
                              >
                                <TypeIcon name={t} />
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-bold truncate text-foreground">
                                  {meta.label}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                  <span>Marks each:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={cfg.marksPerQuestion === 0 ? "" : cfg.marksPerQuestion}
                                    placeholder="1"
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (raw === "") {
                                        setMarks(t, 0);
                                        return;
                                      }
                                      const n = parseInt(raw, 10);
                                      if (!isNaN(n)) setMarks(t, Math.max(1, n));
                                    }}
                                    onBlur={() => {
                                      if (cfg.marksPerQuestion < 1) setMarks(t, 1);
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    className="h-6 w-12 rounded border bg-background px-1 text-center font-bold text-xs"
                                    title="Marks per question"
                                  />
                                  <span>· Subtotal: <strong className="text-foreground">{subtotalMarks} marks</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Interactive Stepper */}
                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                              <div className="flex items-center rounded-xl border bg-muted/40 p-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => incrementTypeCount(t, -1)}
                                  disabled={count <= 0}
                                  className="h-8 w-8 rounded-lg hover:bg-background"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={count === 0 ? "" : count}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === "") {
                                      setTypeCount(t, 0);
                                      return;
                                    }
                                    const n = parseInt(raw, 10);
                                    if (!isNaN(n)) setTypeCount(t, Math.max(0, n));
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="h-8 w-14 bg-transparent text-center font-bold text-sm focus:outline-none"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => incrementTypeCount(t, 1)}
                                  className="h-8 w-8 rounded-lg hover:bg-background"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Advanced Options (Source Engine, Difficulty & Analytics, Instructions & Shuffle) */}
                  <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm">
                    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-emerald-600 py-1"
                        >
                          <span className="flex items-center gap-2">
                            <Settings2 className="h-4 w-4 text-emerald-600" />
                            Advanced Options (Source Engine, Difficulty & Analytics, Instructions & Shuffle)
                          </span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4 space-y-4 border-t mt-3">
                        {/* Generation Engine */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5 text-emerald-600" />
                            Source Engine
                          </Label>
                          <Select value={source} onValueChange={(v) => setSource(v as any)}>
                            <SelectTrigger className="h-9 text-xs font-semibold bg-background">
                              <SelectValue placeholder="Source" />
                            </SelectTrigger>
                            <SelectContent>
                              {SOURCES.map((s) => (
                                <SelectItem key={s.id} value={s.id} className="text-xs font-medium">
                                  <span className="flex items-center gap-2">
                                    <s.icon className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>{s.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Choose question source: Curated Question Bank, AI Generation, or Hybrid.
                          </p>
                        </div>

                        {/* Difficulty Distribution & Analytics */}
                        <div className="rounded-xl border bg-background/60 p-4 space-y-3.5 shadow-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
                            <div>
                              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <BarChart3 className="h-4 w-4 text-emerald-600" />
                                Difficulty Distribution & Analytics
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Default is <strong>Balanced</strong> (35% Easy · 45% Medium · 20% Hard) for standard exam difficulty.
                              </p>
                            </div>
                            <Badge variant="outline" className={`font-bold text-xs shrink-0 self-start sm:self-auto ${difficultyIndexColor}`}>
                              {difficultyStats.index}% · {difficultyIndexLabel}
                            </Badge>
                          </div>

                          {/* Visual Stacked Bar */}
                          <div className="space-y-1.5">
                            <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
                              {difficultyStats.total > 0 && (
                                <>
                                  <div
                                    style={{ width: `${(difficultyStats.easy / difficultyStats.total) * 100}%` }}
                                    className="bg-emerald-500 h-full transition-all"
                                    title={`Easy: ${difficultyStats.easy} questions`}
                                  />
                                  <div
                                    style={{ width: `${(difficultyStats.medium / difficultyStats.total) * 100}%` }}
                                    className="bg-amber-500 h-full transition-all"
                                    title={`Medium: ${difficultyStats.medium} questions`}
                                  />
                                  <div
                                    style={{ width: `${(difficultyStats.hard / difficultyStats.total) * 100}%` }}
                                    className="bg-rose-500 h-full transition-all"
                                    title={`Hard: ${difficultyStats.hard} questions`}
                                  />
                                </>
                              )}
                            </div>
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                ● Easy ({difficultyStats.total > 0 ? Math.round((difficultyStats.easy / difficultyStats.total) * 100) : 35}%)
                              </span>
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                ● Medium ({difficultyStats.total > 0 ? Math.round((difficultyStats.medium / difficultyStats.total) * 100) : 45}%)
                              </span>
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                ● Hard ({difficultyStats.total > 0 ? Math.round((difficultyStats.hard / difficultyStats.total) * 100) : 20}%)
                              </span>
                            </div>
                          </div>

                          {/* Metric summary cards */}
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-lg border border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-950/20 p-2">
                              <div className="font-semibold text-emerald-700 dark:text-emerald-300">Easy</div>
                              <div className="text-base font-extrabold text-foreground">{difficultyStats.easy}</div>
                              <div className="text-[10px] text-muted-foreground">{difficultyStats.easyMarks} marks</div>
                            </div>
                            <div className="rounded-lg border border-amber-500/25 bg-amber-50/40 dark:bg-amber-950/20 p-2">
                              <div className="font-semibold text-amber-700 dark:text-amber-300">Medium</div>
                              <div className="text-base font-extrabold text-foreground">{difficultyStats.medium}</div>
                              <div className="text-[10px] text-muted-foreground">{difficultyStats.mediumMarks} marks</div>
                            </div>
                            <div className="rounded-lg border border-rose-500/25 bg-rose-50/40 dark:bg-rose-950/20 p-2">
                              <div className="font-semibold text-rose-700 dark:text-rose-300">Hard</div>
                              <div className="text-base font-extrabold text-foreground">{difficultyStats.hard}</div>
                              <div className="text-[10px] text-muted-foreground">{difficultyStats.hardMarks} marks</div>
                            </div>
                          </div>

                          {/* Quick 1-click profiles */}
                          <div className="space-y-1.5 pt-1 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-muted-foreground">
                                Quick Difficulty Profiles:
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setDifficultyOpen(!difficultyOpen)}
                                className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
                              >
                                {difficultyOpen ? "Hide Cell-by-Cell" : "Fine-Tune Cell-by-Cell"}
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyDifficultyRatio(50, 35, 15)}
                                className="text-xs h-8 font-semibold hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              >
                                🌱 Easy (50/35/15)
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyDifficultyRatio(35, 45, 20)}
                                className="text-xs h-8 font-semibold border-emerald-600/40 bg-emerald-50/30 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                              >
                                ⚖️ Balanced (35/45/20)
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyDifficultyRatio(20, 40, 40)}
                                className="text-xs h-8 font-semibold hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              >
                                🔥 Hard (20/40/40)
                              </Button>
                            </div>
                          </div>

                          {/* Expandable fine-tune matrix */}
                          {difficultyOpen && (
                            <div className="pt-2 border-t">
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
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2">
                            <span>Higher-order thinking questions (Medium + Hard):</span>
                            <span className="font-bold text-foreground">
                              {difficultyStats.higherOrderPct}%
                            </span>
                          </div>
                        </div>

                        {/* Instructions */}
                        <div>
                          <Label htmlFor="inst" className="text-xs font-semibold">
                            Instructions for Students
                          </Label>
                          <Textarea
                            id="inst"
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            rows={2}
                            placeholder="e.g. Attempt all questions. Calculators not allowed."
                            className="mt-1 text-xs"
                          />
                        </div>

                        {/* Shuffle switch */}
                        <div className="flex items-center justify-between rounded-lg border bg-background p-2.5">
                          <div className="flex items-center gap-2">
                            <Shuffle className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-xs font-medium">Shuffle Question Order</span>
                          </div>
                          <Switch checked={shuffle} onCheckedChange={setShuffle} />
                        </div>

                        {/* Templates & AI Suggester */}
                        <div className="space-y-3 pt-1 border-t">
                          <BlueprintTemplates
                            blueprint={blueprint}
                            onApply={(bp) => {
                              setBlueprint(bp);
                              setSelectedPreset("");
                              toast.success("Template applied");
                            }}
                          />

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
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>

                {/* ================= RIGHT / STICKY SUMMARY & ACTION COLUMN ================= */}
                <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
                  {/* Live Blueprint Summary Box */}
                  <div className="rounded-2xl border-2 border-emerald-500/30 bg-card p-5 shadow-sm space-y-4">
                    <div className="border-b pb-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Exam Blueprint Summary
                      </div>
                      <h3 className="text-lg font-bold text-foreground mt-0.5">
                        {currentClass?.class_name} · {currentSubject?.subject_name}
                      </h3>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {chapterIds.length} {chapterIds.length === 1 ? "Chapter" : "Chapters"} Included
                      </div>
                    </div>

                    {/* Big Key Stats */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                      <div>
                        <div className="text-2xl font-black text-foreground">{totalQuestions}</div>
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Questions</div>
                      </div>
                      <div className="border-x">
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalMarks}</div>
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Marks</div>
                      </div>
                      <div>
                        <div className="text-xl sm:text-2xl font-black text-foreground">{formatDuration(durationMins)}</div>
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Duration</div>
                      </div>
                    </div>

                    {/* Question Breakdown Chips */}
                    <div className="space-y-1.5 text-xs">
                      <div className="text-[11px] font-semibold text-muted-foreground">Section Breakdown:</div>
                      <div className="flex flex-col gap-1.5">
                        {TYPE_NAMES.map((t) => {
                          const count = blueprint[t].difficulties.Easy + blueprint[t].difficulties.Medium + blueprint[t].difficulties.Hard;
                          const marks = count * blueprint[t].marksPerQuestion;
                          return (
                            <div key={t} className="flex items-center justify-between rounded-lg bg-background px-3 py-1.5 border text-xs">
                              <span className="font-medium flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ background: `var(--chart-${TYPE_NAMES.indexOf(t) + 1})` }} />
                                {TYPE_META[t].label}
                              </span>
                              <span className="font-bold text-muted-foreground">
                                {count} Qs ({marks} Marks)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* PRIMARY GENERATION ACTION CARDS */}
                  <div className="space-y-3">
                    {/* Action 1: Practice Online */}
                    <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/70 via-background to-card p-4 shadow-sm hover:border-emerald-500 transition-all dark:from-emerald-950/30">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                            <Play className="h-4 w-4 fill-current" />
                            Practice Online
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Interactive in-browser test with live timer and instant scoring.
                          </div>
                        </div>
                        <Badge className="bg-emerald-600 text-white border-0 text-[10px] shrink-0 font-semibold">
                          Online
                        </Badge>
                      </div>

                      <Button
                        size="lg"
                        disabled={generating || (!!user && !canGenerate)}
                        onClick={() => handleGenerate("practice")}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-sm mt-2"
                      >
                        {!user ? (
                          <>
                            <Lock className="mr-1.5 h-4 w-4" /> Sign In to Practice Online
                          </>
                        ) : generating ? (
                          <>
                            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            Preparing Test…
                          </>
                        ) : (
                          <>
                            <Play className="mr-1.5 h-4 w-4 fill-current" /> Start Online Practice
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Action 2: Generate & Print */}
                    <div className="rounded-2xl border-2 border-teal-500/40 bg-gradient-to-br from-teal-50/70 via-background to-card p-4 shadow-sm hover:border-teal-500 transition-all dark:from-teal-950/30">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-bold text-sm">
                            <Printer className="h-4 w-4" />
                            Generate & Print Paper
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Official exam paper with school logo, header, 2-column layout & PDF export.
                          </div>
                        </div>
                        <Badge className="bg-teal-600 text-white border-0 text-[10px] shrink-0 font-semibold">
                          Print / PDF
                        </Badge>
                      </div>

                      <Button
                        size="lg"
                        disabled={generating || (!!user && !canGenerate)}
                        onClick={() => handleGenerate("preview")}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold h-11 shadow-sm mt-2"
                      >
                        {!user ? (
                          <>
                            <Lock className="mr-1.5 h-4 w-4" /> Sign In to Generate Paper
                          </>
                        ) : generating ? (
                          <>
                            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            Generating Paper…
                          </>
                        ) : (
                          <>
                            <Printer className="mr-1.5 h-4 w-4" /> Generate Printable Paper
                          </>
                        )}
                      </Button>
                    </div>

                    {!canGenerate && (
                      <p className="text-center text-[11px] text-muted-foreground">
                        {chapterIds.length === 0
                          ? "Select at least 1 chapter in syllabus."
                          : "Add at least 1 question using + or pick a preset."}
                      </p>
                    )}
                  </div>
                </div>
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
                      value={need === 0 ? "" : need}
                      placeholder="0"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setCount(t, d, 0);
                          return;
                        }
                        const n = parseInt(raw, 10);
                        if (!isNaN(n)) setCount(t, d, Math.max(0, n));
                      }}
                      onFocus={(e) => e.target.select()}
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
/*                          Wizard Breadcrumbs                               */
/* ========================================================================= */

function WizardBreadcrumbs({
  step,
  currentClass,
  currentSubject,
  chapterCount,
  onNavigate,
}: {
  step: WizardStep;
  currentClass?: CurriculumNode;
  currentSubject?: CurriculumNode;
  chapterCount: number;
  onNavigate: (step: WizardStep) => void;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground"
    >
      {step === "class" && (
        <span className="font-bold text-foreground bg-muted/70 px-2.5 py-1 rounded-md text-xs">
          Class
        </span>
      )}

      {step === "subject" && (
        <>
          <button
            type="button"
            onClick={() => onNavigate("class")}
            className="hover:text-emerald-600 transition-colors cursor-pointer hover:underline text-xs"
          >
            {currentClass?.class_name || "Class"}
          </button>
          <span className="text-muted-foreground/60 select-none text-xs">›</span>
          <span className="font-bold text-foreground bg-muted/70 px-2.5 py-1 rounded-md text-xs">
            Subject
          </span>
        </>
      )}

      {step === "syllabus" && (
        <>
          <button
            type="button"
            onClick={() => onNavigate("class")}
            className="hover:text-emerald-600 transition-colors cursor-pointer hover:underline text-xs"
          >
            {currentClass?.class_name || "Class"}
          </button>
          <span className="text-muted-foreground/60 select-none text-xs">›</span>
          <button
            type="button"
            onClick={() => onNavigate("subject")}
            className="hover:text-emerald-600 transition-colors cursor-pointer hover:underline text-xs"
          >
            {currentSubject?.subject_name || "Subject"}
          </button>
          <span className="text-muted-foreground/60 select-none text-xs">›</span>
          <span className="font-bold text-foreground bg-muted/70 px-2.5 py-1 rounded-md text-xs">
            Syllabus
          </span>
        </>
      )}

      {step === "setup" && (
        <>
          <button
            type="button"
            onClick={() => onNavigate("class")}
            className="hover:text-emerald-600 transition-colors cursor-pointer hover:underline text-xs"
          >
            {currentClass?.class_name || "Class"}
          </button>
          <span className="text-muted-foreground/60 select-none text-xs">›</span>
          <button
            type="button"
            onClick={() => onNavigate("subject")}
            className="hover:text-emerald-600 transition-colors cursor-pointer hover:underline text-xs"
          >
            {currentSubject?.subject_name || "Subject"}
          </button>
          <span className="text-muted-foreground/60 select-none text-xs">›</span>
          <button
            type="button"
            onClick={() => onNavigate("syllabus")}
            className="hover:text-emerald-600 transition-colors cursor-pointer hover:underline text-xs"
          >
            Syllabus ({chapterCount} Ch)
          </button>
          <span className="text-muted-foreground/60 select-none text-xs">›</span>
          <span className="font-bold text-foreground bg-muted/70 px-2.5 py-1 rounded-md text-xs">
            Test Setup
          </span>
        </>
      )}
    </nav>
  );
}

/* ========================================================================= */
/*                   Difficulty Distribution & Analytics Dropdown            */
/* ========================================================================= */

function DifficultyDistributionDropdown(props: {
  blueprint: Blueprint;
  setBlueprint: (bp: Blueprint) => void;
  totalQuestions: number;
  totalMarks: number;
  setSelectedPreset: (p: string) => void;
}) {
  const { blueprint, setBlueprint, totalQuestions, setSelectedPreset } = props;
  const [open, setOpen] = useState(false);

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
      total,
      index,
      higherOrderPct,
    };
  }, [blueprint]);

  const indexLabel =
    stats.index <= 35
      ? "Easy"
      : stats.index <= 65
      ? "Balanced"
      : "Challenging";
  const indexColor =
    stats.index <= 35
      ? "text-emerald-600"
      : stats.index <= 65
      ? "text-amber-600"
      : "text-rose-600";

  const applyRatio = (easyPct: number, medPct: number, hardPct: number) => {
    setSelectedPreset("");
    const updated = { ...blueprint };
    for (const t of TYPE_NAMES) {
      const count =
        updated[t].difficulties.Easy +
        updated[t].difficulties.Medium +
        updated[t].difficulties.Hard;
      if (count === 0) continue;
      const easy = Math.round((count * easyPct) / 100);
      const hard = Math.round((count * hardPct) / 100);
      const med = Math.max(0, count - easy - hard);
      updated[t] = {
        ...updated[t],
        difficulties: { Easy: easy, Medium: med, Hard: hard },
      };
    }
    setBlueprint(updated);
    toast.success("Difficulty distribution updated");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold shadow-xs hover:bg-accent/40 focus:outline-hidden"
        >
          <span className="truncate flex items-center gap-1.5 min-w-0">
            <BarChart3 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">
              {stats.total > 0
                ? `${stats.easy}E · ${stats.medium}M · ${stats.hard}H`
                : "Balanced"}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-4 space-y-3.5" align="start">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h4 className="text-xs font-bold text-foreground">
              Difficulty Analytics
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Distribution across {stats.total} total questions
            </p>
          </div>
          <Badge variant="outline" className={`font-bold text-xs ${indexColor}`}>
            {stats.index}% · {indexLabel}
          </Badge>
        </div>

        {/* Stacked Visual Bar */}
        <div className="space-y-1">
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
            {stats.total > 0 && (
              <>
                <div
                  style={{ width: `${(stats.easy / stats.total) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Easy: ${stats.easy}`}
                />
                <div
                  style={{ width: `${(stats.medium / stats.total) * 100}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`Medium: ${stats.medium}`}
                />
                <div
                  style={{ width: `${(stats.hard / stats.total) * 100}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`Hard: ${stats.hard}`}
                />
              </>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              ● Easy ({stats.total > 0 ? Math.round((stats.easy / stats.total) * 100) : 0}%)
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              ● Med ({stats.total > 0 ? Math.round((stats.medium / stats.total) * 100) : 0}%)
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">
              ● Hard ({stats.total > 0 ? Math.round((stats.hard / stats.total) * 100) : 0}%)
            </span>
          </div>
        </div>

        {/* Analytics Breakdown Cards */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-2">
            <div className="font-bold text-emerald-700 dark:text-emerald-300">
              Easy
            </div>
            <div className="text-base font-extrabold text-foreground">
              {stats.easy}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {stats.easyMarks} marks
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-2">
            <div className="font-bold text-amber-700 dark:text-amber-300">
              Medium
            </div>
            <div className="text-base font-extrabold text-foreground">
              {stats.medium}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {stats.mediumMarks} marks
            </div>
          </div>
          <div className="rounded-lg border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-2">
            <div className="font-bold text-rose-700 dark:text-rose-300">
              Hard
            </div>
            <div className="text-base font-extrabold text-foreground">
              {stats.hard}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {stats.hardMarks} marks
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5 pt-1 border-t">
          <div className="text-[11px] font-semibold text-muted-foreground">
            Apply Quick Distribution:
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyRatio(50, 35, 15)}
              className="text-[10px] h-7 px-1 font-semibold"
            >
              Easy (50/35/15)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyRatio(35, 45, 20)}
              className="text-[10px] h-7 px-1 font-semibold"
            >
              Balanced (35/45/20)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyRatio(20, 40, 40)}
              className="text-[10px] h-7 px-1 font-semibold"
            >
              Hard (20/40/40)
            </Button>
          </div>
        </div>

        {/* Higher Order Thinking Footer */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2">
          <span>Higher-order thinking questions:</span>
          <span className="font-bold text-foreground">
            {stats.higherOrderPct}%
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ========================================================================= */
/*                          DurationDropdown                                 */
/* ========================================================================= */

function DurationDropdown(props: {
  durationMins: number;
  setDurationMins: (mins: number) => void;
}) {
  const { durationMins, setDurationMins } = props;
  const [open, setOpen] = useState(false);
  const presets = [15, 20, 30, 45, 60, 90, 120, 180];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold shadow-xs hover:bg-accent/40 focus:outline-hidden"
        >
          <span className="truncate flex items-center gap-1.5 min-w-0">
            <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{formatDuration(durationMins)}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="start">
        <div className="flex items-center justify-between border-b pb-2">
          <span className="text-xs font-bold text-foreground">Exam Duration</span>
          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatDuration(durationMins)}
          </span>
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-4 gap-1.5">
          {presets.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setDurationMins(m);
                setOpen(false);
              }}
              className={`rounded-md border py-1.5 text-xs font-semibold transition-all ${
                durationMins === m
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-border bg-background hover:bg-accent text-foreground"
              }`}
            >
              {formatDuration(m)}
            </button>
          ))}
        </div>

        {/* Custom Input */}
        <div className="flex items-center gap-2 border-t pt-2">
          <span className="text-xs text-muted-foreground shrink-0">Custom:</span>
          <div className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 flex-1">
            <input
              type="number"
              min={1}
              max={360}
              value={durationMins === 0 ? "" : durationMins}
              placeholder="e.g. 75"
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  setDurationMins(0);
                  return;
                }
                const n = parseInt(val, 10);
                if (!isNaN(n)) setDurationMins(Math.max(1, Math.min(360, n)));
              }}
              onBlur={() => {
                if (durationMins < 1) setDurationMins(30);
              }}
              onFocus={(e) => e.target.select()}
              className="w-full text-xs font-bold bg-transparent focus:outline-none"
            />
            <span className="text-[11px] text-muted-foreground">min</span>
          </div>
          {durationMins >= 60 && (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
              ({formatDuration(durationMins)})
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ========================================================================= */
/*                       SourceFilterDropdown                                */
/* ========================================================================= */

function SourceFilterDropdown(props: {
  subjectId: string;
  chapterIds: string[];
  topicIds: string[];
  questionSources: string[];
  setQuestionSources: (v: string[]) => void;
}) {
  const { subjectId, chapterIds, topicIds, questionSources, setQuestionSources } = props;
  const [open, setOpen] = useState(false);
  const [sourceCounts, setSourceCounts] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSources = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    try {
      const data = await fetchQuestionSources({ subjectId, chapterIds, topicIds });
      setSourceCounts(data.sources);
      // Select all sources by default
      setQuestionSources(data.sources.map((s) => s.name));
    } catch {
      toast.error("Could not load question sources");
    } finally {
      setLoading(false);
    }
  }, [subjectId, chapterIds, topicIds, setQuestionSources]);

  useEffect(() => {
    loadSources();
  }, [subjectId, chapterIds, topicIds, loadSources]);

  // Prune any selected sources that no longer exist after a re-fetch
  useEffect(() => {
    if (sourceCounts.length === 0) return;
    const valid = new Set(sourceCounts.map((s) => s.name));
    const pruned = questionSources.filter((s) => valid.has(s));
    if (pruned.length !== questionSources.length && pruned.length > 0) {
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

  const areAllSelected =
    sourceCounts.length > 0 && questionSources.length === sourceCounts.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold shadow-xs hover:bg-accent/40 focus:outline-hidden"
        >
          <span className="truncate flex items-center gap-1.5 min-w-0">
            <Filter className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">Source Filter</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2.5" align="start">
        <div className="flex items-center justify-between border-b pb-2">
          <span className="text-xs font-bold text-foreground">Question Source Filter</span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-tight">
          Filter bank questions by source category. All categories selected by default.
        </p>

        {loading ? (
          <div className="space-y-1.5 py-1">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        ) : sourceCounts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            No question sources found in this scope.
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {sourceCounts.map((s) => {
              const checked = questionSources.includes(s.name);
              return (
                <label
                  key={s.name}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-2 text-xs transition-all ${
                    checked
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-medium"
                      : "border-border hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSource(s.name)}
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                    <span className="capitalize truncate">{s.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {s.count}
                  </Badge>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setQuestionSources(sourceCounts.map((s) => s.name))}
            disabled={areAllSelected}
            className="h-7 text-[11px] px-2 text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Select All
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setQuestionSources([])}
            disabled={questionSources.length === 0}
            className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground font-medium"
          >
            Deselect All
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
  defaultOpen?: boolean;
}) {
  const { subjectId, chapterIds, topicIds, questionSources, setQuestionSources, defaultOpen = false } = props;
  const [sourceCounts, setSourceCounts] = useState<
    { name: string; count: number }[]
  >([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(defaultOpen);
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
    if (defaultOpen && !sourcesFetched && subjectId) {
      loadSources();
    }
  }, [defaultOpen, sourcesFetched, subjectId, loadSources]);

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
                value={targetMarks === 0 ? "" : targetMarks}
                placeholder="Target marks"
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setTargetMarks(0);
                    return;
                  }
                  const n = parseInt(raw, 10);
                  if (!isNaN(n)) setTargetMarks(Math.max(1, n));
                }}
                onBlur={() => {
                  if (targetMarks < 1) setTargetMarks(currentTotalMarks || 30);
                }}
                onFocus={(e) => e.target.select()}
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
