"use client";

import { useMemo } from "react";
import {
  BarChart3,
  Target,
  Layers,
  TrendingUp,
  Brain,
  BookOpen,
  ListTree,
  Bot,
  Database,
  Sparkles,
  Inbox,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import type { GeneratedTest } from "@/lib/types";
import { TYPE_NAMES, DIFF_NAMES, TYPE_META, DIFF_META } from "./lib";

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function TestAnalytics({
  test,
  onStart,
}: {
  test: GeneratedTest | null;
  onStart?: () => void;
}) {
  const analytics = useMemo(() => {
    if (!test) return null;
    const allQ = test.sections.flatMap((s) => s.questions);

    // By type
    const byType = TYPE_NAMES.map((t) => ({
      name: t,
      count: allQ.filter((q) => q.type_name === t).length,
      marks: allQ
        .filter((q) => q.type_name === t)
        .reduce((s, q) => s + q.marks, 0),
    })).filter((x) => x.count > 0);

    // By difficulty
    const byDifficulty = DIFF_NAMES.map((d) => ({
      name: d,
      count: allQ.filter((q) => q.difficulty_name === d).length,
      marks: allQ
        .filter((q) => q.difficulty_name === d)
        .reduce((s, q) => s + q.marks, 0),
    })).filter((x) => x.count > 0);

    // By Bloom's
    const bloomMap = new Map<string, number>();
    for (const q of allQ) {
      const k = q.blooms_taxonomy ?? "Unspecified";
      bloomMap.set(k, (bloomMap.get(k) ?? 0) + 1);
    }
    const byBloom = Array.from(bloomMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // By chapter / topic coverage
    const chapterMap = new Map<string, number>();
    const topicMap = new Map<string, number>();
    for (const q of allQ) {
      if (q.chapter_name) chapterMap.set(q.chapter_name, (chapterMap.get(q.chapter_name) ?? 0) + 1);
      if (q.topic_name) topicMap.set(q.topic_name, (topicMap.get(q.topic_name) ?? 0) + 1);
    }
    const byChapter = Array.from(chapterMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const byTopic = Array.from(topicMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Source split
    const fromBank = allQ.filter((q) => q.source === "bank").length;
    const fromAI = allQ.filter((q) => q.source === "ai").length;

    // Difficulty index (weighted avg): Easy=1, Medium=2, Hard=3 → 0-100 scale
    const diffWeight = allQ.reduce((s, q) => {
      const w = q.difficulty_name === "Easy" ? 1 : q.difficulty_name === "Medium" ? 2 : 3;
      return s + w;
    }, 0);
    const diffIndex = allQ.length
      ? Math.round((diffWeight / (allQ.length * 3)) * 100)
      : 0;

    // Bloom's higher-order ratio (Apply/Analyze/Evaluate/Create vs Remember/Understand)
    const higherOrder = allQ.filter((q) => {
      const b = (q.blooms_taxonomy ?? "").toLowerCase();
      return ["apply", "analyze", "evaluate", "create"].includes(b);
    }).length;
    const higherOrderPct = allQ.length
      ? Math.round((higherOrder / allQ.length) * 100)
      : 0;

    return {
      total: allQ.length,
      byType,
      byDifficulty,
      byBloom,
      byChapter,
      byTopic,
      fromBank,
      fromAI,
      diffIndex,
      higherOrderPct,
      marksTotal: test.totalMarks,
    };
  }, [test]);

  if (!test || !analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold">No test to analyze yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a test first, then come back here to see coverage insights,
              difficulty distribution and Bloom&apos;s taxonomy breakdown.
            </p>
          </div>
          {onStart && (
            <Button onClick={onStart} className="mt-2 bg-emerald-600 hover:bg-emerald-700">
              <Sparkles className="mr-1 h-4 w-4" /> Generate a test
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const a = analytics;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="overflow-hidden border-none bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md">
        <CardContent className="relative p-5 sm:p-6">
          <div className="absolute inset-0 bg-grid opacity-15" />
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/80">
                <BarChart3 className="h-3.5 w-3.5" /> Test Analytics
              </div>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">{test.title}</h2>
              <p className="text-sm text-white/85">
                {test.className} · {test.subjectName} · {a.total} questions · {a.marksTotal} marks
              </p>
            </div>
            <div className="flex gap-3">
              <Stat label="Bank" value={a.fromBank} icon={Database} />
              <Stat label="AI" value={a.fromAI} icon={Bot} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Difficulty Index"
          value={`${a.diffIndex}/100`}
          desc={diffLabel(a.diffIndex)}
          icon={TrendingUp}
          progress={a.diffIndex}
        />
        <KpiCard
          label="Higher-order Qs"
          value={`${a.higherOrderPct}%`}
          desc="Apply / Analyze / Evaluate"
          icon={Brain}
          progress={a.higherOrderPct}
        />
        <KpiCard
          label="Chapters covered"
          value={`${a.byChapter.length}`}
          desc={`${a.byTopic.length} topics touched`}
          icon={BookOpen}
        />
        <KpiCard
          label="Question types"
          value={`${a.byType.length}/3`}
          desc={a.byType.map((t) => t.name).join(" · ")}
          icon={Layers}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-emerald-600" /> Marks by question type
            </CardTitle>
            <CardDescription>Distribution of marks across MCQ / Short / Long</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={a.byType} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="marks" name="Marks" radius={[6, 6, 0, 0]}>
                  {a.byType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-emerald-600" /> Difficulty distribution
            </CardTitle>
            <CardDescription>Question count by Easy / Medium / Hard</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={a.byDifficulty}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={45}
                  paddingAngle={2}
                  label={(e: { name: string; count: number }) => `${e.name}: ${e.count}`}
                  labelLine={false}
                >
                  {a.byDifficulty.map((d) => (
                    <Cell
                      key={d.name}
                      fill={
                        d.name === "Easy"
                          ? "var(--chart-1)"
                          : d.name === "Medium"
                          ? "var(--chart-2)"
                          : "var(--chart-3)"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bloom's + radial */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-emerald-600" /> Bloom&apos;s taxonomy coverage
            </CardTitle>
            <CardDescription>Cognitive levels targeted by the questions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {a.byBloom.map((b, i) => {
                const pct = Math.round((b.count / a.total) * 100);
                return (
                  <div key={b.name} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-medium">{b.name}</span>
                    <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                      <div
                        className="flex h-full items-center justify-end rounded-md px-2 text-[11px] font-semibold text-white transition-all"
                        style={{
                          width: `${Math.max(pct, 8)}%`,
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      >
                        {b.count}
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                );
              })}
              {a.byBloom.length === 0 && (
                <p className="text-sm text-muted-foreground">No Bloom&apos;s data available.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Difficulty index
            </CardTitle>
            <CardDescription>Weighted cognitive load</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart
                innerRadius="65%"
                outerRadius="100%"
                data={[{ name: "idx", value: a.diffIndex, fill: "var(--chart-1)" }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="-mt-24 text-center">
              <div className="text-3xl font-bold tabular-nums">{a.diffIndex}</div>
              <div className="text-[11px] text-muted-foreground">out of 100</div>
            </div>
            <p className="mt-16 text-center text-xs text-muted-foreground">
              {diffLabel(a.diffIndex)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coverage tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-emerald-600" /> Chapter coverage
            </CardTitle>
            <CardDescription>Questions drawn from each chapter</CardDescription>
          </CardHeader>
          <CardContent>
            {a.byChapter.length === 0 ? (
              <EmptyHint text="No chapter data (likely AI-only questions)." />
            ) : (
              <div className="max-h-72 space-y-1.5 overflow-y-auto scroll-fancy pr-1">
                {a.byChapter.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">
                      {i + 1}.
                    </span>
                    <span className="flex-1 truncate text-sm" title={c.name}>
                      {c.name}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {c.count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-4 w-4 text-emerald-600" /> Topic coverage
            </CardTitle>
            <CardDescription>Questions drawn from each topic</CardDescription>
          </CardHeader>
          <CardContent>
            {a.byTopic.length === 0 ? (
              <EmptyHint text="No topic data (likely AI-only questions)." />
            ) : (
              <div className="max-h-72 space-y-1.5 overflow-y-auto scroll-fancy pr-1">
                {a.byTopic.map((t, i) => (
                  <div key={t.name} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">
                      {i + 1}.
                    </span>
                    <span className="flex-1 truncate text-sm" title={t.name}>
                      {t.name}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Competency mapping */}
      <CompetencyMap test={test} />
    </div>
  );
}

/* --------------------------- Competency map ----------------------------- */

function CompetencyMap({ test }: { test: GeneratedTest }) {
  const competency = useMemo(() => {
    const allQ = test.sections.flatMap((s) => s.questions);
    const levels = [
      { name: "Remember", desc: "Recall facts and basic concepts", order: 1, count: 0, marks: 0 },
      { name: "Understand", desc: "Explain ideas or concepts", order: 2, count: 0, marks: 0 },
      { name: "Apply", desc: "Use information in new situations", order: 3, count: 0, marks: 0 },
      { name: "Analyze", desc: "Draw connections among ideas", order: 4, count: 0, marks: 0 },
      { name: "Evaluate", desc: "Justify a stand or decision", order: 5, count: 0, marks: 0 },
      { name: "Create", desc: "Produce new or original work", order: 6, count: 0, marks: 0 },
    ];
    const map = new Map(levels.map((l) => [l.name.toLowerCase(), l]));
    for (const q of allQ) {
      const bloom = (q.blooms_taxonomy ?? "Unspecified").toLowerCase();
      const entry = map.get(bloom);
      if (entry) {
        entry.count++;
        entry.marks += q.marks;
      }
    }
    const covered = levels.filter((l) => l.count > 0).length;
    const gaps = levels.filter((l) => l.count === 0);
    const coveragePct = Math.round((covered / levels.length) * 100);
    return { levels, covered, gaps, coveragePct };
  }, [test]);

  const maxCount = Math.max(...competency.levels.map((l) => l.count), 1);

  return (
    <Card className="animate-fade-in stagger-5 card-lift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-emerald-600" /> Competency mapping
        </CardTitle>
        <CardDescription>
          Bloom&apos;s taxonomy coverage — how well the test spans cognitive levels
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Coverage summary */}
        <div className="mb-4 flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="var(--muted)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeDasharray={`${(competency.coveragePct / 100) * 94.2} 94.2`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold tabular-nums">{competency.coveragePct}%</span>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">
              {competency.covered} of 6 cognitive levels covered
            </div>
            <p className="text-xs text-muted-foreground">
              {competency.gaps.length > 0
                ? `Missing: ${competency.gaps.map((g) => g.name).join(", ")}`
                : "Full Bloom's taxonomy coverage achieved!"}
            </p>
          </div>
        </div>

        {/* Bloom's levels */}
        <div className="space-y-2">
          {competency.levels.map((level, i) => {
            const hasQuestions = level.count > 0;
            const widthPct = hasQuestions
              ? Math.max((level.count / maxCount) * 100, 5)
              : 0;
            return (
              <div
                key={level.name}
                className={[
                  "flex items-center gap-3 rounded-lg border p-2.5 transition-colors",
                  hasQuestions
                    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/10"
                    : "border-dashed border-muted-foreground/20 opacity-60",
                ].join(" ")}
              >
                <div className="flex w-8 shrink-0 flex-col items-center">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      background: hasQuestions
                        ? `var(--chart-${(i % 5) + 1})`
                        : "var(--muted-foreground)",
                    }}
                  >
                    {level.order}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{level.name}</span>
                    {hasQuestions ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {level.count} Q · {level.marks}m
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Not covered
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{level.desc}</p>
                  {hasQuestions && (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          background: `var(--chart-${(i % 5) + 1})`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ helpers --------------------------------- */

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
} as const;

function diffLabel(idx: number) {
  if (idx <= 33) return "Easy-leaning — mostly recall & understanding";
  if (idx <= 66) return "Balanced — mix of recall and application";
  return "Rigorous — emphasis on analysis & evaluation";
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Database;
}) {
  return (
    <div className="rounded-lg bg-white/15 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase text-white/80">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  desc,
  icon: Icon,
  progress,
}: {
  label: string;
  value: string;
  desc: string;
  icon: typeof TrendingUp;
  progress?: number;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {progress !== undefined && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={desc}>
          {desc}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
      <Inbox className="h-6 w-6" />
      {text}
    </div>
  );
}
