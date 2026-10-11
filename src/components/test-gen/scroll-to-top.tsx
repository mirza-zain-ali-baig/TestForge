"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating "scroll to top" button. Appears after scrolling down 400px.
 * Hidden during practice mode / dialogs.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="no-print fixed bottom-6 right-6 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-background/90 text-emerald-600 shadow-lg backdrop-blur transition-all hover:bg-emerald-50 hover:shadow-xl dark:border-emerald-800 dark:bg-emerald-950/40"
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
