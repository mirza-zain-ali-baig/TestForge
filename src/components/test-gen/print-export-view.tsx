"use client";

/**
 * PrintExportView — comprehensive "Print & Export" view for a GeneratedTest.
 *
 * Layout: top toolbar + two-column body
 *   • top toolbar           — export buttons, quick toggles, close
 *   • left  (380px)         — collapsible customization sections
 *   • right (flex-1)        — live iframe preview (optionally editable)
 *
 * The preview HTML is regenerated via useMemo whenever ANY control changes,
 * and pushed into the iframe through `srcDoc` for real-time updates.
 *
 * Export actions:
 *   • PDF    — opens a print window (user picks "Save as PDF")
 *   • Word   — downloads a Word-compatible .doc
 *   • Excel  — downloads an Excel-compatible .xls
 *   • Print  — prints the live iframe directly
 *
 * Live edit: toggling "Live edit" makes the iframe body contentEditable.
 * Click "Apply edits" to capture the edited HTML and use it for exports.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Printer,
  FileText,
  FileSpreadsheet,
  Download,
  Upload,
  Image as ImageIcon,
  Building2,
  Stamp,
  GraduationCap,
  Settings2,
  Trash2,
  Type,
  AlignJustify,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  KeyRound,
  PencilLine,
  Check,
  LayoutTemplate,
  Save,
  Eye,
  Sliders,
  ArrowLeft,
  MoreHorizontal,
  SlidersHorizontal,
  Bold,
  Italic,
  Underline,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import type { GeneratedTest, GeneratedQuestion } from "@/lib/types";
import { saveTest } from "./lib";
import { exportTestToDocxBlob } from "@/lib/docx-export";

import {
  HEADER_FONT_FAMILIES,
  PAPER_FONT_FAMILIES,
  PAPER_SIZES,
  MARGIN_PRESETS,
  DATE_FORMATS,
  LIVE_EDIT_FONT_SIZES,
  LIVE_EDIT_COLORS,
  GOOGLE_FONTS_LINK,
  escapeHtml,
  extractClassNumber,
  formatDuration,
  pad2,
  formatDate,
  todayDate,
  generatePaperCode,
  type PrintExportOpts,
  renderPreviewHTML,
  renderExcelHTML,
} from "@/lib/paper-preview-html";

export {
  type PrintExportOpts,
  renderPreviewHTML,
  renderExcelHTML,
  PAPER_SIZES,
  MARGIN_PRESETS,
};

/* --------------------------- Component shell ----------------------------- */

export function PrintExportView({
  test,
  onClose,
}: {
  test: GeneratedTest;
  onClose: () => void;
}) {
  /* ---- Academy header state ---- */
  const [academyName, setAcademyName] = useState("");
  const [academyLocation, setAcademyLocation] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<number>(90);
  const [headerFont, setHeaderFont] = useState<string>("Arial, sans-serif");
  const [headerSize, setHeaderSize] = useState<number>(20);
  const [paperFont, setPaperFont] = useState<string>("'Times New Roman', serif");
  const [fontSize, setFontSize] = useState<number>(9); // default 9pt (was 12)
  const [topMargin, setTopMargin] = useState<number>(6); // default 6mm (was 0)

  /* ---- Layout state ---- */
  const [paperSize, setPaperSize] = useState<string>("A4");
  const [marginPreset, setMarginPreset] = useState<string>("Normal");
  const [dateFormat, setDateFormat] = useState<string>("Locale");

  /* ---- Student info state ---- */
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [classNameInput, setClassNameInput] = useState(
    extractClassNumber(test.className)
  );
  // Paper code auto-generated once via lazy initializer (4 digits, last 4 of timestamp).
  const [paperCode, setPaperCode] = useState<string>(() => generatePaperCode());
  const [subjectNameInput, setSubjectNameInput] = useState(
    test.subjectName || ""
  );
  const [timeAllowed, setTimeAllowed] = useState(
    formatDuration(test.durationMins)
  );
  const [totalMarksInput, setTotalMarksInput] = useState(
    String(test.totalMarks)
  );
  const [examDate, setExamDate] = useState<string>(() => todayDate("Locale"));
  const [examSyllabus, setExamSyllabus] = useState("L1");
  const [showExamSyllabus, setShowExamSyllabus] = useState(false);
  const [examLabel, setExamLabel] = useState("Mid Term");
  const [showExamLabel, setShowExamLabel] = useState(false);

  /* ---- Paper options state ---- */
  const [printAnswerKey, setPrintAnswerKey] = useState(true);
  const [showBubbleSheet, setShowBubbleSheet] = useState(true); // enabled by default
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null);
  const [watermarkSize, setWatermarkSize] = useState<number>(40); // percentage of page width
  const [mcqBorder, setMcqBorder] = useState(true);
  const [shortBorder, setShortBorder] = useState(false);
  const [longBorder, setLongBorder] = useState(false);
  const [repeatHeader, setRepeatHeader] = useState(false);
  const [separateSubjectivePart, setSeparateSubjectivePart] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(false);

  /* ---- Layout toggles (header & MCQ rendering variants) ---- */
  const [headerLayout, setHeaderLayout] = useState<1 | 2>(1);
  const [mcqLayout, setMcqLayout] = useState<1 | 2>(1);
  const [academyLocBold, setAcademyLocBold] = useState(false);
  const [headerLineSpacing, setHeaderLineSpacing] = useState(1.4);

  /* ---- Live edit state ---- */
  const [liveEdit, setLiveEdit] = useState(false);
  const [editedHtml, setEditedHtml] = useState<string | null>(null);

  /* ---- iframe ref for direct printing ---- */
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  /* ---- Memoized preview options ---- */
  const opts: PrintExportOpts = useMemo(
    () => ({
      academyName,
      academyLocation,
      logoDataUrl,
      logoSize,
      headerFont,
      headerSize,
      paperFont,
      fontSize,
      topMargin,
      paperSize,
      marginPreset,
      studentName,
      rollNumber,
      classNameInput,
      paperCode,
      subjectNameInput,
      timeAllowed,
      totalMarksInput,
      examDate,
      examSyllabus,
      showExamSyllabus,
      examLabel,
      showExamLabel,
      dateFormat,
      printAnswerKey,
      showBubbleSheet,
      watermarkText,
      watermarkImage,
      watermarkSize,
      mcqBorder,
      shortBorder,
      longBorder,
      repeatHeader,
      separateSubjectivePart,
      showPageNumbers,
      headerLayout,
      mcqLayout,
      academyLocBold,
      headerLineSpacing,
    }),
    [
      academyName,
      academyLocation,
      logoDataUrl,
      logoSize,
      headerFont,
      headerSize,
      paperFont,
      fontSize,
      topMargin,
      paperSize,
      marginPreset,
      studentName,
      rollNumber,
      classNameInput,
      paperCode,
      subjectNameInput,
      timeAllowed,
      totalMarksInput,
      examDate,
      examSyllabus,
      showExamSyllabus,
      examLabel,
      showExamLabel,
      dateFormat,
      printAnswerKey,
      showBubbleSheet,
      watermarkText,
      watermarkImage,
      watermarkSize,
      mcqBorder,
      shortBorder,
      longBorder,
      repeatHeader,
      separateSubjectivePart,
      showPageNumbers,
      headerLayout,
      mcqLayout,
      academyLocBold,
      headerLineSpacing,
    ]
  );

  /* ---- Memoized preview HTML (regenerated on ANY control change) ---- */
  const previewHtml = useMemo(() => renderPreviewHTML(test, opts), [test, opts]);

  /* ---- Preview HTML tracking ----
   * When controls change, clear editedHtml so the fresh preview is used.
   * The iframe always shows previewHtml (so controls work live).
   * Exports use editedHtml (if set) so user's manual edits are preserved. */
  const [prevPreview, setPrevPreview] = useState(previewHtml);
  if (previewHtml !== prevPreview) {
    setPrevPreview(previewHtml);
    setEditedHtml(null); // clear stale edits when controls change
  }

  /* ---- Selection preservation for live-edit formatting controls ---- */
  const savedSelectionRef = useRef<Range | null>(null);

  const saveSelection = () => {
    const iframe = iframeRef.current;
    try {
      const sel = iframe?.contentWindow?.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
      }
    } catch {
      // ignore
    }
  };

  const restoreSelection = () => {
    const iframe = iframeRef.current;
    try {
      const sel = iframe?.contentWindow?.getSelection();
      if (sel && savedSelectionRef.current) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
      }
    } catch {
      // ignore
    }
  };

  /* ---- Toggle contentEditable on iframe body + preserve scroll position ----
   * Re-applied after every srcDoc change (iframe reloads) and on liveEdit toggle.
   * Saves scroll position before reload and restores it after. */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Save scroll position before iframe reloads
    let savedScroll = 0;
    try {
      savedScroll = iframe.contentWindow?.scrollY ?? 0;
    } catch { /* ignore */ }
    const apply = () => {
      try {
        const doc = iframe.contentWindow?.document;
        if (doc?.body) {
          doc.body.contentEditable = liveEdit ? "true" : "false";
          // Restore scroll position after reload
          if (savedScroll > 0) {
            iframe.contentWindow?.scrollTo(0, savedScroll);
          }
          // Listen for selection changes inside iframe
          doc.addEventListener("selectionchange", saveSelection);
          doc.addEventListener("mouseup", saveSelection);
          doc.addEventListener("keyup", saveSelection);
        }
      } catch {
        /* ignore cross-origin or not-yet-ready iframe */
      }
    };
    iframe.addEventListener("load", apply);
    apply();
    return () => {
      iframe.removeEventListener("load", apply);
      try {
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.removeEventListener("selectionchange", saveSelection);
          doc.removeEventListener("mouseup", saveSelection);
          doc.removeEventListener("keyup", saveSelection);
        }
      } catch {
        // ignore
      }
    };
  }, [liveEdit, previewHtml, editedHtml]);

  /* ---- The srcDoc for the iframe: always use fresh previewHtml so controls work.
   * Exports (PDF/Word/Excel) use editedHtml if set, otherwise previewHtml. */
  const effectiveSrcDoc = previewHtml;
  const exportHtml = editedHtml ?? previewHtml;

  /* ------------------------------- Actions ------------------------------- */

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleWatermarkImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setWatermarkImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  /* ---- Rich text formatting command (execCommand on iframe) ---- */
  const execCmd = (cmd: string, value?: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.focus();
      restoreSelection();
      iframe.contentWindow.document.execCommand(cmd, false, value);
      saveSelection();
    } catch {
      // ignore
    }
  };

  /* ---- Apply edits: read iframe body HTML and save for exports ---- */
  const handleApplyEdits = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      toast.error("Preview not ready");
      return;
    }
    try {
      const doc = iframe.contentWindow.document;
      const fullHtml = "<!DOCTYPE html>" + doc.documentElement.outerHTML;
      setEditedHtml(fullHtml);
      toast.success("Edits applied — exports will use the edited version");
    } catch {
      toast.error("Could not read edits from preview");
    }
  };

  const handleExportPDF = () => {
    const html = exportHtml;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Pop-up blocked. Allow pop-ups to export PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
    toast.success("Opening print window for PDF…");
  };

  const handleExportWord = async () => {
    try {
      toast.info("Generating Word document (.docx)...");
      const blob = await exportTestToDocxBlob(test, {
        academyName,
        academyLocation,
        examLabel: showExamLabel ? examLabel : (test.title || "Examination Paper"),
        studentName,
        rollNumber,
        className: classNameInput || test.className,
        subjectName: subjectNameInput || test.subjectName,
        timeAllowed,
        totalMarks: totalMarksInput || test.totalMarks,
        examDate,
        printStudentInfo: true,
        printAnswerKey,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(test.title || "exam_paper").replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word document (.docx) exported successfully");
    } catch (e) {
      console.error("DOCX export error:", e);
      toast.error(e instanceof Error ? `Export failed: ${e.message}` : "Failed to export Word document");
    }
  };

  const handleExportExcel = () => {
    const html = renderExcelHTML(test);
    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(test.title || "exam_paper").replace(/\s+/g, "_")}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel spreadsheet exported");
  };

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) {
      toast.error("Preview not ready yet.");
      return;
    }
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      toast.success("Print dialog opened");
    } catch {
      toast.error("Could not print the preview.");
    }
  };

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTest(test);
      setSaved(true);
      toast.success("Test saved to My Tests");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshPaperCode = () => {
    setPaperCode(generatePaperCode());
    toast.success("New paper code generated");
  };

  /* ---- Date format change: re-format existing examDate ---- */
  const handleDateFormatChange = (fmt: string) => {
    setDateFormat(fmt);
    const parsed = new Date(examDate);
    if (!isNaN(parsed.getTime())) {
      setExamDate(formatDate(parsed, fmt));
    } else {
      setExamDate(todayDate(fmt));
    }
  };

  const [mobileTab, setMobileTab] = useState<"preview" | "settings">("preview");

  /* ----------------------------- UI helpers ----------------------------- */

  const inputCls = "h-8 text-xs";
  const labelCls = "text-[11px] font-medium text-muted-foreground mb-1";

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ===== Top toolbar (Notion-style clean header with merged action button) ===== */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 sm:px-4 py-2.5 text-foreground shadow-xs backdrop-blur-md">
        {/* Left: Close / Back + Document Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 cursor-pointer"
            onClick={onClose}
            aria-label="Back to Studio"
            title="Back to Studio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold leading-tight truncate text-foreground">
                {test.title || `${test.subjectName} Examination`}
              </h1>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium hidden sm:inline-flex">
                {test.totalQuestions} Q · {test.totalMarks} m
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {test.className || "Class"} · {test.subjectName || "Subject"} · {paperSize} {marginPreset}
            </p>
          </div>
        </div>

        {/* Right: Consolidated Controls & Merged Print/Export Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Document Layout & Options Popover (Accessible on Mobile & Desktop) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 font-medium text-foreground hover:bg-accent border-border cursor-pointer px-2 sm:px-3"
                aria-label="Layout and Document Options"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Layout Options</span>
                <span className="sm:hidden">Layout</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3.5 space-y-3 z-50">
              <div className="font-semibold text-xs text-foreground pb-1 border-b">
                Document Layout & Content
              </div>

              {/* Header Style Segmented Toggle */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Header Layout:</div>
                <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setHeaderLayout(1)}
                    className={`py-1 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      headerLayout === 1
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Centered
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeaderLayout(2)}
                    className={`py-1 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      headerLayout === 2
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    2-Column
                  </button>
                </div>
              </div>

              {/* MCQ Style Segmented Toggle */}
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">MCQ Layout:</div>
                <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setMcqLayout(1)}
                    className={`py-1 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      mcqLayout === 1
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setMcqLayout(2)}
                    className={`py-1 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      mcqLayout === 2
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Compact (2-Col)
                  </button>
                </div>
              </div>

              {/* Bubble Sheet Switch */}
              <div className="flex items-center justify-between pt-1 border-t">
                <span className="text-xs font-medium text-foreground">Bubble Sheet</span>
                <Switch
                  checked={showBubbleSheet}
                  onCheckedChange={setShowBubbleSheet}
                  className="scale-90"
                />
              </div>

              {/* Answer Key Switch */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Answer Key</span>
                <Switch
                  checked={printAnswerKey}
                  onCheckedChange={setPrintAnswerKey}
                  className="scale-90"
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Live Edit Toggle Button (Desktop header) */}
          <div className="hidden lg:block">
            <Button
              size="sm"
              variant={liveEdit ? "default" : "outline"}
              onClick={() => {
                if (liveEdit) {
                  handleApplyEdits();
                  setLiveEdit(false);
                } else {
                  setEditedHtml(null);
                  setLiveEdit(true);
                }
              }}
              className={`h-8 text-xs gap-1.5 font-medium transition-colors cursor-pointer ${
                liveEdit
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs"
                  : "text-foreground hover:bg-accent border-border"
              }`}
            >
              {liveEdit ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply</span>
                </>
              ) : (
                <>
                  <PencilLine className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Edit Text</span>
                </>
              )}
            </Button>
          </div>

          {/* Save Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={saving || saved}
            className="h-8 text-xs gap-1.5 font-medium text-foreground border-border hover:bg-accent cursor-pointer"
          >
            {saved ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Saved</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
              </>
            )}
          </Button>

          {/* Merged Print & Export Button Suite (Desktop header) */}
          <div className="hidden lg:flex items-center rounded-lg shadow-xs overflow-hidden">
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 rounded-r-none border-r border-emerald-700 transition-colors cursor-pointer px-3"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2 rounded-l-none transition-colors cursor-pointer"
                  aria-label="Export options"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                  Export Assessment
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
                  <Printer className="mr-2 h-4 w-4 text-emerald-600" />
                  <span>Browser Print (A4)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                  <Download className="mr-2 h-4 w-4 text-emerald-600" />
                  <span>Download PDF</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportWord} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4 text-blue-600" />
                  <span>Word Document (.docx)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-teal-600" />
                  <span>Excel Sheet (.xlsx)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Close Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Mobile Tab Switcher (<lg screens) */}
      <div className="flex border-b bg-card lg:hidden shrink-0 shadow-xs">
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === "preview"
              ? "border-emerald-600 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Eye className="h-4 w-4" />
          <span>Paper Preview</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("settings")}
          className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
            mobileTab === "settings"
              ? "border-emerald-600 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Customization &amp; Settings</span>
        </button>
      </div>

      {/* ===== Two-column body on desktop, tabbed on mobile ===== */}
      <div className="flex min-h-0 flex-1 relative">
        {/* ===== Left column: collapsible controls (full width on mobile, 380px on desktop) ===== */}
        <aside
          className={`w-full lg:w-[380px] shrink-0 overflow-y-auto border-r bg-background ${
            mobileTab === "preview" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="space-y-2 p-2">
            {/* ---------- Academy Header ---------- */}
            <CollapsibleSection
              icon={<Building2 className="h-4 w-4" />}
              title="Academy Header"
              defaultOpen
            >
              {/* Logo upload */}
              <div>
                <Label className={labelCls}>Logo (image)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex h-8 cursor-pointer items-center gap-1 rounded-md border bg-background px-2 text-[11px] hover:bg-accent">
                    <Upload className="h-3 w-3" />
                    {logoDataUrl ? "Change" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {logoDataUrl && (
                    <>
                      <img
                        src={logoDataUrl}
                        alt="logo"
                        className="h-8 w-8 rounded border object-contain"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[11px] text-destructive"
                        onClick={() => setLogoDataUrl(null)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Logo size slider (40-150px) */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Logo size</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {logoSize}px
                  </span>
                </div>
                <Slider
                  value={[logoSize]}
                  min={40}
                  max={150}
                  step={1}
                  onValueChange={(v) => setLogoSize(v[0])}
                  className="mt-2"
                />
              </div>

              {/* Academy name */}
              <div>
                <Label className={labelCls}>Academy name</Label>
                <Input
                  value={academyName}
                  onChange={(e) => setAcademyName(e.target.value)}
                  placeholder="e.g. Greenwood High School"
                  className={inputCls}
                />
              </div>

              {/* Academy location — multi-line textarea (one campus per line) */}
              <div>
                <Label className={labelCls}>
                  Academy location (one campus per line)
                </Label>
                <Textarea
                  value={academyLocation}
                  onChange={(e) => setAcademyLocation(e.target.value)}
                  placeholder={"e.g.\nLahore Campus\nKarachi Campus\nIslamabad Campus"}
                  rows={3}
                  className="min-h-[60px] text-xs"
                />
              </div>

              {/* Academy name font family (includes stylish Google Fonts) */}
              <div>
                <Label className={labelCls}>Academy name font</Label>
                <Select value={headerFont} onValueChange={setHeaderFont}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEADER_FONT_FAMILIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Academy name font size (12-36pt) */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Academy name size</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {headerSize}pt
                  </span>
                </div>
                <Slider
                  value={[headerSize]}
                  min={12}
                  max={36}
                  step={1}
                  onValueChange={(v) => setHeaderSize(v[0])}
                  className="mt-2"
                />
              </div>

              {/* Academy location bold toggle */}
              <div className="flex items-center justify-between">
                <Label className={labelCls}>Academy details bold</Label>
                <Switch checked={academyLocBold} onCheckedChange={setAcademyLocBold} />
              </div>

              {/* Header line spacing */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Header line spacing</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {headerLineSpacing.toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={[headerLineSpacing * 10]}
                  min={10}
                  max={30}
                  step={1}
                  onValueChange={(v) => setHeaderLineSpacing(v[0] / 10)}
                  className="mt-2"
                />
              </div>
            </CollapsibleSection>

            {/* ---------- Paper & Layout ---------- */}
            <CollapsibleSection
              icon={<LayoutTemplate className="h-4 w-4" />}
              title="Paper & Layout"
              defaultOpen
            >
              {/* Header Style Segmented Toggle */}
              <div className="space-y-1">
                <Label className={labelCls}>Header Layout</Label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setHeaderLayout(1)}
                    className={`py-1 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      headerLayout === 1
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Centered
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeaderLayout(2)}
                    className={`py-1 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      headerLayout === 2
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    2-Column
                  </button>
                </div>
              </div>

              {/* MCQ Style Segmented Toggle */}
              <div className="space-y-1">
                <Label className={labelCls}>MCQ Layout</Label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setMcqLayout(1)}
                    className={`py-1 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      mcqLayout === 1
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setMcqLayout(2)}
                    className={`py-1 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      mcqLayout === 2
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Compact (2-Col)
                  </button>
                </div>
              </div>

              {/* Paper size */}
              <div>
                <Label className={labelCls}>Paper size</Label>
                <Select value={paperSize} onValueChange={setPaperSize}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_SIZES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Margins preset */}
              <div>
                <Label className={labelCls}>Margins</Label>
                <Select value={marginPreset} onValueChange={setMarginPreset}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARGIN_PRESETS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Paper font family */}
              <div>
                <Label className={labelCls}>
                  <Type className="mr-1 inline h-3 w-3" />
                  Paper font
                </Label>
                <Select value={paperFont} onValueChange={setPaperFont}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_FONT_FAMILIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Paper font size (8-16pt) */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Paper font size</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {fontSize}pt
                  </span>
                </div>
                <Slider
                  value={[fontSize]}
                  min={8}
                  max={16}
                  step={1}
                  onValueChange={(v) => setFontSize(v[0])}
                  className="mt-2"
                />
              </div>

              {/* Top margin override (0-50mm) */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Top margin (override)</Label>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {topMargin}mm
                  </span>
                </div>
                <Slider
                  value={[topMargin]}
                  min={0}
                  max={50}
                  step={1}
                  onValueChange={(v) => setTopMargin(v[0])}
                  className="mt-2"
                />
              </div>
            </CollapsibleSection>

            {/* ---------- Student Info ---------- */}
            <CollapsibleSection
              icon={<GraduationCap className="h-4 w-4" />}
              title="Student Info"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className={labelCls}>Student Name</Label>
                  <Input
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="—"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Roll Number</Label>
                  <Input
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="—"
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Class</Label>
                  <Input
                    value={classNameInput}
                    onChange={(e) => setClassNameInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Paper Code (4 digits)</Label>
                  <div className="flex gap-1">
                    <Input
                      value={paperCode}
                      onChange={(e) =>
                        setPaperCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      className={inputCls}
                      maxLength={4}
                      inputMode="numeric"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 px-2"
                      onClick={handleRefreshPaperCode}
                      title="Regenerate code"
                    >
                      <AlignJustify className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className={labelCls}>Subject</Label>
                  <Input
                    value={subjectNameInput}
                    onChange={(e) => setSubjectNameInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Time Allowed</Label>
                  <Input
                    value={timeAllowed}
                    onChange={(e) => setTimeAllowed(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Total Marks</Label>
                  <Input
                    value={totalMarksInput}
                    onChange={(e) => setTotalMarksInput(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label className={labelCls}>Exam Date</Label>
                  <Input
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Date format selector */}
              <div>
                <Label className={labelCls}>Date format</Label>
                <Select
                  value={dateFormat}
                  onValueChange={handleDateFormatChange}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Exam Syllabus toggle + input */}
              <div className="mt-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Exam Syllabus</Label>
                  <Switch
                    checked={showExamSyllabus}
                    onCheckedChange={setShowExamSyllabus}
                  />
                </div>
                {showExamSyllabus && (
                  <Input
                    value={examSyllabus}
                    onChange={(e) => setExamSyllabus(e.target.value)}
                    placeholder="e.g. L1 to L5"
                    className="mt-2 h-8 text-xs"
                  />
                )}
              </div>

              {/* Exam Label toggle + input */}
              <div className="mt-2 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Exam Label</Label>
                  <Switch
                    checked={showExamLabel}
                    onCheckedChange={setShowExamLabel}
                  />
                </div>
                {showExamLabel && (
                  <Input
                    value={examLabel}
                    onChange={(e) => setExamLabel(e.target.value)}
                    placeholder="e.g. Mid Term"
                    className="mt-2 h-8 text-xs"
                  />
                )}
              </div>
            </CollapsibleSection>

            {/* ---------- Paper Options ---------- */}
            <CollapsibleSection
              icon={<Settings2 className="h-4 w-4" />}
              title="Paper Options"
            >
              <ToggleRow
                label="Answer key (MCQ only)"
                checked={printAnswerKey}
                onCheckedChange={setPrintAnswerKey}
              />
              <ToggleRow
                label="Bubble sheet"
                checked={showBubbleSheet}
                onCheckedChange={setShowBubbleSheet}
              />
              <ToggleRow
                label="Repeat header on each page"
                checked={repeatHeader}
                onCheckedChange={setRepeatHeader}
              />
              <ToggleRow
                label="Separate subjective part (page break)"
                checked={separateSubjectivePart}
                onCheckedChange={setSeparateSubjectivePart}
              />
              <ToggleRow
                label="Page numbers (Page X of Y)"
                checked={showPageNumbers}
                onCheckedChange={setShowPageNumbers}
              />

              {/* Border toggles */}
              <div className="mt-2">
                <Label className={labelCls}>Section borders</Label>
                <div className="mt-1 space-y-1.5">
                  <ToggleRow
                    label="MCQ border"
                    checked={mcqBorder}
                    onCheckedChange={setMcqBorder}
                  />
                  <ToggleRow
                    label="Short border"
                    checked={shortBorder}
                    onCheckedChange={setShortBorder}
                  />
                  <ToggleRow
                    label="Long border"
                    checked={longBorder}
                    onCheckedChange={setLongBorder}
                  />
                </div>
              </div>

              {/* Watermark text */}
              <div className="mt-2">
                <Label className={labelCls}>
                  <Stamp className="mr-1 inline h-3 w-3" />
                  Watermark text
                </Label>
                <Input
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="e.g. SAMPLE"
                  className={inputCls}
                />
              </div>

              {/* Watermark image */}
              <div>
                <Label className={labelCls}>Watermark image (optional)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex h-8 cursor-pointer items-center gap-1 rounded-md border bg-background px-2 text-[11px] hover:bg-accent">
                    <ImageIcon className="h-3 w-3" />
                    {watermarkImage ? "Change" : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleWatermarkImageUpload}
                    />
                  </label>
                  {watermarkImage && (
                    <>
                      <img
                        src={watermarkImage}
                        alt="watermark"
                        className="h-8 w-8 rounded border object-contain opacity-60"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[11px] text-destructive"
                        onClick={() => setWatermarkImage(null)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Watermark size */}
              {watermarkImage && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className={labelCls}>Watermark size</Label>
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {watermarkSize}%
                    </span>
                  </div>
                  <Slider
                    value={[watermarkSize]}
                    min={10}
                    max={80}
                    step={5}
                    onValueChange={(v) => setWatermarkSize(v[0])}
                    className="mt-2"
                  />
                </div>
              )}
            </CollapsibleSection>

            <p className="flex items-start gap-1 px-2 pb-2 text-[10px] text-muted-foreground">
              <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-emerald-500" />
              <span>
                PDF opens a print window — choose “Save as PDF” as the
                destination. Word &amp; Excel download directly. Toggle “Live
                edit” to tweak text inline in the preview, then click “Apply
                edits” to save.
              </span>
            </p>

            {/* Quick mobile button to switch to preview */}
            <div className="pt-2 pb-6 px-2 lg:hidden">
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 shadow cursor-pointer"
                onClick={() => setMobileTab("preview")}
              >
                <Eye className="mr-1.5 h-4 w-4" /> View Paper Preview
              </Button>
            </div>
          </div>
        </aside>

        {/* ===== Right column: live preview ===== */}
        <main
          className={`min-h-0 flex-1 flex-col bg-slate-200/60 p-2 sm:p-3 dark:bg-slate-900/40 relative ${
            mobileTab === "settings" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  liveEdit
                    ? "bg-emerald-600 motion-safe:animate-pulse ring-2 ring-emerald-500/30"
                    : "bg-emerald-500"
                }`}
              />
              <span className="text-[11px] font-medium text-muted-foreground truncate">
                {liveEdit
                  ? "Live edit active: click text in preview to format or edit, then click Done."
                  : "Live paper preview updates in real-time"}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
              {paperSize}, {marginPreset}, {fontSize}pt, {topMargin}mm top
            </span>
          </div>

          {/* Contextual Live Edit Formatting Toolbar (Project Scheme: Emerald / Slate / Shadcn) */}
          {liveEdit && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-md p-1.5 sm:p-2 shadow-xs shrink-0 text-foreground">
              {/* Badge Label */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 text-xs font-semibold shrink-0">
                <PencilLine className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Format Text</span>
              </div>

              {/* Font Family Dropdown */}
              <Select onValueChange={(val) => execCmd("fontName", val)}>
                <SelectTrigger className="h-7 w-[130px] text-xs bg-background border-border text-foreground hover:bg-muted/50 cursor-pointer">
                  <Type className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Font Family" />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_FONT_FAMILIES.map((f) => (
                    <SelectItem key={f.value} value={f.value} className="text-xs cursor-pointer">
                      <span style={{ fontFamily: f.value }}>{f.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Font Size Dropdown */}
              <Select onValueChange={(val) => execCmd("fontSize", val)}>
                <SelectTrigger className="h-7 w-[95px] text-xs bg-background border-border text-foreground hover:bg-muted/50 cursor-pointer">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  {LIVE_EDIT_FONT_SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs cursor-pointer">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Format Buttons: Bold, Italic, Underline */}
              <div className="flex items-center gap-0.5 border-x border-border px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execCmd("bold")}
                  className="h-7 w-7 rounded-md text-foreground hover:bg-muted hover:text-foreground cursor-pointer font-bold"
                  title="Bold (Ctrl+B)"
                  aria-label="Bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execCmd("italic")}
                  className="h-7 w-7 rounded-md text-foreground hover:bg-muted hover:text-foreground cursor-pointer italic"
                  title="Italic (Ctrl+I)"
                  aria-label="Italic"
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execCmd("underline")}
                  className="h-7 w-7 rounded-md text-foreground hover:bg-muted hover:text-foreground cursor-pointer underline"
                  title="Underline (Ctrl+U)"
                  aria-label="Underline"
                >
                  <Underline className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Color Picker Dropdown */}
              <DropdownMenu onOpenChange={(open) => { if (open) saveSelection(); }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 px-2 bg-background border-border text-foreground hover:bg-muted cursor-pointer"
                    title="Text Color"
                  >
                    <Palette className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Color</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44 p-1.5 space-y-1">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-0.5">
                    Text color
                  </DropdownMenuLabel>
                  {LIVE_EDIT_COLORS.map((c) => (
                    <DropdownMenuItem
                      key={c.value}
                      onClick={() => execCmd("foreColor", c.value)}
                      className="cursor-pointer flex items-center gap-2 text-xs py-1.5 px-2"
                    >
                      <span className={`h-3.5 w-3.5 rounded-full border shadow-xs ${c.previewClass}`} />
                      <span>{c.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Done Button */}
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  handleApplyEdits();
                  setLiveEdit(false);
                }}
                className="ml-auto h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 font-semibold gap-1.5 shadow-xs cursor-pointer transition-colors"
                title="Save edits and finish"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Done</span>
              </Button>
            </div>
          )}

          <iframe
            ref={iframeRef}
            title="Paper preview"
            srcDoc={effectiveSrcDoc}
            className={`h-full w-full flex-1 min-h-0 rounded-lg border bg-white shadow-xl transition-colors ${
              liveEdit
                ? "border-emerald-500/80 ring-2 ring-emerald-500/30"
                : "border-slate-300 dark:border-slate-700"
            }`}
          />

          {/* Mobile Bottom Action Bar in Preview Mode (Clean: Edit Mode + Print/Export, no duplicate Settings) */}
          <div className="lg:hidden sticky bottom-2 z-20 mx-auto w-full max-w-sm rounded-2xl border border-border bg-card/95 p-2 shadow-md backdrop-blur-md flex items-center justify-between gap-2 mt-2">
            <Button
              type="button"
              onClick={() => {
                if (liveEdit) {
                  handleApplyEdits();
                  setLiveEdit(false);
                } else {
                  setEditedHtml(null);
                  setLiveEdit(true);
                }
              }}
              variant={liveEdit ? "default" : "outline"}
              size="sm"
              className={`h-10 text-xs gap-1.5 font-medium cursor-pointer flex-1 transition-colors ${
                liveEdit ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs" : ""
              }`}
            >
              {liveEdit ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Done Edit</span>
                </>
              ) : (
                <>
                  <PencilLine className="h-4 w-4 text-muted-foreground" />
                  <span>Edit Text</span>
                </>
              )}
            </Button>
            <div className="flex flex-1 items-center rounded-lg shadow-xs overflow-hidden">
              <Button
                type="button"
                onClick={handlePrint}
                size="sm"
                className="h-10 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer flex-1 rounded-r-none border-r border-emerald-700 transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span>Print A4</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="h-10 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-l-none cursor-pointer transition-colors"
                    aria-label="Export options"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                    <Download className="mr-2 h-4 w-4 text-emerald-600" />
                    <span>Download PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportWord} className="cursor-pointer">
                    <FileText className="mr-2 h-4 w-4 text-blue-600" />
                    <span>Word Document</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                    <FileSpreadsheet className="mr-2 h-4 w-4 text-teal-600" />
                    <span>Excel Sheet</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* --------------------------- Small UI helpers ---------------------------- */

/** Quick toggle button for the top toolbar (active = white, inactive = translucent). */
function QuickToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition ${
        active
          ? "bg-white text-emerald-700"
          : "bg-white/15 text-white hover:bg-white/25"
      }`}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}

/** Collapsible section with a header (icon + title + chevron) and content. */
function CollapsibleSection({
  icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 border-b bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/70 cursor-pointer"
          >
            <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
            <h3 className="flex-1 text-xs font-semibold text-foreground">
              {title}
            </h3>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2.5 p-3">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/** Row with a label and a switch toggle. */
function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background/50 px-2.5 py-1.5">
      <Label className="cursor-pointer text-xs font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
