import { z } from './deps.ts';

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
