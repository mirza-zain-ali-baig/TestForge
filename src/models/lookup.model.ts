/**
 * lookup.model.ts — Model layer
 *
 * Manages in-memory caches for static lookup tables:
 * question_types and difficulty_levels.
 *
 * These are reference data that rarely change and are fetched
 * once per server process lifetime.
 */

import { supabase } from "@/lib/supabase";
import type { QuestionTypeRow, DifficultyRow } from "@/lib/supabase";

export type Lookups = {
  types: QuestionTypeRow[];
  difficulties: DifficultyRow[];
  /** id → name */
  byType: Record<string, string>;
  /** id → name */
  byDifficulty: Record<string, string>;
  /** name → id */
  typeIdByName: Record<string, string>;
  /** name → id */
  difficultyIdByName: Record<string, string>;
};

const DEFAULT_LOOKUPS: Lookups = {
  types: [
    { id: "adcc43f1-f0a9-4940-bf76-b6873367813a", name: "MCQ" },
    { id: "551873ca-f74c-4aeb-bc87-b8bde11effdd", name: "Short" },
    { id: "a93094e3-38ed-4822-84b5-4660f43d3443", name: "Long" },
  ],
  difficulties: [
    { id: "aeeda179-d03f-4d48-a5b5-80c27d6867bd", name: "Easy" },
    { id: "a650cd57-82e4-4f34-835d-61737058f19d", name: "Medium" },
    { id: "e10f8404-b392-460b-8a8d-1ce4ab388397", name: "Hard" },
  ],
  byType: {
    "adcc43f1-f0a9-4940-bf76-b6873367813a": "MCQ",
    "551873ca-f74c-4aeb-bc87-b8bde11effdd": "Short",
    "a93094e3-38ed-4822-84b5-4660f43d3443": "Long",
  },
  byDifficulty: {
    "aeeda179-d03f-4d48-a5b5-80c27d6867bd": "Easy",
    "a650cd57-82e4-4f34-835d-61737058f19d": "Medium",
    "e10f8404-b392-460b-8a8d-1ce4ab388397": "Hard",
  },
  typeIdByName: {
    MCQ: "adcc43f1-f0a9-4940-bf76-b6873367813a",
    Short: "551873ca-f74c-4aeb-bc87-b8bde11effdd",
    Long: "a93094e3-38ed-4822-84b5-4660f43d3443",
  },
  difficultyIdByName: {
    Easy: "aeeda179-d03f-4d48-a5b5-80c27d6867bd",
    Medium: "a650cd57-82e4-4f34-835d-61737058f19d",
    Hard: "e10f8404-b392-460b-8a8d-1ce4ab388397",
  },
};

let lookupsCache: Lookups = DEFAULT_LOOKUPS;

/**
 * Returns pre-seeded lookup maps for question types and difficulty levels (0ms).
 */
export async function getLookups(): Promise<Lookups> {
  return lookupsCache;
}

/** Clears the lookup cache (useful in tests or after schema changes). */
export function invalidateLookupCache(): void {
  lookupsCache = null;
}
