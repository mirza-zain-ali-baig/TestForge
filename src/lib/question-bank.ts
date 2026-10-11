/**
 * question-bank.ts — Legacy re-export shim
 *
 * This file previously contained all question-bank data access.
 * It has been refactored into the Model layer under:
 *   src/models/question.model.ts  — question data access
 *   src/models/lookup.model.ts    — type/difficulty caches
 *
 * This shim re-exports everything so any existing imports continue
 * to work without changes during the architecture migration.
 *
 * @deprecated Import directly from @/models/question.model or
 *             @/models/lookup.model for new code.
 */

export {
  getLookups,
  invalidateLookupCache,
} from "@/models/lookup.model";

export type { Lookups } from "@/models/lookup.model";

export {
  findAllClasses as getClasses,
  findSubjectsByClass as getSubjectsByClass,
  findAllSubjects as getSubjects,
  findChaptersBySubject as getChapters,
  findTopicsByChapters as getTopics,
  findQuestions as getQuestions,
  fetchAllQuestionKeys,
  findMcqOptions as getMcqOptions,
} from "@/models/question.model";

export type { QuestionFilter } from "@/models/question.model";
export type { EnrichedQuestion } from "@/controllers/question.controller";
