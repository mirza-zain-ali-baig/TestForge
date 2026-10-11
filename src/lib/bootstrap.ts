/**
 * bootstrap.ts — Server bootstrap
 *
 * Registers all event handlers once when first imported.
 * Import this file at the top of any API route that needs
 * background events wired up.
 *
 * Next.js API routes are module-cached, so this runs only once
 * per server process (not on every request).
 */

import { registerTestGenerationHandler } from "@/events/handlers/test-generation.handler";
import { registerAnalyticsHandler } from "@/events/handlers/analytics.handler";
import { registerAuthHandler } from "@/events/handlers/auth.handler";

let booted = false;

export function bootstrap(): void {
  if (booted) return;
  booted = true;

  registerTestGenerationHandler();
  registerAnalyticsHandler();
  registerAuthHandler();

  console.info("[Bootstrap] Event handlers registered.");
}
