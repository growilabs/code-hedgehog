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
  message: z.string(), // Important review comment
  suggestion: z.string().optional(), // Optional improvement suggestion
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

export const ConfigSchema = z.object({
  language: z.string().optional(),
  file_path_instructions: z.array(PathInstructionSchema).optional(),
  path_filters: z.string().optional(),
  skip_simple_changes: z.boolean().optional().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

// Default configuration (Moved from deps.ts, now using ReviewConfig type)
export const DEFAULT_CONFIG: ReviewConfig = {
  language: 'en-US',
  path_instructions: [], // Required by core
  file_path_instructions: [], // Local extension
  path_filters: ['!dist/**', '!**/*.min.js', '!**/*.map', '!**/node_modules/**'].join('\n'),
  skip_simple_changes: false,
  severityThreshold: 3, // Default threshold for comment severity (1-5)
};
