"use client";

import { useEffect, useState } from "react";
import {
  History,
  TrendingUp,
  Database,
  Bot,
  Sparkles,
  FileText,
  Award,
  BarChart3,
  Inbox,
  Calendar,
  Layers,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
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
import { fetchHistory, type TestHistory } from "./lib";

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
} as const;

export function TestHistoryView() {
  const [history, setHistory] = useState<TestHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchHistory()
      .then((h) => alive && setHistory(h))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-4 text-sm text-destructive">
          Failed to load history: {error}
        </CardContent>
      </Card>
    );
  }

  if (!history || history.totalTests === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
            <History className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold">No test history yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate and save tests to see generation trends, source breakdown, and
              marks distribution over time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const h = history;
  const sourceIcons: Record<string, typeof Database> = {
    bank: Database,
    hybrid: Sparkles,
    ai: Bot,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="animate-fade-in overflow-hidden border-none bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md">
        <CardContent className="relative p-5 sm:p-6">
          <div className="absolute inset-0 bg-grid opacity-15" />
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/80">
                <History className="h-3.5 w-3.5" /> Test History
              </div>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                {h.totalTests} test{h.totalTests === 1 ? "" : "s"} created
              </h2>
              <p className="text-sm text-white/85">
                {h.totalQuestions} total questions · {h.totalMarks} total marks ·{" "}
                avg {h.avgMarks} marks per test
              </p>
            </div>
            <div className="flex gap-3">
              <HeaderStat label="Total Q" value={h.totalQuestions} icon={FileText} />
              <HeaderStat label="Total marks" value={h.totalMarks} icon={Award} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total tests" value={h.totalTests} icon={History} />
        <KpiCard label="Avg questions" value={h.avgQuestions} icon={FileText} />
        <KpiCard label="Avg marks" value={h.avgMarks} icon={Award} />
        <KpiCard
          label="Sources used"
          value={h.bySource.length}
          icon={Layers}
        />
      </div>

      {/* Trend + Source breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Generation trend */}
        <Card className="animate-fade-in stagger-2 card-lift lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Generation trend
            </CardTitle>
            <CardDescription>Tests created over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={h.trend}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={1} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Tests"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#trendGrad)"
                  dot={{ r: 3, fill: "var(--chart-1)" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Source breakdown */}
        <Card className="animate-fade-in stagger-3 card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-emerald-600" /> Source breakdown
            </CardTitle>
            <CardDescription>Bank vs Hybrid vs AI</CardDescription>
          </CardHeader>
          <CardContent>
            {h.bySource.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={h.bySource}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={35}
                      paddingAngle={2}
                    >
                      {h.bySource.map((s) => (
                        <Cell
                          key={s.name}
                          fill={
                            s.name === "bank"
                              ? "var(--chart-1)"
                              : s.name === "hybrid"
                              ? "var(--chart-2)"
                              : "var(--chart-3)"
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {h.bySource.map((s) => {
                    const Icon = sourceIcons[s.name] ?? Database;
                    const pct = Math.round((s.count / h.totalTests) * 100);
                    return (
                      <div
                        key={s.name}
                        className="flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                      >
                        <Icon className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="flex-1 text-sm font-medium capitalize">
                          {s.name}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {s.count}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyHint text="No source data." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Marks distribution + Class/Subject */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Marks distribution */}
        <Card className="animate-fade-in stagger-4 card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-emerald-600" /> Marks distribution
            </CardTitle>
            <CardDescription>How tests are distributed by total marks</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={h.marksBuckets}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                <XAxis dataKey="range" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="count" name="Tests" radius={[6, 6, 0, 0]}>
                  {h.marksBuckets.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Class + Subject distribution */}
        <Card className="animate-fade-in stagger-4 card-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-emerald-600" /> By class &amp; subject
            </CardTitle>
            <CardDescription>Distribution across the curriculum</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Classes
                </div>
                <div className="max-h-44 space-y-1.5 overflow-y-auto scroll-fancy pr-1">
                  {h.byClass.length > 0 ? (
                    h.byClass.map((c, i) => (
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
                    ))
                  ) : (
                    <EmptyHint text="No data." />
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Subjects
                </div>
                <div className="max-h-44 space-y-1.5 overflow-y-auto scroll-fancy pr-1">
                  {h.bySubject.length > 0 ? (
                    h.bySubject.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-2">
                        <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span className="flex-1 truncate text-sm" title={s.name}>
                          {s.name}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {s.count}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <EmptyHint text="No data." />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ helpers --------------------------------- */

function HeaderStat({
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
      <div className="text-xl font-bold tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof TrendingUp;
}) {
  return (
    <Card className="card-lift">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
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
