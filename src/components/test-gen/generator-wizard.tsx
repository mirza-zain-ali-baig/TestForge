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
} from "./lib";
import type {
  GenerateTestRequest,
  GeneratedTest,
  Blueprint,
  QuestionTypeName,
  DifficultyName,
  GenerateSource,
} from "@/lib/types";

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
}: {
  onGenerated: (variants: GeneratedTest[]) => void;
}) {
  const [tree, setTree] = useState<CurriculumNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const generateBtnRef = useRef<HTMLDivElement>(null);

  /* -------------------- Mount: load curriculum + auto-select first class/subject/all chapters -------------------- */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCurriculum()
      .then((d) => {
        if (!alive) return;
        setTree(d.tree);
        if (d.tree[0]) {
          setClassId(d.tree[0].id);
          const firstSubject = d.tree[0].subjects?.[0];
          if (firstSubject) {
            setSubjectId(firstSubject.id);
            if (firstSubject.chapters?.length) {
              setChapterIds(firstSubject.chapters.map((c) => c.id));
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

  const currentClass = tree.find((c) => c.id === classId);
  const currentSubject = currentClass?.subjects?.find((s) => s.id === subjectId);
  const chapters = currentSubject?.chapters ?? [];
  const selectedChapters = chapters.filter((c) => chapterIds.includes(c.id));

  const allTopics = useMemo(
    () => selectedChapters.flatMap((c) => c.topics ?? []),
    [selectedChapters]
  );

  /* -------------------- When class changes, auto-pick first subject of new class (if current subject is no longer valid) -------------------- */
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

  /* -------------------- When subject changes, auto-select ALL chapters of the new subject (20s flow UX) -------------------- */
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

  /* -------------------- Blueprint setters (clear preset highlight on manual edit) -------------------- */
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

  /* -------------------- Preset click: fill blueprint + duration, scroll to generate -------------------- */
  const handlePresetClick = (preset: PresetDef) => {
    setSelectedPreset(preset.id);
    setBlueprint(preset.blueprint);
    setDurationMins(preset.duration);
    setCustomizeOpen(false);
    // allow state to settle before smooth-scrolling
    setTimeout(() => {
      generateBtnRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
  };

  /* -------------------- Generate (existing logic, unchanged) -------------------- */
  const handleGenerate = async () => {
    if (!currentClass || !currentSubject) return;
    setGenerating(true);
    try {
      const req: GenerateTestRequest = {
        classId,
        className: currentClass.class_name ?? "",
        subjectId,
        subjectName: currentSubject.subject_name ?? "",
        title,
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
        onGenerated(variants);
      } else {
        const test = await generateTest(req);
        toast.success(
          `Test generated — ${test.totalQuestions} questions, ${test.totalMarks} marks`
        );
        onGenerated([test]);
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

  const customizeOpenEffective = customizeOpen || !selectedPreset;

  return (
    <div className="space-y-5">
      {loading ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ============================ Section 1: Quick Presets ============================ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wand2 className="h-4 w-4 text-emerald-600" /> Create a test
              </CardTitle>
              <CardDescription>
                Pick a preset to start in seconds — then click <strong>Generate</strong>. Or
                customize below.
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
                      className={[
                        "flex min-h-[150px] flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all",
                        selected
                          ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/30 dark:bg-emerald-950/40"
                          : "border-border bg-card hover:border-emerald-400 hover:bg-emerald-50/40 hover:shadow-sm dark:hover:bg-emerald-950/20",
                      ].join(" ")}
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

          {/* ============================ Section 2: Customize (collapsible) ============================ */}
          <Collapsible
            open={customizeOpenEffective}
            onOpenChange={(o) => {
              // Only allow user to toggle when a preset is selected.
              // When no preset is selected, the section is forced open.
              if (selectedPreset) setCustomizeOpen(o);
            }}
          >
            <Card className="gap-0 overflow-hidden py-0">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={[
                    "flex w-full items-center gap-2 px-5 py-3.5 text-left transition hover:bg-accent/40",
                    customizeOpenEffective ? "border-b" : "",
                  ].join(" ")}
                >
                  <Settings2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">Customize</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {selectedPreset
                        ? "Optional — tweak class, chapters, counts, or difficulty"
                        : "Pick a class, subject, and chapters to build your test"}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      customizeOpenEffective ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-5 p-5">
                  {/* Class + Subject dropdowns */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Class
                      </Label>
                      <Select value={classId} onValueChange={setClassId}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {tree.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.class_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Subject
                      </Label>
                      <Select value={subjectId} onValueChange={setSubjectId}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {(currentClass?.subjects ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.subject_name} ({s.questionCount} Q)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Chapter chips */}
                  {chapters.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="flex items-center gap-2 text-sm font-medium">
                          <Layers className="h-4 w-4 text-emerald-600" /> Chapters
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {chapterIds.length}/{chapters.length}
                          </Badge>
                        </Label>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={selectAllChapters}>
                            Select all
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setChapterIds([])}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {chapters.map((c) => {
                          const checked = chapterIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleChapter(c.id)}
                              className={[
                                "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all",
                                checked
                                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                                  : "border-border hover:border-emerald-400 hover:bg-accent",
                              ].join(" ")}
                              title={c.chapter_name}
                            >
                              <span className="font-mono text-[10px] text-muted-foreground">
                                Ch{c.chapter_number}
                              </span>
                              <span className="max-w-[160px] truncate font-medium">
                                {c.chapter_name}
                              </span>
                              <Badge variant="secondary" className="text-[10px]">
                                {c.questionCount}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Blueprint: 3 compact cards */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <SquareStack className="h-4 w-4 text-emerald-600" /> Question setup
                    </Label>
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
                            className={[
                              "rounded-xl border-2 p-3 transition-all",
                              dimmed ? "border-muted bg-muted/20 opacity-60" : "bg-card",
                            ].join(" ")}
                            style={dimmed ? undefined : { borderColor: colorVar }}
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                                style={{ background: colorVar }}
                              >
                                <TypeIcon name={t} />
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold">
                                  {meta.label}
                                </div>
                                <div className="truncate text-[10px] text-muted-foreground">
                                  {typeCount}Q · {typeCount * cfg.marksPerQuestion} marks
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Count
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={typeCount}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === "") return; // allow empty while typing
                                    const n = parseInt(raw, 10);
                                    if (!isNaN(n)) setTypeCount(t, Math.max(0, n));
                                  }}
                                  className="mt-0.5 h-9 text-sm font-semibold"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Marks
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
                                  className="mt-0.5 h-9 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Difficulty: auto-balanced by default, expandable */}
                  <Collapsible open={difficultyOpen} onOpenChange={setDifficultyOpen}>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Shuffle className="h-4 w-4 text-emerald-600" />
                          <div>
                            <div className="text-sm font-medium">
                              Difficulty distribution
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {difficultyOpen
                                ? "Fine-tune Easy / Medium / Hard per type"
                                : "Auto-balanced (Easy / Medium / Hard)"}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDifficultyOpen(!difficultyOpen)}
                        >
                          <ChevronDown
                            className={`mr-1 h-4 w-4 transition-transform ${
                              difficultyOpen ? "rotate-180" : ""
                            }`}
                          />
                          {difficultyOpen ? "Hide" : "Customize"}
                        </Button>
                      </div>
                      <CollapsibleContent>
                        <div className="mt-3 space-y-3">
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
                          <DifficultyPreview
                            blueprint={blueprint}
                            totalQuestions={totalQuestions}
                            totalMarks={totalMarks}
                          />
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>

                  {/* Test title + Duration */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="flex items-center gap-1.5">
                        Test title
                        <span className="text-[10px] font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Computer Science — Mid Term"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-emerald-600" /> Duration:{" "}
                        {durationMins} min
                      </Label>
                      <div className="pt-1">
                        <Slider
                          value={[durationMins]}
                          onValueChange={(v) => setDurationMins(v[0])}
                          min={15}
                          max={180}
                          step={5}
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                          <span>15 min</span>
                          <span>3 hrs</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ============================ Section 3: Generate ============================ */}
          <div ref={generateBtnRef}>
            <Card>
              <CardContent className="space-y-4 p-5">
                {/* Source pills */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Question source</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {SOURCES.map((s) => {
                      const selected = source === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSource(s.id)}
                          title={s.desc}
                          className={[
                            "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 text-center transition-all",
                            selected
                              ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                              : "border-border hover:border-emerald-400 hover:bg-accent",
                          ].join(" ")}
                        >
                          <s.icon className="h-5 w-5 text-emerald-600" />
                          <span className="text-xs font-semibold">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Variant count */}
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <CopyPlus className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="text-sm font-medium">Variants</div>
                      <div className="text-[11px] text-muted-foreground">
                        Multiple disjoint versions
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setVariantCount(n)}
                        className={[
                          "h-9 min-w-[36px] rounded-md border text-sm font-semibold transition-all",
                          variantCount === n
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-border hover:border-emerald-400 hover:bg-accent",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced options */}
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full">
                      <ChevronDown
                        className={`mr-1 h-4 w-4 transition-transform ${
                          advancedOpen ? "rotate-180" : ""
                        }`}
                      />
                      Advanced options
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-3 rounded-lg border bg-muted/20 p-3">
                      {/* Shuffle */}
                      <div className="flex items-center justify-between rounded-md border bg-card p-3">
                        <div className="flex items-center gap-2">
                          <Shuffle className="h-4 w-4 text-emerald-600" />
                          <div>
                            <div className="text-sm font-medium">
                              Shuffle questions &amp; options
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Randomize order per generation.
                            </div>
                          </div>
                        </div>
                        <Switch checked={shuffle} onCheckedChange={setShuffle} />
                      </div>

                      {/* Topics filter (optional) */}
                      {selectedChapters.length > 0 && (
                        <div className="rounded-md border bg-card p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                              <Layers className="h-4 w-4 text-emerald-600" /> Topics filter
                              <span className="text-[11px] font-normal text-muted-foreground">
                                (optional)
                              </span>
                            </Label>
                            {topicIds.length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setTopicIds([])}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                            {allTopics.map((t) => {
                              const checked = topicIds.includes(t.id);
                              return (
                                <label
                                  key={t.id}
                                  className={[
                                    "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-all",
                                    checked
                                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                                      : "border-border hover:bg-accent",
                                  ].join(" ")}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleTopic(t.id)}
                                  />
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {t.topic_article_no}
                                  </span>
                                  <span className="truncate">{t.topic_name}</span>
                                  <Badge
                                    variant="secondary"
                                    className="ml-auto text-[10px]"
                                  >
                                    {t.questionCount}
                                  </Badge>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Question source filter (question_from) */}
                      <SourceFilterEditor
                        subjectId={subjectId}
                        chapterIds={chapterIds}
                        topicIds={topicIds}
                        questionSources={questionSources}
                        setQuestionSources={setQuestionSources}
                      />

                      {/* Instructions */}
                      <div className="rounded-md border bg-card p-3">
                        <Label
                          htmlFor="instructions"
                          className="flex items-center gap-2 text-sm font-medium"
                        >
                          <FileText className="h-4 w-4 text-emerald-600" /> Instructions for
                          students
                        </Label>
                        <Textarea
                          id="instructions"
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          rows={3}
                          className="mt-2"
                          placeholder="General instructions printed at the top of the paper…"
                        />
                      </div>

                      {/* Templates */}
                      <div className="rounded-md border bg-card p-3">
                        <BlueprintTemplates
                          blueprint={blueprint}
                          onApply={(bp) => {
                            setBlueprint(bp);
                            setSelectedPreset("");
                            toast.success("Template applied");
                          }}
                        />
                      </div>

                      {/* AI Suggester */}
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

                {/* Summary line */}
                <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{totalQuestions}</strong> questions
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-foreground">{totalMarks}</strong> marks
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-foreground">{durationMins}</strong> min
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-foreground">{chapterIds.length}</strong> chapters
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-foreground capitalize">{source}</strong>
                  </span>
                </div>

                {/* Generate button */}
                <Button
                  size="lg"
                  className="h-14 w-full bg-emerald-600 text-base hover:bg-emerald-700"
                  onClick={handleGenerate}
                  disabled={generating || !canGenerate}
                >
                  {generating ? (
                    <>
                      <span className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      {variantCount > 1
                        ? `Generating ${variantCount} variants…`
                        : "Generating your test…"}
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-5 w-5" />
                      {variantCount > 1
                        ? `Generate ${variantCount} variants · ${
                            variantCount * totalQuestions
                          } questions`
                        : `Generate Test · ${totalQuestions} questions · ${totalMarks} marks`}
                    </>
                  )}
                </Button>

                {!canGenerate && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    {chapterIds.length === 0
                      ? "Select at least one chapter in Customize above."
                      : "Pick a preset above or add questions in Customize."}
                  </p>
                )}

                {source !== "bank" && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      AI generation calls the language model and may take 10–30 seconds depending
                      on the number of questions. Generated questions are original and not stored
                      in the bank.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
