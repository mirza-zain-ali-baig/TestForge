/**
 * auth.handler.ts — Event-Driven layer / Handler
 *
 * Listens for authentication and authorization lifecycle events:
 *  - USER_REGISTERED: logs registration audit telemetry
 *  - USER_LOGIN: logs login audit telemetry
 *  - USER_LOGOUT: logs logout audit telemetry
 *  - AUTH_ACCESS_DENIED: logs security warnings when RBAC blocks an action
 */

import { eventBus } from "@/events/event-bus";
import { EVENTS } from "@/events/events";
import type {
  UserRegisteredPayload,
  UserLoginPayload,
  UserLogoutPayload,
  AuthAccessDeniedPayload,
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

  eventBus.on(EVENTS.AUTH_ACCESS_DENIED, (payload: AuthAccessDeniedPayload) => {
    try {
      console.warn(
        `[RBAC Security] Access denied to "${payload.resource}" for user="${payload.email}" (role="${payload.role}"). Required: [${payload.requiredRoles.join(", ")}]`
      );
    } catch (err) {
      console.error("[AuthHandler] Error handling AUTH_ACCESS_DENIED:", err);
    }
  });
}
