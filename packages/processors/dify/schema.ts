export interface DifyResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Response format for triage workflow
 */
export interface SummaryResponse {
  summary: string;
  needsReview?: boolean;
  reason?: string;
}

/**
 * Structure for review comments
 */
export interface ReviewComment {
  content: string;
  line?: number;
  suggestion?: string;
}

/**
 * Response format for review workflow
 */
export interface ReviewResponse {
  comments: ReviewComment[];  // Required array of review comments
  summary?: string;  // Optional overall summary
}
