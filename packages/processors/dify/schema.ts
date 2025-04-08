import { z } from './deps.ts';
import { ImpactLevel } from '../base/types.ts';

// Dify API Response Schema
export const DifyResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    })
  ),
});

export type DifyResponse = z.infer<typeof DifyResponseSchema>;


/**
 * Response format for triage workflow
 */
export const SummaryResponseSchema = z.object({
  summary: z.string(),
  needsReview: z.boolean().optional(),
  reason: z.string().optional(),
});

export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

/**
 * Schema for review aspects
 */
export const ReviewAspectSchema = z.object({
  key: z.string(),
  description: z.string(),
  priority: z.number(),
});

/**
 * Review aspect definition
 * Represents a specific focus area or concern for code review
 * 
 * @param key - Unique identifier for the aspect
 * @param description - Human-readable description of what this aspect covers
 * @param priority - Priority level for reviewing this aspect (higher number = higher priority)
 */
export type ReviewAspect = z.infer<typeof ReviewAspectSchema>;


/**
 * Schema for grouping workflow response
 * Contains a description and aspect mappings
 */
const ReviewAspectMappingsSchema = z.object({
  aspect: ReviewAspectSchema,
  summary: z.string(),
  impactLevel: z.nativeEnum(ImpactLevel),
  files: z.array(z.string()),  // Files related to this aspect (only used in grouping response)
});

/**
 * Response format for grouping workflow
 */
export const GroupingResponseSchema = z.object({
  description: z.string(),
  aspectMappins: z.array(ReviewAspectMappingsSchema),
  crossCuttingConcerns: z.array(z.string()).optional(),
});

export type GroupingResponse = z.infer<typeof GroupingResponseSchema>;

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
