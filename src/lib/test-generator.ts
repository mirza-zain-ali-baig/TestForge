/**
 * test-generator.ts — Legacy re-export shim
 *
 * This file previously contained the core test generation logic.
 * It has been refactored into the Controller layer:
 *   src/controllers/test.controller.ts
 *
 * This shim re-exports the public API so any existing imports
 * continue to work without modification.
 *
 * @deprecated Import directly from @/controllers/test.controller
 *             for new code.
 */

export {
  generateTest,
  generateBatch,
} from "@/controllers/test.controller";
