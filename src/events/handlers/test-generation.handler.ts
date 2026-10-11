/**
 * test-generation.handler.ts — Event-Driven layer / Handler
 *
 * Listens for TEST_GENERATION_COMPLETED events and performs
 * background work that should not block the HTTP response:
 *
 *  1. Logs generation metadata for observability / audit trail.
 *  2. Emits an ANALYTICS_REBUILD_REQUESTED event so the analytics
 *     cache is marked stale after every generation.
 *
 * This handler is registered once when the module is first imported
 * (side-effect import from the API bootstrap or layout).
 */

import { eventBus } from "@/events/event-bus";
import { EVENTS } from "@/events/events";
import type {
  TestGenerationCompletedPayload,
} from "@/events/events";

let registered = false;

export function registerTestGenerationHandler(): void {
  if (registered) return;
  registered = true;

  eventBus.on(
    EVENTS.TEST_GENERATION_COMPLETED,
    (payload: TestGenerationCompletedPayload) => {
      // Run async work without blocking the caller
      void handleAsync(payload);
    }
  );
}

async function handleAsync(payload: TestGenerationCompletedPayload): Promise<void> {
  try {
    const { test, fromBank, fromAI } = payload;

    // 1. Structured log for observability
    console.info(
      `[TestGenHandler] Test generated — title="${test.title}" ` +
        `questions=${test.totalQuestions} marks=${test.totalMarks} ` +
        `fromBank=${fromBank} fromAI=${fromAI} ` +
        `source=${test.source} at=${test.generatedAt}`
    );

    // 2. Signal analytics cache invalidation
    eventBus.emit(EVENTS.ANALYTICS_REBUILD_REQUESTED, {
      reason: `New test generated: ${test.title}`,
    });
  } catch (err) {
    // Handlers must never crash the caller
    console.error("[TestGenHandler] Error in background handler:", err);
  }
}
