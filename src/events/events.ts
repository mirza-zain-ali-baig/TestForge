/**
 * events.ts — Event-Driven layer
 *
 * Central registry of all event names and their payload types.
 * Import EVENTS (the name constants) and EventPayloads (the types)
 * in both emitters (Controllers) and listeners (Handlers).
 *
 * Convention: "domain:action:state"
 *   e.g.  test:generation:completed
 *         test:saved
 *         analytics:rebuild:requested
 */

import type { GenerateTestRequest, GeneratedTest } from "@/lib/types";

// ─── Event name constants ─────────────────────────────────────────────────────

export const EVENTS = {
  /** Fired by TestController after a test is fully generated. */
  TEST_GENERATION_COMPLETED: "test:generation:completed",

  /** Fired by the tests/route after a generated test is persisted to SQLite. */
  TEST_SAVED: "test:saved",

  /** Fired when the analytics cache should be invalidated / rebuilt. */
  ANALYTICS_REBUILD_REQUESTED: "analytics:rebuild:requested",

  /** Fired when a new user signs up. */
  USER_REGISTERED: "user:registered",

  /** Fired when a user logs in. */
  USER_LOGIN: "user:login",

  /** Fired when a user logs out. */
  USER_LOGOUT: "user:logout",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// ─── Payload types ────────────────────────────────────────────────────────────

export type TestGenerationCompletedPayload = {
  test: GeneratedTest;
  request: GenerateTestRequest;
  fromBank: number;
  fromAI: number;
};

export type TestSavedPayload = {
  savedId: string;
  title: string;
  source: string;
  totalMarks: number;
  className: string;
  subjectName: string;
};

export type AnalyticsRebuildRequestedPayload = {
  reason: string;
};

export type UserRegisteredPayload = {
  userId: string;
  email: string;
  name: string | null;
  role: string;
};

export type UserLoginPayload = {
  userId: string;
  email: string;
  role: string;
};

export type UserLogoutPayload = {
  userId: string;
};

/** Union map of event name → payload type (for type-safe listeners). */
export type EventPayloads = {
  [EVENTS.TEST_GENERATION_COMPLETED]: TestGenerationCompletedPayload;
  [EVENTS.TEST_SAVED]: TestSavedPayload;
  [EVENTS.ANALYTICS_REBUILD_REQUESTED]: AnalyticsRebuildRequestedPayload;
  [EVENTS.USER_REGISTERED]: UserRegisteredPayload;
  [EVENTS.USER_LOGIN]: UserLoginPayload;
  [EVENTS.USER_LOGOUT]: UserLogoutPayload;
};
