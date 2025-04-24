import { z } from './deps.ts';

/**
 * Impact level of changes
 */
export enum ImpactLevel {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
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
export const ReviewCommentSchema = z.object({
  content: z.string(),
  line: z.number().optional(),
  suggestion: z.string().optional(),
});
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

/**
 * Response format for review workflow
 */
export const ReviewResponseSchema = z.object({
  comments: z.array(ReviewCommentSchema),
  summary: z.string().optional(),
});
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
