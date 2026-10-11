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

let lookupsCache: Lookups | null = null;

/**
 * Returns cached (or freshly fetched) lookup maps for question types
 * and difficulty levels. Safe to call concurrently — the cache is set
 * atomically after the first successful fetch.
 */
export async function getLookups(): Promise<Lookups> {
  if (lookupsCache) return lookupsCache;

  const [typesRes, diffRes] = await Promise.all([
    supabase.from("question_types").select("*"),
    supabase.from("difficulty_levels").select("*"),
  ]);

  const types = (typesRes.data as QuestionTypeRow[]) ?? [];
  const difficulties = (diffRes.data as DifficultyRow[]) ?? [];

  lookupsCache = {
    types,
    difficulties,
    byType: Object.fromEntries(types.map((t) => [t.id, t.name])),
    byDifficulty: Object.fromEntries(difficulties.map((d) => [d.id, d.name])),
    typeIdByName: Object.fromEntries(types.map((t) => [t.name, t.id])),
    difficultyIdByName: Object.fromEntries(difficulties.map((d) => [d.name, d.id])),
  };

  return lookupsCache;
}

/** Clears the lookup cache (useful in tests or after schema changes). */
export function invalidateLookupCache(): void {
  lookupsCache = null;
}
