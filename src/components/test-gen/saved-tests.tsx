"use client";

import { useEffect, useState } from "react";
import {
  Trash2,
  Eye,
  Clock,
  FileText,
  Database,
  Bot,
  Sparkles,
  Inbox,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  GitCompare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fetchSavedTests, deleteTest, fmtDate, type SavedTest } from "./lib";
import type { GeneratedTest } from "@/lib/types";

export function SavedTests({
  onOpen,
}: {
  onOpen: (test: GeneratedTest) => void;
}) {
  const [tests, setTests] = useState<SavedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [overlap, setOverlap] = useState<{
    pairs: {
      a: string;
      b: string;
      aTitle: string;
      bTitle: string;
      shared: number;
    }[];
    maxShared: number;
    totalTests: number;
  } | null>(null);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetchSavedTests(),
      fetch("/api/test-overlap", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([r, ov]) => {
        setTests(r.tests);
        setOverlap(ov);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchSavedTests(),
      fetch("/api/test-overlap", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([r, ov]) => {
        if (!alive) return;
        setTests(r.tests);
        setOverlap(ov);
      })
      .catch((e) => alive && toast.error(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteTest(id);
      toast.success("Test deleted");
      loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleOpen = (t: SavedTest) => {
    try {
      const parsed = JSON.parse(t.testJson) as GeneratedTest;
      onOpen(parsed);
    } catch {
      toast.error("Saved test is corrupted");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-emerald-600" /> My Saved Tests
        </CardTitle>
        <CardDescription>
          Tests you&apos;ve generated and saved. Re-open to preview, print or export.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No saved tests yet</p>
            <p className="text-xs text-muted-foreground">
              Generate a test and click “Save” to keep it here.
            </p>
          </div>
        ) : (
          <>
            {/* Overlap detection panel */}
            {overlap && overlap.totalTests > 1 && (
              <OverlapPanel pairs={overlap.pairs} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
            {tests.map((t) => (
              <div
                key={t.id}
                className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-all hover:border-emerald-400 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold" title={t.title}>
                      {t.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t.className} · {t.subjectName}
                    </p>
                  </div>
                  <SourceBadge source={t.source} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    <FileText className="mr-1 h-3 w-3" /> {t.totalMarks} marks
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    <Clock className="mr-1 h-3 w-3" /> {t.durationMins} min
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <Calendar className="mr-1 h-3 w-3" /> {fmtDate(t.createdAt)}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleOpen(t)}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Open
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this test?</AlertDialogTitle>
                        <AlertDialogDescription>
                          “{t.title}” will be permanently removed. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(t.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "ai")
    return (
      <Badge variant="outline" className="gap-1 text-[10px]">
        <Bot className="h-3 w-3" /> AI
      </Badge>
    );
  if (source === "hybrid")
    return (
      <Badge variant="outline" className="gap-1 text-[10px]">
        <Sparkles className="h-3 w-3" /> Hybrid
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <Database className="h-3 w-3" /> Bank
    </Badge>
  );
}

function OverlapPanel({
  pairs,
}: {
  pairs: {
    a: string;
    b: string;
    aTitle: string;
    bTitle: string;
    shared: number;
  }[];
}) {
  if (pairs.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          <strong>No question overlap</strong> — every saved test uses unique questions. Great for avoiding duplication across exams.
        </span>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <GitCompare className="h-4 w-4 shrink-0" />
        Question overlap detected between {pairs.length} pair{pairs.length === 1 ? "" : "s"} of tests
      </div>
      <div className="mt-2 space-y-1.5">
        {pairs.slice(0, 6).map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md bg-white/60 px-2.5 py-1.5 text-xs dark:bg-black/20"
          >
            <Badge
              variant={p.shared > 5 ? "destructive" : "secondary"}
              className="shrink-0 text-[10px]"
            >
              {p.shared} shared
            </Badge>
            <span className="min-w-0 flex-1 truncate font-medium" title={p.aTitle}>
              {p.aTitle}
            </span>
            <span className="shrink-0 text-muted-foreground">↔</span>
            <span className="min-w-0 flex-1 truncate font-medium" title={p.bTitle}>
              {p.bTitle}
            </span>
          </div>
        ))}
        {pairs.length > 6 && (
          <div className="text-[11px] text-muted-foreground">
            +{pairs.length - 6} more pair{pairs.length - 6 === 1 ? "" : "s"}…
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
        Tip: use <strong>batch generation with multiple variants</strong> to create tests with no shared questions automatically.
      </p>
    </div>
  );
}
