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
  Wand2,
  Database,
  BarChart3,
  CopyPlus,
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

export function Dashboard({
  onStart,
  onNavigate,
}: {
  onStart: () => void;
  onNavigate?: (
    view: "generate" | "bank" | "chat" | "saved" | "analytics" | "history",
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
    { key: "questions", label: "Questions", icon: FileQuestion, value: stats?.counts.questions, highlight: true },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="animate-fade-in relative overflow-hidden border-none bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <CardContent className="relative z-10 p-5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/25">
                <Sparkles className="mr-1 h-3 w-3" /> AI-Powered
              </Badge>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-snug">
                Create custom exam papers & practice online
              </h1>
              <p className="max-w-xl text-xs sm:text-sm text-white/85 leading-relaxed">
                Select your class, choose your subject and syllabus chapters, and generate custom test papers instantly from curated questions or fresh AI generation. Practice online or export print-ready exam papers with full styling.
              </p>
            </div>
            <Button
              size="lg"
              onClick={onStart}
              className="w-full sm:w-auto h-12 bg-white text-emerald-700 hover:bg-white/90 shadow-md font-semibold text-sm sm:text-base shrink-0 active:scale-95 min-h-[48px]"
            >
              <Sparkles className="mr-2 h-4 w-4" /> Generate a Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c, i) => (
          <Card
            key={c.key}
            className={[
              "card-lift animate-fade-in",
              `stagger-${Math.min(i + 1, 5)}`,
              c.highlight ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40" : "",
            ].join(" ")}
          >
            <CardContent className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </h3>
                <c.icon className="h-4 w-4 text-emerald-600" />
              </div>
              {c.value === undefined ? (
                <Skeleton className="mt-1 h-7 w-16" />
              ) : (
                <span className="text-2xl font-bold tabular-nums">{c.value.toLocaleString()}</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load stats: {error}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="animate-fade-in stagger-2 card-lift lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Questions by type
            </CardTitle>
            <CardDescription>Composition of the question bank across types and difficulties</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={stats.byType}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip
                      cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Bar dataKey="count" name="Questions" radius={[6, 6, 0, 0]}>
                      {stats.byType.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {stats.byDifficulty.map((d, i) => {
                    const total = stats.byDifficulty.reduce((s, x) => s + x.count, 0) || 1;
                    const pct = Math.round((d.count / total) * 100);
                    return (
                      <div key={d.name} className="rounded-lg border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">{d.name}</span>
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                        </div>
                        <div className="mt-1 text-lg font-bold tabular-nums">{d.count.toLocaleString()}</div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
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

        <Card className="animate-fade-in stagger-3 card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-emerald-600" /> Bloom&apos;s taxonomy
            </CardTitle>
            <CardDescription>Cognitive levels covered</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.byBloom}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {stats.byBloom.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {stats?.byBloom.map((b, i) => (
                <Badge key={b.name} variant="outline" className="text-[11px]">
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {b.name} · {b.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="animate-fade-in stagger-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-emerald-600" /> Quick actions
          </CardTitle>
          <CardDescription>Jump straight to common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <QuickAction
              icon={Wand2}
              title="Generate a test"
              desc="Configure a blueprint & create a paper"
              onClick={onStart}
            />
            <QuickAction
              icon={Database}
              title="Browse questions"
              desc={`Search the ${stats?.counts.questions.toLocaleString() ?? "2,123"}-question bank`}
              onClick={() => (onNavigate ? onNavigate("bank") : onStart())}
            />
            <QuickAction
              icon={BarChart3}
              title="View analytics"
              desc="See coverage & difficulty insights"
              onClick={() => (onNavigate ? onNavigate("analytics") : onStart())}
            />
            <QuickAction
              icon={CopyPlus}
              title="Batch variants"
              desc="Create up to 6 disjoint versions"
              onClick={() => (onNavigate ? onNavigate("generate", { batch: true }) : onStart())}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sticky Mobile Generate Button (Chapter 13 Rec 3) */}
      <div className="fixed bottom-16 right-4 z-30 sm:hidden">
        <Button
          size="sm"
          onClick={onStart}
          className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 active:scale-95 flex items-center gap-1.5 h-10 border border-emerald-400/30"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Generate Test</span>
        </Button>
      </div>
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
      className="card-lift group flex flex-col sm:flex-row items-start gap-2 sm:gap-3 rounded-xl border bg-card p-3 sm:p-4 text-left transition-all hover:border-emerald-400 active:scale-[0.98] active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-[82px] sm:min-h-[90px]"
    >
      <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950/40">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-xs sm:text-sm font-semibold truncate sm:whitespace-normal">{title}</div>
        <div className="mt-0.5 text-[10px] sm:text-[11px] text-muted-foreground line-clamp-2">{desc}</div>
      </div>
    </button>
  );
}


