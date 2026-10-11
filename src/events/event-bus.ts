/**
 * event-bus.ts — Event-Driven layer
 *
 * Singleton EventEmitter that acts as the in-process message bus.
 * Handlers subscribe to events from controllers; they run
 * asynchronously and never block the HTTP response.
 *
 * Pattern: Controllers emit events after completing work.
 *          Handlers react to those events in the background.
 *
 * Why in-process?
 *   This is a single-process Next.js app. For production
 *   scale-out, swap this for Redis Pub/Sub or a job queue
 *   (e.g. BullMQ) without changing the Controller emit calls.
 */

import { EventEmitter } from "events";

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners to support many handler registrations
    // without Node.js emitting a MaxListenersExceeded warning.
    this.setMaxListeners(50);
  }

  /**
   * Emits an event and logs any handler errors so they never
   * propagate to the caller (fire-and-forget semantics).
   */
  emitSafe(event: string, payload: unknown): void {
    try {
      this.emit(event, payload);
    } catch (err) {
      console.error(`[EventBus] Unhandled error in handler for "${event}":`, err);
    }
  }
}

// Preserve the singleton across Next.js hot-reloads in development.
const globalForBus = globalThis as unknown as { __examforgeBus?: EventBus };

export const eventBus: EventBus =
  globalForBus.__examforgeBus ?? new EventBus();

if (process.env.NODE_ENV !== "production") {
  globalForBus.__examforgeBus = eventBus;
}
