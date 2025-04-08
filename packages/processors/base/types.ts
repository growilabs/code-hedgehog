/**
 * Triage result
 * Determines if each file change requires detailed review
 */
export interface TriageResult {
  /** Whether detailed review is needed */
  needsReview: boolean;
  /** Triage reason (e.g. "Format changes only", "Contains logic changes") */
  reason?: string;
  /** Optional summary of changes */
  summary?: string;
}
