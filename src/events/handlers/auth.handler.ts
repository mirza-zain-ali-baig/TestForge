/**
 * auth.handler.ts — Event-Driven layer / Handler
 *
 * Listens for authentication lifecycle events:
 *  - USER_REGISTERED: logs registration audit telemetry
 *  - USER_LOGIN: logs login audit telemetry
 *  - USER_LOGOUT: logs logout audit telemetry
 */

import { eventBus } from "@/events/event-bus";
import { EVENTS } from "@/events/events";
import type {
  UserRegisteredPayload,
  UserLoginPayload,
  UserLogoutPayload,
} from "@/events/events";

let registered = false;

export function registerAuthHandler(): void {
  if (registered) return;
  registered = true;

  eventBus.on(EVENTS.USER_REGISTERED, (payload: UserRegisteredPayload) => {
    try {
      console.info(
        `[AuthHandler] User registered — id="${payload.userId}" email="${payload.email}" role="${payload.role}"`
      );
    } catch (err) {
      console.error("[AuthHandler] Error handling USER_REGISTERED:", err);
    }
  });

  eventBus.on(EVENTS.USER_LOGIN, (payload: UserLoginPayload) => {
    try {
      console.info(
        `[AuthHandler] User logged in — id="${payload.userId}" email="${payload.email}" role="${payload.role}"`
      );
    } catch (err) {
      console.error("[AuthHandler] Error handling USER_LOGIN:", err);
    }
  });

  eventBus.on(EVENTS.USER_LOGOUT, (payload: UserLogoutPayload) => {
    try {
      console.info(
        `[AuthHandler] User logged out — id="${payload.userId}"`
      );
    } catch (err) {
      console.error("[AuthHandler] Error handling USER_LOGOUT:", err);
    }
  });
}
