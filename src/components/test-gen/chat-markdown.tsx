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

  try {
    return <ChatMarkdownInner content={content} reasoning={reasoning} isStreaming={isStreaming} />;
  } catch (err) {
    console.warn("ChatMarkdown error, falling back to preformatted text:", err);
    return (
      <div className="whitespace-pre-wrap leading-relaxed text-sm break-words">
        {content}
      </div>
    );
  }
}

function ChatMarkdownInner({ content, reasoning, isStreaming = false }: ChatMarkdownProps) {
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
    <div className="space-y-3 leading-relaxed text-sm break-words max-w-full overflow-hidden">
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
  const [isOpen, setIsOpen] = useState(true);
  const [userToggled, setUserToggled] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const thoughtContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Live timer counting up while thinking
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // While actively streaming, keep open unless user explicitly collapses
  useEffect(() => {
    if (isStreaming && !userToggled) {
      setIsOpen(true);
    }
  }, [isStreaming, userToggled]);

  // Auto-scroll the inner thought box as tokens stream in
  useEffect(() => {
    if (isStreaming && isOpen && thoughtContainerRef.current) {
      thoughtContainerRef.current.scrollTop = thoughtContainerRef.current.scrollHeight;
    }
  }, [thought, isStreaming, isOpen]);

  const wordCount = useMemo(() => {
    return thought.trim().split(/\s+/).filter(Boolean).length;
  }, [thought]);

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-950/20 my-1 overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => {
          setUserToggled(true);
          setIsOpen((prev) => !prev);
        }}
        className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BrainCircuit className={`h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ${isStreaming ? "animate-pulse" : ""}`} />
          <span className="font-semibold truncate">
            {isStreaming
              ? `ExamForge AI is thinking (${seconds}s)...`
              : `Thought Process & Reasoning (${seconds > 0 ? `${seconds}s` : `${wordCount} words`})`}
          </span>
          {isStreaming && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
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
        <div
          ref={thoughtContainerRef}
          className="border-t border-emerald-500/15 p-3.5 text-xs text-muted-foreground/90 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto custom-scrollbar select-text bg-background/50"
        >
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
  const rawLines = text.split("\n");

  // Preprocess lines: if a line is just "1." or "2.", merge it with the subsequent text line even if separated by blank lines
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const curr = rawLines[i].trim();
    if (/^\d+\.$/.test(curr)) {
      let j = i + 1;
      while (j < rawLines.length && !rawLines[j].trim()) j++;
      if (j < rawLines.length && rawLines[j].trim() && !/^\d+\.$/.test(rawLines[j].trim())) {
        lines.push(`${curr} ${rawLines[j].trim()}`);
        i = j;
        continue;
      }
    }
    lines.push(rawLines[i]);
  }

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Horizontal Rule (---, ***, ___)
        if (/^[-*_]{3,}$/.test(trimmed)) {
          return <hr key={idx} className="my-3 border-t border-border" />;
        }

        // Headers: Check from deepest level (######) up to (#)
        if (trimmed.startsWith("###### ")) {
          return (
            <h6 key={idx} className="pt-2 font-bold text-foreground text-xs uppercase tracking-wide">
              {renderInlineStyles(trimmed.slice(7))}
            </h6>
          );
        }
        if (trimmed.startsWith("##### ")) {
          return (
            <h5 key={idx} className="pt-2 font-bold text-foreground text-xs">
              {renderInlineStyles(trimmed.slice(6))}
            </h5>
          );
        }
        if (trimmed.startsWith("#### ")) {
          return (
            <h5 key={idx} className="pt-2 font-bold text-foreground text-sm">
              {renderInlineStyles(trimmed.slice(5))}
            </h5>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="pt-2 font-bold text-foreground text-sm sm:text-base">
              {renderInlineStyles(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="pt-2 text-base sm:text-lg font-bold text-foreground">
              {renderInlineStyles(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="pt-2.5 text-lg sm:text-xl font-bold text-foreground">
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
        const numMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 min-w-[1.4rem] text-xs shrink-0">
                {numMatch[1]}.
              </span>
              <span className="flex-1 leading-relaxed">{renderInlineStyles(numMatch[2])}</span>
            </div>
          );
        }

        // Regular paragraph line
        return <p key={idx} className="leading-relaxed">{renderInlineStyles(line)}</p>;
      })}
    </div>
  );
}

// ─── Inline Styles & Math Parsing ─────────────────────────────────────────────

export function renderInlineStyles(str: string): React.ReactNode {
  if (!str || typeof str !== "string") return typeof str === "number" ? String(str) : "";

  // Tokens:
  // 1. Math block `$$...$$` inside lines
  // 2. Math inline `$..$` or `\(...\)`
  // 3. Inline code `` `...` ``
  // 4. Bold `**...**`
  // 5. Italic `*...*`
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|`[^`]+?`|\*\*[^*]+?\*\*|\*[^*]+?\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(str)) !== null) {
    if (m.index > lastIndex) {
      parts.push(str.slice(lastIndex, m.index));
    }
    const token = m[0];

    // Display math embedded inline: $$...$$ or \[...\]
    if (
      (token.startsWith("$$") && token.endsWith("$$")) ||
      (token.startsWith("\\[") && token.endsWith("\\]"))
    ) {
      const expr = token.slice(2, -2).trim();
      try {
        const html = katex.renderToString(expr, {
          throwOnError: false,
          displayMode: true,
        });
        parts.push(
          <span
            key={m.index}
            className="my-1.5 block text-center overflow-x-auto max-w-full"
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
