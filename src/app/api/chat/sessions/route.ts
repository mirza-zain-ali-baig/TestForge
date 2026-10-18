/**
 * /api/chat/sessions
 *
 * Persists and loads user-scoped AI Chat conversations directly in Supabase
 * tables `app_chat_sessions` and `app_chat_messages`.
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  extractTokenFromRequest,
  authenticateSession,
} from "@/controllers/auth.controller";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = await extractTokenFromRequest(request);
    const user = await authenticateSession(token);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const email = (searchParams.get("email") || user.email).toLowerCase().trim();

    if (!email || email !== user.email.toLowerCase().trim()) {
      return NextResponse.json({ sessions: [] });
    }

    const { data: sessionRows, error: sessErr } = await supabase
      .from("app_chat_sessions")
      .select("*")
      .eq("user_email", email)
      .order("updated_at", { ascending: false });

    if (sessErr || !sessionRows) {
      return NextResponse.json({ sessions: [] });
    }

    const sessionIds = sessionRows.map((s) => s.id);
    let allMessages: Array<{
      id: string;
      session_id: string;
      role: string;
      content: string;
      reasoning?: string | null;
      model_used?: string | null;
      created_at: string;
    }> = [];

    if (sessionIds.length > 0) {
      const { data: msgRows } = await supabase
        .from("app_chat_messages")
        .select("*")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: true });

      if (msgRows) {
        allMessages = msgRows;
      }
    }

    const sessions = sessionRows.map((sess) => {
      const msgs = allMessages
        .filter((m) => m.session_id === sess.id)
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          reasoning: m.reasoning || undefined,
          modelUsed: m.model_used || "ExamForge AI",
          timestamp: new Date(m.created_at).getTime(),
        }));

      return {
        id: sess.id,
        title: sess.title,
        createdAt: new Date(sess.created_at).getTime(),
        updatedAt: new Date(sess.updated_at).getTime(),
        messages: msgs,
        model: "auto",
      };
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load chat history" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const token = await extractTokenFromRequest(request);
    const user = await authenticateSession(token);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { session } = body;

    if (!session || !session.id) {
      return NextResponse.json({ error: "session is required" }, { status: 400 });
    }

    const normalizedEmail = user.email.toLowerCase().trim();
    const nowIso = new Date().toISOString();

    // 1. Upsert session row
    await supabase.from("app_chat_sessions").upsert({
      id: session.id,
      user_email: normalizedEmail,
      title: session.title || "New Conversation",
      updated_at: nowIso,
    });

    // 2. Upsert messages if provided
    if (Array.isArray(session.messages) && session.messages.length > 0) {
      const rows = session.messages.map((m: {
        id: string;
        role: string;
        content: string;
        reasoning?: string;
        modelUsed?: string;
        timestamp?: number;
      }) => ({
        id: m.id,
        session_id: session.id,
        user_email: normalizedEmail,
        role: m.role,
        content: m.content,
        reasoning: m.reasoning || null,
        model_used: m.modelUsed || "ExamForge AI",
        created_at: m.timestamp ? new Date(m.timestamp).toISOString() : nowIso,
      }));

      await supabase.from("app_chat_messages").upsert(rows);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save chat history" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const token = await extractTokenFromRequest(request);
    const user = await authenticateSession(token);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Session id required" }, { status: 400 });
    }

    const normalizedEmail = user.email.toLowerCase().trim();
    const q = supabase
      .from("app_chat_sessions")
      .delete()
      .eq("id", id)
      .eq("user_email", normalizedEmail);
    await q;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete session" },
      { status: 500 }
    );
  }
}
