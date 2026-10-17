import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client (server-side only).
 * Reads from the shared question-bank database using the public anon key.
 * All queries are performed inside API routes — never in client components.
 */
const DEFAULT_SUPABASE_URL = "https://hpzuvqoviudcgwqcsdog.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwenV2cW92aXVkY2d3cWNzZG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDA3NDYsImV4cCI6MjEwMTUxNjc0Nn0.9IeE1vncfiezqGc9WWRuny8RiMHTUUVzXziMpabc-Zc";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* ----------------------------- Domain types ----------------------------- */

export type ClassRow = {
  id: string;
  class_name: string;
  created_at: string;
};

export type SubjectRow = {
  id: string;
  class_id: string;
  subject_name: string;
  created_at: string;
};

export type ChapterRow = {
  id: string;
  subject_id: string;
  chapter_number: number;
  chapter_name: string;
  created_at: string;
};

export type TopicRow = {
  id: string;
  chapter_id: string;
  topic_name: string;
  topic_article_no: string;
  created_at: string;
};

export type QuestionTypeRow = { id: string; name: string };
export type DifficultyRow = { id: string; name: string };

export type QuestionRow = {
  id: string;
  subject_id: string;
  chapter_id: string;
  topic_id: string;
  question_type_id: string;
  difficulty_level_id: string;
  question_text: string;
  marks: number;
  created_at: string;
  updated_at: string;
  question_from: string | null;
  blooms_taxonomy: string | null;
  tags: string | null;
};

export type McqOptionRow = {
  id: string;
  question_id: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
};

/* --------------------------- Lookup constants --------------------------- */

export const QUESTION_TYPES = ["MCQ", "Short", "Long"] as const;
export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export type QuestionTypeName = (typeof QUESTION_TYPES)[number];
export type DifficultyName = (typeof DIFFICULTIES)[number];
