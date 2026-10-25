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
      className="no-print fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-30 flex h-11 w-11 sm:h-10 sm:w-10 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-md backdrop-blur-md transition-[colors,box-shadow] hover:border-emerald-500 hover:text-emerald-600 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
