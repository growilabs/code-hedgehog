/**
 * Impact level of changes
 */
export enum ImpactLevel {
  High = "high",
  Medium = "medium",
  Low = "low"
}

/**
 * Review aspect definition
 * Represents a specific focus area or concern for code review
 */
export interface ReviewAspect {
  /** Unique identifier for the aspect */
  key: string;
  /** Human readable description of what this aspect covers */
  description: string;
  /** Priority level for reviewing this aspect (higher number = higher priority) */
  priority: number;
}

/**
 * Summary of changes related to a specific aspect
 */
export interface AspectSummary {
  /** The review aspect this summary relates to */
  aspect: ReviewAspect;
  /** Summary of changes for this aspect */
  summary: string;
  /** Level of impact these changes have */
  impactLevel: ImpactLevel;
}

/**
 * Overall summary of all changes
 */
export interface OverallSummary {
  /** High-level description of the entire change set */
  description: string;
  /** Summaries grouped by review aspect */
  aspectSummaries: AspectSummary[];
  /** Issues that affect multiple aspects */
  crossCuttingConcerns?: string[];
}

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
  /** Review aspects relevant to this file */
  aspects: ReviewAspect[];
}
