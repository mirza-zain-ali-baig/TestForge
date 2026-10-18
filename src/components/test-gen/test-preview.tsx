"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Printer,
  Save,
  RefreshCw,
  ArrowLeft,
  KeyRound,
  Download,
  CheckCircle2,
  Database,
  Bot,
  Sparkles,
  FileWarning,
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  FileText,
  X,
  ListPlus,
  Wand2,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Timer,
  Flag,
  Award,
  Upload,
  FileType,
  Share2,
  Link2,
  Copy,
  Check,
  QrCode,
  Building2,
  Stamp,
  FileSpreadsheet,
  CopyCheck,
  AlertTriangle,
  Lightbulb,
  ImageIcon,
  FileDown,
  EyeOff,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GeneratedTest, GeneratedQuestion, TestSection } from "@/lib/types";
import type { QuestionTypeName, DifficultyName } from "@/lib/types";
import {
  saveTest,
  fetchQuestions,
  regenerateQuestion as regenerateQuestionApi,
  checkSimilarity,
  explainQuestion,
  type BankQuestion,
  type SimilarityPair,
} from "./lib";
import { TYPE_NAMES, DIFF_NAMES, TYPE_META } from "./lib";
import { formatDuration } from "./generator-wizard";
import { renderInlineStyles } from "./chat-markdown";
import { exportTestToDocxBlob } from "@/lib/docx-export";

const LETTERS = ["A", "B", "C", "D"] as const;

export function TestPreview({
  test,
  onTestChange,
  onBack,
  onRegenerate,
  onPrintExport,
  initialMode,
}: {
  test: GeneratedTest;
  onTestChange: (t: GeneratedTest) => void;
  onBack: () => void;
  onRegenerate: () => void;
  onPrintExport?: () => void;
  initialMode?: "preview" | "practice" | "print";
}) {
  const [showAnswers, setShowAnswers] = useState(false);
  const [hidePaper, setHidePaper] = useState(false); // default: show paper
  const [printAnswerKey, setPrintAnswerKey] = useState(true);
  const [printStudentInfo, setPrintStudentInfo] = useState(true);
  const [institutionName, setInstitutionName] = useState("");
  const [watermarkText, setWatermarkText] = useState("");

  // New print customization fields
  const [academyName, setAcademyName] = useState("");
  const [academyLocation, setAcademyLocation] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [classNameInput, setClassNameInput] = useState(test.className || "10TH");
  const [paperCode, setPaperCode] = useState("");
  const [subjectNameInput, setSubjectNameInput] = useState(test.subjectName || "");
  const [timeAllowed, setTimeAllowed] = useState(`${test.durationMins} min`);
  const [totalMarksInput, setTotalMarksInput] = useState(`${test.totalMarks}`);
  const [examDate, setExamDate] = useState(
    new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  );
  const [examSyllabus, setExamSyllabus] = useState("L1");
  const [examLabel, setExamLabel] = useState("");
  const [showExamLabel, setShowExamLabel] = useState(false);

  // Font size + header size controls
  const [fontSize, setFontSize] = useState(12);
  const [headerSize, setHeaderSize] = useState(18);

  // Border options
  const [mcqBorder, setMcqBorder] = useState(true);
  const [shortBorder, setShortBorder] = useState(false);
  const [longBorder, setLongBorder] = useState(false);

  // Bubble sheet
  const [showBubbleSheet, setShowBubbleSheet] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingQ, setEditingQ] = useState<{
    sectionIndex: number;
    qIndex: number;
  } | null>(null);
  const [addingToSection, setAddingToSection] = useState<number | null>(null);
  const [practicing, setPracticing] = useState(initialMode === "practice");
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [checkingDupes, setCheckingDupes] = useState(false);

  /* --------------------------- mutation helpers -------------------------- */

  const updateTest = useCallback(
    (updater: (t: GeneratedTest) => GeneratedTest) => {
      onTestChange(updater(test));
      setSaved(false);
    },
    [test, onTestChange]
  );

  const recomputeTotals = (t: GeneratedTest): GeneratedTest => {
    let totalQ = 0;
    let totalMarks = 0;
    for (const s of t.sections) {
      s.questions = s.questions.map((q, i) => ({ ...q, marks: s.marksPerQuestion }));
      s.sectionMarks = s.questions.reduce((sum, q) => sum + q.marks, 0);
      totalQ += s.questions.length;
      totalMarks += s.sectionMarks;
    }
    return { ...t, totalQuestions: totalQ, totalMarks };
  };

  const deleteQuestion = (sectionIndex: number, qIndex: number) => {
    updateTest((t) => {
      const sections = [...t.sections];
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        questions: sections[sectionIndex].questions.filter((_, i) => i !== qIndex),
      };
      return recomputeTotals({ ...t, sections });
    });
    toast.success("Question removed");
  };

  const editQuestion = (sectionIndex: number, qIndex: number, q: GeneratedQuestion) => {
    updateTest((t) => {
      const sections = [...t.sections];
      const questions = [...sections[sectionIndex].questions];
      questions[qIndex] = q;
      sections[sectionIndex] = { ...sections[sectionIndex], questions };
      return recomputeTotals({ ...t, sections });
    });
    setEditingQ(null);
    toast.success("Question updated");
  };

  const addQuestion = (sectionIndex: number, q: GeneratedQuestion) => {
    updateTest((t) => {
      const sections = [...t.sections];
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        questions: [...sections[sectionIndex].questions, q],
      };
      return recomputeTotals({ ...t, sections });
    });
    setAddingToSection(null);
    toast.success("Question added");
  };

  const reorderInSection = (sectionIndex: number, activeId: string, overId: string) => {
    updateTest((t) => {
      const sections = [...t.sections];
      const sec = sections[sectionIndex];
      const oldIndex = sec.questions.findIndex((q) => q.id === activeId);
      const newIndex = sec.questions.findIndex((q) => q.id === overId);
      if (oldIndex === -1 || newIndex === -1) return t;
      sections[sectionIndex] = {
        ...sec,
        questions: arrayMove(sec.questions, oldIndex, newIndex),
      };
      return { ...t, sections };
    });
  };

  const regenerateQuestion = async (sectionIndex: number, qIndex: number) => {
    const oldQ = test.sections[sectionIndex]?.questions[qIndex];
    if (!oldQ) return;
    setRegeneratingId(oldQ.id);
    try {
      const newQ = await regenerateQuestionApi({
        subjectName: test.subjectName,
        className: test.className,
        chapterName: oldQ.chapter_name ?? undefined,
        topicName: oldQ.topic_name ?? undefined,
        typeName: oldQ.type_name,
        difficultyName: oldQ.difficulty_name,
        marks: oldQ.marks,
      });
      updateTest((t) => {
        const sections = [...t.sections];
        const questions = [...sections[sectionIndex].questions];
        questions[qIndex] = newQ;
        sections[sectionIndex] = { ...sections[sectionIndex], questions };
        return recomputeTotals({ ...t, sections });
      });
      toast.success("Question regenerated with AI");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegeneratingId(null);
    }
  };

  const explainQuestionHandler = async (sectionIndex: number, qIndex: number) => {
    const q = test.sections[sectionIndex]?.questions[qIndex];
    if (!q) return;
    // If already explained, toggle it off
    if (explanations[q.id]) {
      setExplanations((prev) => {
        const next = { ...prev };
        delete next[q.id];
        return next;
      });
      return;
    }
    setExplainingId(q.id);
    try {
      const explanation = await explainQuestion({
        question: q,
        className: test.className,
        subjectName: test.subjectName,
      });
      setExplanations((prev) => ({ ...prev, [q.id]: explanation }));
      toast.success("AI explanation generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Explanation failed");
    } finally {
      setExplainingId(null);
    }
  };

  /* ------------------------------- actions -------------------------------- */

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTest(test);
      setSaved(true);
      toast.success("Test saved to “My Tests”");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(test, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${test.title.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadText = () => {
    const text = renderPlainText(test, showAnswers);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${test.title.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF export: open a print-optimized window and trigger print (user picks "Save as PDF")
  const handleExportPDF = () => {
    const html = renderPrintHTML(test, {
      showAnswers: false,
      printAnswerKey,
      printStudentInfo,
      watermarkText,
      academyName,
      academyLocation,
      logoDataUrl,
      studentName,
      rollNumber,
      classNameInput,
      paperCode,
      subjectNameInput,
      timeAllowed,
      totalMarksInput,
      examDate,
      examSyllabus,
      examLabel,
      showExamLabel,
      fontSize,
      headerSize,
      mcqBorder,
      shortBorder,
      longBorder,
      showBubbleSheet,
    });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Pop-up blocked. Allow pop-ups to export PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 400);
  };

  // Word export: generate a genuine OpenXML Microsoft Word (.docx) file
  const handleExportWord = async () => {
    try {
      toast.info("Generating Word document (.docx)...");
      const blob = await exportTestToDocxBlob(test, {
        academyName,
        academyLocation,
        examLabel: showExamLabel ? examLabel : test.title,
        studentName,
        rollNumber,
        className: classNameInput,
        subjectName: subjectNameInput,
        timeAllowed,
        totalMarks: totalMarksInput,
        examDate,
        printStudentInfo,
        printAnswerKey,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${test.title.replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word document (.docx) exported successfully");
    } catch (e) {
      console.error("DOCX export error:", e);
      toast.error("Failed to export Word document");
    }
  };

  // Excel export: generate an HTML table with Excel-compatible MIME (.xls)
  const handleExportExcel = () => {
    const html = renderExcelHTML(test);
    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${test.title.replace(/\s+/g, "_")}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel spreadsheet exported");
  };

  // Import questions from CSV/JSON
  const handleImport = (questions: GeneratedQuestion[]) => {
    updateTest((t) => {
      const sections = [...t.sections];
      for (const q of questions) {
        // Find or create a matching section by type
        let secIdx = sections.findIndex(
          (s) => s.type_name === q.type_name && s.marksPerQuestion === q.marks
        );
        if (secIdx === -1) {
          // Find any section of matching type
          secIdx = sections.findIndex((s) => s.type_name === q.type_name);
        }
        if (secIdx === -1) {
          // Create a new section
          sections.push({
            type_name: q.type_name,
            marksPerQuestion: q.marks,
            questions: [q],
            sectionMarks: q.marks,
          });
        } else {
          sections[secIdx] = {
            ...sections[secIdx],
            questions: [...sections[secIdx].questions, q],
          };
        }
      }
      return recomputeTotals({ ...t, sections });
    });
    setImporting(false);
    toast.success(`${questions.length} question${questions.length === 1 ? "" : "s"} imported`);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="no-print">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Badge variant="outline" className="gap-1">
                {test.source === "bank" ? (
                  <Database className="h-3 w-3" />
                ) : test.source === "ai" ? (
                  <Bot className="h-3 w-3" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {test.source}
              </Badge>
              <Badge variant="secondary">{test.totalQuestions} Q</Badge>
              <Badge variant="secondary">{test.totalMarks} marks</Badge>
              <Badge variant="secondary">{formatDuration(test.durationMins)}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                <KeyRound className="h-4 w-4 text-emerald-600" />
                <Label htmlFor="ans" className="cursor-pointer text-sm">
                  Answer key
                </Label>
                <Switch id="ans" checked={showAnswers} onCheckedChange={setShowAnswers} />
              </div>
              {onPrintExport && (
                <Button
                  size="sm"
                  onClick={onPrintExport}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-sm"
                >
                  <FileDown className="mr-1.5 h-4 w-4" /> Print & Export
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
              >
                <Printer className="mr-1 h-4 w-4" /> Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
              >
                <Download className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportWord}
                title="Download as Microsoft Word document (.docx)"
              >
                <FileText className="mr-1 h-4 w-4 text-blue-600" /> Word (.docx)
              </Button>
              <Button
                size="sm"
                onClick={() => setPracticing(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold"
              >
                <Play className="mr-1 h-4 w-4 fill-current" /> Practice Online
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={saving || saved}
              >
                {saved ? (
                  <>
                    <CheckCircle2 className="mr-1 h-4 w-4 text-emerald-600" /> Saved
                  </>
                ) : (
                  <>
                    <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save"}
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={onRegenerate}>
                <RefreshCw className="mr-1 h-4 w-4" /> Regenerate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meta warnings removed per user request */}


      {/* Paper (hidden by default — click "Show paper" to view) */}
      {!hidePaper && (
      <Card id="print-area" className="mx-auto max-w-3xl min-w-0 w-full overflow-hidden">
        <CardContent className="p-4 sm:p-8 md:p-10">
          {/* Header */}
          <div className="border-b-2 border-emerald-600 pb-4 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
              {test.className} · {test.subjectName}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {test.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Time: <strong className="text-foreground">{formatDuration(test.durationMins)}</strong>
              </span>
              <span>
                Total Marks: <strong className="text-foreground">{test.totalMarks}</strong>
              </span>
              <span>
                Questions: <strong className="text-foreground">{test.totalQuestions}</strong>
              </span>
            </div>
          </div>

          {/* Student info fields */}
          {printStudentInfo && (
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Name:</span>
                <span className="flex-1 border-b border-muted-foreground/40" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Roll No:</span>
                <span className="flex-1 border-b border-muted-foreground/40" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Date:</span>
                <span className="flex-1 border-b border-muted-foreground/40" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Section:</span>
                <span className="flex-1 border-b border-muted-foreground/40" />
              </div>
            </div>
          )}

          {/* Instructions */}
          {test.instructions && (
            <div className="mt-4 rounded-md bg-muted/40 p-3 text-sm">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                General Instructions
              </div>
              <p className="whitespace-pre-line leading-relaxed">{test.instructions}</p>
            </div>
          )}

          {/* Sections */}
          <div className="mt-6 space-y-8">
            {test.sections.map((sec, si) => (
              <SortableSection
                key={sec.type_name}
                section={sec}
                sectionIndex={si}
                showAnswers={showAnswers}
                onReorder={reorderInSection}
                onDelete={deleteQuestion}
                onEdit={(qi) => setEditingQ({ sectionIndex: si, qIndex: qi })}
                onAdd={() => setAddingToSection(si)}
                onRegenerate={(qi) => regenerateQuestion(si, qi)}
                regeneratingId={regeneratingId}
                onExplain={(qi) => explainQuestionHandler(si, qi)}
                explainingId={explainingId}
                explanations={explanations}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-10 border-t border-dashed pt-3 text-center text-[11px] text-muted-foreground">
            Generated on{" "}
            {new Date(test.generatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · End of paper
          </div>

          {/* Answer key page (print only) */}
          {printAnswerKey && (
            <div className="print-only hidden print:block print-break">
              <AnswerKeyPage test={test} />
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Edit dialog */}
      {editingQ && (
        <EditQuestionDialog
          q={test.sections[editingQ.sectionIndex].questions[editingQ.qIndex]}
          onClose={() => setEditingQ(null)}
          onSave={(q) => editQuestion(editingQ.sectionIndex, editingQ.qIndex, q)}
        />
      )}

      {/* Add dialog */}
      {addingToSection !== null && (
        <AddQuestionDialog
          section={test.sections[addingToSection]}
          subjectId={test.subjectId}
          existingIds={test.sections.flatMap((s) => s.questions).map((q) => q.id)}
          onClose={() => setAddingToSection(null)}
          onAdd={(q) => addQuestion(addingToSection, q)}
        />
      )}

      {/* Practice mode */}
      {practicing && (
        <PracticeMode test={test} onClose={() => setPracticing(false)} />
      )}

      {/* Import dialog */}
      {importing && (
        <ImportQuestionsDialog
          onClose={() => setImporting(false)}
          onImport={handleImport}
        />
      )}

      {/* Share dialog */}
      {sharing && (
        <ShareDialog test={test} onClose={() => setSharing(false)} />
      )}

      {/* Dedupe dialog */}
      {checkingDupes && (
        <DedupeDialog
          test={test}
          onClose={() => setCheckingDupes(false)}
          onRemove={deleteQuestion}
        />
      )}
    </div>
  );
}

/* ------------------------- Sortable section ----------------------------- */

function SortableSection({
  section,
  sectionIndex,
  showAnswers,
  onReorder,
  onDelete,
  onEdit,
  onAdd,
  onRegenerate,
  regeneratingId,
  onExplain,
  explainingId,
  explanations,
}: {
  section: TestSection;
  sectionIndex: number;
  showAnswers: boolean;
  onReorder: (sectionIndex: number, activeId: string, overId: string) => void;
  onDelete: (sectionIndex: number, qIndex: number) => void;
  onEdit: (qIndex: number) => void;
  onAdd: () => void;
  onRegenerate: (qIndex: number) => void;
  regeneratingId: string | null;
  onExplain: (qIndex: number) => void;
  explainingId: string | null;
  explanations: Record<string, string>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = section.questions.map((q) => q.id);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      onReorder(sectionIndex, String(active.id), String(over.id));
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between border-b border-dashed pb-1">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          Section {String.fromCharCode(65 + sectionIndex)} — {section.type_name}
        </h2>
        <span className="text-xs text-muted-foreground">
          {section.questions.length} questions · {section.sectionMarks} marks ·{" "}
          {section.marksPerQuestion} each
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="space-y-4">
            {section.questions.map((q, qi) => (
              <SortableQuestion
                key={q.id}
                q={q}
                number={qi + 1}
                showAnswers={showAnswers}
                onDelete={() => onDelete(sectionIndex, qi)}
                onEdit={() => onEdit(qi)}
                onRegenerate={() => onRegenerate(qi)}
                regenerating={regeneratingId === q.id}
                onExplain={() => onExplain(qi)}
                explaining={explainingId === q.id}
                explanation={explanations[q.id] ?? null}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <button
        onClick={onAdd}
        className="no-print mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-emerald-400/60 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
      >
        <Plus className="h-3.5 w-3.5" /> Add question
      </button>
    </section>
  );
}

/* ------------------------- Sortable question ---------------------------- */

function SortableQuestion({
  q,
  number,
  showAnswers,
  onDelete,
  onEdit,
  onRegenerate,
  regenerating,
  onExplain,
  explaining,
  explanation,
}: {
  q: GeneratedQuestion;
  number: number;
  showAnswers: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  regenerating?: boolean;
  onExplain: () => void;
  explaining?: boolean;
  explanation?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: q.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.8 : 1,
  } as React.CSSProperties;

  const options = useMemo(() => {
    if (!q.options) return null;
    return LETTERS.map((l) => ({
      label: l,
      text: q.options![`option_${l.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"],
      correct: l === q.options!.correct_option,
    }));
  }, [q]);

  return (
    <li ref={setNodeRef} style={style} className="flex gap-2 sm:gap-3 min-w-0 max-w-full overflow-hidden">
      <button
        {...attributes}
        {...listeners}
        className="no-print mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm leading-relaxed break-words">
            {renderInlineStyles(q.question_text)}
            <span className="ml-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              [{q.marks} mark{q.marks > 1 ? "s" : ""}]
            </span>
          </div>
          <div className="no-print flex shrink-0 items-center gap-0.5">
            {showAnswers && q.source === "ai" && (
              <Badge variant="outline" className="mr-1 gap-1 text-[10px]">
                <Bot className="h-3 w-3" /> AI
              </Badge>
            )}
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-emerald-600 disabled:opacity-50"
              aria-label="Regenerate question with AI"
              title="Regenerate with AI"
            >
              {regenerating ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400/40 border-t-emerald-600" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={onExplain}
              disabled={explaining}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-amber-600 disabled:opacity-50"
              aria-label="Explain answer with AI"
              title="Explain answer with AI"
            >
              {explaining ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-600" />
              ) : (
                <Lightbulb className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={onEdit}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-emerald-600"
              aria-label="Edit question"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete question"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* MCQ options */}
        {options && (
          <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {options.map((o) => (
              <div
                key={o.label}
                className={[
                  "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm",
                  showAnswers && o.correct
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                    : "border-border",
                ].join(" ")}
              >
                <span className="font-semibold text-muted-foreground">{o.label}.</span>
                <span className="flex-1 break-words">{renderInlineStyles(o.text)}</span>
                {showAnswers && o.correct && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Short / Long answer */}
        {!options && showAnswers && (
          <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-2.5 text-sm dark:bg-emerald-950/30">
            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              <KeyRound className="h-3 w-3" /> Model Answer
            </div>
            <div className="whitespace-pre-line leading-relaxed break-words">
              {renderInlineStyles(q.model_answer ?? "No model answer provided.")}
            </div>
          </div>
        )}

        {/* Meta tags */}
        {showAnswers && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {q.blooms_taxonomy && (
              <Badge variant="secondary" className="text-[10px]">
                {q.blooms_taxonomy}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {q.difficulty_name}
            </Badge>
            {q.topic_name && (
              <Badge variant="outline" className="text-[10px]">
                {q.topic_name}
              </Badge>
            )}
          </div>
        )}

        {/* AI Explanation */}
        {explanation && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/20">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                <Bot className="h-3 w-3" /> AI Explanation
              </div>
              <div className="leading-relaxed text-amber-950 dark:text-amber-200 break-words">
                {renderInlineStyles(explanation)}
              </div>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/* --------------------------- Edit dialog -------------------------------- */

function EditQuestionDialog({
  q,
  onClose,
  onSave,
}: {
  q: GeneratedQuestion;
  onClose: () => void;
  onSave: (q: GeneratedQuestion) => void;
}) {
  const [draft, setDraft] = useState<GeneratedQuestion>({ ...q });

  const setOpt = (key: "option_a" | "option_b" | "option_c" | "option_d", v: string) => {
    if (!draft.options) return;
    setDraft({ ...draft, options: { ...draft.options, [key]: v } });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scroll-fancy">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-emerald-600" /> Edit question
          </DialogTitle>
          <DialogDescription>
            Modify the question text, options or model answer. Changes apply to this paper only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Question text</Label>
            <Textarea
              value={draft.question_text}
              onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
              rows={3}
            />
          </div>
          {draft.options ? (
            <div className="space-y-2">
              <Label>Options</Label>
              {LETTERS.map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        options: { ...draft.options!, correct_option: l },
                      })
                    }
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors",
                      draft.options.correct_option === l
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-border hover:border-emerald-400",
                    ].join(" ")}
                    title="Mark as correct"
                  >
                    {l}
                  </button>
                  <Input
                    value={draft.options[`option_${l.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"]}
                    onChange={(e) =>
                      setOpt(`option_${l.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d", e.target.value)
                    }
                  />
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Click the letter to mark the correct option.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Model answer</Label>
              <Textarea
                value={draft.model_answer ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, model_answer: e.target.value })
                }
                rows={5}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bloom&apos;s level</Label>
              <Input
                value={draft.blooms_taxonomy ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, blooms_taxonomy: e.target.value || null })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <Input
                value={draft.tags ?? ""}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value || null })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(draft)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="mr-1 h-4 w-4" /> Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Add dialog -------------------------------- */

function AddQuestionDialog({
  section,
  subjectId,
  existingIds,
  onClose,
  onAdd,
}: {
  section: TestSection;
  subjectId?: string;
  existingIds: string[];
  onClose: () => void;
  onAdd: (q: GeneratedQuestion) => void;
}) {
  const [tab, setTab] = useState<"bank" | "manual">(
    subjectId ? "bank" : "manual"
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-4 w-4 text-emerald-600" /> Add question to {section.type_name}
          </DialogTitle>
          <DialogDescription>
            Pick from the question bank or write a custom one. Worth {section.marksPerQuestion} mark(s).
          </DialogDescription>
        </DialogHeader>

        {/* Tab switch */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setTab("bank")}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              tab === "bank"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Database className="h-3.5 w-3.5" /> From Bank
          </button>
          <button
            onClick={() => setTab("manual")}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              tab === "manual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Pencil className="h-3.5 w-3.5" /> Custom
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto scroll-fancy">
          {tab === "bank" ? (
            <BankPicker
              section={section}
              subjectId={subjectId}
              existingIds={existingIds}
              onAdd={onAdd}
            />
          ) : (
            <ManualForm section={section} onAdd={onAdd} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Bank picker: search + filter the question bank for questions of the section's type */

function BankPicker({
  section,
  subjectId,
  existingIds,
  onAdd,
}: {
  section: TestSection;
  subjectId?: string;
  existingIds: string[];
  onAdd: (q: GeneratedQuestion) => void;
}) {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [results, setResults] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const PAGE = 10;

  const existing = new Set(existingIds);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    const t = setTimeout(() => {
      // setLoading inside the timeout avoids the synchronous-setState-in-effect lint
      // rule and reads as "loading started after debounce".
      if (cancelled) return;
      setLoading(true);
      fetchQuestions({
        subjectId,
        questionType: section.type_name,
        difficulty: difficulty === "all" ? undefined : difficulty,
        search: search || undefined,
        limit: PAGE,
        offset,
      })
        .then((r) => {
          if (cancelled) return;
          setResults(r.questions);
          setTotal(r.total);
        })
        .catch((e) => !cancelled && toast.error(e.message))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [subjectId, search, difficulty, offset, section.type_name]);

  const addFromBank = (bq: BankQuestion) => {
    const q: GeneratedQuestion = {
      id: bq.id,
      source: "bank",
      question_text: bq.question_text,
      type_name: section.type_name as QuestionTypeName,
      difficulty_name: bq.difficulty_name as DifficultyName,
      marks: section.marksPerQuestion,
      blooms_taxonomy: bq.blooms_taxonomy,
      tags: bq.tags,
      topic_name: bq.topic_name,
      chapter_name: bq.chapter_name,
      options: bq.options,
      model_answer: null,
    };
    onAdd(q);
  };

  if (!subjectId) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <Database className="h-6 w-6" />
        Bank search isn&apos;t available for this test (no subject linked).
        Use the “Custom” tab to add a question manually.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + filter */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Search bank questions…"
            className="pl-8"
          />
        </div>
        <Select
          value={difficulty}
          onValueChange={(v) => {
            setDifficulty(v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">
        {loading ? "Searching…" : `${total} matching question${total === 1 ? "" : "s"}`}
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No questions found. Try a different search or difficulty.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((bq) => {
            const already = existing.has(bq.id);
            return (
              <div
                key={bq.id}
                className="rounded-lg border bg-card p-3 transition-colors hover:border-emerald-300"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {bq.difficulty_name}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {bq.marks}m
                      </Badge>
                      {bq.blooms_taxonomy && (
                        <Badge variant="outline" className="text-[10px]">
                          {bq.blooms_taxonomy}
                        </Badge>
                      )}
                      {bq.chapter_name && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          · {bq.chapter_name}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed">{bq.question_text}</p>
                    {bq.options && (
                      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>A. {bq.options.option_a}</span>
                        <span>B. {bq.options.option_b}</span>
                        <span>C. {bq.options.option_c}</span>
                        <span>D. {bq.options.option_d}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={already ? "ghost" : "outline"}
                    disabled={already}
                    onClick={() => addFromBank(bq)}
                    className="shrink-0"
                  >
                    {already ? (
                      <>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + PAGE >= total}
            onClick={() => setOffset((o) => o + PAGE)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* Manual form (extracted from the original AddQuestionDialog) */

function ManualForm({
  section,
  onAdd,
}: {
  section: TestSection;
  onAdd: (q: GeneratedQuestion) => void;
}) {
  const [questionText, setQuestionText] = useState("");
  const [modelAnswer, setModelAnswer] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correct, setCorrect] = useState<"A" | "B" | "C" | "D">("A");

  const isMCQ = section.type_name === "MCQ";

  const handleAdd = () => {
    if (!questionText.trim()) {
      toast.error("Question text is required");
      return;
    }
    if (isMCQ) {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
        toast.error("All four options are required for MCQ");
        return;
      }
    }
    const q: GeneratedQuestion = {
      id: `manual-${Date.now()}`,
      source: "ai",
      question_text: questionText.trim(),
      type_name: section.type_name as QuestionTypeName,
      difficulty_name: "Easy",
      marks: section.marksPerQuestion,
      blooms_taxonomy: null,
      tags: null,
      topic_name: null,
      chapter_name: null,
      options: isMCQ
        ? {
            option_a: optionA.trim(),
            option_b: optionB.trim(),
            option_c: optionC.trim(),
            option_d: optionD.trim(),
            correct_option: correct,
          }
        : null,
      model_answer: isMCQ ? null : modelAnswer.trim() || null,
    };
    onAdd(q);
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Question text</Label>
        <Textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={3}
          placeholder="Enter the question…"
        />
      </div>
      {isMCQ ? (
        <div className="space-y-2">
          <Label>Options (click letter to mark correct)</Label>
          {[
            { l: "A" as const, v: optionA, set: setOptionA },
            { l: "B" as const, v: optionB, set: setOptionB },
            { l: "C" as const, v: optionC, set: setOptionC },
            { l: "D" as const, v: optionD, set: setOptionD },
          ].map((o) => (
            <div key={o.l} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCorrect(o.l)}
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors",
                  correct === o.l
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-border hover:border-emerald-400",
                ].join(" ")}
              >
                {o.l}
              </button>
              <Input
                value={o.v}
                onChange={(e) => o.set(e.target.value)}
                placeholder={`Option ${o.l}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Model answer</Label>
          <Textarea
            value={modelAnswer}
            onChange={(e) => setModelAnswer(e.target.value)}
            rows={4}
            placeholder="Enter the model answer…"
          />
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-1 h-4 w-4" /> Add to section
        </Button>
      </div>
    </div>
  );
}

/* --------------------------- Answer key page ---------------------------- */

function AnswerKeyPage({ test }: { test: GeneratedTest }) {
  return (
    <div className="mt-8 border-t-2 border-emerald-600 pt-4">
      <h2 className="text-center text-lg font-bold uppercase tracking-wide">
        Answer Key
      </h2>
      <div className="mt-4 space-y-4">
        {test.sections.map((sec, si) => (
          <div key={sec.type_name}>
            <div className="mb-2 border-b border-dashed pb-1 text-xs font-bold uppercase tracking-wide">
              Section {String.fromCharCode(65 + si)} — {sec.type_name}
            </div>
            <ol className="space-y-1.5">
              {sec.questions.map((q, qi) => (
                <li key={q.id} className="flex gap-2 text-sm">
                  <span className="font-bold tabular-nums">{qi + 1}.</span>
                  <div className="flex-1">
                    {q.options ? (
                      <span>
                        <Badge
                          variant="outline"
                          className="mr-2 border-emerald-600 text-emerald-700"
                        >
                          {q.options.correct_option}
                        </Badge>
                        <span className="text-muted-foreground">
                          {q.options[`option_${q.options.correct_option.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"]}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {q.model_answer ?? "—"}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Practice mode ------------------------------ */

type PracticeState = "intro" | "taking" | "results" | "mcq_study";

type Answer = {
  // MCQ: "A"|"B"|"C"|"D"; written: free text
  mcq?: string;
  text?: string;
  flagged: boolean;
};

function PracticeMode({
  test,
  onClose,
}: {
  test: GeneratedTest;
  onClose: () => void;
}) {
  // Flatten ONLY MCQ questions into a single list with section + marks context
  const flat = useMemo(() => {
    const out: { q: GeneratedQuestion; section: string; marks: number; globalIndex: number }[] = [];
    let gi = 0;
    for (const sec of test.sections) {
      if (sec.type_name !== "MCQ") continue;
      for (const q of sec.questions) {
        if (!q.options) continue;
        out.push({ q, section: sec.type_name, marks: q.marks, globalIndex: gi++ });
      }
    }
    return out;
  }, [test]);

  const [state, setState] = useState<PracticeState>("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [secondsLeft, setSecondsLeft] = useState(test.durationMins * 60);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Timer
  useEffect(() => {
    if (state !== "taking") return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setState("results");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  const start = () => {
    setState("taking");
    setStartedAt(Date.now());
    setCurrent(0);
    setAnswers({});
    setSecondsLeft(test.durationMins * 60);
  };

  const startMcqStudy = () => {
    setState("mcq_study");
  };

  const setMcq = (qi: number, opt: string) =>
    setAnswers((a) => ({ ...a, [qi]: { ...a[qi], mcq: opt, flagged: a[qi]?.flagged ?? false } }));

  const setText = (qi: number, text: string) =>
    setAnswers((a) => ({ ...a, [qi]: { ...a[qi], text, flagged: a[qi]?.flagged ?? false } }));

  const toggleFlag = (qi: number) =>
    setAnswers((a) => ({ ...a, [qi]: { ...a[qi], flagged: !a[qi]?.flagged } }));

  // Grading (MCQs only in practice mode)
  const totalMcqMarks = useMemo(
    () => flat.reduce((sum, item) => sum + item.marks, 0),
    [flat]
  );

  const grade = useMemo(() => {
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    let marksEarned = 0;
    const perQuestion: { q: typeof flat[number]; correct: boolean | null; chosen: string | null }[] = [];
    for (const item of flat) {
      const ans = answers[item.globalIndex];
      const chosen = ans?.mcq ?? null;
      if (!chosen) {
        unanswered++;
        perQuestion.push({ q: item, correct: null, chosen: null });
      } else if (chosen === item.q.options?.correct_option) {
        correct++;
        marksEarned += item.marks;
        perQuestion.push({ q: item, correct: true, chosen });
      } else {
        incorrect++;
        perQuestion.push({ q: item, correct: false, chosen });
      }
    }
    const scorePct = totalMcqMarks > 0 ? Math.round((marksEarned / totalMcqMarks) * 100) : 0;
    return { correct, incorrect, unanswered, marksEarned, perQuestion, mcqTotal: flat.length, scorePct };
  }, [flat, answers, totalMcqMarks]);

  const answeredCount = Object.values(answers).filter(
    (a) => a.mcq || (a.text && a.text.trim())
  ).length;
  const progressPct = flat.length > 0 ? Math.round((answeredCount / flat.length) * 100) : 0;

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const lowTime = secondsLeft <= 60 && state === "taking";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
      {/* Practice header */}
      <div className="no-print flex items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" /> Exit
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            {state === "mcq_study" ? (
              <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <Play className="h-4 w-4 text-emerald-600" />
            )}
            <span className="text-sm font-semibold">
              {state === "mcq_study" ? "MCQ Study Mode" : "Practice Mode"}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {test.title}
            </Badge>
          </div>
        </div>
        {state === "taking" && (
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setState("mcq_study")}
              className="hidden sm:flex text-xs text-muted-foreground hover:text-foreground h-8"
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> MCQ Study Mode
            </Button>
            <Badge variant="outline" className="text-xs">
              {answeredCount}/{flat.length} answered
            </Badge>
            <div
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-1.5",
                lowTime
                  ? "animate-pulse border-red-500 bg-red-50 dark:bg-red-950/30"
                  : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
              ].join(" ")}
            >
              <TimerRing
                secondsLeft={secondsLeft}
                total={test.durationMins * 60}
                low={lowTime}
              />
              <span
                className={[
                  "font-mono text-sm font-bold tabular-nums",
                  lowTime
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-700 dark:text-emerald-300",
                ].join(" ")}
              >
                {fmtTime(secondsLeft)}
              </span>
            </div>
          </div>
        )}
        {state === "mcq_study" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={start}
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 text-xs font-semibold h-8"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" /> Switch to Timed Test
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scroll-fancy">
        {state === "intro" && (
          <PracticeIntro
            test={test}
            totalQuestions={flat.length}
            onStartExam={start}
            onStartMcqStudy={startMcqStudy}
          />
        )}

        {state === "mcq_study" && (
          <MCQStudyView
            test={test}
            mcqs={flat.filter((f) => !!f.q.options)}
            onSwitchToExam={start}
            onExit={onClose}
          />
        )}

        {state === "taking" && flat[current] && (
          <PracticeQuestion
            item={flat[current]}
            index={current}
            total={flat.length}
            answer={answers[flat[current].globalIndex]}
            progressPct={progressPct}
            onMcq={(opt) => setMcq(flat[current].globalIndex, opt)}
            onText={(t) => setText(flat[current].globalIndex, t)}
            onFlag={() => toggleFlag(flat[current].globalIndex)}
            onPrev={() => setCurrent((c) => Math.max(0, c - 1))}
            onNext={() => setCurrent((c) => Math.min(flat.length - 1, c + 1))}
            onSubmit={() => setState("results")}
          />
        )}

        {state === "results" && (
          <PracticeResults
            test={test}
            grade={grade}
            flat={flat}
            answers={answers}
            elapsedSec={startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0}
            onRetake={start}
            onExit={onClose}
          />
        )}
      </div>

      {/* Question navigator (taking state) */}
      {state === "taking" && (
        <div className="no-print border-t bg-card px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            {flat.map((item, i) => {
              const ans = answers[item.globalIndex];
              const answered = !!(ans?.mcq || (ans?.text && ans.text.trim()));
              const flagged = ans?.flagged;
              return (
                <button
                  key={item.globalIndex}
                  onClick={() => setCurrent(i)}
                  className={[
                    "relative h-8 w-8 rounded-md border text-xs font-semibold transition-all",
                    i === current
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : answered
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-border hover:border-emerald-400",
                  ].join(" ")}
                  title={`Question ${i + 1}${answered ? " (answered)" : ""}${flagged ? " (flagged)" : ""}`}
                >
                  {i + 1}
                  {flagged && (
                    <Flag className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* Circular timer ring for the practice mode header */

function TimerRing({
  secondsLeft,
  total,
  low,
}: {
  secondsLeft: number;
  total: number;
  low: boolean;
}) {
  const pct = total > 0 ? secondsLeft / total : 0;
  const R = 12;
  const C = 2 * Math.PI * R;
  const dash = C * pct;
  const color = low ? "#ef4444" : "var(--primary)";
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" className="shrink-0">
      <circle
        cx="16"
        cy="16"
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-muted/30"
      />
      <circle
        cx="16"
        cy="16"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`}
        transform="rotate(-90 16 16)"
        style={{ transition: "stroke-dasharray 1s linear, stroke 0.3s ease" }}
      />
    </svg>
  );
}

function PracticeIntro({
  test,
  totalQuestions,
  onStartExam,
  onStartMcqStudy,
}: {
  test: GeneratedTest;
  totalQuestions: number;
  onStartExam: () => void;
  onStartMcqStudy: () => void;
}) {
  const mcqCount = test.sections
    .filter((s) => s.type_name === "MCQ")
    .reduce((sum, s) => sum + s.questions.length, 0);

  const mcqMarks = test.sections
    .filter((s) => s.type_name === "MCQ")
    .reduce((sum, s) => sum + s.sectionMarks, 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-8 sm:py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
        <GraduationCap className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Choose How You Want to Practice
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg">
          Practice online with multiple-choice questions (MCQs). Take a timed test with automatic scoring or study at your own pace with instant explanations.
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        <IntroStat label="Total MCQs" value={`${mcqCount}`} />
        <IntroStat label="Total Marks" value={`${mcqMarks}`} />
        <IntroStat label="Duration" value={formatDuration(test.durationMins)} />
        <IntroStat label="Format" value="Online MCQs" />
      </div>

      {test.instructions && (
        <div className="w-full rounded-xl border bg-muted/30 p-4 text-left">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Instructions
          </div>
          <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed">{test.instructions}</p>
        </div>
      )}

      {/* Two Choice Cards */}
      <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-4 text-left">
        {/* Option 1: Timed Exam */}
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-card p-5 shadow-sm hover:border-emerald-500 transition-all flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Timer className="h-5 w-5" />
              </span>
              <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                Timed MCQs
              </Badge>
            </div>
            <h3 className="text-base font-bold text-foreground">Give Timed MCQ Test</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Full timed practice simulation with live countdown timer ({formatDuration(test.durationMins)}), question flagging, and instant automated scorecard.
            </p>
          </div>
          <Button
            size="lg"
            disabled={mcqCount === 0}
            onClick={onStartExam}
            className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm disabled:opacity-50"
          >
            <Play className="mr-1.5 h-4 w-4 fill-current" /> Start Timed Test
          </Button>
        </div>

        {/* Option 2: MCQ Preparation Mode */}
        <div className="rounded-2xl border-2 border-blue-500/30 bg-card p-5 shadow-sm hover:border-blue-500 transition-all flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Lightbulb className="h-5 w-5" />
              </span>
              <Badge className="bg-blue-600 text-white text-[10px] font-bold">
                Study Mode
              </Badge>
            </div>
            <h3 className="text-base font-bold text-foreground">Prepare MCQs Only</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Study all {mcqCount} MCQs at your own pace without timer pressure. Click options for instant correctness, and toggle answers & explanations.
            </p>
          </div>
          <Button
            size="lg"
            disabled={mcqCount === 0}
            onClick={onStartMcqStudy}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs disabled:opacity-50 shadow-sm"
          >
            {mcqCount > 0 ? (
              <>
                <BookOpen className="mr-1.5 h-4 w-4" /> Prepare MCQs ({mcqCount})
              </>
            ) : (
              "No MCQs in this test"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IntroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

/* ----------------------- MCQ Preparation & Study View ----------------------- */

function MCQStudyView({
  test,
  mcqs,
  onSwitchToExam,
  onExit,
}: {
  test: GeneratedTest;
  mcqs: { q: GeneratedQuestion; section: string; marks: number; globalIndex: number }[];
  onSwitchToExam: () => void;
  onExit: () => void;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  const toggleReveal = (idx: number) => {
    setRevealed((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSelectOption = (idx: number, opt: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [idx]: opt }));
  };

  const clearSelection = (idx: number) => {
    setSelectedAnswers((prev) => {
      const copy = { ...prev };
      delete copy[idx];
      return copy;
    });
  };

  const resetAll = () => {
    setSelectedAnswers({});
    setRevealed({});
    setShowAll(false);
  };

  const toggleShowAll = () => {
    const next = !showAll;
    setShowAll(next);
    if (!next) {
      setRevealed({});
    }
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = mcqs.reduce((acc, m, idx) => {
    const chosen = selectedAnswers[idx];
    return chosen && chosen === m.q.options?.correct_option ? acc + 1 : acc;
  }, 0);
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  if (mcqs.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <BookOpen className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold">No MCQs in This Test</h3>
        <p className="text-xs text-muted-foreground">
          This test only contains subjective questions (Short and Long). You can take the timed test to practice them.
        </p>
        <div className="flex gap-2 mt-2">
          <Button onClick={onSwitchToExam} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" /> Start Timed Test
          </Button>
          <Button variant="outline" onClick={onExit} className="text-xs">
            Exit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Top Banner & Stats */}
      <div className="rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-50/70 via-background to-card p-5 dark:from-blue-950/20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              <Lightbulb className="h-4 w-4" /> MCQ Preparation & Study Mode
            </div>
            <h2 className="text-lg font-bold text-foreground mt-0.5">{test.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Self-paced preparation without timer stress. Click any option to test your recall, or reveal answers and explanations instantly.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleShowAll}
              className="text-xs h-8"
            >
              {showAll ? (
                <>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide All Answers
                </>
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Reveal All Answers
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={resetAll}
              disabled={answeredCount === 0 && Object.keys(revealed).length === 0 && !showAll}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>

        {/* Live Scorebar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4">
          <div className="rounded-xl border bg-background/80 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Total MCQs</div>
            <div className="text-xl font-black text-foreground mt-0.5">{mcqs.length}</div>
          </div>
          <div className="rounded-xl border bg-background/80 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Attempted</div>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
              {answeredCount}/{mcqs.length}
            </div>
          </div>
          <div className="rounded-xl border bg-background/80 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Correct</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {correctCount}
            </div>
          </div>
          <div className="rounded-xl border bg-background/80 p-2.5 text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Accuracy</div>
            <div className="text-xl font-black text-foreground mt-0.5">
              {answeredCount > 0 ? `${accuracy}%` : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* MCQs List */}
      <div className="space-y-4">
        {mcqs.map((item, idx) => {
          const { q, marks } = item;
          const chosen = selectedAnswers[idx];
          const isRevealed = showAll || !!revealed[idx];
          const correctOpt = q.options?.correct_option;
          const isAnswered = !!chosen;
          const isCorrect = isAnswered && chosen === correctOpt;

          return (
            <Card
              key={item.globalIndex}
              className={`transition-all border-2 ${
                isAnswered
                  ? isCorrect
                    ? "border-emerald-500/40 bg-emerald-50/10"
                    : "border-red-500/30 bg-red-50/10"
                  : "border-border/80 hover:border-border"
              }`}
            >
              <CardContent className="p-4 sm:p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-relaxed text-foreground">
                        {q.question_text}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {marks} Mark{marks > 1 ? "s" : ""}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {q.difficulty_name}
                        </Badge>
                        {q.blooms_taxonomy && (
                          <Badge variant="outline" className="text-[10px]">
                            {q.blooms_taxonomy}
                          </Badge>
                        )}
                        {q.source_origin && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {q.source_origin}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Per Question Status Badge */}
                  {isAnswered && (
                    <Badge
                      className={`shrink-0 text-[10px] font-bold ${
                        isCorrect ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                      }`}
                    >
                      {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                    </Badge>
                  )}
                </div>

                {/* Options Grid */}
                {q.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {(["A", "B", "C", "D"] as const).map((opt) => {
                      const text = q.options![`option_${opt.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"];
                      const isOptionChosen = chosen === opt;
                      const isOptionCorrect = opt === correctOpt;

                      let style = "border-border bg-background hover:bg-accent/40 text-foreground";
                      if (isAnswered) {
                        if (isOptionCorrect) {
                          style = "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold dark:bg-emerald-950/50 dark:text-emerald-100 ring-1 ring-emerald-500/30";
                        } else if (isOptionChosen && !isOptionCorrect) {
                          style = "border-red-500 bg-red-50 text-red-950 font-bold dark:bg-red-950/40 dark:text-red-100 ring-1 ring-red-500/30";
                        } else {
                          style = "border-border/60 bg-muted/20 opacity-60 text-muted-foreground";
                        }
                      } else if (isRevealed) {
                        if (isOptionCorrect) {
                          style = "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold dark:bg-emerald-950/50 dark:text-emerald-100 ring-1 ring-emerald-500/30";
                        }
                      }

                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSelectOption(idx, opt)}
                          className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left text-xs transition-all ${style}`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                              (isAnswered || isRevealed) && isOptionCorrect
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : isOptionChosen && !isOptionCorrect
                                ? "border-red-500 bg-red-500 text-white"
                                : "border-border bg-muted/40"
                            }`}
                          >
                            {opt}
                          </span>
                          <span className="flex-1 leading-snug mt-0.5">{text}</span>
                          {(isAnswered || isRevealed) && isOptionCorrect && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                          )}
                          {isOptionChosen && !isOptionCorrect && (
                            <X className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Footer Controls: Reveal Button & Clear */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toggleReveal(idx)}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {isRevealed ? (
                        <>
                          <EyeOff className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                          Hide Answer & Explanation
                        </>
                      ) : (
                        <>
                          <Eye className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                          Show Answer & Explanation
                        </>
                      )}
                    </Button>
                    {isAnswered && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => clearSelection(idx)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className="mr-1.5 h-3 w-3" /> Try Again
                      </Button>
                    )}
                  </div>

                  {isAnswered && (
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Your choice: <strong className="text-foreground">Option {chosen}</strong>
                      {isCorrect ? " (Correct)" : ` (Correct was Option ${correctOpt})`}
                    </span>
                  )}
                </div>

                {/* Revealed Answer & Explanation Block */}
                {isRevealed && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/70 p-3.5 text-xs text-foreground dark:bg-emerald-950/30 space-y-1.5 animate-fade-in">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                      <KeyRound className="h-3.5 w-3.5" />
                      Correct Answer: Option {correctOpt}
                      {q.options && (
                        <span className="font-medium text-foreground">
                          — {q.options[`option_${correctOpt.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"]}
                        </span>
                      )}
                    </div>
                    {q.explanation && (
                      <div className="text-muted-foreground leading-relaxed pt-1">
                        <strong className="text-foreground">Explanation: </strong>
                        {q.explanation}
                      </div>
                    )}
                    {q.model_answer && !q.explanation && (
                      <div className="text-muted-foreground leading-relaxed pt-1">
                        <strong className="text-foreground">Solution: </strong>
                        {q.model_answer}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom Floating Bar */}
      <div className="sticky bottom-4 rounded-2xl border bg-card/95 backdrop-blur-md p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground text-center sm:text-left">
          Done reviewing? You can now test your knowledge under timed exam conditions.
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onSwitchToExam}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
          >
            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" /> Start Timed Exam
          </Button>
          <Button variant="outline" onClick={onExit} className="text-xs">
            Exit
          </Button>
        </div>
      </div>
    </div>
  );
}

function PracticeQuestion({
  item,
  index,
  total,
  answer,
  progressPct,
  onMcq,
  onText,
  onFlag,
  onPrev,
  onNext,
  onSubmit,
}: {
  item: { q: GeneratedQuestion; section: string; marks: number; globalIndex: number };
  index: number;
  total: number;
  answer: Answer | undefined;
  progressPct: number;
  onMcq: (opt: string) => void;
  onText: (t: string) => void;
  onFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const { q, section, marks } = item;
  const isMCQ = !!q.options;
  const isLast = index === total - 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {index + 1} of {total} · {section}
          </span>
          <span>{progressPct}% answered</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          {/* Question header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {index + 1}
              </span>
              <div>
                <p className="text-base font-medium leading-relaxed">{q.question_text}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {marks} mark{marks > 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {q.difficulty_name}
                  </Badge>
                  {q.blooms_taxonomy && (
                    <Badge variant="outline" className="text-[10px]">
                      {q.blooms_taxonomy}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onFlag}
              className={answer?.flagged ? "text-amber-600" : ""}
            >
              <Flag className={`h-4 w-4 ${answer?.flagged ? "fill-amber-500" : ""}`} />
              {answer?.flagged ? "Flagged" : "Flag"}
            </Button>
          </div>

          {/* MCQ options */}
          {isMCQ && q.options && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["A", "B", "C", "D"] as const).map((l) => {
                const text = q.options![`option_${l.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"];
                const selected = answer?.mcq === l;
                return (
                  <button
                    key={l}
                    onClick={() => onMcq(l)}
                    className={[
                      "flex items-start gap-2.5 rounded-lg border p-3 text-left text-sm transition-all",
                      selected
                        ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600 dark:bg-emerald-950/40"
                        : "border-border hover:border-emerald-400 hover:bg-accent",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors",
                        selected
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-border",
                      ].join(" ")}
                    >
                      {l}
                    </span>
                    <span className="flex-1">{text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Written answer */}
          {!isMCQ && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your answer
              </Label>
              <Textarea
                value={answer?.text ?? ""}
                onChange={(e) => onText(e.target.value)}
                rows={q.type_name === "Long" ? 8 : 4}
                placeholder="Type your answer here…"
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Written answers are self-assessed — you&apos;ll compare with the model answer after submitting.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" onClick={onPrev} disabled={index === 0}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        {isLast ? (
          <Button
            onClick={onSubmit}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Flag className="mr-1 h-4 w-4" /> Submit test
          </Button>
        ) : (
          <Button onClick={onNext} className="bg-emerald-600 hover:bg-emerald-700">
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function PracticeResults({
  test,
  grade,
  flat,
  answers,
  elapsedSec,
  onRetake,
  onExit,
}: {
  test: GeneratedTest;
  grade: {
    correct: number;
    incorrect: number;
    unanswered: number;
    marksEarned: number;
    perQuestion: { q: typeof flat[number]; correct: boolean | null; chosen: string | null }[];
    mcqTotal: number;
    scorePct: number;
  };
  flat: { q: GeneratedQuestion; section: string; marks: number; globalIndex: number }[];
  answers: Record<number, Answer>;
  elapsedSec: number;
  onRetake: () => void;
  onExit: () => void;
}) {
  const totalMcqMarks = flat.reduce((s, f) => s + f.marks, 0);
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const gradeColor =
    grade.scorePct >= 80
      ? "emerald"
      : grade.scorePct >= 50
      ? "amber"
      : "rose";

  const gradeLabel =
    grade.scorePct >= 80
      ? "Excellent"
      : grade.scorePct >= 50
      ? "Good effort"
      : "Needs improvement";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Score hero */}
      <Card className="animate-fade-in-scale mb-4 overflow-hidden border-none bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg">
        <CardContent className="relative p-6 text-center sm:p-8">
          <div className="absolute inset-0 bg-grid opacity-15" />
          <div className="relative z-10">
            <Award className="mx-auto h-10 w-10" />
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-white/80">
              Practice complete
            </div>
            <div className="mt-1 text-5xl font-bold tabular-nums">{grade.scorePct}%</div>
            <div className="mt-1 text-sm text-white/85">{gradeLabel}</div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-white/90">
              <span>
                Score: <strong>{grade.marksEarned}/{totalMcqMarks}</strong> marks
              </span>
              <span>
                Time: <strong>{fmtTime(elapsedSec)}</strong>
              </span>
              <span>
                Correct: <strong>{grade.correct}/{grade.mcqTotal}</strong> MCQ
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <ResultStat
          label="Correct"
          value={grade.correct}
          icon={CheckCircle2}
          color="emerald"
        />
        <ResultStat
          label="Incorrect"
          value={grade.incorrect}
          icon={X}
          color="rose"
        />
        <ResultStat
          label="Unanswered"
          value={grade.unanswered}
          icon={Timer}
          color="amber"
        />
      </div>

      {/* Question review */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-emerald-600" /> Review answers
          </CardTitle>
          <CardDescription>
            MCQs are auto-graded. Written answers show the model answer for self-assessment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {grade.perQuestion.map((pq, i) => {
              const { q } = pq.q;
              const ans = answers[pq.q.globalIndex];
              return (
                <li key={pq.q.globalIndex} className="rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                        pq.correct === true
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : pq.correct === false
                          ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {pq.correct === true ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : pq.correct === false ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-relaxed">{q.question_text}</p>

                      {/* MCQ review */}
                      {q.options && (
                        <div className="mt-2 space-y-1">
                          {(["A", "B", "C", "D"] as const).map((l) => {
                            const text = q.options![`option_${l.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"];
                            const isCorrect = l === q.options!.correct_option;
                            const isChosen = ans?.mcq === l;
                            return (
                              <div
                                key={l}
                                className={[
                                  "flex items-center gap-2 rounded-md border px-2 py-1 text-xs",
                                  isCorrect
                                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                                    : isChosen
                                    ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                                    : "border-border",
                                ].join(" ")}
                              >
                                <span className="font-bold">{l}.</span>
                                <span className="flex-1">{text}</span>
                                {isCorrect && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                )}
                                {isChosen && !isCorrect && (
                                  <X className="h-3.5 w-3.5 text-red-500" />
                                )}
                                {isChosen && (
                                  <Badge variant="outline" className="text-[9px]">your answer</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Written review */}
                      {!q.options && (
                        <div className="mt-2 space-y-2">
                          <div className="rounded-md border border-muted bg-muted/40 p-2 text-xs">
                            <div className="mb-0.5 font-semibold text-foreground">
                              Your answer:
                            </div>
                            <p className="whitespace-pre-line text-muted-foreground">
                              {ans?.text?.trim() || "(not answered)"}
                            </p>
                          </div>
                          {q.model_answer && (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-2 text-xs dark:bg-emerald-950/30">
                              <div className="mb-0.5 flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                                <KeyRound className="h-3 w-3" /> Model answer:
                              </div>
                              <p className="whitespace-pre-line">{q.model_answer}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetake} className="bg-emerald-600 hover:bg-emerald-700">
          <RefreshCw className="mr-1 h-4 w-4" /> Retake test
        </Button>
        <Button variant="outline" onClick={onExit}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to editor
        </Button>
      </div>
    </div>
  );
}

function ResultStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof CheckCircle2;
  color: "emerald" | "rose" | "amber";
}) {
  const colors = {
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    rose: "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    amber: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  };
  return (
    <div className={["rounded-lg border p-3 text-center", colors[color]].join(" ")}>
      <Icon className="mx-auto h-5 w-5" />
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

/* --------------------------- Dedupe dialog ------------------------------ */

function DedupeDialog({
  test,
  onClose,
  onRemove,
}: {
  test: GeneratedTest;
  onClose: () => void;
  onRemove: (sectionIndex: number, qIndex: number) => void;
}) {
  const allQuestions = useMemo(
    () => test.sections.flatMap((s) => s.questions),
    [test]
  );
  const [pairs, setPairs] = useState<SimilarityPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    checkSimilarity(allQuestions)
      .then((p) => {
        if (!alive) return;
        setPairs(p);
        setChecked(true);
      })
      .catch((e) => {
        if (!alive) return;
        toast.error(e instanceof Error ? e.message : "Check failed");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [allQuestions]);

  const findQLocation = (qid: string) => {
    for (let si = 0; si < test.sections.length; si++) {
      const qi = test.sections[si].questions.findIndex((q) => q.id === qid);
      if (qi !== -1) return { sectionIndex: si, qIndex: qi };
    }
    return null;
  };

  const handleRemove = (qid: string) => {
    const loc = findQLocation(qid);
    if (loc) {
      onRemove(loc.sectionIndex, loc.qIndex);
      // Remove pairs that reference this question
      setPairs((prev) =>
        prev.filter((p) => p.a !== qid && p.b !== qid)
      );
    }
  };

  const simColor: Record<string, string> = {
    high: "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    medium: "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    low: "border-teal-400 bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300",
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyCheck className="h-4 w-4 text-emerald-600" /> Duplicate detection
          </DialogTitle>
          <DialogDescription>
            AI scans all {allQuestions.length} questions for near-duplicates or overly
            similar pairs that test the same concept.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto scroll-fancy">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-emerald-400/40 border-t-emerald-600" />
              <p className="text-sm text-muted-foreground">
                AI is analyzing {allQuestions.length} questions for similarity…
              </p>
            </div>
          ) : checked && pairs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">No duplicates found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  All {allQuestions.length} questions are sufficiently distinct.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="text-amber-800 dark:text-amber-200">
                  Found <strong>{pairs.length}</strong> similar pair
                  {pairs.length === 1 ? "" : "s"}. Review and remove duplicates.
                </span>
              </div>

              {pairs.map((p, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-card p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase ${simColor[p.similarity]}`}
                    >
                      {p.similarity} similarity
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      Pair #{i + 1}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        A
                      </span>
                      <p className="flex-1 text-xs leading-relaxed">{p.aText}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 shrink-0 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemove(p.a)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Remove
                      </Button>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        B
                      </span>
                      <p className="flex-1 text-xs leading-relaxed">{p.bText}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 shrink-0 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemove(p.b)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 rounded-md bg-muted/40 px-2 py-1 text-[11px] italic text-muted-foreground">
                    {p.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Share dialog ------------------------------- */

/**
 * Encode a test as a URL-safe base64 string for sharing via link.
 * The test JSON is compressed with a simple URI-encode + base64.
 */
export function encodeTestForShare(test: GeneratedTest): string {
  try {
    const json = JSON.stringify(test);
    // Use encodeURIComponent for unicode safety, then btoa for base64
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return "";
  }
}

export function decodeTestFromShare(encoded: string): GeneratedTest | null {
  try {
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    // pad
    while (b64.length % 4) b64 += "=";
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as GeneratedTest;
  } catch {
    return null;
  }
}

function ShareDialog({
  test,
  onClose,
}: {
  test: GeneratedTest;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const encoded = useMemo(() => encodeTestForShare(test), [test]);
  const shareUrl = useMemo(
    () => `${window.location.origin}${window.location.pathname}#share=${encoded}`,
    [encoded]
  );
  const shareCode = encoded.slice(0, 8).toUpperCase();

  const copy = (text: string, type: "link" | "code") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      toast.success(type === "link" ? "Link copied to clipboard" : "Code copied");
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // Size estimate
  const sizeKb = Math.round((encoded.length / 1024) * 10) / 10;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-emerald-600" /> Share this test
          </DialogTitle>
          <DialogDescription>
            Send this link or code to a colleague. They can open, edit, print or practice
            the test in their browser — no account needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Share link */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Link2 className="h-3.5 w-3.5" /> Share link
            </Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button
                size="sm"
                variant={copied === "link" ? "default" : "outline"}
                onClick={() => copy(shareUrl, "link")}
                className="shrink-0"
              >
                {copied === "link" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Share code */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Short code</Label>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-1 rounded-lg border bg-muted/30 px-3 py-2">
                <span className="font-mono text-lg font-bold tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                  {shareCode}
                </span>
              </div>
              <Button
                size="sm"
                variant={copied === "code" ? "default" : "outline"}
                onClick={() => copy(shareCode, "code")}
                className="shrink-0"
              >
                {copied === "code" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The short code is a quick identifier — the full link contains the complete test.
            </p>
          </div>

          {/* Test summary */}
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center text-xs">
            <div>
              <div className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {test.totalQuestions}
              </div>
              <div className="text-muted-foreground">Questions</div>
            </div>
            <div>
              <div className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {test.totalMarks}
              </div>
              <div className="text-muted-foreground">Marks</div>
            </div>
            <div>
              <div className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {test.durationMins}m
              </div>
              <div className="text-muted-foreground">Duration</div>
            </div>
          </div>

          {/* Size note */}
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
            <QrCode className="h-3.5 w-3.5 shrink-0" />
            <span>
              The test ({sizeKb} KB) is embedded directly in the link — no server storage
              needed. Links expire if the test is edited after sharing.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Import dialog ------------------------------ */

function ImportQuestionsDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (questions: GeneratedQuestion[]) => void;
}) {
  const [parsed, setParsed] = useState<GeneratedQuestion[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);

  const parseCSV = (text: string): GeneratedQuestion[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuote = !inQuote;
          }
        } else if (ch === "," && !inQuote) {
          result.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      result.push(cur);
      return result;
    };
    const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
    const questions: GeneratedQuestion[] = [];
    const errs: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, j) => {
        row[h] = (vals[j] ?? "").trim();
      });
      const type = (row.type || row.question_type || "MCQ").trim() as QuestionTypeName;
      const validTypes = ["MCQ", "Short", "Long"];
      if (!validTypes.includes(type)) {
        errs.push(`Row ${i + 1}: invalid type "${type}" (use MCQ/Short/Long)`);
        continue;
      }
      const qText = row.question_text || row.question || "";
      if (!qText) {
        errs.push(`Row ${i + 1}: missing question_text`);
        continue;
      }
      const difficulty = (row.difficulty || "Easy").trim() as DifficultyName;
      const marks = parseInt(row.marks || "1", 10) || 1;
      const hasOptions = type === "MCQ" && row.option_a && row.option_b && row.option_c && row.option_d;
      questions.push({
        id: `import-${Date.now()}-${i}`,
        source: "ai",
        question_text: qText,
        type_name: type,
        difficulty_name: difficulty,
        marks,
        blooms_taxonomy: row.blooms_taxonomy || row.bloom || null,
        tags: row.tags || null,
        topic_name: row.topic_name || null,
        chapter_name: row.chapter_name || null,
        options: hasOptions
          ? {
              option_a: row.option_a,
              option_b: row.option_b,
              option_c: row.option_c,
              option_d: row.option_d,
              correct_option: (row.correct_option || "A").toUpperCase() as "A" | "B" | "C" | "D",
            }
          : null,
        model_answer: type !== "MCQ" ? (row.model_answer || row.answer || null) : null,
      });
    }
    setErrors(errs);
    return questions;
  };

  const parseJSON = (text: string): GeneratedQuestion[] => {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : data.questions ?? [];
    const questions: GeneratedQuestion[] = [];
    const errs: string[] = [];
    arr.forEach((item: Record<string, unknown>, i: number) => {
      const type = String(item.type || item.type_name || "MCQ") as QuestionTypeName;
      const qText = String(item.question_text || item.question || "");
      if (!qText) {
        errs.push(`Item ${i + 1}: missing question_text`);
        return;
      }
      const difficulty = String(item.difficulty || item.difficulty_name || "Easy") as DifficultyName;
      const marks = Number(item.marks) || 1;
      const opts = item.options as
        | { option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string }
        | undefined;
      questions.push({
        id: `import-${Date.now()}-${i}`,
        source: "ai",
        question_text: qText,
        type_name: type,
        difficulty_name: difficulty,
        marks,
        blooms_taxonomy: (item.blooms_taxonomy as string) || null,
        tags: (item.tags as string) || null,
        topic_name: (item.topic_name as string) || null,
        chapter_name: (item.chapter_name as string) || null,
        options: opts
          ? {
              option_a: opts.option_a,
              option_b: opts.option_b,
              option_c: opts.option_c,
              option_d: opts.option_d,
              correct_option: opts.correct_option.toUpperCase() as "A" | "B" | "C" | "D",
            }
          : null,
        model_answer: (item.model_answer as string) || null,
      });
    });
    setErrors(errs);
    return questions;
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      try {
        if (file.name.endsWith(".json")) {
          setParsed(parseJSON(text));
        } else {
          setParsed(parseCSV(text));
        }
      } catch {
        setErrors(["Failed to parse file. Please check the format."]);
        setParsed([]);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = (format: "csv" | "json") => {
    const csv = `type,difficulty,question_text,marks,option_a,option_b,option_c,option_d,correct_option,model_answer,blooms_taxonomy,tags
MCQ,Easy,What is 2+2?,1,3,4,5,6,B,,Remember,Math
Short,Medium,Explain photosynthesis.,3,,,,,,,Photosynthesis is the process by which plants convert light energy into chemical energy.,Understand,Biology`;
    const json = JSON.stringify(
      [
        {
          type: "MCQ",
          difficulty: "Easy",
          question_text: "What is 2+2?",
          marks: 1,
          options: { option_a: "3", option_b: "4", option_c: "5", option_d: "6", correct_option: "B" },
          blooms_taxonomy: "Remember",
          tags: "Math",
        },
        {
          type: "Short",
          difficulty: "Medium",
          question_text: "Explain photosynthesis.",
          marks: 3,
          model_answer: "Photosynthesis is the process by which plants convert light energy into chemical energy.",
          blooms_taxonomy: "Understand",
          tags: "Biology",
        },
      ],
      null,
      2
    );
    const content = format === "csv" ? csv : json;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `examforge-template.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-emerald-600" /> Import questions
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or JSON file to bulk-add questions to this test. MCQs need 4 options + correct_option.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto scroll-fancy">
          {parsed.length === 0 ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={[
                  "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 transition-colors",
                  dragging
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-muted-foreground/30 hover:border-emerald-400",
                ].join(" ")}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Drop a CSV or JSON file here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                    <Upload className="h-4 w-4" /> Choose file
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Need a template?</span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => downloadTemplate("csv")}>
                  <FileType className="mr-1 h-3 w-3" /> CSV
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => downloadTemplate("json")}>
                  <FileType className="mr-1 h-3 w-3" /> JSON
                </Button>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="mb-1 font-semibold">Required columns (CSV):</div>
                <code className="text-[10px] text-muted-foreground">
                  type, difficulty, question_text, marks, option_a, option_b, option_c, option_d, correct_option, model_answer, blooms_taxonomy, tags
                </code>
                <div className="mt-2 mb-1 font-semibold">JSON format:</div>
                <code className="text-[10px] text-muted-foreground">
                  {"[{ type, difficulty, question_text, marks, options: {option_a..d, correct_option}, model_answer, ... }]"}
                </code>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span>
                  <strong className="text-emerald-700 dark:text-emerald-300">{parsed.length}</strong> question
                  {parsed.length === 1 ? "" : "s"} parsed from <strong>{fileName}</strong>
                </span>
                <Button size="sm" variant="ghost" onClick={() => { setParsed([]); setFileName(""); }}>
                  Clear
                </Button>
              </div>

              {errors.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                  <div className="font-medium">{errors.length} warning(s):</div>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
                  </ul>
                </div>
              )}

              <div className="max-h-64 space-y-2 overflow-y-auto scroll-fancy">
                {parsed.map((q, i) => (
                  <div key={i} className="rounded-lg border bg-card p-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{q.type_name}</Badge>
                      <Badge variant="outline" className="text-[10px]">{q.difficulty_name}</Badge>
                      <Badge variant="outline" className="text-[10px]">{q.marks}m</Badge>
                    </div>
                    <p className="mt-1 font-medium leading-relaxed">{q.question_text}</p>
                    {q.options && (
                      <p className="mt-0.5 text-muted-foreground">
                        A: {q.options.option_a} | B: {q.options.option_b} | C: {q.options.option_c} | D: {q.options.option_d} | &quot; {q.options.correct_option}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {parsed.length > 0 && (
            <Button
              onClick={() => onImport(parsed)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-1 h-4 w-4" /> Import {parsed.length} question{parsed.length === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Print customization ------------------------ */

type PrintOpts = {
  showAnswers: boolean;
  printAnswerKey: boolean;
  printStudentInfo: boolean;
  watermarkText?: string;
  academyName?: string;
  academyLocation?: string;
  logoDataUrl?: string | null;
  studentName?: string;
  rollNumber?: string;
  classNameInput?: string;
  paperCode?: string;
  subjectNameInput?: string;
  timeAllowed?: string;
  totalMarksInput?: string;
  examDate?: string;
  examSyllabus?: string;
  examLabel?: string;
  showExamLabel?: boolean;
  fontSize?: number;
  headerSize?: number;
  mcqBorder?: boolean;
  shortBorder?: boolean;
  longBorder?: boolean;
  showBubbleSheet?: boolean;
};

function PrintCustomization(props: {
  printAnswerKey: boolean;
  setPrintAnswerKey: (v: boolean) => void;
  printStudentInfo: boolean;
  setPrintStudentInfo: (v: boolean) => void;
  showBubbleSheet: boolean;
  setShowBubbleSheet: (v: boolean) => void;
  academyName: string;
  setAcademyName: (v: string) => void;
  academyLocation: string;
  setAcademyLocation: (v: string) => void;
  logoDataUrl: string | null;
  setLogoDataUrl: (v: string | null) => void;
  studentName: string;
  setStudentName: (v: string) => void;
  rollNumber: string;
  setRollNumber: (v: string) => void;
  classNameInput: string;
  setClassNameInput: (v: string) => void;
  paperCode: string;
  setPaperCode: (v: string) => void;
  subjectNameInput: string;
  setSubjectNameInput: (v: string) => void;
  timeAllowed: string;
  setTimeAllowed: (v: string) => void;
  totalMarksInput: string;
  setTotalMarksInput: (v: string) => void;
  examDate: string;
  setExamDate: (v: string) => void;
  examSyllabus: string;
  setExamSyllabus: (v: string) => void;
  examLabel: string;
  setExamLabel: (v: string) => void;
  showExamLabel: boolean;
  setShowExamLabel: (v: boolean) => void;
  fontSize: number;
  setFontSize: (v: number) => void;
  headerSize: number;
  setHeaderSize: (v: number) => void;
  watermarkText: string;
  setWatermarkText: (v: string) => void;
  mcqBorder: boolean;
  setMcqBorder: (v: boolean) => void;
  shortBorder: boolean;
  setShortBorder: (v: boolean) => void;
  longBorder: boolean;
  setLongBorder: (v: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      props.setLogoDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const inputCls = "h-7 rounded-md border bg-background px-2 text-xs w-full";
  const labelCls = "text-[10px] font-medium text-muted-foreground whitespace-nowrap";

  return (
    <div className="rounded-lg border bg-muted/30 text-xs">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-4 px-3 py-2.5">
        <span className="font-medium text-muted-foreground">Print options:</span>
        <label className="flex cursor-pointer items-center gap-1.5">
          <Switch checked={props.printAnswerKey} onCheckedChange={props.setPrintAnswerKey} />
          Answer key (MCQ only)
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <Switch checked={props.showBubbleSheet} onCheckedChange={props.setShowBubbleSheet} />
          Bubble sheet
        </label>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 text-[10px]"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide" : "Customize"} paper
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t px-3 py-3">
          {/* Academy header */}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Academy / School header
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div>
                <Label className={labelCls}>Academy name</Label>
                <input
                  type="text"
                  value={props.academyName}
                  onChange={(e) => props.setAcademyName(e.target.value)}
                  placeholder="e.g. Greenwood High School"
                  className={inputCls}
                />
              </div>
              <div>
                <Label className={labelCls}>Academy location</Label>
                <input
                  type="text"
                  value={props.academyLocation}
                  onChange={(e) => props.setAcademyLocation(e.target.value)}
                  placeholder="e.g. Lahore, Pakistan"
                  className={inputCls}
                />
              </div>
              <div>
                <Label className={labelCls}>Logo (image)</Label>
                <div className="flex items-center gap-1.5">
                  <label className="flex h-7 cursor-pointer items-center justify-center rounded-md border bg-background px-2 text-[10px] hover:bg-accent">
                    <ImageIcon className="mr-1 h-3 w-3" />
                    {props.logoDataUrl ? "Change" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {props.logoDataUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px] text-destructive"
                      onClick={() => props.setLogoDataUrl(null)}
                    >
                      Remove
                    </Button>
                  )}
                  {props.logoDataUrl && (
                    <img
                      src={props.logoDataUrl}
                      alt="logo"
                      className="h-7 w-7 rounded object-contain"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Student info grid */}
          {props.printStudentInfo && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Student info grid
              </div>
              <div className="space-y-2">
                {/* Top row */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <Label className={labelCls}>Student Name</Label>
                    <input type="text" value={props.studentName} onChange={(e) => props.setStudentName(e.target.value)} placeholder="____" className={inputCls} />
                  </div>
                  <div>
                    <Label className={labelCls}>Roll Number</Label>
                    <input type="text" value={props.rollNumber} onChange={(e) => props.setRollNumber(e.target.value)} placeholder="____" className={inputCls} />
                  </div>
                  <div>
                    <Label className={labelCls}>Class</Label>
                    <input type="text" value={props.classNameInput} onChange={(e) => props.setClassNameInput(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <Label className={labelCls}>Paper Code</Label>
                    <input type="text" value={props.paperCode} onChange={(e) => props.setPaperCode(e.target.value)} placeholder="____" className={inputCls} />
                  </div>
                </div>
                {/* Middle row */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <Label className={labelCls}>Subject</Label>
                    <input type="text" value={props.subjectNameInput} onChange={(e) => props.setSubjectNameInput(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <Label className={labelCls}>Time Allowed</Label>
                    <input type="text" value={props.timeAllowed} onChange={(e) => props.setTimeAllowed(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <Label className={labelCls}>Total Marks</Label>
                    <input type="text" value={props.totalMarksInput} onChange={(e) => props.setTotalMarksInput(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <Label className={labelCls}>Exam Date</Label>
                    <input type="text" value={props.examDate} onChange={(e) => props.setExamDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
                {/* Bottom row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className={labelCls}>Exam Syllabus</Label>
                    <input type="text" value={props.examSyllabus} onChange={(e) => props.setExamSyllabus(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className={labelCls}>Exam label</Label>
                      <input
                        type="text"
                        value={props.examLabel}
                        onChange={(e) => props.setExamLabel(e.target.value)}
                        placeholder="e.g. Mid Term"
                        disabled={!props.showExamLabel}
                        className={`${inputCls} ${!props.showExamLabel ? "opacity-40" : ""}`}
                      />
                    </div>
                    <label className="flex items-center gap-1 pb-1.5">
                      <input
                        type="checkbox"
                        checked={props.showExamLabel}
                        onChange={(e) => props.setShowExamLabel(e.target.checked)}
                        className="h-3 w-3"
                      />
                      <span className="text-[10px]">Show</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Styling + borders */}
          <div className="grid grid-cols-2 gap-3 border-t pt-2 sm:grid-cols-4">
            <div>
              <Label className={labelCls}>Font size: {props.fontSize}pt</Label>
              <input
                type="range"
                min={8}
                max={16}
                value={props.fontSize}
                onChange={(e) => props.setFontSize(parseInt(e.target.value))}
                className="h-7 w-full"
              />
            </div>
            <div>
              <Label className={labelCls}>Header size: {props.headerSize}pt</Label>
              <input
                type="range"
                min={12}
                max={28}
                value={props.headerSize}
                onChange={(e) => props.setHeaderSize(parseInt(e.target.value))}
                className="h-7 w-full"
              />
            </div>
            <div>
              <Label className={labelCls}>Watermark</Label>
              <input
                type="text"
                value={props.watermarkText}
                onChange={(e) => props.setWatermarkText(e.target.value)}
                placeholder="e.g. SAMPLE"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className={labelCls}>Borders</Label>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={props.mcqBorder} onChange={(e) => props.setMcqBorder(e.target.checked)} className="h-3 w-3" />
                  <span className="text-[10px]">MCQ</span>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={props.shortBorder} onChange={(e) => props.setShortBorder(e.target.checked)} className="h-3 w-3" />
                  <span className="text-[10px]">Short</span>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={props.longBorder} onChange={(e) => props.setLongBorder(e.target.checked)} className="h-3 w-3" />
                  <span className="text-[10px]">Long</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderPlainText(test: GeneratedTest, withAnswers: boolean): string {
  const lines: string[] = [];
  lines.push(`${test.className} - ${test.subjectName}`);
  lines.push(test.title.toUpperCase());
  lines.push(`Time: ${test.durationMins} minutes  |  Total Marks: ${test.totalMarks}  |  Questions: ${test.totalQuestions}`);
  lines.push("=".repeat(60));
  if (test.instructions) {
    lines.push("GENERAL INSTRUCTIONS:");
    lines.push(test.instructions);
    lines.push("-".repeat(60));
  }
  let n = 1;
  test.sections.forEach((sec, si) => {
    lines.push("");
    lines.push(`Section ${String.fromCharCode(65 + si)} - ${sec.type_name}  (${sec.questions.length} Q, ${sec.sectionMarks} marks, ${sec.marksPerQuestion} each)`);
    lines.push("");
    sec.questions.forEach((q) => {
      lines.push(`Q${n}. ${q.question_text} [${q.marks}]`);
      if (q.options) {
        const o = q.options;
        lines.push(`   A. ${o.option_a}`);
        lines.push(`   B. ${o.option_b}`);
        lines.push(`   C. ${o.option_c}`);
        lines.push(`   D. ${o.option_d}`);
        if (withAnswers) lines.push(`   >> Correct: ${o.correct_option}`);
      } else if (withAnswers && q.model_answer) {
        lines.push(`   >> Answer: ${q.model_answer}`);
      }
      n++;
    });
  });
  lines.push("");
  lines.push("End of paper");
  return lines.join("\n");
}

/* --------------------------- Print HTML (PDF) --------------------------- */

function renderPrintHTML(test: GeneratedTest, opts: PrintOpts): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const fs = opts.fontSize ?? 12;
  const hs = opts.headerSize ?? 18;
  const mcqBorder = opts.mcqBorder ?? false;
  const shortBorder = opts.shortBorder ?? false;
  const longBorder = opts.longBorder ?? false;

  // Helper: fieldset-style bordered input container
  const field = (label: string, value: string) =>
    `<fieldset class="fld"><legend>${escape(label)}</legend><span class="fld-val">${escape(value || "\u00A0")}</span></fieldset>`;

  // ----- Academy header (centered across full row) -----
  const academyHtml = (opts.academyName || opts.academyLocation || opts.logoDataUrl)
    ? `<div class="academy">
         ${opts.logoDataUrl ? `<img src="${opts.logoDataUrl}" class="academy-logo" alt="logo" />` : ""}
         <div class="academy-text">
           ${opts.academyName ? `<div class="academy-name" style="font-size:${hs}pt;">${escape(opts.academyName)}</div>` : ""}
           ${opts.academyLocation ? `<div class="academy-loc">${escape(opts.academyLocation)}</div>` : ""}
         </div>
       </div>`
    : "";

  // ----- Student info as fieldset/legend grid -----
  const studentInfoHtml = opts.printStudentInfo
    ? `<div class="info-grid">
         ${field("Student Name", opts.studentName ?? "")}
         ${field("Roll Number", opts.rollNumber ?? "")}
         ${field("Class", opts.classNameInput ?? test.className)}
         ${field("Paper Code", opts.paperCode ?? "")}
         ${field("Subject", opts.subjectNameInput ?? test.subjectName)}
         ${field("Time Allowed", opts.timeAllowed ?? `${test.durationMins} min`)}
         ${field("Total Marks", opts.totalMarksInput ?? `${test.totalMarks}`)}
         ${field("Exam Date", opts.examDate ?? "")}
         ${field("Exam Syllabus", opts.examSyllabus ?? "")}
         ${opts.showExamLabel ? field("Exam", opts.examLabel ?? "") : ""}
       </div>`
    : "";

  // ----- Bubble sheet (BEFORE sections) -----
  const mcqSections = test.sections.filter((s) => s.type_name === "MCQ");
  const bubbleSheetHtml = opts.showBubbleSheet && mcqSections.length > 0
    ? (() => {
        let qn = 0;
        const parts = mcqSections.map((sec) => {
          const rows = sec.questions.map(() => {
            qn++;
            const bubbles = ["A","B","C","D"].map((l) =>
              `<span class="bub">${l}</span>`
            ).join("");
            return `<tr><td class="bs-n">${qn}</td><td class="bs-b">${bubbles}</td></tr>`;
          }).join("");
          return `<table class="bs-tbl">${rows}</table>`;
        }).join("");
        return `<section class="bubble-sec"><h2>Bubble Sheet</h2>${parts}</section>`;
      })()
    : "";

  // ----- Sections with 2-per-row MCQ options -----
  const sectionsHtml = test.sections.map((sec, si) => {
    const useBorder = sec.type_name === "MCQ" ? mcqBorder : sec.type_name === "Short" ? shortBorder : longBorder;
    const body = sec.questions.map((q, qi) => {
      const qn = qi + 1;
      const marksTag = `<span class="mk">[${q.marks}]</span>`;
      if (q.options) {
        // 2 options per row if short, 1 if long
        const optItems = ["A","B","C","D"].map((l) => {
          const text = escape(q.options![`option_${l.toLowerCase()}` as "option_a"|"option_b"|"option_c"|"option_d"]);
          return `<span class="oi"><b>${l}.</b> ${text}</span>`;
        });
        // Check if any option is long (>40 chars)
        const anyLong = ["A","B","C","D"].some((l) =>
          (q.options![`option_${l.toLowerCase()}` as "option_a"|"option_b"|"option_c"|"option_d"] || "").length > 40
        );
        const optsGrid = anyLong
          ? `<div class="opts-1col">${optItems.map((o) => `<div>${o}</div>`).join("")}</div>`
          : `<div class="opts-2col">${optItems.map((o) => `<div>${o}</div>`).join("")}</div>`;
        if (useBorder) {
          return `<tr><td class="qn">${qn}</td><td>${escape(q.question_text)} ${marksTag}${optsGrid}</td></tr>`;
        }
        return `<li class="qi">${escape(q.question_text)} ${marksTag}${optsGrid}</li>`;
      }
      // Short/Long — no answer lines
      if (useBorder) {
        return `<tr><td class="qn">${qn}</td><td>${escape(q.question_text)} ${marksTag}</td></tr>`;
      }
      return `<li class="qi">${escape(q.question_text)} ${marksTag}</li>`;
    }).join("");
    const hdr = `<h2>Section ${String.fromCharCode(65+si)} — ${sec.type_name}</h2><p class="meta">${sec.questions.length} questions · ${sec.sectionMarks} marks · ${sec.marksPerQuestion} each</p>`;
    const content = useBorder ? `<table class="qt">${body}</table>` : `<ol>${body}</ol>`;
    return `<section>${hdr}${content}</section>`;
  }).join("");

  // ----- Answer Key (MCQ only) -----
  const answerKeyHtml = opts.printAnswerKey && mcqSections.length > 0
    ? (() => {
        let n = 0;
        const akParts = mcqSections.map((sec, si) => {
          const items = sec.questions.map((q) => {
            n++;
            return q.options ? `<span class="aki"><b>${n}.</b> <b class="akc">${q.options.correct_option}</b></span>` : "";
          }).join("\u00A0\u00A0");
          return `<div class="ak-sec"><h3>Section ${String.fromCharCode(65+si)}</h3><div class="ak-in">${items}</div></div>`;
        }).join("");
        return `<section class="ak-page print-break"><h2>Answer Key</h2>${akParts}</section>`;
      })()
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escape(test.title)}</title>
<style>
  @page { margin: 16mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.5; font-size: ${fs}pt; }
  .academy { display: flex; align-items: center; justify-content: center; gap: 12px; border-bottom: 2px solid #047857; padding-bottom: 8px; margin-bottom: 10px; }
  .academy-logo { max-height: 60px; max-width: 120px; object-fit: contain; flex-shrink: 0; }
  .academy-text { text-align: center; }
  .academy-name { font-weight: 800; color: #047857; line-height: 1.1; }
  .academy-loc { font-size: ${Math.max(fs-2, 8)}pt; color: #555; margin-top: 2px; }
  .test-title { text-align: center; font-size: ${Math.max(14, Math.round(hs*0.7))}pt; font-weight: 700; margin: 6px 0 4px; }
  .test-stats { font-size: ${Math.max(fs-2, 8)}pt; color: #555; text-align: center; margin-bottom: 8px; }
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
  .fld { border: 1px solid #555; border-radius: 0; padding: 6px 8px 4px; position: relative; background: #fff; min-height: 20px; }
  .fld legend { font-size: ${Math.max(fs-3, 7)}pt; font-weight: 700; color: #444; background: #fff; padding: 0 4px; }
  .fld-val { font-size: ${fs}pt; }
  .instructions { margin-top: 10px; background: #f3f4f6; padding: 6px 10px; font-size: ${Math.max(fs-1, 9)}pt; }
  .bubble-sec { margin-top: 14px; page-break-after: always; }
  .bubble-sec h2 { font-size: ${Math.max(fs+2, 12)}pt; text-align: center; text-transform: uppercase; }
  .bs-tbl { border-collapse: collapse; margin: 8px auto; }
  .bs-tbl td { border: 1px solid #888; padding: 3px 8px; }
  .bs-n { font-weight: bold; width: 30px; text-align: center; }
  .bub { display: inline-block; border: 1.5px solid #444; border-radius: 50%; width: 18px; height: 18px; line-height: 18px; text-align: center; margin-right: 6px; font-size: 10px; }
  section { margin-top: 16px; }
  section h2 { font-size: ${Math.max(fs+2, 12)}pt; text-transform: uppercase; border-bottom: 1px dashed #999; padding-bottom: 2px; }
  .meta { font-size: ${Math.max(fs-3, 7)}pt; color: #666; margin: 2px 0 6px; }
  ol { padding-left: 20px; }
  .qi { margin-bottom: 10px; }
  .mk { font-size: ${Math.max(fs-2, 8)}pt; color: #666; }
  .opts-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; margin-top: 4px; margin-left: 12px; }
  .opts-1col { margin-top: 4px; margin-left: 12px; }
  .oi { font-size: ${Math.max(fs-1, 9)}pt; }
  table.qt { width: 100%; border-collapse: collapse; }
  table.qt td { border: 1px solid #444; padding: 5px 8px; vertical-align: top; }
  td.qn { width: 32px; font-weight: bold; text-align: center; }
  .ak-page { page-break-before: always; }
  .ak-page h2 { text-align: center; text-transform: uppercase; }
  .ak-sec h3 { font-size: ${Math.max(fs-1, 9)}pt; margin: 8px 0 4px; }
  .ak-in { line-height: 2; }
  .aki { display: inline-block; min-width: 50px; }
  .akc { color: #047857; }
  .print-break { page-break-before: always; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 72px; font-weight: 900; color: rgba(0,0,0,0.05); pointer-events: none; z-index: -1; white-space: nowrap; }
</style></head><body>
  ${opts.watermarkText ? `<div class="watermark">${escape(opts.watermarkText)}</div>` : ""}
  ${academyHtml}
  <div class="test-title">${escape(test.title)}</div>
  <div class="test-stats">Time: <b>${test.durationMins} min</b> &nbsp;|&nbsp; Marks: <b>${test.totalMarks}</b> &nbsp;|&nbsp; Q: <b>${test.totalQuestions}</b></div>
  ${studentInfoHtml}
  ${test.instructions ? `<div class="instructions"><b>Instructions:</b> ${escape(test.instructions)}</div>` : ""}
  ${bubbleSheetHtml}
  ${sectionsHtml}
  ${answerKeyHtml}
</body></html>`;
}

/* --------------------------- Word (.doc) export ------------------------- */

function renderWordHTML(test: GeneratedTest, opts: PrintOpts): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fs = opts.fontSize ?? 12;
  const hs = opts.headerSize ?? 18;
  const mcqBorder = opts.mcqBorder ?? false;
  const shortBorder = opts.shortBorder ?? false;
  const longBorder = opts.longBorder ?? false;

  // Academy header — centered across full row
  const academyHtml = (opts.academyName || opts.academyLocation || opts.logoDataUrl)
    ? `<table style="width:100%;border-bottom:2pt solid #047857;padding-bottom:8pt;margin-bottom:10pt;"><tr>
         ${opts.logoDataUrl ? `<td style="width:120pt;vertical-align:middle;"><img src="${opts.logoDataUrl}" style="max-height:55pt;max-width:110pt;object-fit:contain;" alt="logo" /></td>` : ""}
         <td style="text-align:center;vertical-align:middle;">
           ${opts.academyName ? `<div style="font-size:${hs}pt;font-weight:800;color:#047857;margin:0;line-height:1.1;">${escape(opts.academyName)}</div>` : ""}
           ${opts.academyLocation ? `<div style="font-size:${Math.max(fs-2,8)}pt;color:#555;margin-top:2pt;">${escape(opts.academyLocation)}</div>` : ""}
         </td>
       </tr></table>`
    : "";

  // Student info as fieldset-style boxes (using tables for Word compatibility)
  const fld = (label: string, value: string) =>
    `<td style="border:1pt solid #555;padding:4pt 6pt 3pt;vertical-align:top;"><div style="font-size:${Math.max(fs-3,7)}pt;font-weight:700;color:#444;margin-bottom:1pt;">${escape(label)}</div><div style="font-size:${fs}pt;">${escape(value || "\u00A0")}</div></td>`;
  const studentInfoHtml = opts.printStudentInfo
    ? `<table style="width:100%;border-collapse:separate;border-spacing:4pt;margin-top:8pt;">
        <tr>${fld("Student Name", opts.studentName ?? "")}${fld("Roll Number", opts.rollNumber ?? "")}${fld("Class", opts.classNameInput ?? test.className)}${fld("Paper Code", opts.paperCode ?? "")}</tr>
        <tr>${fld("Subject", opts.subjectNameInput ?? test.subjectName)}${fld("Time Allowed", opts.timeAllowed ?? `${test.durationMins} min`)}${fld("Total Marks", opts.totalMarksInput ?? `${test.totalMarks}`)}${fld("Exam Date", opts.examDate ?? "")}</tr>
        <tr>${fld("Exam Syllabus", opts.examSyllabus ?? "")}${opts.showExamLabel ? fld("Exam", opts.examLabel ?? "") : "<td></td><td></td><td></td>"}</tr>
      </table>`
    : "";

  // Bubble sheet (BEFORE sections)
  const mcqSections = test.sections.filter((s) => s.type_name === "MCQ");
  const bubbleSheetHtml = opts.showBubbleSheet && mcqSections.length > 0
    ? (() => {
        let qn = 0;
        const parts = mcqSections.map((sec) => {
          const rows = sec.questions.map(() => {
            qn++;
            const bubbles = ["A","B","C","D"].map((l) =>
              `<span style="display:inline-block;border:1pt solid #444;border-radius:50%;width:16pt;height:16pt;line-height:16pt;text-align:center;margin-right:5pt;font-size:9pt;">${l}</span>`
            ).join("");
            return `<tr><td style="border:1pt solid #888;padding:2pt 6pt;font-weight:bold;text-align:center;width:30pt;">${qn}</td><td style="border:1pt solid #888;padding:2pt 6pt;">${bubbles}</td></tr>`;
          }).join("");
          return `<table style="border-collapse:collapse;margin:4pt 0;">${rows}</table>`;
        }).join("");
        return `<div style="page-break-after:always;"><h2 style="text-align:center;font-size:${Math.max(fs+2,12)}pt;">Bubble Sheet</h2>${parts}</div>`;
      })()
    : "";

  // Sections with 2-per-row MCQ options
  const sectionsHtml = test.sections.map((sec, si) => {
    const useBorder = sec.type_name === "MCQ" ? mcqBorder : sec.type_name === "Short" ? shortBorder : longBorder;
    const body = sec.questions.map((q, qi) => {
      const qn = qi + 1;
      const mk = `<i>(${q.marks} marks)</i>`;
      if (q.options) {
        const anyLong = ["A","B","C","D"].some((l) =>
          (q.options![`option_${l.toLowerCase()}` as "option_a"|"option_b"|"option_c"|"option_d"] || "").length > 40
        );
        const optsHtml = ["A","B","C","D"].map((l) => {
          const text = escape(q.options![`option_${l.toLowerCase()}` as "option_a"|"option_b"|"option_c"|"option_d"]);
          return `<span style="margin-right:16pt;"><b>${l}.</b> ${text}</span>`;
        }).join("");
        const optsBlock = anyLong
          ? optsHtml.split("<span").map((s, i) => i === 0 ? s : "<span" + s).join("").replace(/<span/g, "<div><span").replace(/<\/span>/g, "</span></div>")
          : `<div>${optsHtml}</div>`;
        if (useBorder) {
          return `<table style="width:100%;border-collapse:collapse;margin-top:3pt;"><tr><td style="border:1pt solid #444;padding:4pt;width:30pt;font-weight:bold;text-align:center;vertical-align:top;">${qn}</td><td style="border:1pt solid #444;padding:4pt;">${escape(q.question_text)} ${mk}<br/>${optsBlock}</td></tr></table>`;
        }
        return `<p style="margin-top:6pt;"><b>Q${qn}.</b> ${escape(q.question_text)} ${mk}</p><div style="margin-left:12pt;">${optsBlock}</div>`;
      }
      if (useBorder) {
        return `<table style="width:100%;border-collapse:collapse;margin-top:3pt;"><tr><td style="border:1pt solid #444;padding:4pt;width:30pt;font-weight:bold;text-align:center;vertical-align:top;">${qn}</td><td style="border:1pt solid #444;padding:4pt;">${escape(q.question_text)} ${mk}</td></tr></table>`;
      }
      return `<p style="margin-top:6pt;"><b>Q${qn}.</b> ${escape(q.question_text)} ${mk}</p>`;
    }).join("");
    const hdr = `<h3 style="margin-top:12pt;border-bottom:1pt solid #999;font-size:${Math.max(fs+2,12)}pt;">Section ${String.fromCharCode(65+si)} — ${sec.type_name} (${sec.questions.length} × ${sec.marksPerQuestion} = ${sec.sectionMarks} marks)</h3>`;
    return `${hdr}${body}`;
  }).join("");

  // Answer Key (MCQ only)
  const answerKeyHtml = opts.printAnswerKey && mcqSections.length > 0
    ? (() => {
        let n = 0;
        const parts = mcqSections.map((sec, si) => {
          const items = sec.questions.map((q) => {
            n++;
            return q.options ? `<span style="display:inline-block;min-width:45pt;"><b>${n}.</b> <b style="color:#047857;">${q.options.correct_option}</b></span>` : "";
          }).join("\u00A0\u00A0");
          return `<h4 style="margin-top:6pt;">Section ${String.fromCharCode(65+si)}</h4><p style="line-height:2;">${items}</p>`;
        }).join("");
        return `<div style="page-break-before:always;"><h2 style="text-align:center;font-size:${Math.max(fs+4,14)}pt;">Answer Key</h2>${parts}</div>`;
      })()
    : "";

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escape(test.title)}</title>
<style>
  body { font-family: 'Times New Roman', serif; font-size: ${fs}pt; line-height: 1.5; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 72pt; font-weight: 900; color: rgba(0,0,0,0.05); pointer-events: none; z-index: -1; white-space: nowrap; }
</style></head>
<body>
  ${opts.watermarkText ? `<div class="watermark">${escape(opts.watermarkText)}</div>` : ""}
  ${academyHtml}
  <h1 style="text-align:center;font-size:${Math.max(14,Math.round(hs*0.7))}pt;margin:4pt 0 2pt;">${escape(test.title)}</h1>
  <div style="text-align:center;font-size:${Math.max(fs-2,8)}pt;color:#555;">Time: <b>${test.durationMins} min</b> | Marks: <b>${test.totalMarks}</b> | Q: <b>${test.totalQuestions}</b></div>
  ${studentInfoHtml}
  ${test.instructions ? `<div style="margin-top:8pt;background:#f3f4f6;padding:6pt;font-size:${Math.max(fs-1,9)}pt;"><b>Instructions:</b> ${escape(test.instructions)}</div>` : ""}
  ${bubbleSheetHtml}
  ${sectionsHtml}
  ${answerKeyHtml}
</body></html>`;
}

/* --------------------------- Excel (.xls) export ------------------------ */

function renderExcelHTML(test: GeneratedTest): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Build question rows
  let qNum = 1;
  const questionRows: string[] = [];
  const answerRows: string[] = [];

  test.sections.forEach((sec, si) => {
    sec.questions.forEach((q) => {
      const n = qNum++;
      const correctText = q.options
        ? q.options[`option_${q.options.correct_option.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"]
        : "";

      questionRows.push(
        `<tr>
          <td>${n}</td>
          <td>Section ${String.fromCharCode(65 + si)}</td>
          <td>${escape(q.type_name)}</td>
          <td>${escape(q.difficulty_name)}</td>
          <td>${q.marks}</td>
          <td>${escape(q.question_text)}</td>
          ${q.options ? `<td>${escape(q.options.option_a)}</td><td>${escape(q.options.option_b)}</td><td>${escape(q.options.option_c)}</td><td>${escape(q.options.option_d)}</td>` : `<td></td><td></td><td></td><td></td>`}
          <td>${escape(q.blooms_taxonomy ?? "")}</td>
          <td>${escape(q.topic_name ?? "")}</td>
          <td>${escape(q.chapter_name ?? "")}</td>
        </tr>`
      );

      answerRows.push(
        `<tr>
          <td>${n}</td>
          <td>${escape(q.type_name)}</td>
          <td>${q.options ? escape(q.options.correct_option) : "—"}</td>
          <td>${q.options ? escape(correctText) : escape(q.model_answer ?? "Self-assess")}</td>
          <td>${q.marks}</td>
        </tr>`
      );
    });
  });

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escape(test.title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #047857; color: #fff; font-weight: bold; padding: 6px; border: 1px solid #999; text-align: left; }
  td { padding: 5px; border: 1px solid #ccc; vertical-align: top; }
  tr:nth-child(even) { background: #f0fdf4; }
  .title { font-size: 14pt; font-weight: bold; color: #047857; }
  .meta { font-size: 10pt; color: #666; margin-bottom: 8px; }
</style></head>
<body>
  <div class="title">${escape(test.title)}</div>
  <div class="meta">${escape(test.className)} · ${escape(test.subjectName)} · ${test.totalQuestions} questions · ${test.totalMarks} marks · ${test.durationMins} min</div>

  <h3>Questions</h3>
  <table>
    <thead><tr>
      <th>#</th><th>Section</th><th>Type</th><th>Difficulty</th><th>Marks</th><th>Question</th>
      <th>Option A</th><th>Option B</th><th>Option C</th><th>Option D</th>
      <th>Bloom's</th><th>Topic</th><th>Chapter</th>
    </tr></thead>
    <tbody>${questionRows.join("")}</tbody>
  </table>

  <br/>

  <h3>Answer Key</h3>
  <table>
    <thead><tr>
      <th>#</th><th>Type</th><th>Correct</th><th>Answer / Model Answer</th><th>Marks</th>
    </tr></thead>
    <tbody>${answerRows.join("")}</tbody>
  </table>
</body></html>`;
}
