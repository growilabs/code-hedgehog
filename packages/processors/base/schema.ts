import { z } from './deps.ts';
// Import ReviewConfig from types.ts
import type { ReviewConfig } from './types.ts';

/**
 * Impact level of changes
 */
export enum ImpactLevel {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

/**
 * Severity level for review comments
 */
export enum SeverityLevel {
  Trivial = 1,
  Minor = 2,
  Major = 3,
  Critical = 4,
  Blocker = 5,
}

/**
 * Response format for triage workflow
 */
export const SummaryResponseSchema = z.object({
  summary: z.string(),
  needsReview: z.boolean(),
  reason: z.string().optional(),
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

export const ReviewAspectSchema = z.object({
  key: z.string(),
  description: z.string(),
  impact: z.nativeEnum(ImpactLevel),
});
export type ReviewAspect = z.infer<typeof ReviewAspectSchema>;

/**
 * Schema for changes grouped by aspects
 */
export const ReviewAspectMappingsSchema = z.object({
  aspect: ReviewAspectSchema,
  files: z.array(z.string()),
});
export type ReviewAspectMappings = z.infer<typeof ReviewAspectMappingsSchema>;

export const OverallSummarySchema = z.object({
  description: z.string(),
  aspectMappings: z.array(ReviewAspectMappingsSchema),
  crossCuttingConcerns: z.array(z.string()).optional(),
});
export type OverallSummary = z.infer<typeof OverallSummarySchema>;

/**
 * Structure for review comments
 */
/**
 * Schema for review comments
 */
export const ReviewCommentSchema = z.object({
  target: z.string(), // Target of the review comment
  issue: z.string(), // Description of the issue
  improvement: z.string(), // Suggested improvement
  line_number: z.number().optional(), // Optional line number reference
  severity: z.nativeEnum(SeverityLevel), // Severity level (Trivial to Blocker)
});
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

/**
 * Response format for review workflow
 */
export const ReviewResponseSchema = z.object({
  comments: z.array(ReviewCommentSchema), // All review comments with confidence scores
  summary: z.string().optional(), // Overall evaluation of changes
});
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

/**
 * Configuration schema for path based instructions
 */
export const PathInstructionSchema = z.object({
  path: z.string(),
  instructions: z.string(),
});

export const FileFilterSchema = z.object({
  exclude: z
    .array(z.string())
    .optional()
    .default(['**/*.min.{js,css}', '**/*.map', '**/node_modules/**', '**/vendor/**'])
    .describe('List of glob patterns to exclude files from review.'),
  max_changes: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe('Maximum number of changes (lines) for a file to be reviewed. Specify 0 for unlimited changes (default: 0).'),
});

export const ConfigSchema = z.object({
  language: z.string().optional(),
  file_path_instructions: z.array(PathInstructionSchema).optional(),
  file_filter: FileFilterSchema.optional(),
  skip_simple_changes: z.boolean().optional().default(false),
  review_diff_since_last_review: z.boolean().optional().default(false),
  // PR level settings
  ignore_draft_prs: z.boolean().optional().default(true),
  ignored_branches: z.array(z.string()).optional().default([]),
  ignored_titles: z.array(z.string()).optional().default([]),
  limit_reviews_by_labels: z.array(z.string()).optional().default([]),
});

export type Config = z.infer<typeof ConfigSchema>;

// Default configuration (Moved from deps.ts, now using ReviewConfig type)
export const DEFAULT_CONFIG: ReviewConfig = {
  language: 'ja-JP',
  path_instructions: [], // Required by core
  file_path_instructions: [], // Local extension
  file_filter: {
    // New default structure
    exclude: ['**/*.min.{js,css}', '**/*.map', '**/node_modules/**', '**/vendor/**', 'yarn.lock', 'deno.lock'],
    max_changes: 500,
  },
  skip_simple_changes: false,
  review_diff_since_last_review: false,
  severityThreshold: 3, // Default threshold for comment severity (1-5)
  // PR level settings
  ignore_draft_prs: false,
  ignored_branches: [],
  ignored_titles: [],
  limit_reviews_by_labels: [],
};
