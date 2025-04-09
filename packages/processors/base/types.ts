import type { ReviewAspect, SummaryResponse } from './schema.ts';

/**
 * Summarize result
 * Determines if each file change requires detailed review
 */
export type SummarizeResult = Omit<SummaryResponse, 'summary'> & {
  summary?: string;
  /** Review aspects relevant to this file */
  aspects: ReviewAspect[];
};
