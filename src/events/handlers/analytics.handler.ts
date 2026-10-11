/**
 * analytics.handler.ts — Event-Driven layer / Handler
 *
 * Listens for TEST_SAVED and ANALYTICS_REBUILD_REQUESTED events and
 * performs background analytics bookkeeping:
 *
 *  1. TEST_SAVED — logs the save action and emits ANALYTICS_REBUILD_REQUESTED.
 *  2. ANALYTICS_REBUILD_REQUESTED — logs the stale-cache signal.
 *     (In a production system this would enqueue a cache warm-up job.)
 *
 * Register once at server startup by calling registerAnalyticsHandler().
 */

import { eventBus } from "@/events/event-bus";
import { EVENTS } from "@/events/events";
import type {
  TestSavedPayload,
  AnalyticsRebuildRequestedPayload,
} from "@/events/events";

let registered = false;

export function registerAnalyticsHandler(): void {
  if (registered) return;
  registered = true;

  // ── Handler: test saved ──────────────────────────────────────────────────
  eventBus.on(EVENTS.TEST_SAVED, (payload: TestSavedPayload) => {
    void handleTestSaved(payload);
  });

  // ── Handler: analytics rebuild requested ─────────────────────────────────
  eventBus.on(
    EVENTS.ANALYTICS_REBUILD_REQUESTED,
    (payload: AnalyticsRebuildRequestedPayload) => {
      void handleAnalyticsRebuild(payload);
    }
  );
}

async function handleTestSaved(payload: TestSavedPayload): Promise<void> {
  try {
    console.info(
      `[AnalyticsHandler] Test saved — id="${payload.savedId}" ` +
        `title="${payload.title}" source=${payload.source} ` +
        `marks=${payload.totalMarks} class="${payload.className}" subject="${payload.subjectName}"`
    );

    // Signal analytics cache stale after every save
    eventBus.emit(EVENTS.ANALYTICS_REBUILD_REQUESTED, {
      reason: `Test saved: ${payload.title}`,
    });
  } catch (err) {
    console.error("[AnalyticsHandler] Error handling TEST_SAVED:", err);
  }
}

async function handleAnalyticsRebuild(
  payload: AnalyticsRebuildRequestedPayload
): Promise<void> {
  try {
    // Structured log — in production replace with cache invalidation or
    // a BullMQ job that calls getHistoryStats() and warms a Redis key.
    console.info(
      `[AnalyticsHandler] Analytics rebuild requested — reason="${payload.reason}"`
    );
  } catch (err) {
    console.error("[AnalyticsHandler] Error handling ANALYTICS_REBUILD_REQUESTED:", err);
  }
}
