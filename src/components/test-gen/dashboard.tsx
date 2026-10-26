"use client";

import { useEffect, useState } from "react";
import {
  GraduationCap,
  BookOpen,
  Layers,
  ListTree,
  FileQuestion,
  Sparkles,
  TrendingUp,
  Brain,
  Zap,
  History,
  CopyPlus,
  FolderOpen,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchStats } from "./lib";

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type Stats = Awaited<ReturnType<typeof fetchStats>>;

interface ChartTooltipPayloadItem {
  name?: string;
  value?: number;
  fill?: string;
  color?: string;
  payload?: {
    name?: string;
    count?: number;
    fill?: string;
  };
}

function CustomBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const count = item.value ?? item.payload?.count ?? 0;
  const typeName = label || item.payload?.name || "Questions";
  const color = item.fill || item.color || item.payload?.fill || "var(--chart-1)";

  return (
    <div className="rounded-xl border border-border bg-popover/95 px-3.5 py-2.5 shadow-md backdrop-blur-sm text-xs min-w-[150px]">
      <div className="font-semibold text-popover-foreground">{typeName} Questions</div>
      <div className="mt-1.5 flex items-center gap-2 text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span>Total:</span>
        <span className="font-bold tabular-nums text-foreground">{count.toLocaleString()}</span>
      </div>
    </div>
  );
}

function CustomPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = item.name || item.payload?.name || "";
  const count = item.value ?? item.payload?.count ?? 0;
  const fill = item.payload?.fill || item.fill || item.color || "var(--chart-1)";

  return (
    <div className="rounded-xl border border-border bg-popover/95 px-3.5 py-2.5 shadow-md backdrop-blur-sm text-xs min-w-[140px]">
      <div className="font-semibold text-popover-foreground flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: fill }} />
        <span>{name}</span>
      </div>
      <div className="mt-1.5 pl-4.5 text-muted-foreground">
        <span className="font-bold tabular-nums text-foreground">{count.toLocaleString()}</span> questions
      </div>
    </div>
  );
}

export function Dashboard({
  onStart,
  onNavigate,
}: {
  onStart: () => void;
  onNavigate?: (
    view: "generate" | "bank" | "chat" | "saved" | "history",
    opts?: { batch?: boolean }
  ) => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStats()
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const cards = [
    { key: "classes", label: "Classes", icon: GraduationCap, value: stats?.counts.classes },
    { key: "subjects", label: "Subjects", icon: BookOpen, value: stats?.counts.subjects },
    { key: "chapters", label: "Chapters", icon: Layers, value: stats?.counts.chapters },
    { key: "topics", label: "Topics", icon: ListTree, value: stats?.counts.topics },
    { key: "questions", label: "Curriculum Questions", icon: FileQuestion, value: stats?.counts.questions },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />
        <div className="relative z-10 px-5 py-7 sm:px-8 sm:py-10 md:py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
                <span>Next-Gen Examination Paper Studio</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.12] text-white">
                Create Custom Exam Papers & Blueprint Assessments
              </h1>
              <p className="text-sm sm:text-base text-emerald-50/90 leading-relaxed max-w-xl">
                Configure curriculum classes, syllabus chapters, and question distribution. Generate print-ready test papers with official school styling or practice interactively online.
              </p>
            </div>
            <div className="flex shrink-0">
              <Button
                size="lg"
                onClick={onStart}
                className="h-12 px-7 bg-white text-emerald-800 hover:bg-emerald-50 shadow-lg font-bold text-sm sm:text-base cursor-pointer press-effect transition-colors"
              >
                <Sparkles className="mr-2 h-4 w-4 text-emerald-600" /> Create Exam Paper
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.key}
            className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-border/80 transition-colors duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
                {c.label}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              {c.value === undefined ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
                  {c.value.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load stats: {error}
          </CardContent>
        </Card>
      )}

      {/* Analytics Charts */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Bar Chart: Questions by Type */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> Questions by Type & Difficulty
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribution of curriculum questions across multiple choice, short, and long questions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {!stats ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <div className="w-full h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.byType}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--accent)", opacity: 0.2 }}
                        content={<CustomBarTooltip />}
                      />
                      <Bar dataKey="count" name="Questions" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {stats.byType.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t">
                  {stats.byDifficulty.map((d, i) => {
                    const total = stats.byDifficulty.reduce((s, x) => s + x.count, 0) || 1;
                    const pct = Math.round((d.count / total) * 100);
                    return (
                      <div key={d.name} className="rounded-xl border bg-card p-3 shadow-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground">{d.name}</span>
                          <span className="font-bold text-foreground tabular-nums">{pct}%</span>
                        </div>
                        <div className="mt-1.5 text-xl font-bold tabular-nums text-foreground">
                          {d.count.toLocaleString()}
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-opacity duration-300"
                            style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart: Bloom's Taxonomy with Center Stat & Structured Breakdown */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Brain className="h-4 w-4 text-emerald-600" /> Cognitive Levels
                </CardTitle>
                <CardDescription className="text-xs">Bloom&apos;s Taxonomy distribution</CardDescription>
              </div>
              {stats && (
                <Badge variant="outline" className="text-xs font-semibold">
                  {stats.byBloom.reduce((acc, b) => acc + (b.count || 0), 0).toLocaleString()} Total
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-2 space-y-4">
            {!stats ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <div className="relative w-full h-52 sm:h-56 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.byBloom}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={56}
                        paddingAngle={2}
                        stroke="none"
                        strokeWidth={0}
                      >
                        {stats.byBloom.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                            stroke="none"
                            strokeWidth={0}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Stat Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-2xl font-black tabular-nums text-foreground leading-tight">
                      {stats.byBloom.reduce((acc, b) => acc + (b.count || 0), 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Questions
                    </span>
                  </div>
                </div>

                {/* Structured Cognitive Breakdown Grid */}
                {(() => {
                  const totalBloom = stats.byBloom.reduce((acc, b) => acc + (b.count || 0), 0);
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/60">
                      {stats.byBloom.map((b, i) => {
                        const pct = totalBloom > 0 ? Math.round((b.count / totalBloom) * 100) : 0;
                        return (
                          <div
                            key={b.name}
                            className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs border border-border/40"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                              />
                              <span className="font-medium text-foreground truncate">{b.name}</span>
                            </div>
                            <span className="font-bold tabular-nums text-muted-foreground ml-1 shrink-0">
                              {b.count} <span className="font-normal text-[10px] opacity-75">({pct}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Zap className="h-4 w-4 text-emerald-600" /> Quick Actions
          </CardTitle>
          <CardDescription className="text-xs">
            Instant shortcuts for common teacher workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <QuickAction
              icon={CopyPlus}
              title="Batch Paper Sets"
              desc="Generate up to 6 distinct variants with zero question overlap"
              onClick={() => (onNavigate ? onNavigate("generate", { batch: true }) : onStart())}
            />
            <QuickAction
              icon={FolderOpen}
              title="My Saved Tests"
              desc="Re-open, practice, print, or export previous papers"
              onClick={() => (onNavigate ? onNavigate("saved") : onStart())}
            />
            <QuickAction
              icon={History}
              title="History & Analytics"
              desc="Review test generation trends and marks distribution"
              onClick={() => (onNavigate ? onNavigate("history") : onStart())}
            />
            <QuickAction
              icon={MessageSquare}
              title="AI Exam Assistant"
              desc="Interactive AI chat to refine blueprints or craft questions"
              onClick={() => (onNavigate ? onNavigate("chat") : onStart())}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: typeof Zap;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 text-left transition-[colors,box-shadow] duration-200 hover:border-emerald-500/60 hover:shadow-md active:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer min-h-[105px]"
    >
      <div className="flex items-center justify-between w-full">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950/40 dark:text-emerald-300">
          <Icon className="h-4 w-4" />
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 motion-safe:transition-transform motion-safe:group-hover:translate-x-1 group-hover:text-emerald-600" />
      </div>
      <div className="mt-3">
        <div className="text-sm font-bold text-foreground leading-snug">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{desc}</div>
      </div>
    </button>
  );
}
