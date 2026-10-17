import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://hpzuvqoviudcgwqcsdog.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwenV2cW92aXVkY2d3cWNzZG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDA3NDYsImV4cCI6MjEwMTUxNjc0Nn0.9IeE1vncfiezqGc9WWRuny8RiMHTUUVzXziMpabc-Zc";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
