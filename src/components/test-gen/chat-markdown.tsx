"use client";

import React, { useState, useMemo } from "react";
import { Check, Copy, ChevronDown, ChevronRight, BrainCircuit, Sparkles } from "lucide-react";
import { toast } from "sonner";
import katex from "katex";

export interface ChatMarkdownProps {
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
}

export function ChatMarkdown({ content, reasoning, isStreaming = false }: ChatMarkdownProps) {
  if (!content && !reasoning) return null;

  // Extract <think>...</think> if present in the raw text stream
  const { mainContent, thought } = useMemo(() => {
    let raw = content || "";
    let extractedThought = (reasoning || "").trim();

    // Check for closed <think>...</think>
    const closedMatch = /<think>([\s\S]*?)<\/think>/i.exec(raw);
    if (closedMatch) {
      if (!extractedThought) {
        extractedThought = closedMatch[1].trim();
      }
      raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    } else {
      // Check for unclosed <think>... (streaming mode)
      const openMatch = /<think>([\s\S]*)$/i.exec(raw);
      if (openMatch) {
        if (!extractedThought) {
          extractedThought = openMatch[1].trim();
        }
        raw = raw.slice(0, openMatch.index).trim();
      }
    }

    return { mainContent: raw, thought: extractedThought };
  }, [content, reasoning]);

  const blocks = useMemo(() => parseBlocks(mainContent), [mainContent]);

  return (
    <div className="space-y-3 leading-relaxed text-sm">
      {/* Reasoning Disclosure (if model returned reasoning / thoughts) */}
      {thought && (
        <ReasoningDisclosure
          thought={thought}
          isStreaming={isStreaming && !mainContent}
        />
      )}

      {/* Main Content Blocks */}
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <CodeBlockSnippet
              key={index}
              language={block.lang || "code"}
              code={block.code || ""}
            />
          );
        }

        if (block.type === "display-math") {
          return (
            <DisplayMathBlock key={index} math={block.math || ""} />
          );
        }

        if (block.type === "table") {
          return (
            <MarkdownTableBlock
              key={index}
              headers={block.headers || []}
              alignments={block.alignments || []}
              rows={block.rows || []}
            />
          );
        }

        return <TextFormatted key={index} text={block.text || ""} />;
      })}
    </div>
  );
}

// ─── Collapsible Reasoning Disclosure ─────────────────────────────────────────

function ReasoningDisclosure({
  thought,
  isStreaming,
}: {
  thought: string;
  isStreaming: boolean;
}) {
  // If still actively thinking with no answer yet, keep open; once finished, collapsed by default
  const [isOpen, setIsOpen] = useState(isStreaming);
  const wordCount = useMemo(() => {
    return thought.trim().split(/\s+/).filter(Boolean).length;
  }, [thought]);

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-950/20 my-1 overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BrainCircuit className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold truncate">
            {isStreaming ? "ExamForge AI is thinking..." : "Thought Process & Reasoning"}
          </span>
          {!isStreaming && (
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              {wordCount} words
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 ml-2">
          <span>{isOpen ? "Hide" : "Show"}</span>
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-emerald-500/15 p-3.5 text-xs text-muted-foreground/90 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto custom-scrollbar select-text bg-background/50">
          {thought}
        </div>
      )}
    </div>
  );
}

// ─── Code Block Snippet ────────────────────────────────────────────────────────

function CodeBlockSnippet({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs">
        <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Display Math Block ────────────────────────────────────────────────────────

function DisplayMathBlock({ math }: { math: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return null;
    }
  }, [math]);

  if (!html) {
    return (
      <div className="my-2.5 p-3 font-mono text-xs rounded-lg bg-muted text-center overflow-x-auto">
        $${math}$$
      </div>
    );
  }

  return (
    <div
      className="my-3 overflow-x-auto py-2 text-center text-foreground scrollbar-thin"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─── Markdown Table Block ──────────────────────────────────────────────────────

function MarkdownTableBlock({
  headers,
  alignments,
  rows,
}: {
  headers: string[];
  alignments: Array<"left" | "center" | "right">;
  rows: string[][];
}) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-border shadow-xs bg-card">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-muted/70 text-foreground border-b border-border">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3.5 py-2.5 font-semibold text-xs tracking-wide"
                style={{ textAlign: alignments[i] || "left" }}
              >
                {renderInlineStyles(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="hover:bg-muted/40 transition-colors even:bg-muted/20"
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3.5 py-2.5 text-xs text-foreground align-top"
                  style={{ textAlign: alignments[ci] || "left" }}
                >
                  {renderInlineStyles(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Text / Paragraph Formatted ────────────────────────────────────────────────

function TextFormatted({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Headers
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="pt-2 font-bold text-foreground text-sm">
              {renderInlineStyles(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="pt-2 text-base font-bold text-foreground">
              {renderInlineStyles(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="pt-2.5 text-lg font-bold text-foreground">
              {renderInlineStyles(trimmed.slice(2))}
            </h2>
          );
        }

        // Blockquote
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-3 border-emerald-500 pl-3 py-1 my-1 italic text-muted-foreground bg-muted/30 rounded-r-sm text-xs"
            >
              {renderInlineStyles(trimmed.slice(2))}
            </blockquote>
          );
        }

        // Bullet lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-emerald-500 font-bold leading-none mt-1.5 text-sm">•</span>
              <span className="flex-1">{renderInlineStyles(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-semibold text-emerald-500 min-w-[1.2rem] text-xs">
                {numMatch[1]}.
              </span>
              <span className="flex-1">{renderInlineStyles(numMatch[2])}</span>
            </div>
          );
        }

        // Regular paragraph line
        return <p key={idx}>{renderInlineStyles(line)}</p>;
      })}
    </div>
  );
}

// ─── Inline Styles & Math Parsing ─────────────────────────────────────────────

export function renderInlineStyles(str: string): React.ReactNode {
  if (!str) return "";

  // Tokens:
  // 1. Math block `$$...$$` inside lines
  // 2. Math inline `$..$` or `\(...\)`
  // 3. Inline code `` `...` ``
  // 4. Bold `**...**`
  // 5. Italic `*...*`
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|`[^`]+?`|\*\*[^*]+?\*\*|\*[^*]+?\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(str)) !== null) {
    if (m.index > lastIndex) {
      parts.push(str.slice(lastIndex, m.index));
    }
    const token = m[0];

    // Display math embedded inline
    if (token.startsWith("$$") && token.endsWith("$$")) {
      const expr = token.slice(2, -2).trim();
      try {
        const html = katex.renderToString(expr, {
          throwOnError: false,
          displayMode: true,
        });
        parts.push(
          <span
            key={m.index}
            className="my-1 block text-center"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        parts.push(<code key={m.index} className="font-mono">{token}</code>);
      }
    }
    // Inline math $...$ or \(...\)
    else if (
      (token.startsWith("$") && token.endsWith("$")) ||
      (token.startsWith("\\(") && token.endsWith("\\)"))
    ) {
      const expr = token.startsWith("$")
        ? token.slice(1, -1).trim()
        : token.slice(2, -2).trim();

      try {
        const html = katex.renderToString(expr, {
          throwOnError: false,
          displayMode: false,
        });
        parts.push(
          <span
            key={m.index}
            className="inline-math px-0.5 align-baseline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        parts.push(<span key={m.index} className="font-mono text-xs">{token}</span>);
      }
    }
    // Inline code `...`
    else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={m.index}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    // Bold **...**
    else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={m.index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }
    // Italic *...*
    else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={m.index} className="italic text-muted-foreground">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = m.index + token.length;
  }

  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }

  return parts.length > 0 ? parts : str;
}

// ─── Block Parser ─────────────────────────────────────────────────────────────

type Block =
  | { type: "code"; lang: string; code: string }
  | { type: "display-math"; math: string }
  | {
      type: "table";
      headers: string[];
      alignments: Array<"left" | "center" | "right">;
      rows: string[][];
    }
  | { type: "text"; text: string };

function parseBlocks(content: string): Block[] {
  if (!content) return [];

  const blocks: Block[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block ```
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: "code",
        lang: lang || "code",
        code: codeLines.join("\n"),
      });
      continue;
    }

    // 2. Display Math Block $$ ... $$
    if (line.trim().startsWith("$$")) {
      const mathLines: string[] = [];
      const singleLine = line.trim().slice(2);
      if (singleLine.endsWith("$$") && singleLine.length > 2) {
        // Single line $$math$$
        blocks.push({
          type: "display-math",
          math: singleLine.slice(0, -2).trim(),
        });
        i++;
        continue;
      } else {
        mathLines.push(singleLine);
        i++;
        while (i < lines.length && !lines[i].trim().endsWith("$$")) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const last = lines[i].trim();
          mathLines.push(last.slice(0, -2));
          i++;
        }
        blocks.push({
          type: "display-math",
          math: mathLines.join("\n").trim(),
        });
        continue;
      }
    }

    // 3. Table detection: Header | Separator | Rows
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith("|") &&
      /^[|\s-:]+$/.test(lines[i + 1].trim()) &&
      lines[i + 1].includes("-")
    ) {
      const headerLine = lines[i].trim();
      const separatorLine = lines[i + 1].trim();
      const headers = headerLine
        .split("|")
        .slice(1, -1)
        .map((s) => s.trim());

      const alignments: Array<"left" | "center" | "right"> = separatorLine
        .split("|")
        .slice(1, -1)
        .map((col) => {
          const c = col.trim();
          if (c.startsWith(":") && c.endsWith(":")) return "center";
          if (c.endsWith(":")) return "right";
          return "left";
        });

      const tableRows: string[][] = [];
      i += 2;

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const rowCells = lines[i]
          .trim()
          .split("|")
          .slice(1, -1)
          .map((s) => s.trim());
        tableRows.push(rowCells);
        i++;
      }

      blocks.push({
        type: "table",
        headers,
        alignments,
        rows: tableRows,
      });
      continue;
    }

    // 4. Regular Text Paragraph
    const textLines: string[] = [];
    while (
      i < lines.length &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("$$") &&
      !(
        lines[i].trim().startsWith("|") &&
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith("|") &&
        /^[|\s-:]+$/.test(lines[i + 1].trim()) &&
        lines[i + 1].includes("-")
      )
    ) {
      textLines.push(lines[i]);
      i++;
    }

    if (textLines.length > 0) {
      blocks.push({
        type: "text",
        text: textLines.join("\n"),
      });
    }
  }

  return blocks;
}
